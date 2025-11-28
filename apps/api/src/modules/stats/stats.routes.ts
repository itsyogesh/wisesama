import type { FastifyInstance } from 'fastify';
import { prisma } from '@wisesama/database';

export async function statsRoutes(fastify: FastifyInstance) {
  // Get recent flagged entities (for homepage display)
  fastify.get<{ Querystring: { limit?: string } }>('/stats/recent-flagged', {
    schema: {
      tags: ['stats'],
      description: 'Get recent flagged entities from blacklist',
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'string', default: '5' },
        },
      },
    },
    handler: async (request) => {
      const limit = Math.min(parseInt(request.query.limit || '5', 10), 20);

      const entities = await prisma.entity.findMany({
        where: {
          riskLevel: { in: ['CAUTION', 'FRAUD'] },
        },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          value: true,
          entityType: true,
          riskLevel: true,
          threatCategory: true,
          createdAt: true,
        },
      });

      return { entities };
    },
  });

  // Get platform statistics
  fastify.get('/stats', {
    schema: {
      tags: ['stats'],
      description: 'Get platform statistics',
      response: {
        200: {
          type: 'object',
          properties: {
            totalReports: { type: 'number' },
            verifiedReports: { type: 'number' },
            totalUsers: { type: 'number' },
            totalSearches: { type: 'number' },
            totalEntities: { type: 'number' },
            flaggedAddresses: { type: 'number' },
          },
        },
      },
    },
    handler: async () => {
      const [
        totalReports,
        verifiedReports,
        totalUsers,
        totalSearches,
        totalEntities,
        flaggedAddresses,
      ] = await Promise.all([
        prisma.report.count(),
        prisma.report.count({ where: { status: 'verified' } }),
        prisma.user.count(),
        prisma.search.count(),
        prisma.entity.count(),
        prisma.entity.count({
          where: { riskLevel: { in: ['CAUTION', 'FRAUD'] } },
        }),
      ]);

      return {
        totalReports,
        verifiedReports,
        totalUsers,
        totalSearches,
        totalEntities,
        flaggedAddresses,
      };
    },
  });
}
