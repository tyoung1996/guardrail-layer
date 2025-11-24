// src/routes/metadata.ts
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

// RBAC helpers
async function requirePermission(prisma: any, req: any, reply: any, connectionId: string) {
  const userId = req.user?.userId;

  if (!userId) {
    try {
      await prisma.auditLog.create({
        data: {
          action: "permission_denied",
          userId: null,
          requestId: req.id,
          details: JSON.stringify({
            category: "rbac",
            type: "unauthorized_no_user",
            severity: "warning",
            actor: { ip: req.ip, userAgent: req.headers["user-agent"] },
            connectionId,
            timestamp: new Date().toISOString()
          })
        }
      });
    } catch (_) {}
    reply.code(401).send({ error: "Unauthorized — no user" });
    return false;
  }

  // Check if user is system admin (DB verified)
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { isAdmin: true }
  });

  if (user?.isAdmin) {
    // Admin bypass for all connections
    return true;
  }

  // Normal RBAC permission check
  const roles = req.user?.roles || [];

  const allowed = await prisma.connectionPermission.findFirst({
    where: {
      connectionId,
      OR: [
        { userId },
        { role: { name: { in: roles } } }
      ]
    }
  });

  if (!allowed) {
    try {
      await prisma.auditLog.create({
        data: {
          action: "permission_denied",
          userId,
          requestId: req.id,
          details: JSON.stringify({
            category: "rbac",
            type: "forbidden_connection_access",
            severity: "warning",
            actor: {
              userId,
              roles: req.user?.roles ?? [],
              ip: req.ip,
              userAgent: req.headers["user-agent"]
            },
            connectionId,
            timestamp: new Date().toISOString()
          })
        }
      });
    } catch (_) {}
    reply.code(403).send({ error: "Forbidden — no permission for this connection" });
    return false;
  }

  return true;
}

async function requireRole(prisma: any, req: any, reply: any, roles: string[]) {
  const userId = req.user?.userId;
  if (!userId) {
    reply.code(401).send({ error: "Unauthorized — no user" });
    return false;
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      isAdmin: true,
      roles: { select: { role: { select: { name: true } } } }
    }
  });

  if (!user) {
    reply.code(401).send({ error: "Unauthorized — user not found" });
    return false;
  }

  // Admin bypass
  if (user.isAdmin) return true;

  const userRoles = user.roles.map((r: any) => r.role.name);

  if (!roles.some(r => userRoles.includes(r))) {
    reply.code(403).send({ error: "Forbidden — requires one of roles: " + roles.join(", ") });
    return false;
  }

  return true;
}

/**
 * Metadata Routes
 * 
 * Handles:
 * - Table metadata (description, tags, notes)
 * - Column metadata (description, examples, importance)
 * 
 * Endpoints:
 * - GET    /metadata/:connectionId
 * - GET    /metadata/:connectionId/:tableName
 * - POST   /metadata/:connectionId/:tableName
 * - POST   /metadata/table
 * - POST   /metadata/column
 */
export async function metadataRoutes(app: FastifyInstance, prisma: PrismaClient) {
  
  // Get all table metadata for a connection
  app.get<{ Params: { connectionId: string } }>("/metadata/:connectionId", { preHandler: (app as any).auth }, async (req, reply) => {
    const { connectionId } = req.params;
    const allowed = await requirePermission(prisma, req, reply, connectionId);
    if (!allowed) return;
    try {
      const tables = await prisma.tableMetadata.findMany({
        where: { connectionId },
        include: { columns: true },
      });
      return reply.send(tables);
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });

  // Get metadata for a specific table
  app.get<{ Params: { connectionId: string; tableName: string } }>(
    "/metadata/:connectionId/:tableName",
    { preHandler: (app as any).auth },
    async (req, reply) => {
      const { connectionId, tableName } = req.params;
      const allowed = await requirePermission(prisma, req, reply, connectionId);
      if (!allowed) return;
      try {
        const table = await prisma.tableMetadata.findUnique({
          where: { connectionId_tableName: { connectionId, tableName } },
          include: { columns: true },
        });
        if (!table) return reply.code(404).send({ error: "Table metadata not found" });
        return reply.send(table);
      } catch (e: any) {
        req.log.error(e);
        return reply.code(500).send({ error: e.message });
      }
    }
  );

  // Create or update table metadata
  app.post<{ Params: { connectionId: string; tableName: string } }>(
    "/metadata/:connectionId/:tableName",
    { preHandler: (app as any).auth },
    async (req, reply) => {
      const { connectionId, tableName } = req.params;
      const allowed = await requirePermission(prisma, req, reply, connectionId);
      if (!allowed) return;
      if (!await requireRole(prisma, req, reply, ["admin", "analyst"])) return;
      const Body = z.object({
        description: z.string().optional(),
        notes: z.string().optional(),
        tags: z.union([z.array(z.string()), z.string()]).optional(),
      });
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const tagsArray = Array.isArray(parsed.data.tags)
        ? parsed.data.tags
        : parsed.data.tags?.split(",").map((t: string) => t.trim()) ?? [];

      try {
        const table = await prisma.tableMetadata.upsert({
          where: { connectionId_tableName: { connectionId, tableName } },
          update: { ...parsed.data, tags: tagsArray },
          create: { connectionId, tableName, ...parsed.data, tags: tagsArray },
        });
        return reply.send(table);
      } catch (e: any) {
        req.log.error(e);
        return reply.code(500).send({ error: e.message });
      }
    }
  );

  // Upsert table metadata via POST /metadata/table
  app.post("/metadata/table", { preHandler: (app as any).auth }, async (req, reply) => {
    const Body = z.object({
      connectionId: z.string(),
      tableName: z.string(),
      description: z.string().optional(),
      notes: z.string().optional(),
      tags: z.union([z.array(z.string()), z.string()]).optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    const { connectionId, tableName, description, notes, tags } = parsed.data;
    const allowed = await requirePermission(prisma, req, reply, connectionId);
    if (!allowed) return;
    if (!await requireRole(prisma, req, reply, ["admin", "analyst"])) return;
    const tagsArray = Array.isArray(tags) ? tags : tags?.split(",").map((t: string) => t.trim()) ?? [];

    try {
      const table = await prisma.tableMetadata.upsert({
        where: { connectionId_tableName: { connectionId, tableName } },
        update: { description, notes, tags: tagsArray },
        create: { connectionId, tableName, description, notes, tags: tagsArray },
      });
      return reply.send(table);
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });

  // Upsert column metadata via POST /metadata/column
  app.post("/metadata/column", { preHandler: (app as any).auth }, async (req, reply) => {
    const Body = z.object({
      tableMetadataId: z.string(),
      columnName: z.string(),
      description: z.string().optional(),
      example: z.string().optional(),
      importance: z.number().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

    // Resolve connectionId via tableMetadata lookup
    const tableMeta = await prisma.tableMetadata.findUnique({
      where: { id: parsed.data.tableMetadataId }
    });
    if (!tableMeta) return reply.code(404).send({ error: "Table metadata not found" });

    const allowed = await requirePermission(prisma, req, reply, tableMeta.connectionId);
    if (!allowed) return;
    if (!await requireRole(prisma, req, reply, ["admin", "analyst"])) return;

    const { tableMetadataId, columnName, description, example, importance } = parsed.data;

    try {
      const column = await prisma.columnMetadata.upsert({
        where: { tableMetadataId_columnName: { tableMetadataId, columnName } },
        update: { description, example, importance },
        create: { tableMetadataId, columnName, description, example, importance },
      });
      return reply.send(column);
    } catch (e: any) {
      req.log.error(e);
      return reply.code(500).send({ error: e.message });
    }
  });
}