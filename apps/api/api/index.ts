import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { IncomingMessage, ServerResponse } from 'http';

import { checkRoutes } from '../src/modules/query/check.routes';
import { identityRoutes } from '../src/modules/identity/identity.routes';
import { reportRoutes } from '../src/modules/report/report.routes';
import { authRoutes } from '../src/modules/auth/auth.routes';
import { apiKeysRoutes } from '../src/modules/api-keys/api-keys.routes';
import { healthRoutes } from '../src/modules/health/health.routes';
import { adminRoutes } from '../src/modules/admin/admin.routes';
import { whitelistRoutes } from '../src/modules/admin/whitelist.routes';
import { reportsAdminRoutes } from '../src/modules/admin/reports.routes';
import { contributionsRoutes } from '../src/modules/admin/contributions.routes';
import { jobsRoutes } from '../src/modules/jobs/jobs.routes';
import { ratelimit } from '../src/lib/redis';

// Instantiate Fastify
const app = Fastify({
  logger: false,
});

// Security
app.register(helmet);
app.register(cors, {
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3000'],
  credentials: true,
});

// Rate limiting with Upstash
app.addHook('onRequest', async (request, reply) => {
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
app.register(swagger, {
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
app.register(swaggerUi, {
  routePrefix: '/docs',
});

// Response wrapper
app.addHook('onSend', async (request, reply, payload) => {
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
app.register(healthRoutes, { prefix: '/api/v1' });
app.register(checkRoutes, { prefix: '/api/v1' });
app.register(identityRoutes, { prefix: '/api/v1' });
app.register(reportRoutes, { prefix: '/api/v1' });
app.register(authRoutes, { prefix: '/api/v1' });
app.register(apiKeysRoutes, { prefix: '/api/v1' });
app.register(jobsRoutes, { prefix: '/api/v1' });

// Admin routes
app.register(adminRoutes, { prefix: '/api/v1' });
app.register(whitelistRoutes, { prefix: '/api/v1' });
app.register(reportsAdminRoutes, { prefix: '/api/v1' });
app.register(contributionsRoutes, { prefix: '/api/v1' });

// Vercel Serverless Handler
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  await app.ready();
  app.server.emit('request', req, res);
}
