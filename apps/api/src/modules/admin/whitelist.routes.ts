import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@wisesama/database';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';
import { normalizeEntityValue } from '../../utils/normalize';

const createWhitelistSchema = z.object({
  entityType: z.enum(['ADDRESS', 'DOMAIN', 'TWITTER', 'EMAIL']),
  value: z.string().min(1),
  name: z.string().min(1),
  category: z.string().min(1),
  description: z.string().optional(),
  website: z.string().url().optional().nullable(),
  twitter: z.string().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  chainCode: z.string().optional().nullable(),
});

const updateWhitelistSchema = createWhitelistSchema.partial().extend({
  isActive: z.boolean().optional(),
});

const bulkImportSchema = z.object({
  entities: z.array(createWhitelistSchema).min(1).max(100),
});

export async function whitelistRoutes(fastify: FastifyInstance) {
  // List all whitelist entities
  fastify.get(
    '/admin/whitelist',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'List all whitelisted entities',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            entityType: { type: 'string', enum: ['ADDRESS', 'DOMAIN', 'TWITTER', 'EMAIL'] },
            search: { type: 'string' },
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 50 },
          },
        },
      },
    },
    async (request) => {
      const { category, entityType, search, page = 1, limit = 50 } = request.query as {
        category?: string;
        entityType?: string;
        search?: string;
        page?: number;
        limit?: number;
      };

      const where: Record<string, unknown> = {};

      if (category) where.category = category;
      if (entityType) where.entityType = entityType;
      if (search) {
        where.OR = [
          { name: { contains: search, mode: 'insensitive' } },
          { value: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ];
      }

      const [entities, total] = await Promise.all([
        prisma.whitelistedEntity.findMany({
          where,
          include: {
            chain: { select: { code: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.whitelistedEntity.count({ where }),
      ]);

      return {
        entities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // Get single whitelist entity
  fastify.get(
    '/admin/whitelist/:id',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get a single whitelisted entity',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const entity = await prisma.whitelistedEntity.findUnique({
        where: { id },
        include: {
          chain: { select: { code: true, name: true } },
        },
      });

      if (!entity) {
        reply.status(404);
        return { error: 'Entity not found' };
      }

      return { entity };
    }
  );

  // Create whitelist entity
  fastify.post(
    '/admin/whitelist',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Create a new whitelisted entity',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            entityType: { type: 'string', enum: ['ADDRESS', 'DOMAIN', 'TWITTER', 'EMAIL'] },
            value: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string' },
            description: { type: 'string' },
            website: { type: 'string', nullable: true },
            twitter: { type: 'string', nullable: true },
            logoUrl: { type: 'string', nullable: true },
            chainCode: { type: 'string', nullable: true },
          },
          required: ['entityType', 'value', 'name', 'category'],
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const body = createWhitelistSchema.parse(request.body);

      const normalizedValue = normalizeEntityValue(body.value, body.entityType);

      // Check for duplicates
      const existing = await prisma.whitelistedEntity.findUnique({
        where: {
          entityType_normalizedValue: {
            entityType: body.entityType,
            normalizedValue,
          },
        },
      });

      if (existing) {
        reply.status(409);
        return { error: 'Entity already exists in whitelist' };
      }

      // Get chain if specified
      let chainId: number | null = null;
      if (body.chainCode) {
        const chain = await prisma.chain.findUnique({ where: { code: body.chainCode } });
        if (chain) chainId = chain.id;
      }

      const entity = await prisma.whitelistedEntity.create({
        data: {
          entityType: body.entityType,
          value: body.value,
          normalizedValue,
          name: body.name,
          category: body.category,
          description: body.description,
          website: body.website,
          twitter: body.twitter,
          logoUrl: body.logoUrl,
          chainId,
          source: 'admin',
          verifiedAt: new Date(),
          verifiedBy: user.email,
        },
        include: {
          chain: { select: { code: true, name: true } },
        },
      });

      reply.status(201);
      return { entity };
    }
  );

  // Update whitelist entity
  fastify.put(
    '/admin/whitelist/:id',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Update a whitelisted entity',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = updateWhitelistSchema.parse(request.body);

      const existing = await prisma.whitelistedEntity.findUnique({ where: { id } });
      if (!existing) {
        reply.status(404);
        return { error: 'Entity not found' };
      }

      // Handle chain update
      let chainId: number | null | undefined = undefined;
      if (body.chainCode !== undefined) {
        if (body.chainCode) {
          const chain = await prisma.chain.findUnique({ where: { code: body.chainCode } });
          chainId = chain?.id ?? null;
        } else {
          chainId = null;
        }
      }

      // Handle value update (need to update normalizedValue too)
      let normalizedValue: string | undefined = undefined;
      if (body.value && body.entityType) {
        normalizedValue = normalizeEntityValue(body.value, body.entityType);
      } else if (body.value) {
        // Use existing entityType if only value is being updated
        normalizedValue = normalizeEntityValue(body.value, existing.entityType);
      }

      const entity = await prisma.whitelistedEntity.update({
        where: { id },
        data: {
          ...(body.entityType && { entityType: body.entityType }),
          ...(body.value && { value: body.value }),
          ...(normalizedValue && { normalizedValue }),
          ...(body.name && { name: body.name }),
          ...(body.category && { category: body.category }),
          ...(body.description !== undefined && { description: body.description }),
          ...(body.website !== undefined && { website: body.website }),
          ...(body.twitter !== undefined && { twitter: body.twitter }),
          ...(body.logoUrl !== undefined && { logoUrl: body.logoUrl }),
          ...(body.isActive !== undefined && { isActive: body.isActive }),
          ...(chainId !== undefined && { chainId }),
        },
        include: {
          chain: { select: { code: true, name: true } },
        },
      });

      return { entity };
    }
  );

  // Delete whitelist entity
  fastify.delete(
    '/admin/whitelist/:id',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Delete a whitelisted entity',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      const existing = await prisma.whitelistedEntity.findUnique({ where: { id } });
      if (!existing) {
        reply.status(404);
        return { error: 'Entity not found' };
      }

      await prisma.whitelistedEntity.delete({ where: { id } });

      return { message: 'Entity deleted successfully' };
    }
  );

  // Bulk import whitelist entities
  fastify.post(
    '/admin/whitelist/bulk',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Bulk import whitelisted entities',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            entities: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  entityType: { type: 'string', enum: ['ADDRESS', 'DOMAIN', 'TWITTER', 'EMAIL'] },
                  value: { type: 'string' },
                  name: { type: 'string' },
                  category: { type: 'string' },
                  description: { type: 'string' },
                  website: { type: 'string', nullable: true },
                  twitter: { type: 'string', nullable: true },
                  chainCode: { type: 'string', nullable: true },
                },
                required: ['entityType', 'value', 'name', 'category'],
              },
            },
          },
          required: ['entities'],
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const body = bulkImportSchema.parse(request.body);

      const results = {
        created: 0,
        skipped: 0,
        errors: [] as string[],
      };

      for (const item of body.entities) {
        try {
          const normalizedValue = normalizeEntityValue(item.value, item.entityType);

          // Check for duplicates
          const existing = await prisma.whitelistedEntity.findUnique({
            where: {
              entityType_normalizedValue: {
                entityType: item.entityType,
                normalizedValue,
              },
            },
          });

          if (existing) {
            results.skipped++;
            continue;
          }

          // Get chain if specified
          let chainId: number | null = null;
          if (item.chainCode) {
            const chain = await prisma.chain.findUnique({ where: { code: item.chainCode } });
            if (chain) chainId = chain.id;
          }

          await prisma.whitelistedEntity.create({
            data: {
              entityType: item.entityType,
              value: item.value,
              normalizedValue,
              name: item.name,
              category: item.category,
              description: item.description,
              website: item.website,
              twitter: item.twitter,
              chainId,
              source: 'admin-bulk',
              verifiedAt: new Date(),
              verifiedBy: user.email,
            },
          });

          results.created++;
        } catch (error) {
          results.errors.push(`Failed to import ${item.value}: ${error}`);
        }
      }

      reply.status(results.errors.length > 0 ? 207 : 201);
      return results;
    }
  );

  // Get whitelist categories
  fastify.get(
    '/admin/whitelist/categories',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get all whitelist categories with counts',
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const categories = await prisma.whitelistedEntity.groupBy({
        by: ['category'],
        _count: { category: true },
        orderBy: { _count: { category: 'desc' } },
      });

      return {
        categories: categories.map((c) => ({
          name: c.category,
          count: c._count.category,
        })),
      };
    }
  );
}
