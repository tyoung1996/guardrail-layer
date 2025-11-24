// src/routes/auth.ts
import type { FastifyInstance } from 'fastify';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import bcrypt from 'bcrypt';

export async function authRoutes(app: FastifyInstance, prisma: PrismaClient) {

  // REGISTER
  app.post('/auth/register', async (req: any, reply: any) => {
    const Body = z.object({
      email: z.string().email().or(z.string().endsWith("@localhost")),
      password: z.string().min(6),
      name: z.string().optional(),
    });

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const { email, password, name } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) return reply.code(400).send({ error: 'Email already exists' });

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: { email, name, passwordHash }
    });

    return reply.send({ id: user.id, email: user.email });
  });

  // LOGIN
  app.post('/auth/login', async (req: any, reply: any) => {
    const Body = z.object({
      email: z.string().email().or(z.string().endsWith("@localhost")),
      password: z.string().min(1),
    });

    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send(parsed.error.flatten());

    const { email, password } = parsed.data;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return reply.code(401).send({ error: 'Invalid login' });

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) return reply.code(401).send({ error: 'Invalid login' });

    const userWithRoles = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        roles: {
          select: {
            role: {
              select: { name: true }
            }
          }
        }
      }
    });

    const token = app.jwt.sign({
      userId: user.id,
      email: user.email,
      isAdmin: userWithRoles?.isAdmin ?? false,
      roles: userWithRoles?.roles.map((r: any) => r.role.name) ?? []
    });

    await prisma.user.update({
      where: { id: user.id },
      data: { lastLogin: new Date() }
    });

    return reply.send({ token });
  });

  // CURRENT USER
  app.get('/auth/me', { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const userId = req.user?.userId;

    // Always fetch fresh roles from the database to avoid token staleness
    const dbUser = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        isAdmin: true,
        roles: {
          select: {
            role: {
              select: { name: true }
            }
          }
        }
      }
    });

    return reply.send({
      id: dbUser?.id,
      email: dbUser?.email,
      isAdmin: dbUser?.isAdmin ?? false,
      roles: dbUser?.roles.map((r: any) => r.role.name) ?? []
    });
  });
}