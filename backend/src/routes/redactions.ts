// src/routes/redactions.ts
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

// Correct RBAC helper — aligns with global auth strategy
async function requireRole(req: any, reply: any, prisma: PrismaClient, requiredRole: string) {
  const user = req.user;

  // 1. Super Admin bypass
  if (user?.isAdmin) return true;

  // 2. Check assigned roles from DB
  const roles = await prisma.userRole.findMany({
    where: { userId: user?.userId },
    include: { role: true }
  });

  const roleNames = roles.map((r) => r.role.name.toLowerCase());

  if (!roleNames.includes(requiredRole.toLowerCase())) {
    reply.code(403).send({ error: `Forbidden — requires role: ${requiredRole}` });
    return false;
  }

  return true;
}

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
  app.get("/redactions/:connectionId", { preHandler: (app as any).auth }, async (req, reply) => {
    const { connectionId } = req.params as any;
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
  app.post("/redactions", { preHandler: (app as any).auth }, async (req, reply) => {
    // Only admins can create or modify redactions
    if (!await requireRole(req, reply, prisma, "admin")) return;

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
  app.delete("/redactions/:id", { preHandler: (app as any).auth }, async (req, reply) => {
    // Only admins can delete individual redactions
    if (!await requireRole(req, reply, prisma, "admin")) return;

    const { id } = req.params as any;
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
  app.delete("/redactions/clear", { preHandler: (app as any).auth }, async (req, reply) => {
    // Only admins can clear redactions
    if (!await requireRole(req, reply, prisma, "admin")) return;

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
  app.post("/redactions/table", { preHandler: (app as any).auth }, async (req, reply) => {
    // Only admins can apply table-wide redactions
    if (!await requireRole(req, reply, prisma, "admin")) return;

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
    global.get("/redactions/global", { preHandler: (app as any).auth }, async (req, reply) => {
      // Only admins can list global redactions
      if (!await requireRole(req, reply, prisma, "admin")) return;

      try {
        const rules = await prisma.globalPatternRule.findMany({ orderBy: { createdAt: "desc" } });
        return reply.send(rules);
      } catch (e: any) {
        await logAudit(prisma, "redaction_error", `Error listing global patterns: ${e.message}`);
        return reply.code(500).send({ error: e.message });
      }
    });

    /** Create or update a global regex rule */
    global.post("/redactions/global", { preHandler: (app as any).auth }, async (req, reply) => {
      // Only admins can create global redactions
      if (!await requireRole(req, reply, prisma, "admin")) return;

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
    global.delete("/redactions/global/:id", { preHandler: (app as any).auth }, async (req, reply) => {
      // Only admins can delete global redactions
      if (!await requireRole(req, reply, prisma, "admin")) return;

      const { id } = req.params as any;
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
  /** -------------------------------
   * ROLE-LEVEL REDACTION RULES
   * ------------------------------- */

  /** List role redactions for a connection */
  app.get("/redactions/role/:connectionId", { preHandler: (app as any).auth }, async (req, reply) => {
    if (!await requireRole(req, reply, prisma, "admin")) return;

    const { connectionId } = req.params as any;
    try {
      const rules = await prisma.roleRedaction.findMany({
        where: { connectionId },
        include: { role: true }
      });
      return reply.send(rules);
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });

  /** Create or update a role-level redaction */
  app.post("/redactions/role", { preHandler: (app as any).auth }, async (req, reply) => {
    if (!await requireRole(req, reply, prisma, "admin")) return;

    const Body = z.object({
      connectionId: z.string(),
      roleId: z.string(),
      rules: z.any()
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { connectionId, roleId, rules } = parsed.data;

    try {
      const upsert = await prisma.roleRedaction.upsert({
        where: { roleId_connectionId: { roleId, connectionId } },
        update: { rules },
        create: { roleId, connectionId, rules }
      });
      return reply.send(upsert);
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });

  /** Delete a role-level redaction */
  app.delete("/redactions/role/:id", { preHandler: (app as any).auth }, async (req, reply) => {
    if (!await requireRole(req, reply, prisma, "admin")) return;

    const { id } = req.params as any;
    try {
      await prisma.roleRedaction.delete({ where: { id } });
      return reply.send({ ok: true });
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });
}