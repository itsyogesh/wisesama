import type { FastifyInstance } from 'fastify';
import { prisma } from '@wisesama/database';

export async function statsRoutes(fastify: FastifyInstance) {
  // Public blacklist listing
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      riskLevel?: string;
    };
  }>('/blacklist', {
    schema: {
      tags: ['stats'],
      description: 'List blacklisted entities (FRAUD/CAUTION)',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', default: '1' },
          limit: { type: 'string', default: '20' },
          search: { type: 'string' },
          riskLevel: { type: 'string', enum: ['FRAUD', 'CAUTION'] },
        },
      },
    },
    handler: async (request) => {
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
      const skip = (page - 1) * limit;
      const { search, riskLevel } = request.query;

      const where: any = {
        riskLevel: riskLevel ? riskLevel : { in: ['FRAUD', 'CAUTION'] },
      };

      if (search) {
        where.value = { contains: search, mode: 'insensitive' };
      }

      const [entities, total] = await Promise.all([
        prisma.entity.findMany({
          where,
          select: {
            id: true,
            value: true,
            entityType: true,
            riskLevel: true,
            threatCategory: true,
            createdAt: true,
            threatName: true,
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
        }),
        prisma.entity.count({ where }),
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
    },
  });

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
