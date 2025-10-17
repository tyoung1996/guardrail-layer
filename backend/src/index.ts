// src/index.ts
import 'dotenv/config';
import Fastify from 'fastify';
import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import { z } from 'zod';
import OpenAI from 'openai';
import { initializeGuardrailsDB } from './initGuardrailsDB.js';
import { Client as PgClient } from 'pg';

// ================== Types for Schema ==================
type RealSchema = Record<string, { columns: Array<{ name: string; type: string }> }>;

// ================== Live Connection Health Checker ==================
async function checkConnectionHealth() {
  try {
    const connections = await prisma.connection.findMany();
    const now = new Date();
    for (const conn of connections) {
      let status: "active" | "down" = "down";
      try {
        if (conn.dbType === "mysql") {
          const mysql = await import("mysql2/promise");
          const pool = mysql.createPool(conn.connectionUrl);
          await pool.query("SELECT 1");
          await pool.end();
          status = "active";
        } else if (conn.dbType === "postgres") {
          const client = new PgClient({ connectionString: conn.connectionUrl });
          await client.connect();
          await client.query("SELECT 1");
          await client.end();
          status = "active";
        } else {
          status = "down";
        }
      } catch (e) {
        status = "down";
      }
      await prisma.connection.update({
        where: { id: conn.id },
        data: {
          status,
          lastChecked: now
        }
      });
    }
    console.log("🩺 Connection status check complete");
  } catch (e) {
    console.error("Error in connection health check:", e);
  }
}

setInterval(checkConnectionHealth, 60_000);
const prisma = await initializeGuardrailsDB();

const PORT = Number(process.env.PORT || 8080);
const SCHEMA_WHITELIST = (process.env.SCHEMA_WHITELIST ?? 'public')
  .split(',')
  .map(s => s.trim());

/** ============ DB POOL (set later via /connect or env) ============ */
let pool: mysql.Pool | null = null;
function ensurePool() {
  if (!pool) throw new Error("Database not connected. POST /connect or set DATABASE_URL");
  return pool;
}

/** ============ OpenAI (optional for NL->SQL) ============ */
const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

/** ============ Types ============ */
type QueryRows = RowDataPacket[];
type ColumnRule = 'EXPOSE' | 'REDACT' | 'MASK_EMAIL';
type TableGuardrail = Record<string, ColumnRule>;
const guardrails = new Map<string, TableGuardrail>();

/** ============ Schema Cache ============ */
const schemaCache = new Map<string, { schema: any; timestamp: number }>();
const SCHEMA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/** ============ Helper: Get REAL schema from actual database ============ */
async function getRealSchema(connection: any) {
  // Check cache first
  const cacheKey = connection.id;
  const cached = schemaCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < SCHEMA_CACHE_TTL) {
    return cached.schema;
  }

  const { dbType, connectionUrl } = connection;
  const schema: Record<string, { columns: Array<{ name: string; type: string }> }> = {};

  if (dbType === 'mysql') {
    const mysql = await import('mysql2/promise');
    const pool = mysql.createPool(connectionUrl);
    
    const [tables] = await pool.query('SHOW TABLES');
    const tableNames = (tables as any[]).map(row => Object.values(row)[0] as string);
    
    for (const table of tableNames) {
      const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
      schema[table] = {
        columns: (cols as any[]).map(c => ({
          name: c.Field,
          type: c.Type
        }))
      };
    }
    await pool.end();
  } else if (dbType === 'postgres') {
    const { Client } = await import('pg');
    const client = new Client({ connectionString: connectionUrl });
    await client.connect();
    
    const schemaWhitelist = (process.env.SCHEMA_WHITELIST ?? 'public')
      .split(',')
      .map(s => s.trim());
    
    const res = await client.query(
      `
      SELECT table_name, column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = ANY($1)
      ORDER BY table_name, ordinal_position
      `,
      [schemaWhitelist]
    );
    
    for (const row of res.rows) {
      const tableName = row.table_name;
      if (!schema[tableName]) {
        schema[tableName] = { columns: [] };
      }
      schema[tableName].columns.push({
        name: row.column_name,
        type: row.data_type
      });
    }
    await client.end();
  }
  
  // Cache the schema
  schemaCache.set(cacheKey, { schema, timestamp: Date.now() });
  
  return schema;
}

/** ============ Helper: Detect relationships from actual schema ============ */
function detectRelationships(schema: Record<string, { columns: Array<{ name: string; type: string }> }>) {
  const relationships: Array<{ from: string; to: string; via: string }> = [];
  const tables = Object.keys(schema);
  
  for (const table of tables) {
    for (const col of schema[table].columns) {
      const fkMatch = col.name.match(/^(.+?)_id$/i);
      if (fkMatch) {
        const refName = fkMatch[1];
        const targetTable = tables.find(t => 
          t.toLowerCase() === refName.toLowerCase() ||
          t.toLowerCase() === refName.toLowerCase() + 's' ||
          t.toLowerCase() + 's' === refName.toLowerCase()
        );
        
        if (targetTable && schema[targetTable].columns.some(c => c.name === 'id')) {
          relationships.push({
            from: `${table}.${col.name}`,
            to: `${targetTable}.id`,
            via: col.name
          });
        }
      }
    }
  }
  
  return relationships;
}

/** ============ Helpers ============ */
async function getSchemaSummary(): Promise<
  { table: string; column: string; data_type: string }[]
> {
  const schemaName = process.env.SCHEMA_WHITELIST?.trim() || 'PUB_0915';
  const [rows] = await ensurePool().query(
    `
    SELECT 
      TABLE_SCHEMA AS table_schema,
      TABLE_NAME AS table_name,
      COLUMN_NAME AS column_name,
      DATA_TYPE AS data_type
    FROM information_schema.columns
    WHERE TABLE_SCHEMA = ?
    ORDER BY TABLE_SCHEMA, TABLE_NAME, ORDINAL_POSITION;
    `,
    [schemaName]
  );

  console.log('🟢 Fetched schema:', schemaName, 'Rows:', (rows as any[]).length);

  return (rows as any[]).map(r => ({
    table: `${r.table_schema}.${r.table_name}`,
    column: r.column_name,
    data_type: r.data_type
  }));
}

function applyRedactionRow(
  table: string,
  row: Record<string, any>
): Record<string, any> {
  const rules = guardrails.get(table) ?? {};
  const out: Record<string, any> = {};
  for (const key of Object.keys(row)) {
    const rule = rules[key] ?? 'EXPOSE';
    const val = row[key];
    if (val == null) {
      out[key] = val;
      continue;
    }
    switch (rule) {
      case 'REDACT':
        out[key] = '■■■';
        break;
      case 'MASK_EMAIL':
        if (typeof val === 'string') {
          const parts = val.split('@');
          if (parts.length === 2) {
            const [u, d] = parts;
            const mu = u.length <= 1 ? '*' : u[0] + '*'.repeat(Math.max(1, u.length - 1));
            const md = d.length <= 3 ? '*'.repeat(d.length) : d[0] + '*'.repeat(d.length - 3) + d.slice(-2);
            out[key] = `${mu}@${md}`;
          } else out[key] = '■■■';
        } else out[key] = '■■■';
        break;
      case 'EXPOSE':
      default:
        out[key] = val;
    }
  }
  return out;
}

function applyRedactionTable(
  fqTable: string,
  rows: Record<string, any>[]
): Record<string, any>[] {
  return rows.map(r => applyRedactionRow(fqTable, r));
}

function validateSelectOnly(sql: string) {
  const s = sql.trim().toUpperCase();
  if (!s.startsWith('SELECT')) throw new Error('Only SELECT queries are permitted.');
  if (s.includes(';')) throw new Error('Multiple statements are not allowed.');
  const banned = ['INSERT ', 'UPDATE ', 'DELETE ', 'DROP ', 'ALTER ', 'TRUNCATE ', 'CREATE '];
  if (banned.some(k => s.includes(k))) throw new Error('Write or DDL statements are not allowed.');
}

function schemaToPrompt(schema: { table: string; column: string; data_type: string }[]) {
  const lines: string[] = [];
  const byTable = new Map<string, { column: string; data_type: string }[]>();
  for (const c of schema) {
    if (!byTable.has(c.table)) byTable.set(c.table, []);
    byTable.get(c.table)!.push({ column: c.column, data_type: c.data_type });
  }
  for (const [table, cols] of byTable) {
    lines.push(`TABLE ${table} (${cols.map(c => `${c.column}:${c.data_type}`).join(', ')})`);
  }
  return lines.join('\n');
}

/** ============ Server ============ */
const app = Fastify({ logger: true });

import cors from "@fastify/cors";
await app.register(cors, {
  origin: true,
});

app.get('/health', async () => ({ ok: true }));

app.post('/connect', async (req, reply) => {
  const body = (req.body ?? {}) as { databaseUrl?: string };
  const databaseUrl = body.databaseUrl || process.env.DATABASE_URL;
  if (!databaseUrl) return reply.code(400).send({ error: 'DATABASE_URL missing' });
  pool?.end().catch(() => {});
  pool = mysql.createPool(databaseUrl);
  await pool.query('SELECT 1');
  return { connected: true };
});

app.get('/schema', async (_req, reply) => {
  try {
    const schema = await getSchemaSummary();
    return { schema };
  } catch (e: any) {
    return reply.code(500).send({ error: e.message });
  }
});

app.get('/guardrails', async (_req, _reply) => {
  const out: Record<string, TableGuardrail> = {};
  for (const [k, v] of guardrails.entries()) out[k] = v;
  return out;
});

app.post('/users', async (req, reply) => {
  const Body = z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    email: z.string().email().optional()
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }

  try {
    const created = await prisma.user.create({
      data: {
        id: parsed.data.id ?? undefined,
        name: parsed.data.name ?? null,
        email: parsed.data.email ?? null
      }
    });
    return created;
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

app.get('/users', async (_req, _reply) => {
  const users = await prisma.user.findMany();
  return users;
});

app.post('/connections', async (req, reply) => {
  const Body = z.object({
    name: z.string().min(1),
    dbType: z.enum(['mysql', 'postgres', 'mssql', 'sqlite']).default('mysql'),
    connectionUrl: z.string().min(1),
    userId: z.string().min(1)
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }

  try {
    const created = await prisma.connection.create({
      data: {
        name: parsed.data.name,
        dbType: parsed.data.dbType,
        connectionUrl: parsed.data.connectionUrl,
        userId: parsed.data.userId
      }
    });
    return created;
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

app.get('/connections', async (req, reply) => {
  const Query = z.object({
    userId: z.string().optional()
  });
  const parsed = Query.safeParse(req.query);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }

  const connections = await prisma.connection.findMany({
    where: parsed.data.userId ? { userId: parsed.data.userId } : undefined
  });
  return connections;
});

app.get<{ Params: { connectionId: string } }>('/schema/:connectionId', async (req, reply) => {
  const { connectionId } = req.params;
  if (!connectionId) {
    return reply.code(400).send({ error: "Missing connectionId" });
  }
  try {
    const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!connection) {
      return reply.code(404).send({ error: "Connection not found" });
    }
    const { dbType, connectionUrl } = connection;
    let schema: { table: string; name: string }[] = [];
    if (dbType === "mysql") {
      let pool: any;
      try {
        const mysql = await import("mysql2/promise");
        pool = mysql.createPool(connectionUrl);
        const [tables] = await pool.query("SHOW TABLES");
        const tableNames: string[] = [];
        for (const row of tables as any[]) {
          const key = Object.keys(row)[0];
          tableNames.push(row[key]);
        }
        for (const table of tableNames) {
          const [cols] = await pool.query(`SHOW COLUMNS FROM \`${table}\``);
          for (const col of cols as any[]) {
            schema.push({ table, name: col.Field });
          }
        }
      } finally {
        if (pool) await pool.end().catch(() => {});
      }
    } else if (dbType === "postgres") {
      let client: any;
      try {
        const { Client } = await import("pg");
        client = new Client({ connectionString: connectionUrl });
        await client.connect();
        const schemaWhitelist = (process.env.SCHEMA_WHITELIST ?? 'public')
          .split(',')
          .map(s => s.trim());
        const res = await client.query(
          `
            SELECT table_schema, table_name, column_name
            FROM information_schema.columns
            WHERE table_schema = ANY($1)
            ORDER BY table_schema, table_name, ordinal_position
          `,
          [schemaWhitelist]
        );
        for (const row of res.rows) {
          schema.push({ table: `${row.table_schema}.${row.table_name}`, name: row.column_name });
        }
      } finally {
        if (client) await client.end().catch(() => {});
      }
    } else {
      return reply.code(400).send({ error: `Unsupported dbType: ${dbType}` });
    }
    return { schema };
  } catch (e: any) {
    req.log.error(e, `❌ Error fetching schema for connection ${req.params.connectionId}`);
    return reply.code(500).send({ error: e.message });
  }
});

app.delete('/connections/:id', async (req, reply) => {
  const { id } = req.params as { id: string };

  if (!id) {
    req.log.warn("❌ Missing connection ID in delete request");
    return reply.code(400).send({ error: "Connection ID is required" });
  }

  try {
    const existing = await prisma.connection.findUnique({ where: { id } });
    if (!existing) {
      req.log.warn(`⚠️ Connection not found for ID: ${id}`);
      return reply.code(404).send({ error: "Connection not found" });
    }

    await prisma.connection.delete({ where: { id } });
    req.log.info(`🗑️ Deleted connection ${id}`);
    return reply.send({ ok: true, id });
  } catch (e: any) {
    req.log.error(e, `❌ Error deleting connection ${id}`);
    return reply.code(500).send({ error: e.message });
  }
});

app.post('/connections/test', async (req, reply) => {
  const Body = z.object({
    dbType: z.enum(['mysql', 'postgres', 'mssql', 'sqlite']),
    connectionUrl: z.string().min(1)
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }

  const { dbType, connectionUrl } = parsed.data;

  try {
    if (dbType === 'mysql') {
      const mysql = await import('mysql2/promise');
      const pool = mysql.createPool(connectionUrl);
      await pool.query('SELECT 1');
      await pool.end();
    } else if (dbType === 'postgres') {
      const { Client } = await import('pg');
      const client = new Client({ connectionString: connectionUrl });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
    } else {
      throw new Error(`Unsupported dbType: ${dbType}`);
    }

    return { ok: true, message: 'Connection successful ✅' };
  } catch (e: any) {
    req.log.error(e);
    return reply.code(400).send({ ok: false, error: e.message });
  }
});

/** ================= REDACTION RULES ================= **/

app.get<{ Params: { connectionId: string } }>('/redactions/:connectionId', async (req, reply) => {
  const { connectionId } = req.params as { connectionId: string };
  try {
    const rules = await prisma.redactionRule.findMany({ where: { connectionId } });
    return reply.send(rules);
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

app.post('/redactions', async (req, reply) => {
  const Body = z.object({
    connectionId: z.string(),
    tableName: z.string(),
    columnName: z.string(),
    ruleType: z.enum(['REDACT', 'MASK_EMAIL', 'REMOVE', 'HASH', 'EXPOSE']),
    replacement: z.string().optional()
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

  if (parsed.data.ruleType === 'EXPOSE') {
    const { connectionId, tableName, columnName } = parsed.data;

    // Delete any rule that matches by table or schema prefix (case-insensitive)
    const result = await prisma.redactionRule.deleteMany({
      where: {
        connectionId,
        AND: [
          {
            OR: [
              { tableName: { equals: tableName, mode: "insensitive" } },
              { tableName: { contains: tableName, mode: "insensitive" } },
              { tableName: { endsWith: tableName, mode: "insensitive" } },
            ],
          },
          { columnName: { equals: columnName, mode: "insensitive" } },
        ],
      },
    });

    const totalDeleted = result.count;
    const msg =
      totalDeleted > 0
        ? `✅ Removed ${totalDeleted} redaction rule(s) for ${tableName}.${columnName}`
        : `⚠️ No existing redaction found for ${tableName}.${columnName}`;

    req.log.info(msg);
    return reply.send({ ok: true, message: msg });
  }

  try {
    const rule = await prisma.redactionRule.create({ data: parsed.data });
    return reply.send(rule);
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});


app.delete('/redactions/:id', async (req, reply) => {
  const { id } = req.params as { id: string };
  try {
    await prisma.redactionRule.delete({ where: { id } });
    req.log.info(`🗑️ Deleted redaction rule ${id}`);
    return reply.send({ ok: true });
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

// 🧹 Clear all redactions for a specific connection or globally
app.delete('/redactions/clear', async (req, reply) => {
  try {
    const { connectionId } = req.body as { connectionId?: string };
    let result;
    if (connectionId) {
      result = await prisma.redactionRule.deleteMany({ where: { connectionId } });
      req.log.info(`🧹 Cleared ${result.count} redactions for connection ${connectionId}`);
    } else {
      result = await prisma.redactionRule.deleteMany({});
      req.log.info(`🧹 Cleared ${result.count} redactions globally`);
    }

    // Clear caches
    guardrails.clear();
    schemaCache.clear();

    return reply.send({
      ok: true,
      deleted: result.count,
      scope: connectionId ? "connection" : "global",
      message: connectionId
        ? `Cleared all redactions for connection ${connectionId}`
        : `Cleared all redactions globally`
    });
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

app.post('/redactions/table', async (req, reply) => {
  const Body = z.object({
    connectionId: z.string(),
    tableName: z.string(),
    ruleType: z.enum(['REDACT', 'MASK_EMAIL', 'REMOVE', 'HASH']),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

  const { connectionId, tableName, ruleType } = parsed.data;

  try {
    await prisma.redactionRule.deleteMany({
      where: { connectionId, tableName },
    });

    if (ruleType === 'REMOVE') {
      const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
      if (!connection) return reply.code(404).send({ error: 'Connection not found' });

      let columns: string[] = [];
      if (connection.dbType === 'mysql') {
        const mysql = await import('mysql2/promise');
        const pool = mysql.createPool(connection.connectionUrl);
        const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
        columns = (cols as any[]).map((c) => c.Field);
        await pool.end();
      } else if (connection.dbType === 'postgres') {
        const { Client } = await import('pg');
        const client = new Client({ connectionString: connection.connectionUrl });
        await client.connect();
        const res = await client.query(
          `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
          [tableName]
        );
        columns = res.rows.map((r) => r.column_name);
        await client.end();
      }

      const removeRules = columns.map((name) => ({
        connectionId,
        tableName,
        columnName: name,
        ruleType: 'REMOVE' as const,
      }));

      if (removeRules.length > 0) {
        await prisma.redactionRule.createMany({ data: removeRules });
      }

      return reply.send({ ok: true, message: `Marked all columns as REMOVE for ${tableName}` });
    }

    const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!connection) return reply.code(404).send({ error: 'Connection not found' });

    let columns: string[] = [];
    if (connection.dbType === 'mysql') {
      const mysql = await import('mysql2/promise');
      const pool = mysql.createPool(connection.connectionUrl);
      const [cols] = await pool.query(`SHOW COLUMNS FROM \`${tableName}\``);
      columns = (cols as any[]).map((c) => c.Field);
      await pool.end();
    } else if (connection.dbType === 'postgres') {
      const { Client } = await import('pg');
      const client = new Client({ connectionString: connection.connectionUrl });
      await client.connect();
      const res = await client.query(
        `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
        [tableName]
      );
      columns = res.rows.map((r) => r.column_name);
      await client.end();
    }

    const createData = columns.map((name) => ({
      connectionId,
      tableName,
      columnName: name,
      ruleType,
    }));

    if (createData.length > 0) {
      await prisma.redactionRule.createMany({ data: createData });
    }

    return reply.send({ ok: true, message: `Applied ${ruleType} to all columns in ${tableName}` });
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

/** ================= METADATA ================= **/

app.get<{ Params: { connectionId: string } }>('/metadata/:connectionId', async (req, reply) => {
  const { connectionId } = req.params;
  try {
    const tables = await prisma.tableMetadata.findMany({
      where: { connectionId },
      include: { columns: true },
    });
    return reply.send(tables);
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

app.get<{ Params: { connectionId: string; tableName: string } }>(
  '/metadata/:connectionId/:tableName',
  async (req, reply) => {
    const { connectionId, tableName } = req.params;
    try {
      const table = await prisma.tableMetadata.findUnique({
        where: { connectionId_tableName: { connectionId, tableName } },
        include: { columns: true },
      });
      if (!table) {
        return reply.code(404).send({ error: "Table metadata not found" });
      }
      return reply.send(table);
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  }
);

app.post<{ Params: { connectionId: string; tableName: string } }>(
  '/metadata/:connectionId/:tableName',
  async (req, reply) => {
    const { connectionId, tableName } = req.params;
    const Body = z.object({
      description: z.string().optional(),
      notes: z.string().optional(),
      tags: z.union([z.array(z.string()), z.string()]).optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const tagsArray = Array.isArray(parsed.data.tags)
      ? parsed.data.tags
      : parsed.data.tags?.split(',').map(t => t.trim()) ?? [];

    try {
      const table = await prisma.tableMetadata.upsert({
        where: { connectionId_tableName: { connectionId, tableName } },
        update: { ...parsed.data, tags: tagsArray },
        create: { connectionId, tableName, ...parsed.data, tags: tagsArray },
      });
      return reply.send(table);
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  }
);

app.post('/metadata/table', async (req, reply) => {
  const Body = z.object({
    connectionId: z.string(),
    tableName: z.string(),
    description: z.string().optional(),
    notes: z.string().optional(),
    tags: z.union([z.array(z.string()), z.string()]).optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

  const { connectionId, tableName, description, notes, tags } = parsed.data;
  const tagsArray = Array.isArray(tags)
    ? tags
    : tags?.split(',').map(t => t.trim()) ?? [];

  try {
    const table = await prisma.tableMetadata.upsert({
      where: { connectionId_tableName: { connectionId, tableName } },
      update: { description, notes, tags: tagsArray },
      create: { connectionId, tableName, description, notes, tags: tagsArray },
    });
    return reply.send(table);
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

app.post('/metadata/column', async (req, reply) => {
  const Body = z.object({
    tableMetadataId: z.string(),
    columnName: z.string(),
    description: z.string().optional(),
    example: z.string().optional(),
    importance: z.number().optional(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

  const { tableMetadataId, columnName, description, example, importance } = parsed.data;

  try {
    const column = await prisma.columnMetadata.upsert({
      where: { tableMetadataId_columnName: { tableMetadataId, columnName } },
      update: { description, example, importance },
      create: { tableMetadataId, columnName, description, example, importance },
    });
    return reply.send(column);
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

app.post('/query/run', async (req, reply) => {
  const Body = z.object({
    connectionId: z.string(),
    sql: z.string().min(1)
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: parsed.error.flatten() });
  }

  const connection = await prisma.connection.findUnique({
    where: { id: parsed.data.connectionId }
  });
  if (!connection) return reply.code(404).send({ error: 'Connection not found' });

  const { connectionUrl, dbType } = connection;

  try {
    let rows: any[] = [];
    if (dbType === 'mysql') {
      const mysql = await import('mysql2/promise');
      const pool = mysql.createPool(connectionUrl);
      const [result] = await pool.query(parsed.data.sql);
      rows = result as any[];
      await pool.end();
    } else if (dbType === 'postgres') {
      const { Client } = await import('pg');
      const client = new Client({ connectionString: connectionUrl });
      await client.connect();
      const res = await client.query(parsed.data.sql);
      rows = res.rows;
      await client.end();
    } else {
      throw new Error(`Unsupported dbType: ${dbType}`);
    }

    return { rows };
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

app.post('/guardrails', async (req, reply) => {
  const Body = z.object({
    table: z.string(),
    rules: z.record(z.string(), z.enum(['EXPOSE', 'REDACT', 'MASK_EMAIL']))
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

  const { table, rules } = parsed.data;
  guardrails.set(table, rules as TableGuardrail);
  return { ok: true, table, rules };
});

app.post('/query', async (req, reply) => {
  const Body = z.object({
    question: z.string(),
    table: z.string().optional()
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

  if (!openai) return reply.code(400).send({ error: 'OPENAI_API_KEY not set' });

  try {
    const schema = await getSchemaSummary();
    const schemaPrompt = schemaToPrompt(schema);

    const forcedTable = parsed.data.table;
    const instruction = forcedTable
      ? `Only query from the table "${forcedTable}".`
      : `Prefer the most relevant table(s).`;

    const systemPrompt =
`You are a SQL generator. Output a single MySQL SELECT statement. 
Do not include comments or explanations. No semicolons. Only SELECT.`;

    const userPrompt =
`Question: ${parsed.data.question}

${instruction}

Database Schema:
${schemaPrompt}

Rules:
- Return a single SELECT statement.
- Use fully qualified table names (schema.table).
- LIMIT 100 if result can be large.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.1
    });

    const sql = (completion.choices[0]?.message?.content ?? '').trim();
    validateSelectOnly(sql);

    const [rows] = await ensurePool().query<QueryRows>(sql);

    let tableForRules = forcedTable ?? '';
    if (!tableForRules) {
      const tables = Array.from(new Set(schema.map(s => s.table)));
      const found = tables.find(t => sql.includes(t));
      if (found) tableForRules = found;
    }

    const redacted = tableForRules ? applyRedactionTable(tableForRules, rows) : rows;

    return { sql, table: tableForRules || null, rows: redacted };
  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

/** ================== IMPROVED CHAT ENDPOINT ================== **/

import util from "util";

app.post('/chat', async (req, reply) => {
  const Body = z.object({
    question: z.string().min(5),
    connectionId: z.string(),
  });
  const parsed = Body.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

  const { question, connectionId } = parsed.data;
  if (!openai) return reply.code(400).send({ error: "OPENAI_API_KEY not set" });

  try {
    const connection = await prisma.connection.findUnique({ where: { id: connectionId } });
    if (!connection) return reply.code(404).send({ error: "Connection not found" });

    // Get REAL schema from database (cached)
    const realSchema: RealSchema = await getRealSchema(connection) as RealSchema;
    // Debug log after fetching real schema
    console.log("🧩 Real schema tables:", Object.keys(realSchema));
    console.log("🧩 Example table columns:", Object.entries(realSchema)[0]);

    // Get redaction rules
    const redactions = await prisma.redactionRule.findMany({ where: { connectionId } });
    const redactedColumns = new Map<string, Set<string>>();
    for (const r of redactions) {
      if (!redactedColumns.has(r.tableName)) redactedColumns.set(r.tableName, new Set());
      if (["REDACT", "REMOVE", "MASK_EMAIL", "HASH"].includes(r.ruleType)) {
        redactedColumns.get(r.tableName)!.add(r.columnName);
      }
    }
    // Debug log after building redacted columns map
    console.log("🕶️ Redacted columns map:", util.inspect(Array.from(redactedColumns.entries()), { depth: 3 }));

    // Get metadata for context (optional descriptions)
    const metadata = await prisma.tableMetadata.findMany({
      where: { connectionId },
      include: { columns: true }
    });
    // Debug log after loading metadata
    console.log("🧠 Metadata tables loaded:", metadata.length);
    const metadataMap = new Map(metadata.map(m => [m.tableName, m]));

    // Build filtered schema (remove redacted columns)
    const filteredSchema: RealSchema = {};
    for (const [table, info] of Object.entries(realSchema) as [string, { columns: Array<{ name: string; type: string }> }][]) {
      const redacted = redactedColumns.get(table);
      filteredSchema[table] = {
        columns: info.columns.filter(c => !redacted?.has(c.name))
      };
    }
    // Debug log after building filtered schema
    console.log("🧱 Filtered schema sample:", util.inspect(Object.entries(filteredSchema).slice(0, 2), { depth: 3 }));

    // Detect relationships
    const relationships = detectRelationships(filteredSchema);

    // Build comprehensive schema prompt
    const schemaLines: string[] = [];
    for (const [table, info] of Object.entries(filteredSchema) as [string, { columns: Array<{ name: string; type: string }> }][]) {
      const meta = metadataMap.get(table) as { description?: string; notes?: string; tags?: string[] } | undefined;
      const colList = info.columns.map(c => `${c.name} (${c.type})`).join(', ');
      let line = `TABLE ${table}: ${colList}`;
      if (meta?.description) line += `\n  Description: ${meta.description}`;
      schemaLines.push(line);
    }

    // Build metadataHints block
    const metadataHints = metadata.length
      ? `\nMETADATA HINTS:\n${metadata
          .map(m => {
            const colHints = m.columns
              .map(c => `- ${m.tableName}.${c.columnName}: ${c.description ?? "No description"}`)
              .join('\n');
            return `TABLE ${m.tableName}:\nDescription: ${m.description ?? "None"}\n${colHints}`;
          })
          .join('\n\n')}`
      : '';

    const relationshipHints = relationships.length > 0
      ? `\nKNOWN RELATIONSHIPS:\n${relationships.map(r => `- ${r.from} → ${r.to}`).join('\n')}`
      : '';

    // Identify date/time columns
    const dateColumns: string[] = [];
    for (const [table, info] of Object.entries(filteredSchema) as [string, { columns: Array<{ name: string; type: string }> }][]) {
      for (const col of info.columns) {
        if (/date|time|timestamp|created|updated|started|ended/i.test(col.name) ||
            /date|time|timestamp/i.test(col.type)) {
          dateColumns.push(`${table}.${col.name}`);
        }
      }
    }
    const dateHint = dateColumns.length > 0
      ? `\nDATE/TIME COLUMNS: ${dateColumns.join(', ')}`
      : '';

    // Identify name/text columns
    const nameColumns: string[] = [];
    for (const [table, info] of Object.entries(filteredSchema) as [string, { columns: Array<{ name: string; type: string }> }][]) {
      for (const col of info.columns) {
        if (/name|title|label|description/i.test(col.name)) {
          nameColumns.push(`${table}.${col.name}`);
        }
      }
    }
    const nameHint = nameColumns.length > 0
      ? `\nNAME/TEXT COLUMNS: ${nameColumns.join(', ')}`
      : '';

    // --- Insert semanticPriorityBlock above systemPrompt ---
    const semanticPriorityBlock = `
When multiple tables include similar or overlapping concepts (e.g., "invoices" and "vendor_invoices"), 
choose based on semantic meaning, not table name alone:
- If the question involves "organization", "client", or "customer", prefer tables whose metadata includes those words.
- If the question involves "vendor", "supplier", or "provider", prefer those tables instead.
- If metadata contains phrases like "relates to", "references", or "contains data for", treat those relationships as authoritative.
- Always prioritize metadata descriptions and notes over assumptions about table names.
- If metadata is missing, make a best guess based on column names and relationships, but never invent data.
This rule applies universally across all databases, even when these specific entities are not present.
`;

    // --- Insert temporalAnchorBlock immediately after semanticPriorityBlock ---
    const temporalAnchorBlock = `
DATE INTERPRETATION RULES:
- "This month" means between the first day of the current month and today.
- "Last month" means between the first and last day of the previous calendar month.
- If a month name (like "October") is mentioned without a year, assume the most recent occurrence of that month (including the current year if that month has already passed, otherwise the previous year).
- Always use the most relevant date column from DATE/TIME COLUMNS when filtering (e.g. started_at, created_at, or updated_at).
`;

    const systemPrompt = `${semanticPriorityBlock}
${temporalAnchorBlock}
You are an expert SQL assistant. Generate accurate ${connection.dbType === 'mysql' ? 'MySQL' : 'PostgreSQL'} SELECT queries using ONLY the provided schema.

CRITICAL RULES:
1. Use ONLY columns that exist in the schema below
2. Use ONLY tables that exist in the schema below
3. Always include LIMIT 100 for potentially large results
4. Use the relationship hints to JOIN tables correctly
5. When metadata describes relationships (e.g. "pto_type_id relates to pto_types"), always use that for JOIN logic.
6. If metadata notes that a column "relates to" or "references" another table, JOIN using that relationship.
7. Prefer JOINs inferred from metadata over guessing column names.
8. When dates/timestamps are needed, use the DATE/TIME COLUMNS listed
9. For names/text fields, use the NAME/TEXT COLUMNS listed
10. Never invent column names - if you can't find what you need, use ID columns and join
11. Output ONLY the SQL query, no explanations, comments, or markdown
12. For "latest" or "most recent" queries, use ORDER BY with date columns DESC and LIMIT 1
13. For "who" questions, always join to get names if possible, don't just return IDs
14. When filtering by text (like 'status', 'type', 'name', or 'description'), use case-insensitive fuzzy matching (e.g., LOWER(column) LIKE '%keyword%') instead of exact equality, unless an exact match is clearly required.`;

    // --- Insert dynamic time context right before userPrompt ---
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const firstDayOfMonth = new Date(year, month - 1, 1);
    const lastMonthDate = new Date(year, month - 2, 1);
    const lastMonthYear = lastMonthDate.getFullYear();
    const lastMonthNumber = lastMonthDate.getMonth() + 1;
    const lastMonthDays = new Date(lastMonthYear, lastMonthNumber, 0).getDate();
    const lastMonthStr = `${lastMonthYear}-${String(lastMonthNumber).padStart(2, '0')}`;
    const currentMonthStr = `${year}-${String(month).padStart(2, '0')}`;

    const timeContext = `
Current date: ${year}-${String(month).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}.
This month started on ${currentMonthStr}-01.
Last month ran from ${lastMonthStr}-01 to ${lastMonthStr}-${lastMonthDays}.
`;

    const userPrompt = `${timeContext}
User question: "${question}"

DATABASE SCHEMA:
${schemaLines.join('\n\n')}
${relationshipHints}
${dateHint}
${nameHint}
${metadataHints}

IMPORTANT REMINDERS:
- Do NOT invent columns like "pto_date", "employee_id", "date_taken" if they don't exist
- Use metadata relationships when joining tables (e.g. if "pto_type_id" relates to "pto_types.id", join them)
- For PTO queries, look for tables like "pto_requests" or "time_off" with date columns
- For organization/client queries, look for "organization_id" or "client_id" foreign keys
- For user queries, always try to join to a users/employees table to get names
- Use ORDER BY with DESC for "latest" or "most recent" queries
- Use GROUP BY and COUNT(*) for "most" or "how many" questions

Generate a single SELECT query to answer the question.`;

    // Debug log before sending prompt to OpenAI
    console.log("📤 OpenAI prompt:");
    console.log("SYSTEM:\n", systemPrompt);
    console.log("USER:\n", userPrompt);

    // Generate SQL with retry logic
    let sql = "";
    let attempts = 0;
    let lastError = "";

    while (attempts < 3) {
      attempts++;

      const messages: any[] = [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ];

      if (lastError) {
        messages.push({
          role: "user",
          content: `Previous attempt failed with error: "${lastError}". 

Analyze the error and fix the query:
- If it mentions "Unknown column", that column doesn't exist - use a different one from the schema
- If it mentions syntax error, check your JOIN conditions and WHERE clauses
- Remember to use ONLY the exact column names listed in the schema above

Generate a corrected query.`
        });
      }

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.1,
      });

      sql = completion.choices[0]?.message?.content?.trim() ?? "";
      // Clean up SQL
      sql = sql.replace(/```sql|```/gi, "").trim();

      // Debug log after receiving generated SQL from OpenAI
      console.log("📥 Generated SQL:", sql);

      if (!sql.toUpperCase().startsWith("SELECT")) {
        lastError = "Query must start with SELECT";
        continue;
      }

      // Try to execute
      try {
        let rows: any[] = [];
        if (connection.dbType === "mysql") {
          const mysql = await import("mysql2/promise");
          const pool = mysql.createPool(connection.connectionUrl);
          const [result] = await pool.query(sql);
          rows = result as any[];
          await pool.end();
        } else if (connection.dbType === "postgres") {
          const { Client } = await import("pg");
          const client = new Client({ connectionString: connection.connectionUrl });
          await client.connect();
          const res = await client.query(sql);
          rows = res.rows;
          await client.end();
        }

        // Success! Apply redactions
        const redactedRows = rows.map(row => {
          const out = { ...row };
          // Apply redaction rules for all tables
          for (const [table, cols] of redactedColumns.entries()) {
            for (const col of cols) {
              if (out[col] !== undefined) {
                const rule = redactions.find(r => r.tableName === table && r.columnName === col);
                if (rule?.ruleType === 'MASK_EMAIL' && typeof out[col] === 'string') {
                  const parts = out[col].split('@');
                  if (parts.length === 2) {
                    const [u, d] = parts;
                    out[col] = `${u[0]}${'*'.repeat(Math.max(1, u.length - 1))}@${d[0]}${'*'.repeat(Math.max(1, d.length - 3))}${d.slice(-2)}`;
                  } else {
                    out[col] = '■■■';
                  }
                } else if (rule?.ruleType === 'HASH') {
                  out[col] = `[HASH_${Math.random().toString(36).substr(2, 9)}]`;
                } else {
                  out[col] = '■■■';
                }
              }
            }
          }
          return out;
        });

        // Debug log before summary generation
        console.log("🗂️ Query result sample:", redactedRows.slice(0, 3));

        // Generate summary
        let summary = "Query executed successfully.";
        try {
          const summaryPrompt = `User asked: "${question}"

SQL executed: ${sql}

Number of results: ${rows.length}

Sample data (first 3 rows):
${JSON.stringify(redactedRows.slice(0, 3), null, 2)}

Provide a clear, natural-language answer to the user's question based on this data. 
- Be specific with numbers and names when available
- If the question asks "who", mention the person's name if it's in the results
- If the question asks "what organization", mention the organization name
- If the question asks about trends or patterns, describe what you see
- Keep it concise but informative`;

          const summaryCompletion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              { role: "system", content: "You are a helpful data analyst. Provide clear, concise answers based on query results. Always mention specific names, dates, and numbers when they're in the data." },
              { role: "user", content: summaryPrompt },
            ],
          });
          summary = summaryCompletion.choices[0]?.message?.content?.trim() ?? summary;
        } catch (e) {
          req.log.error(e, "Summary generation failed");
        }

        return reply.send({
          sql,
          summary,
          rowCount: rows.length,
          rows: redactedRows.slice(0, 100),
        });

      } catch (execError: any) {
        lastError = execError.message;
        // Debug log when SQL execution fails
        req.log.warn(`❌ SQL execution failed: ${sql}\nError: ${lastError}`);

        if (attempts >= 3) {
          return reply.code(400).send({
            error: "Failed to generate valid SQL after 3 attempts",
            lastError,
            lastSQL: sql,
            hint: "The AI couldn't find the right columns. Try rephrasing your question or check if the data exists in your database.",
            availableTables: Object.keys(filteredSchema),
          });
        }
      }
    }

    return reply.code(400).send({ error: "Failed to generate query" });

  } catch (e: any) {
    req.log.error(e);
    return reply.code(500).send({ error: e.message });
  }
});

app.listen({ port: PORT, host: '0.0.0.0' }).then(() => {
  console.log(`Guardrail backend running on http://localhost:${PORT}`);
});