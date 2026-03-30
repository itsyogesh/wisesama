import type { FastifyInstance } from 'fastify';
import { prisma } from '@wisesama/database';
import { phishingSyncService } from '../../services/phishing-sync.service';
import { identitySyncService } from '../../services/identity-sync.service';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';

export async function adminRoutes(fastify: FastifyInstance) {
  // Trigger manual sync (redirects to the jobs endpoint)
  fastify.post(
    '/admin/sync',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Trigger a manual phishing list sync',
        security: [{ cookieAuth: [] }],
      },
    },
    async () => {
      const result = await phishingSyncService.syncPhishingList();
      return {
        message: 'Sync completed',
        ...result,
      };
    }
  );

  // Run sync immediately (blocking)
  fastify.post(
    '/admin/sync/now',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Run sync immediately and wait for result',
        security: [{ cookieAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              addresses: { type: 'number' },
              domains: { type: 'number' },
              total: { type: 'number' },
            },
          },
        },
      },
    },
    async () => {
      const result = await phishingSyncService.syncPhishingList();
      return result;
    }
  );

  // Get sync status
  fastify.get(
    '/admin/sync/status',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get phishing list sync status',
        security: [{ cookieAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              status: {
                type: 'object',
                properties: {
                  sourceName: { type: 'string' },
                  lastSyncAt: { type: ['string', 'null'] },
                  recordsProcessed: { type: 'number' },
                  lastError: { type: ['string', 'null'] },
                },
              },
              counts: {
                type: 'object',
                properties: {
                  addresses: { type: 'number' },
                  domains: { type: 'number' },
                  whitelisted: { type: 'number' },
                  total: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async () => {
      const [status, counts] = await Promise.all([
        phishingSyncService.getSyncStatus(),
        phishingSyncService.getEntityCounts(),
      ]);

      return { status, counts };
    }
  );

  // Dashboard stats — combined overview for admin dashboard
  fastify.get(
    '/admin/stats',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get combined dashboard statistics',
        security: [{ cookieAuth: [] }],
      },
    },
    async () => {
      const [
        totalWhitelisted,
        addressesWhitelisted,
        domainsWhitelisted,
        twitterWhitelisted,
        pendingRequests,
        openReports,
        totalUsers,
        totalChains,
        totalIdentities,
      ] = await Promise.all([
        prisma.whitelistedEntity.count({ where: { isActive: true } }),
        prisma.whitelistedEntity.count({ where: { isActive: true, entityType: 'ADDRESS' } }),
        prisma.whitelistedEntity.count({ where: { isActive: true, entityType: 'DOMAIN' } }),
        prisma.whitelistedEntity.count({ where: { isActive: true, entityType: 'TWITTER' } }),
        prisma.whitelistRequest.count({ where: { status: 'PENDING' } }),
        prisma.report.count({ where: { status: 'pending' } }),
        prisma.user.count(),
        prisma.chain.count({ where: { isActive: true } }),
        prisma.identity.count({ where: { hasIdentity: true } }),
      ]);

      return {
        totalWhitelisted,
        addressesWhitelisted,
        domainsWhitelisted,
        twitterWhitelisted,
        pendingRequests,
        openReports,
        totalUsers,
        totalChains,
        totalIdentities,
      };
    }
  );

  // Trigger identity sync from People Chains
  fastify.post(
    '/admin/sync/identities',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Sync all on-chain identities from People Chains (Polkadot + Kusama)',
        security: [{ cookieAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            chain: { type: 'string', enum: ['polkadot', 'kusama', 'all'], default: 'all' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              message: { type: 'string' },
              polkadot: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  synced: { type: 'number' },
                  errors: { type: 'number' },
                  duration: { type: 'number' },
                },
              },
              kusama: {
                type: 'object',
                properties: {
                  total: { type: 'number' },
                  synced: { type: 'number' },
                  errors: { type: 'number' },
                  duration: { type: 'number' },
                },
              },
            },
          },
        },
      },
    },
    async (request) => {
      const chain = (request.query as { chain?: string }).chain || 'all';
      const results: Record<string, unknown> = {};

      if (chain === 'all' || chain === 'polkadot') {
        results.polkadot = await identitySyncService.syncChain('polkadot');
      }
      if (chain === 'all' || chain === 'kusama') {
        results.kusama = await identitySyncService.syncChain('kusama');
      }

      return {
        message: 'Identity sync completed',
        ...results,
      };
    }
  );

  // Get identity sync status
  fastify.get(
    '/admin/sync/identities/status',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get identity sync status and counts',
        security: [{ cookieAuth: [] }],
      },
    },
    async () => {
      const [polkadotCount, kusamaCount, totalCount, lastSynced] = await Promise.all([
        prisma.identity.count({ where: { source: 'POLKADOT_PEOPLE' } }),
        prisma.identity.count({ where: { source: 'KUSAMA_PEOPLE' } }),
        prisma.identity.count(),
        prisma.identity.findFirst({
          orderBy: { lastSyncedAt: 'desc' },
          select: { lastSyncedAt: true },
        }),
      ]);

      return {
        identities: {
          polkadot: polkadotCount,
          kusama: kusamaCount,
          total: totalCount,
        },
        lastSyncedAt: lastSynced?.lastSyncedAt || null,
      };
    }
  );

  // List identities (paginated, searchable)
  fastify.get<{
    Querystring: {
      page?: string;
      limit?: string;
      search?: string;
      chain?: string;
      verified?: string;
    };
  }>(
    '/admin/identities',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'List synced on-chain identities with search and filters',
        security: [{ cookieAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            page: { type: 'string', default: '1' },
            limit: { type: 'string', default: '20' },
            search: { type: 'string' },
            chain: { type: 'string', enum: ['polkadot', 'kusama'] },
            verified: { type: 'string', enum: ['true', 'false'] },
          },
        },
      },
    },
    async (request) => {
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
      const { search, chain, verified } = request.query;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const where: any = { hasIdentity: true };

      if (search) {
        where.OR = [
          { displayName: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { twitter: { contains: search, mode: 'insensitive' } },
          { github: { contains: search, mode: 'insensitive' } },
        ];
      }

      if (chain) {
        where.source = chain === 'polkadot' ? 'POLKADOT_PEOPLE' : 'KUSAMA_PEOPLE';
      }

      if (verified) {
        where.isVerified = verified === 'true';
      }

      const [identities, total] = await Promise.all([
        prisma.identity.findMany({
          where,
          include: { chain: true },
          orderBy: [{ isVerified: 'desc' }, { displayName: 'asc' }],
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.identity.count({ where }),
      ]);

      return {
        identities,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    }
  );

  // Get single identity by ID
  fastify.get<{ Params: { id: string } }>(
    '/admin/identities/:id',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get a single identity by ID',
        security: [{ cookieAuth: [] }],
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
      const identity = await prisma.identity.findUnique({
        where: { id: request.params.id },
        include: { chain: true },
      });

      if (!identity) {
        reply.status(404);
        return { error: 'Identity not found' };
      }

      return identity;
    }
  );
}
