import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@wisesama/database';
import type { EntityType, WhitelistRequestStatus } from '@wisesama/types';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';
import { normalizeEntityValue } from '../../utils/normalize';
import {
  sendWhitelistRequestApproved,
  sendWhitelistRequestRejected,
} from '../../services/email.service';
import { logActivity } from '../../services/activity.service';

const reviewSchema = z.object({
  notes: z.string().optional(),
});

const approveSchema = z.object({
  notes: z.string().optional(),
  // Optional overrides for the whitelist entity
  name: z.string().optional(),
  category: z.string().optional(),
  website: z.string().optional(),
  twitter: z.string().optional(),
  logoUrl: z.string().optional(),
});

const rejectSchema = z.object({
  reason: z.string().min(1, 'Rejection reason is required'),
});

export async function whitelistRequestsAdminRoutes(fastify: FastifyInstance) {
  // List all whitelist requests (admin view)
  fastify.get(
    '/admin/whitelist/requests',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'List all whitelist requests with filtering',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['PENDING', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] },
            category: { type: 'string' },
            entityType: { type: 'string', enum: ['ADDRESS', 'DOMAIN', 'TWITTER'] },
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 20 },
          },
        },
      },
    },
    async (request) => {
      const { status, category, entityType, page = 1, limit = 20 } = request.query as {
        status?: WhitelistRequestStatus;
        category?: string;
        entityType?: EntityType;
        page?: number;
        limit?: number;
      };

      const where: Record<string, unknown> = {};
      if (status) where.status = status;
      if (category) where.category = category;
      if (entityType) where.entityType = entityType;

      const [requests, total] = await Promise.all([
        prisma.whitelistRequest.findMany({
          where,
          include: {
            chain: { select: { code: true, name: true } },
            user: { select: { id: true, email: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.whitelistRequest.count({ where }),
      ]);

      // Get counts by status
      const statusCounts = await prisma.whitelistRequest.groupBy({
        by: ['status'],
        _count: { status: true },
      });

      return {
        requests,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        statusCounts: statusCounts.reduce(
          (acc, s) => ({ ...acc, [s.status]: s._count.status }),
          { PENDING: 0, UNDER_REVIEW: 0, APPROVED: 0, REJECTED: 0 }
        ),
      };
    }
  );

  // Get single request details
  fastify.get(
    '/admin/whitelist/requests/:id',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get detailed whitelist request information',
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

      const whitelistRequest = await prisma.whitelistRequest.findUnique({
        where: { id },
        include: {
          chain: { select: { code: true, name: true } },
          user: { select: { id: true, email: true } },
          whitelistedEntity: true,
        },
      });

      if (!whitelistRequest) {
        reply.status(404);
        return { error: 'Request not found' };
      }

      // Check if entity already exists in whitelist or blacklist
      const [existingWhitelisted, existingBlacklisted] = await Promise.all([
        prisma.whitelistedEntity.findUnique({
          where: {
            entityType_normalizedValue: {
              entityType: whitelistRequest.entityType,
              normalizedValue: whitelistRequest.normalizedValue,
            },
          },
        }),
        prisma.entity.findUnique({
          where: {
            entityType_normalizedValue: {
              entityType: whitelistRequest.entityType,
              normalizedValue: whitelistRequest.normalizedValue,
            },
          },
          select: { id: true, riskLevel: true, source: true },
        }),
      ]);

      return {
        request: whitelistRequest,
        existingWhitelisted,
        existingBlacklisted,
      };
    }
  );

  // Mark as under review
  fastify.put(
    '/admin/whitelist/requests/:id/review',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Mark a whitelist request as under review',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = reviewSchema.parse(request.body || {});
      const adminUser = (request as unknown as { user: { id: string; email: string } }).user;

      const existingRequest = await prisma.whitelistRequest.findUnique({ where: { id } });

      if (!existingRequest) {
        reply.status(404);
        return { error: 'Request not found' };
      }

      if (existingRequest.status !== 'PENDING') {
        reply.status(400);
        return { error: `Request is already ${existingRequest.status}` };
      }

      const updatedRequest = await prisma.whitelistRequest.update({
        where: { id },
        data: {
          status: 'UNDER_REVIEW',
          reviewedBy: adminUser.email,
          reviewNotes: body.notes,
        },
      });

      // Log activity
      await logActivity({
        type: 'REQUEST_SUBMITTED', // Using closest match - should add REQUEST_UNDER_REVIEW
        description: `Whitelist request for "${existingRequest.name}" marked as under review`,
        userId: adminUser.id,
        userEmail: adminUser.email,
        entityType: 'WhitelistRequest',
        entityId: id,
        ipAddress: request.ip,
      });

      return {
        message: 'Request marked as under review',
        request: updatedRequest,
      };
    }
  );

  // Approve request
  fastify.put(
    '/admin/whitelist/requests/:id/approve',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Approve a whitelist request and create whitelist entity',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            notes: { type: 'string' },
            name: { type: 'string' },
            category: { type: 'string' },
            website: { type: 'string' },
            twitter: { type: 'string' },
            logoUrl: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = approveSchema.parse(request.body || {});
      const adminUser = (request as unknown as { user: { id: string; email: string } }).user;

      const existingRequest = await prisma.whitelistRequest.findUnique({
        where: { id },
        include: { chain: true },
      });

      if (!existingRequest) {
        reply.status(404);
        return { error: 'Request not found' };
      }

      if (existingRequest.status === 'APPROVED') {
        reply.status(400);
        return { error: 'Request already approved' };
      }

      if (existingRequest.status === 'REJECTED') {
        reply.status(400);
        return { error: 'Cannot approve a rejected request' };
      }

      // Check if entity already whitelisted
      const existingWhitelisted = await prisma.whitelistedEntity.findUnique({
        where: {
          entityType_normalizedValue: {
            entityType: existingRequest.entityType,
            normalizedValue: existingRequest.normalizedValue,
          },
        },
      });

      if (existingWhitelisted) {
        // Link to existing entity
        await prisma.whitelistRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedBy: adminUser.email,
            reviewNotes: body.notes,
            whitelistedEntityId: existingWhitelisted.id,
          },
        });

        return {
          message: 'Request approved (entity was already whitelisted)',
          whitelistedEntity: existingWhitelisted,
        };
      }

      // Create new whitelist entity in transaction
      const result = await prisma.$transaction(async (tx) => {
        // Create the whitelist entity
        const whitelistedEntity = await tx.whitelistedEntity.create({
          data: {
            entityType: existingRequest.entityType,
            value: existingRequest.value,
            normalizedValue: existingRequest.normalizedValue,
            chainId: existingRequest.chainId,
            name: body.name || existingRequest.name,
            category: body.category || existingRequest.category,
            description: existingRequest.description,
            website: body.website || existingRequest.website,
            twitter: body.twitter || existingRequest.twitter,
            logoUrl: body.logoUrl || existingRequest.logoUrl,
            source: 'request',
            verifiedAt: new Date(),
            verifiedBy: adminUser.email,
          },
        });

        // Update the request
        await tx.whitelistRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            reviewedAt: new Date(),
            reviewedBy: adminUser.email,
            reviewNotes: body.notes,
            whitelistedEntityId: whitelistedEntity.id,
          },
        });

        return whitelistedEntity;
      });

      // Log activity
      await logActivity({
        type: 'REQUEST_APPROVED',
        description: `Whitelist request for "${existingRequest.name}" approved`,
        userId: adminUser.id,
        userEmail: adminUser.email,
        entityType: 'WhitelistRequest',
        entityId: id,
        metadata: { whitelistedEntityId: result.id },
        ipAddress: request.ip,
      });

      // Send email notification (async)
      if (existingRequest.requesterEmail) {
        sendWhitelistRequestApproved({
          email: existingRequest.requesterEmail,
          requestId: id,
          entityValue: existingRequest.value,
          entityType: existingRequest.entityType,
          name: result.name,
        }).catch((err) => {
          request.log.warn({ err }, 'Failed to send whitelist approval email');
        });
      }

      return {
        message: 'Request approved successfully',
        whitelistedEntity: result,
      };
    }
  );

  // Reject request
  fastify.put(
    '/admin/whitelist/requests/:id/reject',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Reject a whitelist request',
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
        body: {
          type: 'object',
          properties: {
            reason: { type: 'string' },
          },
          required: ['reason'],
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = rejectSchema.parse(request.body);
      const adminUser = (request as unknown as { user: { id: string; email: string } }).user;

      const existingRequest = await prisma.whitelistRequest.findUnique({ where: { id } });

      if (!existingRequest) {
        reply.status(404);
        return { error: 'Request not found' };
      }

      if (existingRequest.status === 'APPROVED') {
        reply.status(400);
        return { error: 'Cannot reject an approved request' };
      }

      if (existingRequest.status === 'REJECTED') {
        reply.status(400);
        return { error: 'Request already rejected' };
      }

      const updatedRequest = await prisma.whitelistRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          reviewedBy: adminUser.email,
          rejectionReason: body.reason,
        },
      });

      // Log activity
      await logActivity({
        type: 'REQUEST_REJECTED',
        description: `Whitelist request for "${existingRequest.name}" rejected: ${body.reason}`,
        userId: adminUser.id,
        userEmail: adminUser.email,
        entityType: 'WhitelistRequest',
        entityId: id,
        metadata: { reason: body.reason },
        ipAddress: request.ip,
      });

      // Send email notification (async)
      if (existingRequest.requesterEmail) {
        sendWhitelistRequestRejected({
          email: existingRequest.requesterEmail,
          requestId: id,
          entityValue: existingRequest.value,
          entityType: existingRequest.entityType,
          name: existingRequest.name,
          reason: body.reason,
        }).catch((err) => {
          request.log.warn({ err }, 'Failed to send whitelist rejection email');
        });
      }

      return {
        message: 'Request rejected',
        request: updatedRequest,
      };
    }
  );

  // Get request statistics
  fastify.get(
    '/admin/whitelist/requests/stats',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get whitelist request statistics',
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const [statusCounts, categoryCounts, recentRequests, totalRequests] = await Promise.all([
        // Requests by status
        prisma.whitelistRequest.groupBy({
          by: ['status'],
          _count: { status: true },
        }),

        // Requests by category
        prisma.whitelistRequest.groupBy({
          by: ['category'],
          _count: { category: true },
          orderBy: { _count: { category: 'desc' } },
        }),

        // Recent requests count (last 7 days)
        prisma.whitelistRequest.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),

        // Total requests
        prisma.whitelistRequest.count(),
      ]);

      return {
        total: totalRequests,
        recentCount: recentRequests,
        byStatus: statusCounts.reduce(
          (acc, s) => ({ ...acc, [s.status]: s._count.status }),
          { PENDING: 0, UNDER_REVIEW: 0, APPROVED: 0, REJECTED: 0 }
        ),
        byCategory: categoryCounts.map((c) => ({
          category: c.category,
          count: c._count.category,
        })),
      };
    }
  );
}
