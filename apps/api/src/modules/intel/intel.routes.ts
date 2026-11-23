import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  authenticateIntel as authenticate,
  authenticateIntelApiKey as authenticateApiKey,
} from '../../middleware/intel-access.middleware';
import { InventoryValidationError } from '../../services/intel/index';
import { IntelWorkspaceError, intelWorkspaceService } from '../../services/intel-workspace.service';
import { OrganizationError } from '../../services/organization-access';

const identifier = z
  .string()
  .trim()
  .min(1)
  .max(150)
  .regex(/^[a-zA-Z0-9._-]+$/, 'Invalid identifier.');
const inventory = z
  .object({
    format: z.enum(['auto', 'inventory', 'package-lock', 'pnpm-lock', 'package-json']),
    content: z
      .string()
      .min(2)
      .max(2 * 1024 * 1024),
  })
  .strict();
const runtime = z
  .object({
    name: z.string().trim().min(1).max(80),
    version: z.string().trim().min(1).max(80),
  })
  .strict();
const projectInput = z
  .object({
    organizationId: z
      .string()
      .min(1)
      .max(150)
      .regex(/^[a-zA-Z0-9._-]+$/),
    name: z.string().trim().min(1).max(100),
    environment: z.enum(['production', 'staging', 'development']),
    inventory,
    runtime: runtime.optional(),
  })
  .strict();
const inventoryInput = z.object({ inventory, runtime: runtime.optional() }).strict();
const findingInput = z
  .object({
    status: z.enum(['open', 'investigating', 'mitigated', 'resolved', 'not_affected']),
    note: z.string().max(4000).optional(),
    evidence: z.string().max(4000).optional(),
  })
  .strict();

const feedFilters = z.object({
  q: z.string().max(150).optional(),
  severity: z.enum(['critical', 'high', 'medium', 'low', 'unknown']).optional(),
  exploited: z.enum(['true', 'false']).optional(),
  ecosystem: z.enum(['npm', 'PyPI']).optional(),
});
function filterAdvisories<
  T extends {
    id: string;
    title: string;
    aliases: string[];
    severity: string;
    exploited: boolean;
    affected: Array<{ name: string; ecosystem: string }>;
  },
>(advisories: T[], filters: z.infer<typeof feedFilters>) {
  const search = filters.q?.trim().toLowerCase();
  return advisories.filter(
    (advisory) =>
      (!filters.severity || advisory.severity === filters.severity) &&
      (!filters.exploited || advisory.exploited === (filters.exploited === 'true')) &&
      (!filters.ecosystem ||
        advisory.affected.some((item) => item.ecosystem === filters.ecosystem)) &&
      (!search ||
        [
          advisory.id,
          advisory.title,
          ...advisory.aliases,
          ...advisory.affected.map((item) => item.name),
        ].some((value) => value.toLowerCase().includes(search))),
  );
}

function xml(value: string) {
  return value.replace(
    /[<>&'"]/g,
    (character) =>
      ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[character] ??
      character,
  );
}

/** JSON-only mutations avoid ambient-cookie cross-site form submissions. */
async function requireJson(request: FastifyRequest, reply: FastifyReply) {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    reply.code(415).send({ error: 'Use application/json for this request.' });
  }
}

type Service = typeof intelWorkspaceService;
type AuthHandler = typeof authenticate;

/** The injected seams keep authorization and error handling testable with Fastify.inject. */
export function createIntelRoutes(
  options: { service?: Service; authenticate?: AuthHandler; authenticateApiKey?: AuthHandler } = {},
) {
  const service = options.service ?? intelWorkspaceService;
  const sessionAuth = options.authenticate ?? authenticate;
  const inventoryAuth = options.authenticateApiKey ?? authenticateApiKey;

  return async function registerIntelRoutes(fastify: FastifyInstance) {
    fastify.setErrorHandler((error, request, reply) => {
      if (error instanceof OrganizationError)
        return reply.code(error.statusCode).send({ error: error.message });
      if (error instanceof z.ZodError) {
        reply.code(400).send({
          error: 'Check the request fields.',
          details: error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
          })),
        });
        return;
      }
      if (error instanceof IntelWorkspaceError || error instanceof InventoryValidationError) {
        reply
          .code(error instanceof IntelWorkspaceError ? error.statusCode : 400)
          .send({ error: error.message });
        return;
      }
      const statusCode =
        error &&
        typeof error === 'object' &&
        'statusCode' in error &&
        typeof error.statusCode === 'number'
          ? error.statusCode
          : 500;
      if (statusCode >= 400 && statusCode < 500) {
        reply.code(statusCode).send({
          error:
            statusCode === 413
              ? 'The inventory exceeds the upload limit.'
              : 'The request could not be processed.',
        });
        return;
      }
      request.log.error(
        { errorName: error instanceof Error ? error.name : 'UnknownError' },
        'Security workspace request failed',
      );
      reply
        .code(500)
        .send({ error: 'Wisesama could not complete this request. Please try again.' });
    });

    fastify.get(
      '/intel/briefings',
      {
        schema: {
          tags: ['intel'],
          description:
            'Public vulnerability briefings and collection health. No customer inventories are exposed.',
        },
      },
      async (request, reply) => {
        const query = feedFilters.parse(request.query);
        const result = await service.getBriefings();
        reply.header('Cache-Control', 'no-store');
        return { ...result, advisories: filterAdvisories(result.advisories, query) };
      },
    );

    fastify.get(
      '/intel/briefings/:id',
      { schema: { tags: ['intel'], description: 'Read a public vulnerability briefing.' } },
      async (request, reply) => {
        const { id } = z.object({ id: identifier }).parse(request.params);
        reply.header('Cache-Control', 'no-store');
        return service.getBriefing(id);
      },
    );

    fastify.get(
      '/intel/feed.xml',
      {
        schema: {
          tags: ['intel'],
          description: 'Public RSS feed. It never includes private project matches.',
        },
      },
      async (request, reply) => {
        const query = feedFilters.parse(request.query);
        const result = await service.getBriefings();
        const base = (process.env.INTEL_APP_URL || 'https://wisesama.com').replace(/\/$/, '');
        const items = filterAdvisories(result.advisories, query)
          .map((advisory) => {
            const date = new Date(advisory.modifiedAt || advisory.publishedAt);
            const description = advisory.editorial?.guidance
              ? `${advisory.summary}\n\nWisesama response guidance: ${advisory.editorial.guidance}`
              : advisory.summary;
            return `<item><title>${xml(advisory.title)}</title><link>${xml(`${base}/feed/${encodeURIComponent(advisory.id)}`)}</link><guid isPermaLink="false">${xml(`${advisory.id}:${advisory.modifiedAt}:${advisory.editorial?.reviewedAt ?? ''}`)}</guid><description>${xml(description)}</description>${Number.isFinite(date.getTime()) ? `<pubDate>${date.toUTCString()}</pubDate>` : ''}</item>`;
          })
          .join('');
        reply.type('application/rss+xml; charset=utf-8').header('Cache-Control', 'no-store');
        return `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Wisesama security briefings</title><link>${xml(base)}</link><description>Sourced vulnerability updates. Assess relevance to your own environment.</description>${items}</channel></rss>`;
      },
    );

    fastify.get(
      '/intel/workspace',
      { preHandler: sessionAuth, schema: { tags: ['intel'], security: [{ cookieAuth: [] }] } },
      async (request, reply) => {
        reply.header('Cache-Control', 'private, no-store');
        const query = z
          .object({ organizationId: z.string().min(1).max(150).optional() })
          .strict()
          .parse(request.query);
        return service.getWorkspace(request.user!.id, query.organizationId);
      },
    );

    fastify.post(
      '/intel/projects',
      {
        preHandler: [requireJson, inventoryAuth],
        bodyLimit: 3 * 1024 * 1024,
        schema: { tags: ['intel'], security: [{ cookieAuth: [] }, { apiKey: [] }] },
      },
      async (request, reply) => {
        const input = projectInput.parse(request.body);
        const project = await service.createProject(request.user!.id, input);
        reply.code(201);
        return project;
      },
    );

    fastify.post(
      '/intel/projects/:id/inventory',
      {
        preHandler: [requireJson, inventoryAuth],
        bodyLimit: 3 * 1024 * 1024,
        schema: { tags: ['intel'], security: [{ cookieAuth: [] }, { apiKey: [] }] },
      },
      async (request) => {
        const { id } = z.object({ id: identifier }).parse(request.params);
        return service.updateInventory(request.user!.id, id, inventoryInput.parse(request.body));
      },
    );

    fastify.post(
      '/intel/projects/:id/scan',
      {
        preHandler: [requireJson, inventoryAuth],
        schema: { tags: ['intel'], security: [{ cookieAuth: [] }, { apiKey: [] }] },
      },
      async (request) => {
        const { id } = z.object({ id: identifier }).parse(request.params);
        z.object({})
          .strict()
          .parse(request.body ?? {});
        return service.scanProject(request.user!.id, id);
      },
    );

    fastify.patch(
      '/intel/findings/:id',
      {
        preHandler: [requireJson, sessionAuth],
        schema: { tags: ['intel'], security: [{ cookieAuth: [] }] },
      },
      async (request) => {
        const { id } = z.object({ id: identifier }).parse(request.params);
        return service.updateFinding(request.user!.id, id, findingInput.parse(request.body));
      },
    );

    fastify.get(
      '/intel/notifications',
      { preHandler: sessionAuth, schema: { tags: ['intel'], security: [{ cookieAuth: [] }] } },
      async (request, reply) => {
        reply.header('Cache-Control', 'private, no-store');
        return service.getNotificationSettings(request.user!.id);
      },
    );

    fastify.patch(
      '/intel/notifications',
      {
        preHandler: [requireJson, sessionAuth],
        schema: { tags: ['intel'], security: [{ cookieAuth: [] }] },
      },
      async (request) => {
        const { emailEnabled } = z
          .object({ emailEnabled: z.boolean() })
          .strict()
          .parse(request.body);
        return service.updateNotificationSettings(request.user!.id, emailEnabled);
      },
    );

    fastify.post(
      '/intel/notifications/test',
      {
        preHandler: [requireJson, sessionAuth],
        schema: { tags: ['intel'], security: [{ cookieAuth: [] }] },
      },
      async (request) => {
        z.object({})
          .strict()
          .parse(request.body ?? {});
        return service.testNotification(request.user!.id);
      },
    );

    fastify.get(
      '/intel/deliveries',
      { preHandler: sessionAuth, schema: { tags: ['intel'], security: [{ cookieAuth: [] }] } },
      async (request, reply) => {
        reply.header('Cache-Control', 'private, no-store');
        return { deliveries: await service.listDeliveries(request.user!.id) };
      },
    );
  };
}

export const intelRoutes = createIntelRoutes();
