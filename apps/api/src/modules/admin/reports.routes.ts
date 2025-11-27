import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@wisesama/database';
import { authenticate, requireAdmin } from '../../middleware/auth.middleware';
import { sendReportVerified, sendReportRejected } from '../../services/email.service';
import { contributeToPhishing, isGitHubConfigured } from '../../services/github-contribution.service';
import { normalizeEntityValue } from '../../utils/normalize';

const verifyReportSchema = z.object({
  addToBlacklist: z.boolean().default(true),
  contributeToUpstream: z.boolean().default(true), // Auto-PR to polkadot-js/phishing
  threatName: z.string().optional(),
  notes: z.string().optional(),
});

const rejectReportSchema = z.object({
  reason: z.string().min(1),
});

export async function reportsAdminRoutes(fastify: FastifyInstance) {
  // List all reports (admin view)
  fastify.get(
    '/admin/reports',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'List all reports with filtering',
        security: [{ bearerAuth: [] }],
        querystring: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['pending', 'verified', 'rejected'] },
            threatCategory: { type: 'string' },
            entityType: { type: 'string', enum: ['ADDRESS', 'DOMAIN', 'TWITTER', 'EMAIL'] },
            page: { type: 'number', default: 1 },
            limit: { type: 'number', default: 20 },
          },
        },
      },
    },
    async (request) => {
      const { status, threatCategory, entityType, page = 1, limit = 20 } = request.query as {
        status?: string;
        threatCategory?: string;
        entityType?: string;
        page?: number;
        limit?: number;
      };

      const where: Record<string, unknown> = {};

      if (status) where.status = status;
      if (threatCategory) where.threatCategory = threatCategory;
      if (entityType) where.entityType = entityType;

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where,
          include: {
            user: { select: { id: true, email: true } },
            entity: { select: { id: true, value: true, riskLevel: true } },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.report.count({ where }),
      ]);

      // Get counts by status
      const statusCounts = await prisma.report.groupBy({
        by: ['status'],
        _count: { status: true },
      });

      return {
        reports,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
        statusCounts: statusCounts.reduce(
          (acc, s) => ({ ...acc, [s.status]: s._count.status }),
          { pending: 0, verified: 0, rejected: 0 }
        ),
      };
    }
  );

  // Get single report details
  fastify.get(
    '/admin/reports/:id',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get detailed report information',
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

      const report = await prisma.report.findUnique({
        where: { id },
        include: {
          user: { select: { id: true, email: true } },
          entity: {
            include: {
              chain: { select: { code: true, name: true } },
            },
          },
        },
      });

      if (!report) {
        reply.status(404);
        return { error: 'Report not found' };
      }

      // Get related reports for the same value
      const relatedReports = await prisma.report.findMany({
        where: {
          reportedValue: report.reportedValue,
          id: { not: report.id },
        },
        select: {
          id: true,
          threatCategory: true,
          status: true,
          createdAt: true,
        },
        take: 5,
      });

      return { report, relatedReports };
    }
  );

  // Verify a report (mark as confirmed fraud)
  fastify.put(
    '/admin/reports/:id/verify',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Verify a report as confirmed fraud',
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
            addToBlacklist: { type: 'boolean', default: true },
            contributeToUpstream: { type: 'boolean', default: true },
            threatName: { type: 'string' },
            notes: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = verifyReportSchema.parse(request.body || {});

      const report = await prisma.report.findUnique({ where: { id } });

      if (!report) {
        reply.status(404);
        return { error: 'Report not found' };
      }

      if (report.status !== 'pending') {
        reply.status(400);
        return { error: `Report already ${report.status}` };
      }

      // Start transaction
      const result = await prisma.$transaction(async (tx) => {
        // Update report status
        const updatedReport = await tx.report.update({
          where: { id },
          data: {
            status: 'verified',
            reviewedAt: new Date(),
          },
        });

        // Add to blacklist if requested
        if (body.addToBlacklist) {
          const normalizedValue = normalizeEntityValue(report.reportedValue, report.entityType);

          // Check if entity already exists
          const existingEntity = await tx.entity.findUnique({
            where: {
              entityType_normalizedValue: {
                entityType: report.entityType,
                normalizedValue,
              },
            },
          });

          if (existingEntity) {
            // Update existing entity
            await tx.entity.update({
              where: { id: existingEntity.id },
              data: {
                riskLevel: 'FRAUD',
                riskScore: 95,
                threatCategory: report.threatCategory,
                source: 'community-verified',
                threatName: body.threatName || report.threatCategory,
                userReportCount: { increment: 1 },
              },
            });
          } else {
            // Create new entity
            await tx.entity.create({
              data: {
                entityType: report.entityType,
                value: report.reportedValue,
                normalizedValue,
                riskLevel: 'FRAUD',
                riskScore: 95,
                threatCategory: report.threatCategory,
                source: 'community-verified',
                threatName: body.threatName || report.threatCategory,
                userReportCount: 1,
                firstReportedAt: report.createdAt,
              },
            });
          }
        }

        return updatedReport;
      });

      // Send email notification to reporter (async)
      if (report.reporterEmail) {
        sendReportVerified({
          email: report.reporterEmail,
          reportId: report.id,
          entityValue: report.reportedValue,
          entityType: report.entityType,
          threatCategory: report.threatCategory,
          addedToBlacklist: body.addToBlacklist,
        }).catch((err) => {
          request.log.warn({ err }, 'Failed to send report verified email');
        });
      }

      // Contribute to polkadot-js/phishing (async)
      let contribution: { contributionId?: string; prUrl?: string } | undefined;
      if (body.contributeToUpstream) {
        try {
          const contributionResult = await contributeToPhishing({
            reportId: report.id,
            entityType: report.entityType,
            entityValue: report.reportedValue,
            threatCategory: report.threatCategory,
            description: report.description || undefined,
            evidenceUrls: report.evidenceUrls,
          });
          contribution = {
            contributionId: contributionResult.contributionId,
            prUrl: contributionResult.prUrl,
          };
        } catch (err) {
          request.log.warn({ err }, 'Failed to contribute to upstream');
        }
      }

      return {
        message: 'Report verified successfully',
        report: result,
        addedToBlacklist: body.addToBlacklist,
        contribution: body.contributeToUpstream
          ? {
              enabled: true,
              githubConfigured: isGitHubConfigured(),
              ...contribution,
            }
          : undefined,
      };
    }
  );

  // Reject a report
  fastify.put(
    '/admin/reports/:id/reject',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Reject a report',
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
      const body = rejectReportSchema.parse(request.body);

      const report = await prisma.report.findUnique({ where: { id } });

      if (!report) {
        reply.status(404);
        return { error: 'Report not found' };
      }

      if (report.status !== 'pending') {
        reply.status(400);
        return { error: `Report already ${report.status}` };
      }

      const updatedReport = await prisma.report.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedAt: new Date(),
          // Store rejection reason in description
          description: report.description
            ? `${report.description}\n\n[REJECTED: ${body.reason}]`
            : `[REJECTED: ${body.reason}]`,
        },
      });

      // Send email notification to reporter (async)
      if (report.reporterEmail) {
        sendReportRejected({
          email: report.reporterEmail,
          reportId: report.id,
          entityValue: report.reportedValue,
          entityType: report.entityType,
          reason: body.reason,
        }).catch((err) => {
          request.log.warn({ err }, 'Failed to send report rejected email');
        });
      }

      return {
        message: 'Report rejected',
        report: updatedReport,
      };
    }
  );

  // Get report statistics
  fastify.get(
    '/admin/reports/stats',
    {
      preHandler: [authenticate, requireAdmin],
      schema: {
        tags: ['admin'],
        description: 'Get report statistics',
        security: [{ bearerAuth: [] }],
      },
    },
    async () => {
      const [statusCounts, categoryCounts, recentReports, totalReports] = await Promise.all([
        // Reports by status
        prisma.report.groupBy({
          by: ['status'],
          _count: { status: true },
        }),

        // Reports by threat category
        prisma.report.groupBy({
          by: ['threatCategory'],
          _count: { threatCategory: true },
          orderBy: { _count: { threatCategory: 'desc' } },
        }),

        // Recent reports count (last 7 days)
        prisma.report.count({
          where: {
            createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
          },
        }),

        // Total reports
        prisma.report.count(),
      ]);

      return {
        total: totalReports,
        recentCount: recentReports,
        byStatus: statusCounts.reduce(
          (acc, s) => ({ ...acc, [s.status]: s._count.status }),
          { pending: 0, verified: 0, rejected: 0 }
        ),
        byCategory: categoryCounts.map((c) => ({
          category: c.threatCategory,
          count: c._count.threatCategory,
        })),
      };
    }
  );
}
