// src/routes/audit.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';

// Correct DB-backed RBAC helper (same as connections & redactions)
async function requireRole(req: any, reply: any, prisma: PrismaClient, requiredRole: string) {
  const user = req.user;
  if (!user?.userId) {
    reply.code(401).send({ error: "Unauthorized — no user" });
    return false;
  }

  // 1. Super admin bypass
  const dbUser = await prisma.user.findUnique({
    where: { id: user.userId },
    select: { isAdmin: true }
  });

  if (dbUser?.isAdmin) return true;

  // 2. DB role membership
  const roles = await prisma.userRole.findMany({
    where: { userId: user.userId },
    include: { role: true }
  });

  const roleNames = roles.map((r: any) => r.role.name.toLowerCase());

  if (!roleNames.includes(requiredRole.toLowerCase())) {
    reply.code(403).send({ error: `Forbidden — requires role: ${requiredRole}` });
    return false;
  }

  return true;
}

export async function auditRoutes(app: FastifyInstance, prisma: PrismaClient) {
  app.get('/audit', { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    if (!(await requireRole(req, reply, prisma, "admin"))) return;
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

  app.post('/audit', { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    if (!(await requireRole(req, reply, prisma, "admin"))) return;
    const Body = z.object({
      action: z.string(),
      details: z.string().optional(),
      userId: z.string().optional(),
      connectionId: z.string().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    try {
      const log = await prisma.auditLog.create({
        data: {
          ...parsed.data,
          userId: parsed.data.userId ?? (req.user as any)?.userId
        }
      });
      return reply.send(log);
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });
}