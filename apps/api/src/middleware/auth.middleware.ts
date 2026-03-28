import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '@wisesama/database';
import { auth } from '../lib/auth';
import { fromNodeHeaders } from 'better-auth/node';
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
  reply: FastifyReply
): Promise<void> {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(request.headers),
    });

    if (!session?.user) {
      reply.status(401).send({ error: 'Missing or invalid session' });
      return;
    }

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
    reply.status(401).send({ error: 'Invalid or expired session' });
  }
}

/**
 * Middleware to check if authenticated user is an admin.
 * Must be used after authenticate middleware.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.user) {
    reply.status(401).send({ error: 'Authentication required' });
    return;
  }

  if (request.user.role !== 'ADMIN') {
    reply.status(403).send({ error: 'Admin access required' });
    return;
  }
}

/**
 * Middleware supporting both API key (x-api-key header) and session auth.
 * API key takes priority; falls back to session auth if no API key provided.
 */
export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
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
          role: true,
          tier: true,
          remainingQuota: true,
        },
      },
    },
  });

  if (!key || !key.isActive) {
    reply.status(401).send({ error: 'Invalid API key' });
    return;
  }

  if (key.remainingQuota <= 0) {
    reply.status(429).send({ error: 'API key quota exceeded' });
    return;
  }

  const totalQuota = key.user.tier === 'free' ? 10000 : 100000;
  const remaining = key.remainingQuota;
  const threshold80 = Math.floor(totalQuota * 0.2);

  if (remaining === threshold80) {
    sendApiKeyAlert({
      email: key.user.email,
      keyName: key.name || key.keyPrefix,
      usagePercent: 80,
      limit: totalQuota,
    }).catch(console.error);
  } else if (remaining === 1) {
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
