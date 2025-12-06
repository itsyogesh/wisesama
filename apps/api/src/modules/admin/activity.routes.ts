import type { FastifyInstance } from 'fastify';
import { prisma } from '@wisesama/database';
import type { ActivityType } from '@wisesama/types';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';

export async function activityAdminRoutes(fastify: FastifyInstance) {
  // List activity logs
  fastify.get(
    '/admin/activity',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'List activity logs with filtering',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: [
                'WHITELIST_CREATED',
                'WHITELIST_UPDATED',
                'WHITELIST_DELETED',
                'REQUEST_SUBMITTED',
                'REQUEST_APPROVED',
                'REQUEST_REJECTED',
                'REPORT_VERIFIED',
                'REPORT_REJECTED',
                'SYNC_COMPLETED',
                'ADMIN_LOGIN',
              ],
            },
            userEmail: { type: 'string' },
            entityType: { type: 'string' },
            dateFrom: { type: 'string', format: 'date-time' },
            dateTo: { type: 'string', format: 'date-time' },
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 50 },
          },
        },
      },
    },
    async (request) => {
      const { type, userEmail, entityType, dateFrom, dateTo, page = 1, limit = 50 } = request.query as {
        type?: ActivityType;
        userEmail?: string;
        entityType?: string;
        dateFrom?: string;
        dateTo?: string;
        page?: number;
        limit?: number;
      };

      const where: Record<string, unknown> = {};
      if (type) where.type = type;
      if (userEmail) where.userEmail = { contains: userEmail, mode: 'insensitive' };
      if (entityType) where.entityType = entityType;
      if (dateFrom || dateTo) {
        where.createdAt = {};
        if (dateFrom) (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
        if (dateTo) (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
      }

      const [activities, total] = await Promise.all([
        prisma.activityLog.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: Math.min(limit, 100),
        }),
        prisma.activityLog.count({ where }),
      ]);

      return {
        activities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // Get activity statistics
  fastify.get(
    '/admin/activity/stats',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get activity statistics',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            days: { type: 'number', default: 7 },
          },
        },
      },
    },
    async (request) => {
      const { days = 7 } = request.query as { days?: number };
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const [typeCounts, dailyCounts, topUsers, totalCount] = await Promise.all([
        // Activities by type
        prisma.activityLog.groupBy({
          by: ['type'],
          where: { createdAt: { gte: since } },
          _count: { type: true },
          orderBy: { _count: { type: 'desc' } },
        }),

        // Activities per day (using raw query for date grouping)
        prisma.$queryRaw<Array<{ date: string; count: bigint }>>`
          SELECT DATE(created_at) as date, COUNT(*) as count
          FROM "ActivityLog"
          WHERE created_at >= ${since}
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `,

        // Top active users
        prisma.activityLog.groupBy({
          by: ['userEmail'],
          where: { createdAt: { gte: since }, userEmail: { not: null } },
          _count: { userEmail: true },
          orderBy: { _count: { userEmail: 'desc' } },
          take: 10,
        }),

        // Total count
        prisma.activityLog.count({
          where: { createdAt: { gte: since } },
        }),
      ]);

      return {
        period: { days, since },
        total: totalCount,
        byType: typeCounts.map((t) => ({
          type: t.type,
          count: t._count.type,
        })),
        byDay: dailyCounts.map((d) => ({
          date: d.date,
          count: Number(d.count),
        })),
        topUsers: topUsers
          .filter((u) => u.userEmail)
          .map((u) => ({
            email: u.userEmail,
            count: u._count.userEmail,
          })),
      };
    }
  );
}
