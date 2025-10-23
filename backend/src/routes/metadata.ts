// src/routes/metadata.ts
import { z } from "zod";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "@prisma/client";

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
  app.get<{ Params: { connectionId: string } }>("/metadata/:connectionId", async (req, reply) => {
    const { connectionId } = req.params;
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
    async (req, reply) => {
      const { connectionId, tableName } = req.params;
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
    async (req, reply) => {
      const { connectionId, tableName } = req.params;
      const Body = z.object({
        description: z.string().optional(),
        notes: z.string().optional(),
        tags: z.union([z.array(z.string()), z.string()]).optional(),
      });
      const parsed = Body.safeParse(req.body);
      if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

      const tagsArray = Array.isArray(parsed.data.tags)
        ? parsed.data.tags
        : parsed.data.tags?.split(",").map(t => t.trim()) ?? [];

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
  app.post("/metadata/table", async (req, reply) => {
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
    const tagsArray = Array.isArray(tags) ? tags : tags?.split(",").map(t => t.trim()) ?? [];

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
  app.post("/metadata/column", async (req, reply) => {
    const Body = z.object({
      tableMetadataId: z.string(),
      columnName: z.string(),
      description: z.string().optional(),
      example: z.string().optional(),
      importance: z.number().optional(),
    });
    const parsed = Body.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.flatten() });

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