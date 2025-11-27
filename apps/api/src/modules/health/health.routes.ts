import type { FastifyInstance } from 'fastify';
import { prisma } from '@wisesama/database';
import { redis } from '../../lib/redis';

export async function healthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', {
    schema: {
      tags: ['health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            services: {
              type: 'object',
              properties: {
                database: { type: 'string' },
                redis: { type: 'string' },
              },
            },
          },
        },
      },
    },
    handler: async () => {
      let dbStatus = 'healthy';
      let redisStatus = 'healthy';

      try {
        await prisma.$queryRaw`SELECT 1`;
      } catch {
        dbStatus = 'unhealthy';
      }

      try {
        await redis.ping();
      } catch {
        redisStatus = 'unhealthy';
      }

      const isHealthy = dbStatus === 'healthy' && redisStatus === 'healthy';

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: {
          database: dbStatus,
          redis: redisStatus,
        },
      };
    },
  });
}
