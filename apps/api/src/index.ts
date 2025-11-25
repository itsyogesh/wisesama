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
import { healthRoutes } from './modules/health/health.routes';

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
        { url: 'https://api.wisesama.io', description: 'Production' },
      ],
      tags: [
        { name: 'check', description: 'Entity lookup and risk assessment' },
        { name: 'identity', description: 'Polkadot identity operations' },
        { name: 'report', description: 'Fraud report submission' },
        { name: 'auth', description: 'Authentication' },
      ],
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

  return fastify;
}

async function start() {
  try {
    const app = await buildApp();
    await app.listen({ port: PORT, host: HOST });
    console.log(`Server running at http://${HOST}:${PORT}`);
    console.log(`API docs at http://${HOST}:${PORT}/docs`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
