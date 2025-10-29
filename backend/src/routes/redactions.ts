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

  /** List redaction rules for a specific connection */
  app.get<{ Params: { connectionId: string } }>("/redactions/:connectionId", async (req, reply) => {
    const { connectionId } = req.params;
    try {
      const rules = await prisma.redactionRule.findMany({ where: { connectionId } });
      return reply.send(rules);
    } catch (e: any) {
      req.log.error(e);
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
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const data = parsed.data;
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
        await prisma.auditLog.create({
          data: {
            action: "redaction_deleted",
            details: JSON.stringify(data),
            connectionId: data.connectionId,
          },
        });
        return reply.send({ ok: true, removed: result.count });
      }

      // Create rule
      const rule = await prisma.redactionRule.create({ data });
      await prisma.auditLog.create({
        data: {
          action: "redaction_created",
          details: JSON.stringify(data),
          connectionId: data.connectionId,
        },
      });

      return reply.send(rule);
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });

  /** Delete a redaction rule by ID */
  app.delete<{ Params: { id: string } }>("/redactions/:id", async (req, reply) => {
    const { id } = req.params;
    try {
      await prisma.redactionRule.delete({ where: { id } });
      await prisma.auditLog.create({
        data: { action: "redaction_deleted", details: id },
      });
      return reply.send({ ok: true });
    } catch (e: any) {
      req.log.error(e);
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
      await prisma.auditLog.create({
        data: {
          action: "redactions_cleared",
          details: connectionId ?? "global",
          connectionId: connectionId ?? null,
        },
      });
      return reply.send({
        ok: true,
        deleted: result.count,
        scope: connectionId ? "connection" : "global",
      });
    } catch (e: any) {
      req.log.error(e);
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
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

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

      await prisma.auditLog.create({
        data: {
          action: "redaction_table_applied",
          details: JSON.stringify({ tableName, ruleType }),
          connectionId,
        },
      });

      return reply.send({
        ok: true,
        message: `Applied ${ruleType} to all columns in ${tableName}`,
        count: columns.length,
      });
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });
}