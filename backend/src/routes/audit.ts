// src/routes/audit.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

export async function auditRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get('/audit', async (req, reply) => {
    try {
      const { userId, connectionId, action } = req.query as {
        userId?: string;
        connectionId?: string;
        action?: string;
      };
      const logs = await prisma.auditLog.findMany({
        where: {
          ...(userId ? { userId } : {}),
          ...(connectionId ? { connectionId } : {}),
          ...(action ? { action } : {}),
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return reply.send(logs);
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });

  app.post('/audit', async (req, reply) => {
    const Body = z.object({
      action: z.string(),
      details: z.string().optional(),
      userId: z.string().optional(),
      connectionId: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const log = await prisma.auditLog.create({ data: parsed.data });
      return reply.send(log);
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });
}