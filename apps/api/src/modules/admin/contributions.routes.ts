import type { FastifyInstance } from 'fastify';
import { prisma } from '@wisesama/database';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';
import {
  listContributions,
  syncContributionStatus,
  isGitHubConfigured,
} from '../../services/github-contribution.service';

export async function contributionsRoutes(fastify: FastifyInstance) {
  // Get GitHub configuration status
  fastify.get(
    '/admin/contributions/config',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get GitHub contribution configuration status',
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      return {
        configured: isGitHubConfigured(),
        upstreamRepo: 'polkadot-js/phishing',
        forkOwner: process.env.GITHUB_FORK_OWNER || null,
      };
    }
  );

  // List all contributions
  fastify.get(
    '/admin/contributions',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'List all community contributions (PRs to polkadot-js/phishing)',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              enum: ['pending', 'open', 'merged', 'closed', 'error'],
            },
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 20 },
          },
        },
      },
    },
    async (request) => {
      const { status, page = 1, limit = 20 } = request.query as {
        status?: string;
        page?: number;
        limit?: number;
      };

      const { contributions, total } = await listContributions({ status, page, limit });

      // Get status counts
      const statusCounts = await prisma.communityContribution.groupBy({
        by: ['prStatus'],
        _count: { prStatus: true },
      });

      return {
        contributions,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        statusCounts: statusCounts.reduce(
          (acc, s) => ({ ...acc, [s.prStatus]: s._count.prStatus }),
          { pending: 0, open: 0, merged: 0, closed: 0, error: 0 }
        ),
      };
    }
  );

  // Get single contribution details
  fastify.get(
    '/admin/contributions/:id',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get contribution details',
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

      const contribution = await prisma.communityContribution.findUnique({
        where: { id },
        include: {
          report: {
            select: {
              id: true,
              reportedValue: true,
              entityType: true,
              threatCategory: true,
              description: true,
              evidenceUrls: true,
              reporterEmail: true,
              status: true,
              createdAt: true,
            },
          },
        },
      });

      if (!contribution) {
        reply.status(404);
        return { error: 'Contribution not found' };
      }

      return { contribution };
    }
  );

  // Sync contribution status from GitHub
  fastify.post(
    '/admin/contributions/:id/sync',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Sync contribution PR status from GitHub',
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

      if (!isGitHubConfigured()) {
        reply.status(400);
        return { error: 'GitHub integration not configured' };
      }

      const contribution = await prisma.communityContribution.findUnique({
        where: { id },
      });

      if (!contribution) {
        reply.status(404);
        return { error: 'Contribution not found' };
      }

      if (!contribution.prNumber) {
        reply.status(400);
        return { error: 'Contribution has no PR' };
      }

      await syncContributionStatus(id);

      const updated = await prisma.communityContribution.findUnique({
        where: { id },
      });

      return {
        message: 'Status synced',
        contribution: updated,
      };
    }
  );

  // Sync all open contributions
  fastify.post(
    '/admin/contributions/sync-all',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Sync all open contribution PR statuses from GitHub',
        security: [{ bearerAuth: [] }],
      },
    },
    async (request, reply) => {
      if (!isGitHubConfigured()) {
        reply.status(400);
        return { error: 'GitHub integration not configured' };
      }

      const openContributions = await prisma.communityContribution.findMany({
        where: {
          prStatus: 'open',
          prNumber: { not: null },
        },
      });

      let synced = 0;
      let errors = 0;

      for (const contribution of openContributions) {
        try {
          await syncContributionStatus(contribution.id);
          synced++;
        } catch (err) {
          request.log.warn({ err, contributionId: contribution.id }, 'Failed to sync contribution');
          errors++;
        }
      }

      return {
        message: `Synced ${synced} contributions`,
        synced,
        errors,
        total: openContributions.length,
      };
    }
  );

  // Get contribution statistics
  fastify.get(
    '/admin/contributions/stats',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get contribution statistics',
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const [statusCounts, entityTypeCounts, total, recentMerged] = await Promise.all([
        // By status
        prisma.communityContribution.groupBy({
          by: ['prStatus'],
          _count: { prStatus: true },
        }),

        // By entity type
        prisma.communityContribution.groupBy({
          by: ['entityType'],
          _count: { entityType: true },
        }),

        // Total
        prisma.communityContribution.count(),

        // Recently merged (last 30 days)
        prisma.communityContribution.count({
          where: {
            prStatus: 'merged',
            mergedAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      return {
        total,
        recentMerged,
        byStatus: statusCounts.reduce(
          (acc, s) => ({ ...acc, [s.prStatus]: s._count.prStatus }),
          { pending: 0, open: 0, merged: 0, closed: 0, error: 0 }
        ),
        byEntityType: entityTypeCounts.map((e) => ({
          entityType: e.entityType,
          count: e._count.entityType,
        })),
        githubConfigured: isGitHubConfigured(),
      };
    }
  );
}
