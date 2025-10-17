import { execSync } from 'child_process';
import { Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

export async function ensureDatabaseExists(url: string) {
  const urlObj = new URL(url);
  const dbName = urlObj.pathname.slice(1);
  urlObj.pathname = '/postgres';

  const client = new Client({ connectionString: urlObj.toString() });
  await client.connect();

  const res = await client.query(`SELECT 1 FROM pg_database WHERE datname = '${dbName}'`);
  if (res.rowCount === 0) {
    console.log(`🆕 Creating database ${dbName}`);
    await client.query(`CREATE DATABASE ${dbName}`);
  }

  await client.end();
}

export async function initializeGuardrailsDB() {
  const defaultUrl = process.env.GUARDRAILS_DB_URL || 'postgresql://postgres:postgres@localhost:5432/guardrails';

  // Persist to .env so Prisma sees it on future runs
  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    fs.writeFileSync(envPath, `GUARDRAILS_DB_URL=${defaultUrl}\n`);
    console.log('🆕 Created .env file for Prisma');
  }

  process.env.GUARDRAILS_DB_URL = defaultUrl;

  // Ensure database exists
  await ensureDatabaseExists(defaultUrl);

  // Run migrations automatically
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    console.log('🟢 Guardrails DB schema deployed');
  } catch (err) {
    console.error('⚠️ Schema deploy failed:', err);
  }

  const prisma = new PrismaClient();
  await prisma.$connect();
  console.log('🟢 Guardrails DB connected at', defaultUrl);

  return prisma;
}