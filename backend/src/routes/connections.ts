import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import { Client as PgClient } from "pg";
import { PrismaClient } from "@prisma/client";

export async function connectionRoutes(app: FastifyInstance, prisma: PrismaClient) {
  // POST /connect
  app.post("/connect", async (req, reply) => {
    const body = (req.body ?? {}) as { databaseUrl?: string };
    const databaseUrl = body.databaseUrl || process.env.DATABASE_URL;
    if (!databaseUrl) return reply.code(400).send({ error: "DATABASE_URL missing" });

    const mysql = await import("mysql2/promise");
    const pool = mysql.createPool(databaseUrl);
    await pool.query("SELECT 1");
    await pool.end();

    return { connected: true };
  });

  // POST /connections
  app.post("/connections", async (req, reply) => {
    const Body = z.object({
      name: z.string().min(1),
      dbType: z.enum(["mysql", "postgres", "mssql", "sqlite"]).default("mysql"),
      connectionUrl: z.string().min(1),
      userId: z.string().min(1),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      req.log.info("Creating new connection with data: ", parsed.data);
      const created = await prisma.connection.create({ data: parsed.data });
      req.log.info(`Connection created with id: ${created.id}`);

      let status = "down";
      try {
        if (parsed.data.dbType === "mysql") {
          const mysql = await import("mysql2/promise");
          const pool = mysql.createPool(parsed.data.connectionUrl);
          await pool.query("SELECT 1");
          await pool.end();
          status = "active";
        } else if (parsed.data.dbType === "postgres") {
          const client = new PgClient({ connectionString: parsed.data.connectionUrl });
          await client.connect();
          await client.query("SELECT 1");
          await client.end();
          status = "active";
        }
      } catch (testError: any) {
        req.log.warn(`Connection test failed for connection id ${created.id}:`, testError);
        status = "down";
      }

      const updated = await prisma.connection.update({
        where: { id: created.id },
        data: {
          status,
          lastChecked: new Date(),
        },
      });

      try {
        await prisma.auditLog.create({
          data: {
            action: "connection_created",
            details: JSON.stringify(parsed.data),
            connectionId: created.id,
          },
        });
        req.log.info("Audit log created for connection creation");
      } catch (auditError: any) {
        req.log.error("Failed to create audit log for connection creation:", auditError);
      }

      reply.code(201).send({ ok: true, connection: updated });
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });

  // GET /connections
  app.get("/connections", async (req, reply) => {
    const Query = z.object({ userId: z.string().optional() });
    const parsed = Query.safeParse(req.query);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const connections = await prisma.connection.findMany({
      where: parsed.data.userId ? { userId: parsed.data.userId } : undefined,
    });
    return connections;
  });

  // GET /schema/:connectionId
  app.get<{ Params: { connectionId: string } }>("/schema/:connectionId", async (req, reply) => {
    const { connectionId } = req.params;
    const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!connection) return reply.code(404).send({ error: "Connection not found" });

    const { dbType, connectionUrl } = connection;
    let schema: { table: string; name: string }[] = [];

    try {
      if (dbType === "mysql") {
        const mysql = await import("mysql2/promise");
        const pool = mysql.createPool(connectionUrl);
        const [tables] = await pool.query("SHOW TABLES");
        for (const row of tables as any[]) {
          const key = Object.keys(row)[0];
          const table = row[key];
          const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
          for (const col of cols as any[]) schema.push({ table, name: col.Field });
        }
        await pool.end();
      } else if (dbType === "postgres") {
        const client = new PgClient({ connectionString: connectionUrl });
        await client.connect();
        const res = await client.query(`
          SELECT table_schema, table_name, column_name
          FROM information_schema.columns
          WHERE table_schema IN ('public')
          ORDER BY table_schema, table_name, ordinal_position;
        `);
        for (const row of res.rows) {
          schema.push({ table: `${row.table_schema}.${row.table_name}`, name: row.column_name });
        }
        await client.end();
      } else {
        return reply.code(400).send({ error: `Unsupported dbType: ${dbType}` });
      }

      return { schema };
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });

  // DELETE /connections/:id
  app.delete("/connections/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.connection.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Connection not found" });
    await prisma.connection.delete({ where: { id } });
    return { ok: true, id };
  });

  // POST /connections/test
  app.post("/connections/test", async (req, reply) => {
    const Body = z.object({
      dbType: z.enum(["mysql", "postgres", "mssql", "sqlite"]),
      connectionUrl: z.string().min(1),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { dbType, connectionUrl } = parsed.data;
    try {
      if (dbType === "mysql") {
        const mysql = await import("mysql2/promise");
        const pool = mysql.createPool(connectionUrl);
        await pool.query("SELECT 1");
        await pool.end();
      } else if (dbType === "postgres") {
        const client = new PgClient({ connectionString: connectionUrl });
        await client.connect();
        await client.query("SELECT 1");
        await client.end();
      }
      await prisma.auditLog.create({
        data: {
          action: "connection_tested",
          details: JSON.stringify({ dbType, connectionUrl }),
        },
      });
      return { ok: true, message: "Connection successful ✅" };
    } catch (e: any) {
      req.log.error(e);
      return reply.code(400).send({ ok: false, error: e.message });
    }
  });
}