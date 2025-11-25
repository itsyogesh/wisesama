import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
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
import { scheduleRecurringSync, runInitialSync, shutdownWorker } from './workers/sync.worker';

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

  // Security
  await fastify.register(helmet);
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
    credentials: true,
  });

  // Rate limiting
  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
    keyGenerator: (request) => {
      return request.headers['x-api-key']?.toString() || request.ip;
    },
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

  // Admin routes (require admin role)
  await fastify.register(adminRoutes, { prefix: '/api/v1' });
  await fastify.register(whitelistRoutes, { prefix: '/api/v1' });
  await fastify.register(reportsAdminRoutes, { prefix: '/api/v1' });
  await fastify.register(contributionsRoutes, { prefix: '/api/v1' });

  return fastify;
}

async function start() {
  try {
    const app = await buildApp();

    // Start the server
    await app.listen({ port: PORT, host: HOST });
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log(`API docs at http://${HOST}:${PORT}/docs`);

    // Initialize background sync worker
    try {
      await scheduleRecurringSync();
      await runInitialSync();
    } catch (err) {
      console.warn('Background sync initialization failed (Redis may not be running):', err);
    }

    // Graceful shutdown
    const shutdown = async () => {
      console.log('Shutting down...');
      await shutdownWorker();
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

start();
