// src/routes/query.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import mysql from "mysql2/promise";
import { Client as PgClient } from "pg";

/**
 * Query Routes
 * 
 * Handles:
 * - /query/run (manual SQL execution)
 * - /query (AI-generated query interface helper)
 * 
 * Features:
 * - SQL validation
 * - Redaction rule awareness
 * - Audit logging
 * - Error-safe query execution
 */
export async function queryRoutes(app: FastifyInstance, prisma: PrismaClient) {
  /**
   * Helper: Validate safe SELECT-only queries
   */
  function validateSelectOnly(sql: string) {
    const s = sql.trim().toUpperCase();
    if (!s.startsWith("SELECT")) throw new Error("Only SELECT queries are allowed.");
    if (s.includes(";")) throw new Error("Multiple statements are not permitted.");
    const banned = ["INSERT ", "UPDATE ", "DELETE ", "DROP ", "ALTER ", "TRUNCATE ", "CREATE "];
    if (banned.some(k => s.includes(k))) throw new Error("Write or DDL statements are not allowed.");
  }

  /**
   * POST /query/run
   * Executes a raw SQL query safely.
   */
  app.post("/query/run", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const Body = z.object({
      connectionId: z.string(),
      sql: z.string().min(1),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { connectionId, sql } = parsed.data;
    try {
      validateSelectOnly(sql);
    } catch (err: any) {
      return reply.code(400).send({ error: err.message });
    }

    const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!connection) return reply.code(404).send({ error: "Connection not found" });

    // 🔐 Check permission: Admin bypass OR role-based connection access
    if (!req.user?.isAdmin) {
      const allowed = await prisma.connectionPermission.findMany({
        where: { role: { users: { some: { userId: req.user.userId } } } },
        select: { connectionId: true }
      });

      const allowedIds = allowed.map((a: { connectionId: string }) => a.connectionId);

      if (!allowedIds.includes(connectionId)) {
        return reply.code(403).send({
          error: "Forbidden — you do not have permission to query this connection"
        });
      }
    }

    const { dbType, connectionUrl } = connection;
    let rows: any[] = [];
    const startTime = Date.now();

    try {
      if (dbType === "mysql") {
        const pool = mysql.createPool(connectionUrl);
        const [result] = await pool.query(sql);
        rows = result as any[];
        await pool.end();
      } else if (dbType === "postgres") {
        const client = new PgClient({ connectionString: connectionUrl });
        await client.connect();
        const res = await client.query(sql);
        rows = res.rows;
        await client.end();
      } else {
        throw new Error(`Unsupported dbType: ${dbType}`);
      }

      const executionTime = Date.now() - startTime;

      // 🔒 Determine redactions for this connection
      const redactions = await prisma.redactionRule.findMany({ where: { connectionId } });
      const appliedRules = redactions.length > 0;
      const hiddenColumns = redactions.map((r: any) => `${r.tableName}.${r.columnName}`);

      // Log to audit
      await prisma.auditLog.create({
        data: {
          action: "query_run",
          connectionId,
          details: JSON.stringify({
            sql,
            executionTime,
            redactionsApplied: appliedRules,
            redactedColumns: hiddenColumns,
          }),
        },
      });

      return reply.send({
        rows: rows.slice(0, 100),
        rowCount: rows.length,
        executionTime,
        redactionsApplied: appliedRules,
        hiddenColumns,
      });
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });

  /**
   * POST /query
   * Placeholder for future AI-based query expansion.
   * (Right now, returns a dummy response for compatibility)
   */
  app.post("/query", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const Body = z.object({
      question: z.string(),
      table: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    return reply.send({
      message: "This endpoint will be handled by /chat (AI SQL generator).",
      received: parsed.data,
    });
  });
}