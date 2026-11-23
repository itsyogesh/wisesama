import { prisma } from '@wisesama/database';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from '../lib/auth';
import { sessionMutationError } from '../lib/request-origin';
import { sendApiKeyAlert } from '../services/email.service';

export interface AuthUser {
  id: string;
  email: string;
  role: 'USER' | 'ADMIN';
  tier: string;
  remainingQuota: number;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: AuthUser;
  }
}

/**
 * Middleware to verify Better Auth session and attach user to request.
 * Reads session from cookie (set by Better Auth on sign-in).
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void | FastifyReply> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
      query: { disableCookieCache: true },
    });

    if (!session?.user) {
      return reply.status(401).send({ error: 'Missing or invalid session' });
    }

    const mutationError = sessionMutationError(request.method, request.headers);
    if (mutationError)
      return reply.status(mutationError.status).send({ error: mutationError.error });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const user = session.user as any;

    request.user = {
      id: user.id,
      email: user.email,
      role: user.role || 'USER',
      tier: user.tier || 'free',
      remainingQuota: user.remainingQuota ?? 100,
    };
  } catch {
    return reply.status(401).send({ error: 'Invalid or expired session' });
  }
}

/**
 * Middleware to check if authenticated user is an admin.
 * Must be used after authenticate middleware.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void | FastifyReply> {
  if (!request.user) {
    return reply.status(401).send({ error: 'Authentication required' });
  }

  if (request.user.role !== 'ADMIN') {
    return reply.status(403).send({ error: 'Admin access required' });
  }
}

/**
 * Middleware supporting both API key (x-api-key header) and session auth.
 * API key takes priority; falls back to session auth if no API key provided.
 */
export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void | FastifyReply> {
  const apiKey = request.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    return authenticate(request, reply);
  }

  const crypto = await import('crypto');
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

  const key = await prisma.apiKey.findUnique({
    where: { keyHash },
    include: {
      user: {
        select: {
          id: true,
          email: true,
          emailVerified: true,
          role: true,
          tier: true,
          remainingQuota: true,
        },
      },
    },
  });

  if (!key || !key.isActive) {
    return reply.status(401).send({ error: 'Invalid API key' });
  }

  if (key.remainingQuota <= 0) {
    return reply.status(429).send({ error: 'API key quota exceeded' });
  }

  const totalQuota = key.user.tier === 'free' ? 10000 : 100000;
  const remaining = key.remainingQuota;
  const threshold80 = Math.floor(totalQuota * 0.2);

  if (key.user.emailVerified && remaining === threshold80) {
    sendApiKeyAlert({
      email: key.user.email,
      keyName: key.name || key.keyPrefix,
      usagePercent: 80,
      limit: totalQuota,
    }).catch(console.error);
  } else if (key.user.emailVerified && remaining === 1) {
    sendApiKeyAlert({
      email: key.user.email,
      keyName: key.name || key.keyPrefix,
      usagePercent: 100,
      limit: totalQuota,
    }).catch(console.error);
  }

  await prisma.apiKey.update({
    where: { id: key.id },
    data: {
      lastUsedAt: new Date(),
      remainingQuota: { decrement: 1 },
    },
  });

  request.user = key.user;
}
