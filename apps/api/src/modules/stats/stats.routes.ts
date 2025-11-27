import type { FastifyInstance } from 'fastify';
import { prisma } from '@wisesama/database';

export async function statsRoutes(fastify: FastifyInstance) {
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
