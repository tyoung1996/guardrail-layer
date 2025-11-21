// src/server.ts
import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { auditRoutes } from './routes/audit.js';
import { connectionRoutes } from './routes/connections.js';
import { redactionRoutes } from './routes/redactions.js';
import { metadataRoutes } from './routes/metadata.js';
import { queryRoutes } from './routes/query.js';
import { chatRoutes } from './routes/chat.js';
import OpenAI from 'openai';
import { PrismaClient } from '@prisma/client';
import { tokenRoutes } from './routes/tokens.js';
import fastifyJwt from '@fastify/jwt';
import bcrypt from 'bcrypt';
import { authRoutes } from './routes/auth.js';
import { createDefaultAdmin } from './createDefaultAdmin.js';
import { userRoutes } from './routes/users.js';
import { roleRoutes } from './routes/roles.js';



const prisma = new PrismaClient();

const openai = process.env.OPENAI_API_KEY ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) : null;

const PORT = Number(process.env.PORT || 8080);

export async function buildServer() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET || "dev-secret-change-this",
  });

  app.decorate("auth", async function (req: any, reply: any) {
    try {
      await req.jwtVerify();
      // Normalize JWT payload for consistent user references across routes
      req.user = {
        id: req.user.userId,
        userId: req.user.userId,
        email: req.user.email
      };
    } catch (err) {
      return reply.code(401).send({ error: "Unauthorized" });
    }
  });

  await app.register(async (app) => authRoutes(app, prisma));

  // Register routes (we’ll add more later)
  await app.register(async (app) => auditRoutes(app, prisma));
  await app.register(async (app) => connectionRoutes(app, prisma));
  await app.register(async (app) => redactionRoutes(app, prisma));
  await app.register(async (app) => metadataRoutes(app, prisma));
  await app.register(async (app) => queryRoutes(app, prisma));
  await app.register(async (app) => chatRoutes(app, prisma, openai));
  await app.register(async (app) => tokenRoutes(app, prisma));
  await app.register(async (app) => userRoutes(app, prisma));
  await app.register(async (app) => roleRoutes(app, prisma));

  // Health
  app.get('/health', async () => ({ ok: true }));

  return app;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await createDefaultAdmin();
  const app = await buildServer();
  await app.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`Guardrail backend running on http://localhost:${PORT}`);
}