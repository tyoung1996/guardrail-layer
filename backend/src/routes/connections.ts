import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "../prisma/client.js";
import { Client as PgClient } from "pg";
// @ts-ignore
import mssql from "mssql";
import Database from "better-sqlite3";

import { PrismaClient } from "@prisma/client";

function buildActor(req: any) {
  return {
    userId: (req.user as any)?.userId,
    email: (req.user as any)?.email,
    roles: (req.user as any)?.roles ?? [],
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

function redactConnectionUrl(connectionUrl: string) {
  try {
    const u = new URL(connectionUrl);
    return {
      protocol: u.protocol.replace(":", ""),
      host: u.host,
      database: u.pathname.replace(/^\//, "") || undefined,
      hasPassword: !!u.password,
    };
  } catch {
    return {
      rawLength: connectionUrl.length,
    };
  }
}

function buildConnectionUrlFromRecord(conn: any) {
  if (conn.connectionUrl) return conn.connectionUrl;
  if (!conn.host || !conn.port || !conn.username || !conn.password || !conn.database)
    throw new Error("Missing structured fields");
  if (conn.dbType === "mysql")
    return `mysql://${conn.username}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}${conn.ssl ? "?ssl=true" : ""}`;
  if (conn.dbType === "postgres")
    return `postgresql://${conn.username}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}${conn.ssl ? "?sslmode=require" : ""}`;
  if (conn.dbType === "mssql")
    return `mssql://${conn.username}:${encodeURIComponent(conn.password)}@${conn.host}:${conn.port}/${conn.database}`;
  if (conn.dbType === "sqlite")
    return `file:${conn.database}`;
  throw new Error("Unsupported dbType");
}

export async function connectionRoutes(app: FastifyInstance, prisma: PrismaClient) {
  // POST /connect
app.post("/connect", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
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
app.post("/connections", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const Body = z.object({
      name: z.string().min(1),
      dbType: z.enum(["mysql", "postgres", "mssql", "sqlite"]).default("mysql"),

      host: z.string().optional(),
      port: z.number().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      database: z.string().optional(),
      ssl: z.boolean().optional(),
      extras: z.any().optional(),

      connectionUrl: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const ownerUserId = (req.user as any)?.userId;
    if (!ownerUserId) return reply.code(400).send({ error: "Authenticated user missing" });

    try {
      const finalUrl = buildConnectionUrlFromRecord(parsed.data);
      req.log.info({ msg: "Creating new connection with data", data: parsed.data });
      const created = await prisma.connection.create({
        data: {
          name: parsed.data.name,
          dbType: parsed.data.dbType,
          connectionUrl: finalUrl,
          host: parsed.data.host,
          port: parsed.data.port,
          username: parsed.data.username,
          password: parsed.data.password,
          database: parsed.data.database,
          ssl: parsed.data.ssl,
          extras: parsed.data.extras,
          userId: ownerUserId
        }
      });
      req.log.info(`Connection created with id: ${created.id}`);

      let status = "down";
      let hasWrite = false;
      try {
        if (parsed.data.dbType === "mysql") {
          const mysql = await import("mysql2/promise");
          const pool = mysql.createPool(finalUrl);
          await pool.query("SELECT 1");
          // Permission check for MySQL
          const [grants] = await pool.query("SHOW GRANTS FOR CURRENT_USER()");
          const grantsStr = JSON.stringify(grants);
          hasWrite = /INSERT|UPDATE|DELETE|ALTER|DROP/i.test(grantsStr);
          await pool.end();
          status = "active";
        } else if (parsed.data.dbType === "postgres") {
          const client = new PgClient({ connectionString: finalUrl });
          await client.connect();
          await client.query("SELECT 1");
          // Permission check for Postgres
          const permRes = await client.query(`
            SELECT privilege_type 
            FROM information_schema.role_table_grants
            WHERE grantee = CURRENT_USER;
          `);
          const privileges = permRes.rows.map((r: { privilege_type: string; }) => r.privilege_type.toUpperCase());
          hasWrite = privileges.some((p: string) =>
            ["INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES"].includes(p)
          );
          await client.end();
          status = "active";
        } else if (parsed.data.dbType === "mssql") {
          const cfg = {
            user: parsed.data.username,
            password: parsed.data.password,
            server: parsed.data.host,
            port: parsed.data.port,
            database: parsed.data.database,
            options: { encrypt: true, trustServerCertificate: true },
          };
          const pool = await mssql.connect(cfg);
          await pool.request().query("SELECT 1 as ok");
          // Permission check for MSSQL
          const permRes = await pool.request().query(`
            SELECT * FROM fn_my_permissions(NULL, 'DATABASE');
          `);
          const perms = permRes.recordset.map((r: { permission_name: string; }) => r.permission_name.toUpperCase());
          hasWrite = perms.some((p: string) =>
            ["INSERT","UPDATE","DELETE","ALTER","CONTROL"].includes(p)
          );
          await pool.close();
          status = "active";
        } else if (parsed.data.dbType === "sqlite") {
          const dbPath = parsed.data.database ?? "";
          const db = new Database(dbPath);
          db.prepare("SELECT 1").get();
          // Permission check for SQLite
          hasWrite = false;
          try {
            db.prepare("CREATE TABLE __gr_test (id INTEGER)").run();
            db.prepare("DROP TABLE __gr_test").run();
            hasWrite = true;
          } catch {}
          status = "active";
          db.close();
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

      const actor = buildActor(req);

      try {
        await prisma.auditLog.create({
          data: {
            action: "connection_created",
            connectionId: created.id,
            userId: actor.userId,
            requestId: (req as any).id,
            details: JSON.stringify({
              category: "connection",
              type: "created",
              severity: "info",
              actor,
              before: null,
              after: {
                id: updated.id,
                name: updated.name,
                dbType: updated.dbType,
                status: updated.status,
                lastChecked: updated.lastChecked,
              },
              connectionMetadata: {
                dbType: parsed.data.dbType,
                connection: redactConnectionUrl(finalUrl),
              },
              timestamp: new Date().toISOString(),
            }),
          },
        });
        req.log.info("Audit log created for connection creation");
      } catch (auditError: any) {
        req.log.error("Failed to create audit log for connection creation:", auditError);
      }

      reply.code(201).send({
        ok: true,
        connection: updated,
        warning: hasWrite ? "⚠️ This user has WRITE permissions. Guardrail Layer recommends using a READ‑ONLY user." : null
      });
    } catch (e: any) {
      req.log.error(e, undefined);
      return reply.code(500).send({ error: e.message });
    }
  });

// GET /connections — return all connections user can access
app.get("/connections", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
  const userId = (req.user as any)?.userId;
console.log(userId)
  // Admin bypass
  const adminRole = await prisma.userRole.findFirst({
    where: { userId },
    include: { role: true },
  });

  if (adminRole && adminRole.role.name.toLowerCase() === "admin") {
    const allConnections = await prisma.connection.findMany();
    const safeConnections = allConnections.map((c: { password: any; }) => ({
      ...c,
      password: c.password ? "********" : null
    }));
    return reply.send(safeConnections);
  }

  // 1) Get user's roles
  const roles = await prisma.userRole.findMany({
    where: { userId },
    select: { roleId: true },
  });

  const roleIds = roles.map((r: { roleId: string }): string => {
    return r.roleId;
  });

  // 2) Get connection IDs allowed for those roles
  const allowed = await prisma.connectionPermission.findMany({
    where: { roleId: { in: roleIds } },
    select: { connectionId: true },
  });

  const allowedConnectionIds = allowed.map((p: { connectionId: string }): string => {
    return p.connectionId;
  });

  // 3) Fetch all connections:
  const connections = await prisma.connection.findMany({
    where: {
      OR: [
        { userId }, // connections owned by user
        { id: { in: allowedConnectionIds } }, // connections allowed by roles
      ],
    },
  });

  const safeConnections = connections.map((c: { password: any; }) => ({
    ...c,
    password: c.password ? "********" : null
  }));
  return reply.send(safeConnections);
});

  // GET /schema/:connectionId
  app.get<{ Params: { connectionId: string } }>("/schema/:connectionId", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const { connectionId } = req.params;
    const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!connection) return reply.code(404).send({ error: "Connection not found" });

    const dbType = connection.dbType;
    const connectionUrl = buildConnectionUrlFromRecord(connection);
    let schema: { table: string; name: string }[] = [];

    try {
      if (dbType === "mysql") {
        const mysql = await import("mysql2/promise");
        const pool = mysql.createPool(connectionUrl);
        const [tables] = await pool.query("SHOW TABLES");
        for (const row of tables as Array<{ [key: string]: string }>) {
          const key = Object.keys(row)[0];
          const table = row[key];
          const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
          for (const col of cols as Array<{ Field: string }>) schema.push({ table, name: col.Field });
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
        for (const r of res.rows as Array<{ table_schema: string; table_name: string; column_name: string }>) {
          schema.push({ table: `${r.table_schema}.${r.table_name}`, name: r.column_name });
        }
        await client.end();
      } else if (dbType === "mssql") {
        const cfg = {
          user: connection.username,
          password: connection.password,
          server: connection.host,
          port: connection.port,
          database: connection.database,
          options: { encrypt: true, trustServerCertificate: true },
        };
        const pool = await mssql.connect(cfg);
        const tablesRes = await pool.request().query(`
          SELECT TABLE_NAME, COLUMN_NAME
          FROM INFORMATION_SCHEMA.COLUMNS
          ORDER BY TABLE_NAME, ORDINAL_POSITION;
        `);
        for (const p of tablesRes.recordset as Array<{ TABLE_NAME: string; COLUMN_NAME: string }>) {
          schema.push({ table: p.TABLE_NAME, name: p.COLUMN_NAME });
        }
        await pool.close();
      } else if (dbType === "sqlite") {
        const db = new Database(connection.database ?? "");

        const tables = db
          .prepare("SELECT name FROM sqlite_master WHERE type='table'")
          .all();

        for (const r of tables as Array<{ name: string }>) {
          const cols = db
            .prepare(`PRAGMA table_info(${r.name})`)
            .all() as Array<{ name: string }>;
          for (const p of cols as Array<{ name: string }>) {
            schema.push({ table: r.name, name: p.name });
          }
        }

        db.close();
      } else {
        return reply.code(400).send({ error: `Unsupported dbType: ${dbType}` });
      }

      return { schema };
    } catch (e: any) {
      req.log.error(e, undefined);
      return reply.code(500).send({ error: e.message });
    }
  });

  // DELETE /connections/:id
  app.delete("/connections/:id", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const existing = await prisma.connection.findUnique({ where: { id } });
    if (!existing) return reply.code(404).send({ error: "Connection not found" });
    const actor = buildActor(req);
    try {
      await prisma.auditLog.create({
        data: {
          action: "connection_deleted",
          userId: actor.userId,
          requestId: (req as any).id,
          details: JSON.stringify({
            category: "connection",
            type: "deleted",
            severity: "warning",
            actor,
            before: {
              id: existing.id,
              name: (existing as any).name,
              dbType: (existing as any).dbType,
              status: (existing as any).status,
              lastChecked: (existing as any).lastChecked,
            },
            after: null,
            timestamp: new Date().toISOString(),
          }),
        },
      });
    } catch (auditError: any) {
      req.log.error("Failed to create audit log for connection deletion:", auditError);
    }
    await prisma.auditLog.updateMany({
      where: { connectionId: id },
      data: { connectionId: null },
    });
    await prisma.connection.delete({ where: { id } });
    return { ok: true, id };
  });

  // POST /connections/test
  app.post("/connections/test", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const Body = z.object({
      dbType: z.enum(["mysql", "postgres", "mssql", "sqlite"]),
      host: z.string().optional(),
      port: z.number().optional(),
      username: z.string().optional(),
      password: z.string().optional(),
      database: z.string().optional(),
      ssl: z.boolean().optional(),
      connectionUrl: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const dbType = parsed.data.dbType;
    const connectionUrl = parsed.data.connectionUrl 
      ? parsed.data.connectionUrl 
      : buildConnectionUrlFromRecord(parsed.data);
    let hasWrite = false;
    try {
      if (dbType === "mysql") {
        const mysql = await import("mysql2/promise");
        const pool = mysql.createPool(connectionUrl);
        await pool.query("SELECT 1");
        // Permission check for MySQL
        const [grants] = await pool.query("SHOW GRANTS FOR CURRENT_USER()");
        const grantsStr = JSON.stringify(grants);
        hasWrite = /INSERT|UPDATE|DELETE|ALTER|DROP/i.test(grantsStr);
        await pool.end();
      } else if (dbType === "postgres") {
        const client = new PgClient({ connectionString: connectionUrl });
        await client.connect();
        await client.query("SELECT 1");
        // Permission check for Postgres
        const permRes = await client.query(`
          SELECT privilege_type 
          FROM information_schema.role_table_grants
          WHERE grantee = CURRENT_USER;
        `);
        const privileges = permRes.rows.map((r: { privilege_type: string; }) => r.privilege_type.toUpperCase());
        hasWrite = privileges.some((p: string) =>
          ["INSERT","UPDATE","DELETE","TRUNCATE","REFERENCES"].includes(p)
        );
        await client.end();
      } else if (dbType === "mssql") {
        const cfg = {
          user: parsed.data.username,
          password: parsed.data.password,
          server: parsed.data.host,
          port: parsed.data.port,
          database: parsed.data.database,
          options: { encrypt: true, trustServerCertificate: true },
        };
        const pool = await mssql.connect(cfg);
        await pool.request().query("SELECT 1 as ok");
        // Permission check for MSSQL
        const permRes = await pool.request().query(`
          SELECT * FROM fn_my_permissions(NULL, 'DATABASE');
        `);
        const perms = permRes.recordset.map((r: { permission_name: string; }) => r.permission_name.toUpperCase());
        hasWrite = perms.some((p: string) =>
          ["INSERT","UPDATE","DELETE","ALTER","CONTROL"].includes(p)
        );
        await pool.close();
      } else if (dbType === "sqlite") {
        const db = new Database(parsed.data.database ?? "");
        db.prepare("SELECT 1").get();
        // Permission check for SQLite
        hasWrite = false;
        try {
          db.prepare("CREATE TABLE __gr_test (id INTEGER)").run();
          db.prepare("DROP TABLE __gr_test").run();
          hasWrite = true;
        } catch {}
        db.close();
      }
      const actor = buildActor(req);
      try {
        await prisma.auditLog.create({
          data: {
            action: "connection_tested",
            userId: actor.userId,
            requestId: (req as any).id,
            details: JSON.stringify({
              category: "connection",
              type: "tested",
              severity: "info",
              actor,
              result: "success",
              connectionMetadata: {
                dbType,
                connection: redactConnectionUrl(connectionUrl),
              },
              timestamp: new Date().toISOString(),
            }),
          },
        });
      } catch (auditError: any) {
        req.log.error("Failed to create audit log for successful connection test:", auditError);
      }
      return {
        ok: true,
        message: "Connection successful ✅",
        warning: hasWrite ? "⚠️ This user has WRITE permissions. Guardrail Layer recommends using a READ‑ONLY user." : null
      };
    } catch (e: any) {
      req.log.error(e, undefined);
      const actor = buildActor(req);
      try {
        await prisma.auditLog.create({
          data: {
            action: "connection_tested",
            userId: actor.userId,
            requestId: (req as any).id,
            details: JSON.stringify({
              category: "connection",
              type: "tested",
              severity: "warning",
              actor,
              result: "failure",
              error: e.message,
              connectionMetadata: {
                dbType,
                connection: redactConnectionUrl(connectionUrl),
              },
              timestamp: new Date().toISOString(),
            }),
          },
        });
      } catch (auditError: any) {
        req.log.error("Failed to create audit log for failed connection test:", auditError);
      }
      return reply.code(400).send({ ok: false, error: e.message });
    }
  });
}