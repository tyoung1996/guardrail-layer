import { FastifyInstance } from "fastify";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";

export async function userRoutes(app: FastifyInstance, prisma: PrismaClient) {
  // Create user (admin only)
  app.post("/users", { preHandler: (app as any).auth }, async (req, reply) => {
    const Body = z.object({
      email: z.string().email(),
      password: z.string().min(6),
      name: z.string().optional(),
      roles: z.array(z.string()).optional() // roleIds
    });

    const parsed = Body.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: parsed.error.flatten() });

    const { email, password, name, roles } = parsed.data;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing)
      return reply.code(400).send({ error: "User already exists" });

    const passwordHash = await bcrypt.hash(password, 10);

    const created = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        roles: roles
          ? {
              create: roles.map((roleId) => ({
                role: { connect: { id: roleId } }
              }))
            }
          : undefined
      },
      include: {
        roles: { include: { role: true } }
      }
    });

    return { ok: true, user: created };
  });

  // List users
  app.get("/users", { preHandler: (app as any).auth }, async (_req, reply) => {
    const users = await prisma.user.findMany({
      include: {
        roles: { include: { role: true } }
      }
    });
    return users;
  });

  // Get single user
  app.get("/users/:id", { preHandler: (app as any).auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        roles: { include: { role: true } }
      }
    });
    if (!user) return reply.code(404).send({ error: "User not found" });
    return user;
  });

  // Update user
  app.patch("/users/:id", { preHandler: (app as any).auth }, async (req, reply) => {
    const { id } = req.params as { id: string };

    const Body = z.object({
      name: z.string().optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      disabled: z.boolean().optional()
    });

    const parsed = Body.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: parsed.error.flatten() });

    const data: any = parsed.data;

    if (data.password) {
      data.passwordHash = await bcrypt.hash(data.password, 10);
      delete data.password;
    }

    const updated = await prisma.user.update({
      where: { id },
      data
    });

    return updated;
  });

  // Delete (disable) user
  app.delete("/users/:id", { preHandler: (app as any).auth }, async (req, reply) => {
    const { id } = req.params as { id: string };
    await prisma.user.update({
      where: { id },
      data: { disabled: true }
    });
    return { ok: true };
  });
}