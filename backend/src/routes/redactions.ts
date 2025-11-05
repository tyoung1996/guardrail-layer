// src/routes/redactions.ts
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

/**
 * Handles all /redactions routes
 * 
 * - GET /redactions/:connectionId
 * - POST /redactions
 * - DELETE /redactions/:id
 * - DELETE /redactions/clear
 * - POST /redactions/table
 */
export async function redactionRoutes(app: FastifyInstance, prisma: PrismaClient) {

  async function logAudit(prisma: PrismaClient, action: string, details: string, connectionId?: string | null) {
    try {
      await prisma.auditLog.create({
        data: { action, details, connectionId: connectionId ?? null },
      });
    } catch (err) {
      console.error("Failed to log audit:", err);
    }
  }

  /** List redaction rules for a specific connection */
  app.get<{ Params: { connectionId: string } }>("/redactions/:connectionId", async (req, reply) => {
    const { connectionId } = req.params;
    try {
      const rules = await prisma.redactionRule.findMany({ where: { connectionId } });
      return reply.send(rules);
    } catch (e: any) {
      req.log.error(e);
      await logAudit(prisma, "redaction_error", `Error listing redactions: ${e.message}`, connectionId);
      return reply.code(500).send({ error: e.message });
    }
  });

  /** Create or update a redaction rule */
  app.post("/redactions", async (req, reply) => {
    const Body = z.object({
      connectionId: z.string(),
      tableName: z.string(),
      columnName: z.string(),
      ruleType: z.enum(["REDACT", "MASK_EMAIL", "REMOVE", "HASH", "EXPOSE"]),
      replacement: z.string().optional(),
      pattern: z.string().optional(),
      role: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      await logAudit(prisma, "redaction_error", `Invalid request body: ${JSON.stringify(parsed.error.flatten())}`);
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const data = parsed.data;

    if (data.pattern) {
      try {
        new RegExp(data.pattern);
      } catch {
        await logAudit(prisma, "redaction_error", `Invalid regex pattern: ${data.pattern}`, data.connectionId);
        return reply.code(400).send({ error: "Invalid regex pattern" });
      }
    }

    const allowedRoles = ["admin", "analyst", "viewer"];
    if (data.role && !allowedRoles.includes(data.role.toLowerCase())) {
      await logAudit(prisma, "redaction_error", `Invalid role specified: ${data.role}`, data.connectionId);
      return reply.code(400).send({ error: "Invalid role specified" });
    }

    try {
      // Remove rule if EXPOSE
      if (data.ruleType === "EXPOSE") {
        const result = await prisma.redactionRule.deleteMany({
          where: {
            connectionId: data.connectionId,
            tableName: { equals: data.tableName, mode: "insensitive" },
            columnName: { equals: data.columnName, mode: "insensitive" },
          },
        });
        await logAudit(prisma, "redaction_deleted", `Rule: ${data.ruleType}, Table: ${data.tableName}, Column: ${data.columnName}, Pattern: ${data.pattern ?? "N/A"}, Role: ${data.role ?? "any"}`, data.connectionId);
        return reply.send({ ok: true, removed: result.count });
      }

      // Create rule
      const rule = await prisma.redactionRule.create({ data });
      await logAudit(prisma, "redaction_created", `Rule: ${data.ruleType}, Table: ${data.tableName}, Column: ${data.columnName}, Pattern: ${data.pattern ?? "N/A"}, Role: ${data.role ?? "any"}`, data.connectionId);

      return reply.send(rule);
    } catch (e: any) {
      req.log.error(e);
      await logAudit(prisma, "redaction_error", `Exception: ${e.message}`, data.connectionId);
      return reply.code(500).send({ error: e.message });
    }
  });

  /** Delete a redaction rule by ID */
  app.delete<{ Params: { id: string } }>("/redactions/:id", async (req, reply) => {
    const { id } = req.params;
    try {
      const rule = await prisma.redactionRule.findUnique({ where: { id } });
      await prisma.redactionRule.delete({ where: { id } });
      await logAudit(prisma, "redaction_deleted", `Rule ID: ${id}, Table: ${rule?.tableName ?? "N/A"}, Column: ${rule?.columnName ?? "N/A"}, RuleType: ${rule?.ruleType ?? "N/A"}, Pattern: ${rule?.pattern ?? "N/A"}, Role: ${rule?.role ?? "any"}`, rule?.connectionId);
      return reply.send({ ok: true });
    } catch (e: any) {
      req.log.error(e);
      await logAudit(prisma, "redaction_error", `Exception deleting rule ID ${id}: ${e.message}`);
      return reply.code(500).send({ error: e.message });
    }
  });

  /** Clear all redactions (globally or by connection) */
  app.delete("/redactions/clear", async (req, reply) => {
    const { connectionId } = (req.body ?? {}) as { connectionId?: string };
    try {
      const result = connectionId
        ? await prisma.redactionRule.deleteMany({ where: { connectionId } })
        : await prisma.redactionRule.deleteMany({});
      await logAudit(prisma, "redactions_cleared", `Scope: ${connectionId ?? "global"}`, connectionId ?? null);
      return reply.send({
        ok: true,
        deleted: result.count,
        scope: connectionId ? "connection" : "global",
      });
    } catch (e: any) {
      req.log.error(e);
      await logAudit(prisma, "redaction_error", `Exception clearing redactions: ${e.message}`, connectionId ?? null);
      return reply.code(500).send({ error: e.message });
    }
  });

  /** Apply a rule to an entire table (all columns) */
  app.post("/redactions/table", async (req, reply) => {
    const Body = z.object({
      connectionId: z.string(),
      tableName: z.string(),
      ruleType: z.enum(["REDACT", "MASK_EMAIL", "REMOVE", "HASH"]),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      await logAudit(prisma, "redaction_error", `Invalid request body for table apply: ${JSON.stringify(parsed.error.flatten())}`);
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { connectionId, tableName, ruleType } = parsed.data;

    try {
      const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
      if (!connection) return reply.code(404).send({ error: "Connection not found" });

      let columns: string[] = [];
      if (connection.dbType === "mysql") {
        const mysql = await import("mysql2/promise");
        const pool = mysql.createPool(connection.connectionUrl);
        const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
        columns = (cols as any[]).map((c) => c.Field);
        await pool.end();
      } else if (connection.dbType === "postgres") {
        const { Client } = await import("pg");
        const client = new Client({ connectionString: connection.connectionUrl });
        await client.connect();
        const res = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
          [tableName]
        );
        columns = res.rows.map((r) => r.column_name);
        await client.end();
      }

      if (columns.length === 0) return reply.code(404).send({ error: "No columns found" });

      await prisma.redactionRule.deleteMany({ where: { connectionId, tableName } });
      const data = columns.map((c) => ({ connectionId, tableName, columnName: c, ruleType }));
      await prisma.redactionRule.createMany({ data });

      await logAudit(prisma, "redaction_table_applied", `Applied rule: ${ruleType} to table: ${tableName}`, connectionId);

      return reply.send({
        ok: true,
        message: `Applied ${ruleType} to all columns in ${tableName}`,
        count: columns.length,
      });
    } catch (e: any) {
      req.log.error(e);
      await logAudit(prisma, "redaction_error", `Exception applying table rule: ${e.message}`, connectionId);
      return reply.code(500).send({ error: e.message });
    }
  });

  /** Manage global regex-based redaction patterns */
  app.register(async (global) => {
    /** List all global regex rules */
    global.get("/redactions/global", async (_req, reply) => {
      try {
        const rules = await prisma.globalPatternRule.findMany({ orderBy: { createdAt: "desc" } });
        return reply.send(rules);
      } catch (e: any) {
        await logAudit(prisma, "redaction_error", `Error listing global patterns: ${e.message}`);
        return reply.code(500).send({ error: e.message });
      }
    });

    /** Create or update a global regex rule */
    global.post("/redactions/global", async (req, reply) => {
      const Body = z.object({
        connectionId: z.string().optional(),
        name: z.string(),
        pattern: z.string(),
        replacement: z.string().optional(),
        role: z.string().optional(),
        isActive: z.boolean().optional(),
      });
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) {
        await logAudit(prisma, "redaction_error", `Invalid global pattern request body: ${JSON.stringify(parsed.error.flatten())}`);
        return reply.code(400).send({ error: parsed.error.flatten() });
      }

      const data = parsed.data;
      try {
        new RegExp(data.pattern);
      } catch {
        await logAudit(prisma, "redaction_error", `Invalid global regex pattern: ${data.pattern}`, data.connectionId ?? null);
        return reply.code(400).send({ error: "Invalid regex pattern" });
      }

      try {
        const rule = await prisma.globalPatternRule.create({ data });
        await logAudit(prisma, "global_redaction_created", `Pattern: ${data.pattern}, Role: ${data.role ?? "any"}, Replacement: ${data.replacement ?? "***REDACTED***"}`, data.connectionId ?? null);
        return reply.send(rule);
      } catch (e: any) {
        await logAudit(prisma, "redaction_error", `Exception creating global pattern: ${e.message}`, data.connectionId ?? null);
        return reply.code(500).send({ error: e.message });
      }
    });

    /** Delete a global regex rule */
    global.delete<{ Params: { id: string } }>("/redactions/global/:id", async (req, reply) => {
      const { id } = req.params;
      try {
        const rule = await prisma.globalPatternRule.findUnique({ where: { id } });
        await prisma.globalPatternRule.delete({ where: { id } });
        await logAudit(prisma, "global_redaction_deleted", `Pattern: ${rule?.pattern ?? "N/A"}, Role: ${rule?.role ?? "any"}, Replacement: ${rule?.replacement ?? "***REDACTED***"}`, rule?.connectionId ?? null);
        return reply.send({ ok: true });
      } catch (e: any) {
        await logAudit(prisma, "redaction_error", `Exception deleting global pattern ID ${id}: ${e.message}`);
        return reply.code(500).send({ error: e.message });
      }
    });
  });
}