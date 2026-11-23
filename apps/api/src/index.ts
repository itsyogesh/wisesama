import 'dotenv/config';
import { createHash } from 'node:crypto';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import FastifyBetterAuth from 'fastify-better-auth';
import rawBody from 'fastify-raw-body';
import { auth, githubSignInAvailable } from './lib/auth';
import { publicSubscriptionRatelimit, ratelimit } from './lib/redis';
import { requestLogUrl } from './lib/request-log';
import { trustedApplicationOrigins } from './lib/request-origin';
import { apiKeysRoutes } from './modules/api-keys/api-keys.routes';
import { healthRoutes } from './modules/health/health.routes';
import { intelAdminRoutes } from './modules/intel/admin.routes';
import { adminOpsRoutes } from './modules/intel/admin-ops.routes';
import { intelRoutes } from './modules/intel/intel.routes';
import { mcpRoutes } from './modules/intel/mcp.routes';
import { organizationRoutes } from './modules/intel/organization.routes';
import { playbookRoutes } from './modules/intel/playbook.routes';
import { publicSubscriptionRoutes } from './modules/intel/public-subscription.routes';
import { repositoryRoutes } from './modules/intel/repository.routes';
import { securityBaselineRoutes } from './modules/intel/security-baseline.routes';
import { intelJobsRoutes } from './modules/jobs/intel-jobs.routes';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function buildApp() {
  const fastify = Fastify({
    trustProxy: process.env.TRUST_PROXY === 'true' || process.env.VERCEL === '1',
    logger: {
      level: process.env.LOG_LEVEL || 'info',
      serializers: {
        req: (request) => ({
          method: request.method,
          url: requestLogUrl(request.url || ''),
          hostname: request.hostname,
          remoteAddress: request.ip,
        }),
      },
      transport:
        process.env.NODE_ENV === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
    requestIdHeader: 'x-request-id',
    genReqId: () => crypto.randomUUID(),
  });

  // Raw body plugin for signature verification (QStash)
  await fastify.register(rawBody, {
    field: 'rawBody',
    global: false, // Only add to routes that need it
    runFirst: true,
  });

  const isProduction = process.env.NODE_ENV === 'production';
  const allowedCorsOrigins = trustedApplicationOrigins();

  // Security - CORS must be registered before helmet
  await fastify.register(cors, {
    origin: allowedCorsOrigins,
    credentials: true,
  });
  await fastify.register(helmet, {
    hsts: isProduction
      ? {
          maxAge: 60 * 60 * 24 * 180, // 180 days
          includeSubDomains: true,
        }
      : false,
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
  });

  // Rate limiting with Upstash
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip rate limiting for health checks, docs, and auth routes
    if (
      request.url === '/api/v1/health' ||
      request.url === '/api/v1/auth-options' ||
      request.url.startsWith('/docs') ||
      request.url.startsWith('/api/auth') ||
      request.url.startsWith('/api/v1/telegram/webhook') ||
      request.url.startsWith('/api/v1/discord/interactions') ||
      request.url.startsWith('/api/v1/jobs/')
    ) {
      return;
    }

    const isIntelligence =
      request.url.startsWith('/api/v1/intel/') || request.url.startsWith('/api/v1/mcp');
    const identifier = isIntelligence
      ? `ip:${request.ip}`
      : request.headers['x-api-key']
        ? `key:${createHash('sha256').update(request.headers['x-api-key'].toString()).digest('hex')}`
        : request.ip;
    const consentEmail =
      request.method === 'POST' &&
      /^\/api\/v1\/intel\/subscriptions\/(request|manage\/request)(?:\?|$)/.test(request.url);
    const limiter = consentEmail ? publicSubscriptionRatelimit : ratelimit;
    const { success, limit, remaining, reset } = await limiter.limit(identifier);

    reply.header('X-RateLimit-Limit', limit);
    reply.header('X-RateLimit-Remaining', remaining);
    reply.header('X-RateLimit-Reset', reset);

    if (!success) {
      reply.status(429);
      reply.send({
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
      });
    }
  });

  // API Documentation
  await fastify.register(swagger, {
    openapi: {
      info: {
        title: 'Wisesama API',
        description: 'Wisesama vulnerability response and retained Dotsama crypto fraud APIs',
        version: '1.0.0',
      },
      servers: [
        { url: 'http://localhost:3001', description: 'Development' },
        { url: 'https://api.wisesama.com', description: 'Production' },
      ],
      tags: [
        { name: 'check', description: 'Entity lookup and risk assessment' },
        { name: 'identity', description: 'Polkadot identity operations' },
        { name: 'report', description: 'Fraud report submission' },
        { name: 'stats', description: 'Platform statistics' },
        { name: 'auth', description: 'Authentication' },
        { name: 'api-keys', description: 'API key management' },
        { name: 'admin', description: 'Admin operations (requires admin role)' },
        { name: 'jobs', description: 'Background job endpoints' },
        {
          name: 'intel',
          description: 'Vulnerability briefings, private inventories, and response tracking',
        },
        { name: 'bots', description: 'Bot integrations (Telegram, Discord, X/Twitter)' },
      ],
      components: {
        securitySchemes: {
          cookieAuth: {
            type: 'apiKey',
            in: 'cookie',
            name: 'better-auth.session_token',
            description: 'Session cookie set by Better Auth (POST /api/auth/sign-in)',
          },
          apiKey: {
            type: 'apiKey',
            in: 'header',
            name: 'x-api-key',
          },
        },
      },
    },
  });
  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
  });

  // Response wrapper
  fastify.addHook('onSend', async (request, reply, payload) => {
    if (
      reply.statusCode >= 200 &&
      reply.statusCode < 300 &&
      typeof payload === 'string' &&
      !request.url.startsWith('/docs') &&
      !request.url.startsWith('/api/v1/mcp') &&
      !request.url.startsWith('/api/auth')
    ) {
      try {
        const data = JSON.parse(payload);
        if (!data.meta) {
          const wrapped = {
            meta: {
              requestId: request.id,
              timestamp: new Date().toISOString(),
              processingTimeMs: Math.round(reply.elapsedTime),
            },
            data,
          };
          return JSON.stringify(wrapped);
        }
      } catch {
        // Not JSON, return as-is
      }
    }
    return payload;
  });

  // Better Auth — via fastify-better-auth plugin
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await fastify.register(FastifyBetterAuth, { auth } as any);

  // Wisesama and shared account routes
  fastify.get('/api/v1/auth-options', async (_request, reply) => {
    reply.header('Cache-Control', 'public, max-age=60');
    return { github: githubSignInAvailable };
  });
  await fastify.register(healthRoutes, { prefix: '/api/v1' });
  await fastify.register(apiKeysRoutes, { prefix: '/api/v1' });
  await fastify.register(intelRoutes, { prefix: '/api/v1' });
  await fastify.register(organizationRoutes, { prefix: '/api/v1' });
  await fastify.register(intelAdminRoutes, { prefix: '/api/v1' });
  await fastify.register(adminOpsRoutes, { prefix: '/api/v1' });
  await fastify.register(playbookRoutes, { prefix: '/api/v1' });
  await fastify.register(repositoryRoutes, { prefix: '/api/v1' });
  await fastify.register(securityBaselineRoutes, { prefix: '/api/v1' });
  await fastify.register(publicSubscriptionRoutes, { prefix: '/api/v1' });
  await fastify.register(mcpRoutes, { prefix: '/api/v1' });
  await fastify.register(intelJobsRoutes, { prefix: '/api/v1' });

  // The preserved crypto product is an explicit deployment mode.
  // Keep its routes and provider initialization outside the Wisesama launch by default.
  if (process.env.DOTSAMA_API_ENABLED === 'true') {
    const { dotsamaRoutes } = await import('./dotsama/routes');
    await fastify.register(dotsamaRoutes, { prefix: '/api/v1' });
  }

  return fastify;
}

// For local development
async function start() {
  try {
    const app = await buildApp();

    // Start the server
    await app.listen({ port: PORT, host: HOST });
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log(`API docs at http://${HOST}:${PORT}/docs`);

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down...');
      await app.close();
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

// Singleton for Vercel serverless (reuse across warm invocations)
let app: Awaited<ReturnType<typeof buildApp>> | null = null;

async function getApp() {
  if (!app) {
    app = await buildApp();
    await app.ready();
  }
  return app;
}

// Export for Vercel serverless
import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const fastify = await getApp();
  fastify.server.emit('request', req, res);
}

// Only start server if not running on Vercel
if (process.env.VERCEL !== '1') {
  start();
}
