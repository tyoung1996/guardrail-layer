import type { FastifyInstance } from "fastify";
import { z } from "zod";
import OpenAI from "openai";
import util from "util";

import type { PrismaClient } from "@prisma/client";
import { verifyAuthToken } from "../plugins/authToken.js";

// ================== Types for Schema ==================
type RealSchema = Record<string, { columns: Array<{ name: string; type: string }> }>;

export async function chatRoutes(app: FastifyInstance, prisma: PrismaClient, openai: OpenAI | null) {

const schemaCache = new Map<string, { schema: any; timestamp: number }>();
const SCHEMA_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

app.post('/chat', { preHandler: (app as any).auth }, async (req, reply) => {
    const Body = z.object({
      question: z.string().min(5),
      connectionId: z.string(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { question, connectionId } = parsed.data;
    if (!openai) return reply.code(400).send({ error: "OPENAI_API_KEY not set" });

    // --- RBAC Permission Check ---
    const userId = (req.user as any)?.userId;

    // Load user roles once (for permissions and redactions)
    const userRoles = await prisma.userRole.findMany({
      where: { userId },
      select: { roleId: true }
    });
    const roleIds = userRoles.map(r => r.roleId);

    // 1. Load user to see if admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { isAdmin: true },
    });

    // Admin bypass
    if (!user?.isAdmin) {
      // 3. Check access: user-specific or role-based
      const permission = await prisma.connectionPermission.findFirst({
        where: {
          connectionId,
          OR: [
            { userId },               // direct assignment
            { roleId: { in: roleIds } } // role assignment
          ]
        }
      });

      if (!permission) {
        return reply.code(403).send({
          error: "Forbidden — you do not have permission to query this connection",
        });
      }
    }

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
      // Get global regex-based redaction patterns (both for this connection and global)
      const globalPatterns = await prisma.globalPatternRule.findMany({
        where: {
          OR: [
            { connectionId },
            { connectionId: null }
          ]
        }
      });
      // Load role-level redactions
      const roleRedactions = await prisma.roleRedaction.findMany({
        where: {
          connectionId,
          roleId: { in: roleIds }
        },
        include: { role: true }
      });
      console.log("ROLE REDACTIONS:", util.inspect(roleRedactions, { depth: 5 }));
      // Load user-level redactions
      const userRedactions = await prisma.userRedaction.findMany({
        where: { connectionId, userId }
      });
      // Merge all redaction layers
      // 1. Start with column-level redactions (legacy)
      let effectiveRedactions = [...redactions];
      // 2. Add role-level redaction JSON rules (merged safely)
      for (const rr of roleRedactions) {
        if (rr && rr.rules && typeof rr.rules === "object") {
          for (const [tableNameFull, columnsObj] of Object.entries(rr.rules as any)) {
            const tableName = tableNameFull.includes('.')
              ? tableNameFull.split('.')[1]
              : tableNameFull;

            // Case 1: Object style { id: {ruleType}, name:{ruleType} }
            if (typeof columnsObj === "object" && !Array.isArray(columnsObj)) {
              for (const [colName, colRule] of Object.entries(columnsObj as any)) {
                const col: any = colRule as any;
                effectiveRedactions.push({
                  connectionId: rr.connectionId,
                  id: "role-" + Math.random().toString(36).slice(2),
                  createdAt: new Date(),
                  role: rr.role?.name ?? null,
                  tableName,
                  columnName: colName,
                  ruleType: col.ruleType ?? "REDACT",
                  replacement: col.replacement ?? null,
                  pattern: col.pattern ?? null,
                  redactionsApplied: false
                });
              }
            }

            // Case 2: Array style
            if (Array.isArray(columnsObj)) {
              for (const raw of columnsObj as any[]) {
                const rule: any = raw ?? {};
                effectiveRedactions.push({
                  connectionId: rr.connectionId,
                  id: "role-" + Math.random().toString(36).slice(2),
                  createdAt: new Date(),
                  role: rr.role?.name ?? null,
                  tableName,
                  columnName: rule.columnName ?? "",
                  ruleType: rule.ruleType ?? "REDACT",
                  replacement: rule.replacement ?? null,
                  pattern: rule.pattern ?? null,
                  redactionsApplied: false
                });
              }
            }
          }
        }
      }
      // 3. Add user-level overrides (highest priority)
      for (const ur of userRedactions) {
        if (Array.isArray(ur.rules)) {
          for (const r of ur.rules) {
            effectiveRedactions.push(r as any);
          }
        }
      }
      // 🔍 DEBUG: Inspect merged redaction rules
      console.log("🔍 Effective redactions:", util.inspect(effectiveRedactions, { depth: 5 }));
      // Build unified redaction map
      const unifiedRedactedColumns = new Map<string, Set<string>>();
      for (const rule of effectiveRedactions) {
        const table = rule.tableName;
        const col = rule.columnName;
        if (!table || !col) continue;
        if (!unifiedRedactedColumns.has(table)) unifiedRedactedColumns.set(table, new Set());
        const set = unifiedRedactedColumns.get(table);
        if (set) set.add(col);
      }
      // 🔍 DEBUG: Show unified redacted columns map
      console.log("🔍 Unified redacted columns:", util.inspect(Array.from(unifiedRedactedColumns.entries()), { depth: 5 }));
      // --- Begin redaction impact tracking ---
      const removedFromSchema: string[] = [];
      for (const [table, info] of Object.entries(realSchema)) {
        const redacted = unifiedRedactedColumns.get(table);
        if (redacted) {
          for (const col of redacted) removedFromSchema.push(`${table}.${col}`);
        }
      }
      const maskedColumns = new Set<string>();
      const hashApplied = new Set<string>();
      // Debug log after building redacted columns map
      console.log("🕶️ Redacted columns map:", util.inspect(Array.from(unifiedRedactedColumns.entries()), { depth: 3 }));
  
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
        const redacted = unifiedRedactedColumns.get(table);
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
  
          // 🔍 Raw SQL rows BEFORE redaction
          console.log("🔍 Raw SQL rows BEFORE redaction:", rows.slice(0, 3));
          console.log("🔍 Applying redaction rules:", util.inspect(unifiedRedactedColumns, { depth: 5 }));
          // Success! Apply redactions
          const redactedRows = rows.map(row => {
            const out = { ...row };
            // Apply redaction rules for all tables
            for (const [table, cols] of unifiedRedactedColumns.entries()) {
              for (const col of cols) {
                if (out[col] !== undefined) {
                  const rule = effectiveRedactions.find((r: any) => r.tableName === table && r.columnName === col);
                  if (rule?.ruleType === 'MASK_EMAIL' && typeof out[col] === 'string') {
                    const parts = out[col].split('@');
                    if (parts.length === 2) {
                      const [u, d] = parts;
                      out[col] = `${u[0]}${'*'.repeat(Math.max(1, u.length - 1))}@${d[0]}${'*'.repeat(Math.max(1, d.length - 3))}${d.slice(-2)}`;
                    } else {
                      out[col] = '■■■';
                    }
                    maskedColumns.add(`${table}.${col}`);
                  } else if (rule?.ruleType === 'HASH') {
                    out[col] = `[HASH_${Math.random().toString(36).substr(2, 9)}]`;
                    hashApplied.add(`${table}.${col}`);
                  } else {
                    out[col] = '■■■';
                  }
                }
              }
            }
            // Apply global regex-based redactions
            for (const [key, value] of Object.entries(out)) {
              if (typeof value === 'string') {
                for (const rule of globalPatterns) {
                  const regex = new RegExp(rule.pattern, 'gi');
                  if (regex.test(value)) {
                    out[key] = rule.replacement || '■■■';
                    break;
                  }
                }
              }
            }
            return out;
          });
  
          // Determine if redactions were actually applied to the results
          let anyRedactionsApplied = false;
          for (const row of redactedRows) {
            for (const [key, value] of Object.entries(row)) {
              if (value === '■■■' || (typeof value === 'string' && value.startsWith('[HASH_'))) {
                anyRedactionsApplied = true;
                break;
              }
            }
            if (anyRedactionsApplied) break;
          }
  
          // Debug log before summary generation
          console.log("🗂️ Query result sample:", redactedRows.slice(0, 3));
  
          // Generate summary
          let summary = "Query executed successfully.";
          try {
            const summaryPrompt = `User asked: "${question}"

SQL executed: ${sql}

Number of results: ${redactedRows.length}

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
  
          // Identify redaction rules explicitly or implicitly applied
          const tablesInSQL = Object.keys(filteredSchema).filter(t =>
            new RegExp(`\\b${t}\\b`, "i").test(sql)
          );

          const appliedRedactions = effectiveRedactions.filter((r: any) => {
            if (!r.columnName) return false;

            // Explicit: column name appears in SQL
            const explicit = new RegExp(`\\b${r.columnName}\\b`, "i").test(sql);

            // Implicit: column was removed from schema for a table used in SQL
            const implicit =
              tablesInSQL.includes(r.tableName) &&
              removedFromSchema.some(col => col === `${r.tableName}.${r.columnName}`);

            return explicit || implicit;
          });

          // Build per-query rule summary
          const ruleSummary: Record<string, number> = {
            REDACT: appliedRedactions.filter(r => r.ruleType === "REDACT").length,
            MASK_EMAIL: appliedRedactions.filter(r => r.ruleType === "MASK_EMAIL").length,
            HASH: appliedRedactions.filter(r => r.ruleType === "HASH").length,
            REMOVE: appliedRedactions.filter(r => r.ruleType === "REMOVE").length,
          };
          
          // Count global regex hits in redactedRows
          const globalRegexHits = globalPatterns.filter(r =>
            new RegExp(r.pattern, "gi").test(JSON.stringify(redactedRows))
          ).length;
          ruleSummary["GLOBAL_REGEX"] = globalRegexHits;
          ruleSummary.GLOBAL_REGEX = globalRegexHits;

          // Filter removedFromSchema to only include affected columns
          const actuallyRemoved = removedFromSchema.filter(col =>
            appliedRedactions.some(r => col.endsWith(`.${r.columnName}`))
          );

          // AUDIT LOG: chat_query with detailed redaction impact
          await prisma.auditLog.create({
            data: {
              action: 'chat_query',
              details: JSON.stringify({
                question,
                sql,
                redactionsApplied: appliedRedactions.length > 0,
                redactionImpact: {
                  hiddenColumns: actuallyRemoved,
                  maskedColumns: Array.from(maskedColumns),
                  hashApplied: Array.from(hashApplied),
                  removedFromSchema: actuallyRemoved,
                  ruleSummary,
                },
              }),
              connectionId,
            },
          });
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
  // EXTERNAL API CHAT ROUTE
  // This route allows external API token users (not session users) to chat with OpenAI.
  // It uses verifyAuthToken middleware for authentication.
  // Place this after the /chat route.
  app.post(
    "/api/chat/external",
    { preHandler: verifyAuthToken },
    async (req, reply) => {
      const Body = z.object({
        message: z.string().min(1),
        connectionId: z.string()
      });
  
      const parsed = Body.safeParse(req.body);
      if (!parsed.success)
        return reply.code(400).send({ error: parsed.error.flatten() });
  
      const { message, connectionId } = parsed.data;
  
      // 🔥 Call internal /chat route using Fastify inject()
      const internalResponse = await app.inject({
        method: "POST",
        url: "/chat",
        payload: {
          question: message,
          connectionId
        }
      });
  
      // Mirror the same result back to caller
      return reply
        .code(internalResponse.statusCode)
        .send(internalResponse.json());
    }
  );
}