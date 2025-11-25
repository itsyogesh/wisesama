import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '@wisesama/database';
import type { ThreatCategory, EntityType } from '@wisesama/types';
import { sendReportConfirmation, sendAdminNewReportAlert } from '../../services/email.service';

const reportSchema = z.object({
  value: z.string().min(1),
  entityType: z.enum(['ADDRESS', 'DOMAIN', 'TWITTER', 'EMAIL']),
  threatCategory: z.enum([
    'PHISHING',
    'SCAM',
    'RUG_PULL',
    'IMPERSONATION',
    'FAKE_AIRDROP',
    'RANSOMWARE',
    'MIXER',
    'OFAC_SANCTIONED',
    'OTHER',
  ]),
  otherCategory: z.string().optional(),
  description: z.string().optional(),
  relatedUrl: z.string().url().optional(),
  evidenceUrls: z.array(z.string().url()).optional(),
  reporterName: z.string().optional(),
  reporterEmail: z.string().email().optional(),
});

export async function reportRoutes(fastify: FastifyInstance) {
  // Submit a report
  fastify.post('/reports', {
    schema: {
      tags: ['report'],
      description: 'Submit a fraud report',
      body: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          entityType: { type: 'string', enum: ['ADDRESS', 'DOMAIN', 'TWITTER', 'EMAIL'] },
          threatCategory: {
            type: 'string',
            enum: [
              'PHISHING',
              'SCAM',
              'RUG_PULL',
              'IMPERSONATION',
              'FAKE_AIRDROP',
              'RANSOMWARE',
              'MIXER',
              'OFAC_SANCTIONED',
              'OTHER',
            ],
          },
          otherCategory: { type: 'string' },
          description: { type: 'string' },
          relatedUrl: { type: 'string' },
          evidenceUrls: { type: 'array', items: { type: 'string' } },
          reporterName: { type: 'string' },
          reporterEmail: { type: 'string' },
        },
        required: ['value', 'entityType', 'threatCategory'],
      },
    },
    handler: async (request, reply) => {
      const parsed = reportSchema.safeParse(request.body);
      if (!parsed.success) {
        reply.status(400);
        return { error: 'Invalid report data', details: parsed.error.issues };
      }

      const data = parsed.data;

      try {
        const report = await prisma.report.create({
          data: {
            reportedValue: data.value,
            entityType: data.entityType as EntityType,
            threatCategory: data.threatCategory as ThreatCategory,
            otherCategory: data.otherCategory,
            description: data.description,
            relatedUrl: data.relatedUrl,
            evidenceUrls: data.evidenceUrls || [],
            reporterName: data.reporterName,
            reporterEmail: data.reporterEmail,
            status: 'pending',
          },
        });

        // Send confirmation email to reporter (async, don't block response)
        if (data.reporterEmail) {
          sendReportConfirmation({
            email: data.reporterEmail,
            reportId: report.id,
            entityValue: data.value,
            entityType: data.entityType,
            threatCategory: data.threatCategory,
          }).catch((err) => {
            request.log.warn({ err }, 'Failed to send report confirmation email');
          });
        }

        // Send alert to admin (async)
        const adminEmail = process.env.ADMIN_ALERT_EMAIL;
        if (adminEmail) {
          sendAdminNewReportAlert({
            adminEmail,
            reportId: report.id,
            entityValue: data.value,
            entityType: data.entityType,
            threatCategory: data.threatCategory,
            reporterEmail: data.reporterEmail,
          }).catch((err) => {
            request.log.warn({ err }, 'Failed to send admin alert email');
          });
        }

        reply.status(201);
        return {
          id: report.id,
          status: report.status,
          message: 'Report submitted successfully. It will be reviewed by our team.',
        };
      } catch (error) {
        request.log.error(error, 'Failed to create report');
        reply.status(500);
        return { error: 'Failed to submit report' };
      }
    },
  });

  // List verified reports (public)
  fastify.get<{ Querystring: { page?: string; limit?: string } }>('/reports', {
    schema: {
      tags: ['report'],
      description: 'List verified fraud reports',
      querystring: {
        type: 'object',
        properties: {
          page: { type: 'string', default: '1' },
          limit: { type: 'string', default: '20' },
        },
      },
    },
    handler: async (request) => {
      const page = parseInt(request.query.page || '1', 10);
      const limit = Math.min(parseInt(request.query.limit || '20', 10), 100);
      const skip = (page - 1) * limit;

      const [reports, total] = await Promise.all([
        prisma.report.findMany({
          where: { status: 'verified' },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          select: {
            id: true,
            reportedValue: true,
            entityType: true,
            threatCategory: true,
            description: true,
            createdAt: true,
          },
        }),
        prisma.report.count({ where: { status: 'verified' } }),
      ]);

      return {
        reports,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      };
    },
  });
}
