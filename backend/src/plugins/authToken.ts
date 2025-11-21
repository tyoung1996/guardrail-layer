// src/plugins/authToken.ts
import { FastifyReply, FastifyRequest } from 'fastify';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function verifyAuthToken(req: FastifyRequest, reply: FastifyReply) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return reply.code(401).send({ error: 'Missing or invalid Authorization header' });
  }

  const token = header.replace('Bearer ', '');
  const crypto = await import('crypto');
  const hashed = crypto.createHash('sha256').update(token).digest('hex');

  const record = await prisma.apiToken.findFirst({
    where: { hashedToken: hashed, revoked: false },
    include: { user: true },
  });

  if (!record) {
    return reply.code(401).send({ error: 'Invalid or revoked token' });
  }

  await prisma.apiToken.update({
    where: { id: record.id },
    data: { lastUsed: new Date() },
  });

  (req as any).apiToken = record;
  (req as any).user = record.user;
}