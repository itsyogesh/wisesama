import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@wisesama/database';
import type { EntityType } from '@wisesama/types';
import { normalizeEntityValue, isValidAddress } from '../../utils/normalize';
import {
  sendWhitelistRequestConfirmation,
  sendAdminNewRequestAlert,
} from '../../services/email.service';

const whitelistRequestSchema = z.object({
  // Entity details
  entityType: z.enum(['ADDRESS', 'DOMAIN', 'TWITTER']),
  value: z.string().min(1),
  chainCode: z.string().optional(), // 'dot', 'ksm', etc. - only for ADDRESS type

  // Project/Entity info
  name: z.string().min(1),
  category: z.string().min(1), // project, validator, exchange, infrastructure, etc.
  description: z.string().optional(),
  website: z.string().url().optional(),
  twitter: z.string().optional(),
  logoUrl: z.string().url().optional(),

  // Requester info
  requesterName: z.string().optional(),
  requesterEmail: z.string().email(),
  requesterOrg: z.string().optional(),

  // Evidence
  evidenceUrls: z.array(z.string().url()).default([]),
  verificationNotes: z.string().optional(),
});

const statusCheckSchema = z.object({
  email: z.string().email(),
});

export async function whitelistRequestRoutes(fastify: FastifyInstance) {
  // Submit a whitelist request
  fastify.post('/whitelist/requests', {
    schema: {
      tags: ['whitelist'],
      description: 'Submit a whitelist request for an entity',
      body: {
        type: 'object',
        properties: {
          entityType: { type: 'string', enum: ['ADDRESS', 'DOMAIN', 'TWITTER'] },
          value: { type: 'string' },
          chainCode: { type: 'string' },
          name: { type: 'string' },
          category: { type: 'string' },
          description: { type: 'string' },
          website: { type: 'string' },
          twitter: { type: 'string' },
          logoUrl: { type: 'string' },
          requesterName: { type: 'string' },
          requesterEmail: { type: 'string' },
          requesterOrg: { type: 'string' },
          evidenceUrls: { type: 'array', items: { type: 'string' } },
          verificationNotes: { type: 'string' },
        },
        required: ['entityType', 'value', 'name', 'category', 'requesterEmail'],
      },
    },
    handler: async (request, reply) => {
      const parsed = whitelistRequestSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Invalid request data', details: parsed.error.issues };
      }

      const data = parsed.data;

      // Validate address if entity type is ADDRESS
      if (data.entityType === 'ADDRESS' && !isValidAddress(data.value)) {
        reply.status(400);
        return { error: 'Invalid address format' };
      }

      try {
        // Normalize the entity value
        const normalizedValue = normalizeEntityValue(data.value, data.entityType as EntityType);

        // Get chain ID if provided
        let chainId: number | null = null;
        if (data.entityType === 'ADDRESS' && data.chainCode) {
          const chain = await prisma.chain.findUnique({
            where: { code: data.chainCode },
          });
          if (chain) {
            chainId = chain.id;
          }
        }

        // Check if entity is already whitelisted
        const existingWhitelisted = await prisma.whitelistedEntity.findUnique({
          where: {
            entityType_normalizedValue: {
              entityType: data.entityType as EntityType,
              normalizedValue,
            },
          },
        });

        if (existingWhitelisted) {
          reply.status(409);
          return {
            error: 'Entity already whitelisted',
            entityName: existingWhitelisted.name,
          };
        }

        // Check for duplicate pending request
        const existingRequest = await prisma.whitelistRequest.findFirst({
          where: {
            normalizedValue,
            entityType: data.entityType as EntityType,
            status: { in: ['PENDING', 'UNDER_REVIEW'] },
          },
        });

        if (existingRequest) {
          reply.status(409);
          return {
            error: 'A request for this entity is already pending review',
            requestId: existingRequest.id,
          };
        }

        // Create the request
        const whitelistRequest = await prisma.whitelistRequest.create({
          data: {
            entityType: data.entityType as EntityType,
            value: data.value,
            normalizedValue,
            chainId,
            name: data.name,
            category: data.category,
            description: data.description,
            website: data.website,
            twitter: data.twitter?.replace(/^@/, ''),
            logoUrl: data.logoUrl,
            requesterName: data.requesterName,
            requesterEmail: data.requesterEmail,
            requesterOrg: data.requesterOrg,
            evidenceUrls: data.evidenceUrls,
            verificationNotes: data.verificationNotes,
          },
        });

        // Send confirmation email to requester (async)
        sendWhitelistRequestConfirmation({
          email: data.requesterEmail,
          requestId: whitelistRequest.id,
          entityValue: data.value,
          entityType: data.entityType,
          name: data.name,
        }).catch((err) => {
          request.log.warn({ err }, 'Failed to send whitelist request confirmation email');
        });

        // Send alert to admin (async)
        const adminEmail = process.env.ADMIN_ALERT_EMAIL;
        if (adminEmail) {
          sendAdminNewRequestAlert({
            adminEmail,
            requestId: whitelistRequest.id,
            entityValue: data.value,
            entityType: data.entityType,
            name: data.name,
            category: data.category,
            requesterEmail: data.requesterEmail,
          }).catch((err) => {
            request.log.warn({ err }, 'Failed to send admin alert email');
          });
        }

        reply.status(201);
        return {
          id: whitelistRequest.id,
          status: whitelistRequest.status,
          message: 'Whitelist request submitted successfully. It will be reviewed by our team.',
        };
      } catch (error) {
        request.log.error(error, 'Failed to create whitelist request');
        reply.status(500);
        return { error: 'Failed to submit whitelist request' };
      }
    },
  });

  // Check request status
  fastify.get<{ Params: { id: string }; Querystring: { email?: string } }>(
    '/whitelist/requests/:id/status',
    {
      schema: {
        tags: ['whitelist'],
        description: 'Check the status of a whitelist request',
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        querystring: {
          type: 'object',
          properties: {
            email: { type: 'string' },
          },
          required: ['email'],
        },
      },
      handler: async (request, reply) => {
        const { id } = request.params;
        const { email } = request.query;

        if (!email) {
          reply.status(400);
          return { error: 'Email is required to check status' };
        }

        const parsed = statusCheckSchema.safeParse({ email });
        if (!parsed.success) {
          reply.status(400);
          return { error: 'Invalid email format' };
        }

        const whitelistRequest = await prisma.whitelistRequest.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            entityType: true,
            value: true,
            status: true,
            category: true,
            requesterEmail: true,
            rejectionReason: true,
            createdAt: true,
            reviewedAt: true,
            whitelistedEntity: {
              select: { id: true, name: true },
            },
          },
        });

        if (!whitelistRequest) {
          reply.status(404);
          return { error: 'Request not found' };
        }

        // Verify requester email matches
        if (whitelistRequest.requesterEmail.toLowerCase() !== email.toLowerCase()) {
          reply.status(403);
          return { error: 'Email does not match the request' };
        }

        // Construct timeline
        const timeline = [
          {
            status: 'SUBMITTED',
            timestamp: whitelistRequest.createdAt,
            description: 'Request submitted',
          },
        ];

        if (whitelistRequest.status === 'UNDER_REVIEW') {
          timeline.push({
            status: 'UNDER_REVIEW',
            timestamp: whitelistRequest.reviewedAt || whitelistRequest.createdAt,
            description: 'Request is being reviewed',
          });
        } else if (whitelistRequest.status === 'APPROVED') {
          timeline.push({
            status: 'APPROVED',
            timestamp: whitelistRequest.reviewedAt!,
            description: 'Request approved and entity whitelisted',
          });
        } else if (whitelistRequest.status === 'REJECTED') {
          timeline.push({
            status: 'REJECTED',
            timestamp: whitelistRequest.reviewedAt!,
            description: whitelistRequest.rejectionReason || 'Request rejected',
          });
        }

        return {
          request: {
            id: whitelistRequest.id,
            name: whitelistRequest.name,
            entityType: whitelistRequest.entityType,
            value: whitelistRequest.value,
            category: whitelistRequest.category,
            status: whitelistRequest.status,
            createdAt: whitelistRequest.createdAt,
          },
          timeline,
          whitelistedEntity: whitelistRequest.whitelistedEntity,
        };
      },
    }
  );

  // Get public whitelist stats
  fastify.get('/whitelist/stats', {
    schema: {
      tags: ['whitelist'],
      description: 'Get public whitelist statistics',
    },
    handler: async () => {
      const [totalCount, categoryCounts, recentAdditions] = await Promise.all([
        // Total whitelisted entities
        prisma.whitelistedEntity.count({ where: { isActive: true } }),

        // Count by category
        prisma.whitelistedEntity.groupBy({
          by: ['category'],
          where: { isActive: true },
          _count: { category: true },
          orderBy: { _count: { category: 'desc' } },
        }),

        // Recent additions (last 30 days)
        prisma.whitelistedEntity.count({
          where: {
            isActive: true,
            createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          },
        }),
      ]);

      // Get last update time
      const lastUpdate = await prisma.whitelistedEntity.findFirst({
        where: { isActive: true },
        orderBy: { updatedAt: 'desc' },
        select: { updatedAt: true },
      });

      return {
        total: totalCount,
        recentAdditions,
        lastUpdated: lastUpdate?.updatedAt || null,
        byCategory: categoryCounts.map((c) => ({
          category: c.category,
          count: c._count.category,
        })),
      };
    },
  });
}
