import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { QueryService } from '../../services/query.service';

const queryService = new QueryService();

export async function checkRoutes(fastify: FastifyInstance) {
  // Single entity lookup
  fastify.get<{ Params: { entity: string } }>('/check/:entity', {
    schema: {
      tags: ['check'],
      description: 'Look up risk assessment for an entity (address, domain, or Twitter handle)',
      params: {
        type: 'object',
        properties: {
          entity: { type: 'string', description: 'Address, domain, or Twitter handle to check' },
        },
        required: ['entity'],
      },
      response: {
        200: {
          type: 'object',
          properties: {
            entity: { type: 'string' },
            entityType: { type: 'string', enum: ['ADDRESS', 'DOMAIN', 'TWITTER', 'EMAIL'] },
            chain: { type: 'string' },
            assessment: {
              type: 'object',
              properties: {
                riskLevel: { type: 'string', enum: ['SAFE', 'UNKNOWN', 'CAUTION', 'FRAUD'] },
                riskScore: { type: ['number', 'null'] },
                threatCategory: { type: ['string', 'null'] },
              },
            },
            blacklist: {
              type: 'object',
              properties: {
                found: { type: 'boolean' },
                source: { type: 'string' },
                threatName: { type: 'string' },
              },
            },
            whitelist: {
              type: 'object',
              properties: {
                found: { type: 'boolean' },
                name: { type: 'string' },
                category: { type: 'string' },
              },
            },
            identity: {
              type: 'object',
              properties: {
                hasIdentity: { type: 'boolean' },
                isVerified: { type: 'boolean' },
                displayName: { type: ['string', 'null'] },
              },
            },
            stats: {
              type: 'object',
              properties: {
                timesSearched: { type: 'number' },
                userReports: { type: 'number' },
                lastSearched: { type: ['string', 'null'] },
              },
            },
          },
        },
      },
    },
    handler: async (request, reply) => {
      const { entity } = request.params;

      try {
        const result = await queryService.checkEntity(entity);
        return result;
      } catch (error) {
        request.log.error(error, 'Failed to check entity');
        reply.status(500);
        return { error: 'Failed to check entity' };
      }
    },
  });

  // Batch lookup
  fastify.post<{ Body: { entities: string[] } }>('/check/batch', {
    schema: {
      tags: ['check'],
      description: 'Batch lookup for multiple entities (max 50)',
      body: {
        type: 'object',
        properties: {
          entities: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 50,
          },
        },
        required: ['entities'],
      },
    },
    handler: async (request, reply) => {
      const schema = z.object({
        entities: z.array(z.string()).max(50),
      });

      const parsed = schema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Invalid request body', details: parsed.error.issues };
      }

      const results = await Promise.all(
        parsed.data.entities.map(async (entity) => {
          try {
            return await queryService.checkEntity(entity);
          } catch {
            return { entity, error: 'Failed to check entity' };
          }
        })
      );

      const failed = results.filter((r) => 'error' in r).length;

      return {
        results,
        totalProcessed: results.length,
        totalFailed: failed,
      };
    },
  });
}
