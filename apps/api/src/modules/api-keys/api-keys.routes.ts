import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@wisesama/database';
import { authenticate } from '../../middleware/auth.middleware';

const createKeySchema = z.object({
  name: z.string().min(1).max(100).optional(),
});

/**
 * Generate a secure API key with prefix
 * Format: wsk_live_xxxxxxxxxxxxxxxxxxxx
 */
function generateApiKey(): { key: string; hash: string; prefix: string } {
  const randomBytes = crypto.randomBytes(24);
  const key = `wsk_live_${randomBytes.toString('base64url')}`;
  const hash = crypto.createHash('sha256').update(key).digest('hex');
  const prefix = key.slice(0, 16); // wsk_live_xxxx

  return { key, hash, prefix };
}

export async function apiKeysRoutes(fastify: FastifyInstance) {
  // Create API key
  fastify.post(
    '/api-keys',
    {
      preHandler: authenticate,
      schema: {
        tags: ['api-keys'],
        description: 'Create a new API key',
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Optional name for the key' },
          },
        },
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              key: { type: 'string', description: 'Full API key (only shown once)' },
              keyPrefix: { type: 'string' },
              name: { type: 'string', nullable: true },
              remainingQuota: { type: 'number' },
              rateLimitPerMin: { type: 'number' },
              createdAt: { type: 'string' },
            },
          },
          400: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const body = createKeySchema.parse(request.body || {});

      // Check existing key count (limit to 5 per user)
      const existingCount = await prisma.apiKey.count({
        where: { userId: user.id, isActive: true },
      });

      if (existingCount >= 5) {
        reply.status(400);
        return { error: 'Maximum of 5 active API keys allowed' };
      }

      const { key, hash, prefix } = generateApiKey();

      const apiKey = await prisma.apiKey.create({
        data: {
          userId: user.id,
          keyHash: hash,
          keyPrefix: prefix,
          name: body.name,
          remainingQuota: user.tier === 'free' ? 10000 : 100000,
          rateLimitPerMin: user.tier === 'free' ? 60 : 300,
        },
      });

      reply.status(201);
      return {
        id: apiKey.id,
        key, // Only time the full key is shown
        keyPrefix: apiKey.keyPrefix,
        name: apiKey.name,
        remainingQuota: apiKey.remainingQuota,
        rateLimitPerMin: apiKey.rateLimitPerMin,
        createdAt: apiKey.createdAt,
      };
    }
  );

  // List API keys
  fastify.get(
    '/api-keys',
    {
      preHandler: authenticate,
      schema: {
        tags: ['api-keys'],
        description: 'List all API keys for the current user',
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              keys: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string' },
                    keyPrefix: { type: 'string' },
                    name: { type: 'string', nullable: true },
                    remainingQuota: { type: 'number' },
                    rateLimitPerMin: { type: 'number' },
                    isActive: { type: 'boolean' },
                    lastUsedAt: { type: 'string', nullable: true },
                    createdAt: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const user = request.user!;

      const keys = await prisma.apiKey.findMany({
        where: { userId: user.id },
        select: {
          id: true,
          keyPrefix: true,
          name: true,
          remainingQuota: true,
          rateLimitPerMin: true,
          isActive: true,
          lastUsedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });

      return { keys };
    }
  );

  // Revoke API key
  fastify.delete(
    '/api-keys/:id',
    {
      preHandler: authenticate,
      schema: {
        tags: ['api-keys'],
        description: 'Revoke an API key',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
            },
          },
          404: {
            type: 'object',
            properties: {
              error: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const user = request.user!;
      const { id } = request.params as { id: string };

      const apiKey = await prisma.apiKey.findFirst({
        where: { id, userId: user.id },
      });

      if (!apiKey) {
        reply.status(404);
        return { error: 'API key not found' };
      }

      await prisma.apiKey.update({
        where: { id },
        data: { isActive: false },
      });

      return { message: 'API key revoked successfully' };
    }
  );
}
