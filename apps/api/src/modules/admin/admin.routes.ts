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
        security: [{ bearerAuth: [] }],
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
        security: [{ bearerAuth: [] }],
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
        security: [{ bearerAuth: [] }],
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

  // Trigger identity sync from People Chains
  fastify.post(
    '/admin/sync/identities',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Sync all on-chain identities from People Chains (Polkadot + Kusama)',
        security: [{ bearerAuth: [] }],
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
        security: [{ bearerAuth: [] }],
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
}
