// src/server.ts
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { auditRoutes } from './routes/audit';
import { connectionRoutes } from './routes/connections';
import { redactionRoutes } from './routes/redactions';
import { metadataRoutes } from './routes/metadata';
import { queryRoutes } from './routes/query';
import { chatRoutes } from './routes/chat';

import OpenAI from 'openai';

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;
import { prisma } from './prisma/client';

const PORT = Number(process.env.PORT || 8080);

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  // Register routes (we’ll add more later)
  await app.register(async (app) => auditRoutes(app, prisma));
  await app.register(async (app) => connectionRoutes(app, prisma));
  await app.register(async (app) => redactionRoutes(app, prisma));
  await app.register(async (app) => metadataRoutes(app, prisma));
  await app.register(async (app) => queryRoutes(app, prisma));
  await app.register(async (app) => chatRoutes(app, prisma, openai));


  // Health
  app.get('/health', async () => ({ ok: true }));

  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const app = await buildServer();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Guardrail backend running on http://localhost:${PORT}`);
}