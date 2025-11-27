import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rawBody from 'fastify-raw-body';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

import { checkRoutes } from './modules/query/check.routes';
import { identityRoutes } from './modules/identity/identity.routes';
import { reportRoutes } from './modules/report/report.routes';
import { authRoutes } from './modules/auth/auth.routes';
import { apiKeysRoutes } from './modules/api-keys/api-keys.routes';
import { healthRoutes } from './modules/health/health.routes';
import { adminRoutes } from './modules/admin/admin.routes';
import { whitelistRoutes } from './modules/admin/whitelist.routes';
import { reportsAdminRoutes } from './modules/admin/reports.routes';
import { contributionsRoutes } from './modules/admin/contributions.routes';
import { jobsRoutes } from './modules/jobs/jobs.routes';
import { ratelimit } from './lib/redis';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.LOG_LEVEL || 'info',
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

  // Security
  await fastify.register(helmet);
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Rate limiting with Upstash
  fastify.addHook('onRequest', async (request, reply) => {
    // Skip rate limiting for health checks and docs
    if (request.url === '/api/v1/health' || request.url.startsWith('/docs')) {
      return;
    }

    const identifier = request.headers['x-api-key']?.toString() || request.ip;
    const { success, limit, remaining, reset } = await ratelimit.limit(identifier);

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
        description: 'Fraud detection API for the Polkadot/Dotsama ecosystem',
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
        { name: 'auth', description: 'Authentication' },
        { name: 'api-keys', description: 'API key management' },
        { name: 'admin', description: 'Admin operations (requires admin role)' },
        { name: 'jobs', description: 'Background job endpoints' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
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
      !request.url.startsWith('/docs')
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

  // Routes
  await fastify.register(healthRoutes, { prefix: '/api/v1' });
  await fastify.register(checkRoutes, { prefix: '/api/v1' });
  await fastify.register(identityRoutes, { prefix: '/api/v1' });
  await fastify.register(reportRoutes, { prefix: '/api/v1' });
  await fastify.register(authRoutes, { prefix: '/api/v1' });
  await fastify.register(apiKeysRoutes, { prefix: '/api/v1' });
  await fastify.register(jobsRoutes, { prefix: '/api/v1' });

  // Admin routes (require admin role)
  await fastify.register(adminRoutes, { prefix: '/api/v1' });
  await fastify.register(whitelistRoutes, { prefix: '/api/v1' });
  await fastify.register(reportsAdminRoutes, { prefix: '/api/v1' });
  await fastify.register(contributionsRoutes, { prefix: '/api/v1' });

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
