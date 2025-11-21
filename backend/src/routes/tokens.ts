// src/routes/tokens.ts
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcrypt';

export async function tokenRoutes(app: FastifyInstance, prisma: PrismaClient) {
  // GET /api/tokens
  app.get('/api/tokens', { preHandler: (app as any).auth }, async (req, reply) => {
    const tokens = await prisma.apiToken.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        lastUsed: true,
        revoked: true,
      },
    });
    return reply.send(tokens);
  });

  // POST /api/tokens — secure hashed tokens, tied to user + connection
  app.post('/api/tokens', { preHandler: (app as any).auth }, async (req, reply) => {
    const Body = z.object({
      name: z.string().min(1),
      connectionId: z.string().min(1),
      scopes: z.array(z.enum(['read', 'write', 'admin'])).default(['read']),
      expiresAt: z.string().optional(),
    });

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: parsed.error.flatten() });
    }

    const { name, connectionId, scopes, expiresAt } = parsed.data;

    // Generate a plaintext token (returned once)
    const token = crypto.randomBytes(32).toString('hex');

    // Hash token before storing
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const record = await prisma.apiToken.create({
      data: {
        name,
        connectionId,
        scopes,
        hashedToken,
        userId: (req as any).user.userId,
        expiresAt: expiresAt ? new Date(expiresAt) : null
      },
    });

    return reply.send({
      id: record.id,
      name: record.name,
      createdAt: record.createdAt,
      token // returned only once
    });
  });

  // DELETE /api/tokens/:id
  app.delete('/api/tokens/:id', { preHandler: (app as any).auth }, async (req, reply) => {
    const id = (req.params as { id: string }).id;
    await prisma.apiToken.update({
      where: { id },
      data: { revoked: true },
    });
    return reply.send({ ok: true });
  });
}