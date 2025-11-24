import { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";
import { z } from "zod";

function buildActor(req: any) {
  const u = req.user as any;
  return {
    userId: u?.userId ?? null,
    email: u?.email ?? null,
    roles: u?.roles ?? [],
    ip: req.ip,
    userAgent: req.headers["user-agent"],
  };
}

async function audit(prisma: PrismaClient, req: any, params: {
  action: string;
  category: string;
  type: string;
  severity: "info" | "warning" | "critical";
  before?: any;
  after?: any;
  details?: any;
  error?: any;
}) {
  try {
    const actor = buildActor(req);
    await prisma.auditLog.create({
      data: {
        action: params.action,
        userId: actor.userId,
        requestId: req.id,
        details: JSON.stringify({
          ...params,
          actor,
          timestamp: new Date().toISOString()
        })
      }
    });
  } catch (err) {
    console.error("Audit log failed:", err);
  }
}

export async function roleRoutes(app: FastifyInstance, prisma: PrismaClient) {
  //
  // GET /roles — list all roles
  //
  app.get("/roles", { preHandler: (app as any).auth }, async (_req: any, reply: any) => {
    const roles = await prisma.role.findMany({
      orderBy: { name: "asc" }
    });
    return roles;
  });

  //
  // POST /roles — create a new role
  //
  app.post("/roles", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const Body = z.object({
      name: z.string().min(1),
      label: z.string().optional(),
      description: z.string().optional()
    });

    const parsed = Body.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: parsed.error.flatten() });

    const { name, label, description } = parsed.data;

    const exists = await prisma.role.findUnique({ where: { name } });
    if (exists) return reply.code(400).send({ error: "Role already exists" });

    const role = await prisma.role.create({
      data: { name, label, description }
    });

    await audit(prisma, req, {
      action: "role_created",
      category: "role",
      type: "create",
      severity: "info",
      after: role,
      details: role
    });

    return reply.code(201).send({ ok: true, role });
  });

  //
  // GET /roles/:id — get single role INCLUDING assigned users
  //
  app.get("/roles/:id", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const { id } = req.params as { id: string };

    const role = await prisma.role.findUnique({
      where: { id },
      include: {
        users: { include: { user: true } },
        connectionPermissions: { include: { connection: true } }
      }
    });

    if (!role) return reply.code(404).send({ error: "Role not found" });

    return {
      ...role,
      allowedConnections: role.connectionPermissions.map(cp => cp.connection)
    };
  });

  //
  // PATCH /roles/:id — update a role
  //
  app.patch("/roles/:id", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const { id } = req.params as { id: string };

    const Body = z.object({
      name: z.string().min(1).optional(),
      label: z.string().optional(),
      description: z.string().optional()
    });

    const parsed = Body.safeParse(req.body);
    if (!parsed.success)
      return reply.code(400).send({ error: parsed.error.flatten() });

    const updated = await prisma.role.update({
      where: { id },
      data: parsed.data
    });

    await audit(prisma, req, {
      action: "role_updated",
      category: "role",
      type: "update",
      severity: "info",
      after: updated,
      details: updated
    });

    return { ok: true, role: updated };
  });

  //
  // DELETE /roles/:id — delete role
  //
  app.delete("/roles/:id", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const { id } = req.params as { id: string };

    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) return reply.code(404).send({ error: "Role not found" });

    await prisma.role.delete({ where: { id } });

    await audit(prisma, req, {
      action: "role_deleted",
      category: "role",
      type: "delete",
      severity: "warning",
      before: role,
      details: role
    });

    return { ok: true };
  });
  //
  // POST /roles/:id/assign — assign user to role
  //
  app.post("/roles/:id/assign", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const Body = z.object({ userId: z.string() });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { userId } = parsed.data;

    const exists = await prisma.userRole.findFirst({
      where: { roleId: id, userId }
    });

    if (!exists) {
      await prisma.userRole.create({
        data: { roleId: id, userId }
      });
      await audit(prisma, req, {
        action: "role_user_assigned",
        category: "role",
        type: "assign_user",
        severity: "info",
        details: { roleId: id, userId }
      });
    }

    const role = await prisma.role.findUnique({
      where: { id },
      include: { users: { include: { user: true } } }
    });

    return reply.send({ ok: true, role });
  });

  //
  // POST /roles/:id/unassign — remove user from role
  //
  app.post("/roles/:id/unassign", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const { id } = req.params as { id: string };
    const Body = z.object({ userId: z.string() });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { userId } = parsed.data;

    await prisma.userRole.deleteMany({
      where: { roleId: id, userId }
    });

    await audit(prisma, req, {
      action: "role_user_unassigned",
      category: "role",
      type: "unassign_user",
      severity: "info",
      details: { roleId: id, userId }
    });

    const role = await prisma.role.findUnique({
      where: { id },
      include: { users: { include: { user: true } } }
    });

    return reply.send({ ok: true, role });
  });
  //
  // GET /roles/:id/connections — list allowed connections for this role
  //
  app.get("/roles/:id/connections", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const { id } = req.params as { id: string };

    const connections = await prisma.connectionPermission.findMany({
      where: { roleId: id },
      include: { connection: true }
    });

    return reply.send(connections.map(cp => cp.connection));
  });

  //
  // POST /roles/:id/connections/assign — assign connection to role
  //
  app.post("/roles/:id/connections/assign", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const { id } = req.params as { id: string };

    const Body = z.object({
      connectionId: z.string()
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { connectionId } = parsed.data;

    const exists = await prisma.connectionPermission.findFirst({
      where: { roleId: id, connectionId }
    });

    if (!exists) {
      await prisma.connectionPermission.create({
        data: { roleId: id, connectionId }
      });
      await audit(prisma, req, {
        action: "role_connection_assigned",
        category: "role",
        type: "assign_connection",
        severity: "info",
        details: { roleId: id, connectionId }
      });
    }

    const updated = await prisma.connectionPermission.findMany({
      where: { roleId: id },
      include: { connection: true }
    });

    return reply.send({ ok: true, connections: updated.map(c => c.connection) });
  });

  //
  // POST /roles/:id/connections/unassign — remove connection assignment
  //
  app.post("/roles/:id/connections/unassign", { preHandler: (app as any).auth }, async (req: any, reply: any) => {
    const { id } = req.params as { id: string };

    const Body = z.object({
      connectionId: z.string()
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { connectionId } = parsed.data;

    await prisma.connectionPermission.deleteMany({
      where: { roleId: id, connectionId }
    });

    await audit(prisma, req, {
      action: "role_connection_unassigned",
      category: "role",
      type: "unassign_connection",
      severity: "info",
      details: { roleId: id, connectionId }
    });

    const updated = await prisma.connectionPermission.findMany({
      where: { roleId: id },
      include: { connection: true }
    });

    return reply.send({ ok: true, connections: updated.map(c => c.connection) });
  });
}