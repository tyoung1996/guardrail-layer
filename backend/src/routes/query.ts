// src/routes/query.ts
import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import mysql from "mysql2/promise";
import { Client as PgClient } from "pg";
// @ts-ignore
import mssql from "mssql";
import Database from "better-sqlite3";

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
    if (banned.some((k) => s.includes(k))) throw new Error("Write or DDL statements are not allowed.");
  }

  function buildActor(req: any) {
    const u = req.user as any;
    return {
      userId: u?.userId ?? null,
      email: u?.email ?? null,
      roles: u?.roles ?? [],
      ip: req.ip,
      userAgent: req.headers["user-agent"],
    };
  }

  async function audit(
    prisma: PrismaClient,
    req: any,
    params: {
      action: string;
      category: string;
      type: string;
      severity: "info" | "warning" | "critical";
      connectionId?: string;
      sql?: string;
      executionTime?: number;
      rowCount?: number;
      redactionsApplied?: boolean;
      redactedColumns?: string[];
      error?: any;
      details?: any;
    }
  ) {
    try {
      const actor = buildActor(req);
      await prisma.auditLog.create({
        data: {
          action: params.action,
          userId: actor.userId,
          connectionId: params.connectionId ?? null,
          requestId: req.id,
          details: JSON.stringify({
            ...params,
            actor,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } catch (err) {
      req.log?.error?.("Failed to log audit for query:", err);
    }
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

    const dbType = connection.dbType;
    let rows: any[] = [];
    const startTime = Date.now();

    try {
      if (dbType === "mysql") {
        const pool = connection.connectionUrl
          ? mysql.createPool(connection.connectionUrl)
          : mysql.createPool({
              host: connection.host!,
              port: connection.port!,
              user: connection.username!,
              password: connection.password!,
              database: connection.database!,
            });
        const [result] = await pool.query(sql);
        rows = result as any[];
        await pool.end();
      } else if (dbType === "postgres") {
        const client = connection.connectionUrl
          ? new PgClient({ connectionString: connection.connectionUrl })
          : new PgClient({
              host: connection.host!,
              port: connection.port!,
              user: connection.username!,
              password: connection.password!,
              database: connection.database!,
            });
        await client.connect();
        const res = await client.query(sql);
        rows = res.rows;
        await client.end();
      } else if (dbType === "mssql") {
        const pool = await mssql.connect({
          user: connection.username!,
          password: connection.password!,
          server: connection.host!,
          port: connection.port!,
          database: connection.database!,
          options: { encrypt: true, trustServerCertificate: true },
        });
        const result = await pool.request().query(sql);
        rows = result.recordset as any[];
        await pool.close();
      } else if (dbType === "sqlite") {
        const dbPath = connection.database!;
        const db = new Database(dbPath);
        try {
          const stmt = db.prepare(sql);
          rows = stmt.all();
        } finally {
          db.close();
        }
      } else {
        throw new Error(`Unsupported dbType: ${dbType}`);
      }

      const executionTime = Date.now() - startTime;

      // 🔒 Determine redactions for this connection
      const redactions = await prisma.redactionRule.findMany({ where: { connectionId } });
      const appliedRules = redactions.length > 0;
      const hiddenColumns = redactions.map((r: any) => `${r.tableName}.${r.columnName}`);

      await audit(prisma, req, {
        action: "query_run",
        category: "query",
        type: "run_manual_sql",
        severity: "info",
        connectionId,
        sql,
        executionTime,
        rowCount: rows.length,
        redactionsApplied: appliedRules,
        redactedColumns: hiddenColumns,
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
      await audit(prisma, req, {
        action: "query_error",
        category: "query",
        type: "run_manual_sql",
        severity: "critical",
        connectionId,
        sql,
        error: e.message,
      });
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