import type { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { prisma } from '@wisesama/database';
import { sendApiKeyAlert } from '../services/email.service';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

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
 * Middleware to verify JWT token and attach user to request
 */
export async function authenticate(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const auth = request.headers.authorization;

  if (!auth?.startsWith('Bearer ')) {
    reply.status(401).send({ error: 'Missing or invalid authorization header' });
    return;
  }

  const token = auth.slice(7);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: string };

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        role: true,
        tier: true,
        remainingQuota: true,
      },
    });

    if (!user) {
      reply.status(401).send({ error: 'User not found' });
      return;
    }

    request.user = user;
  } catch (error) {
    reply.status(401).send({ error: 'Invalid or expired token' });
  }
}

/**
 * Middleware to check if authenticated user is an admin
 * Must be used after authenticate middleware
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
 * Helper to verify API key authentication
 */
export async function authenticateApiKey(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const apiKey = request.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    // Fall back to JWT auth
    return authenticate(request, reply);
  }

  // Hash the API key to compare with stored hash
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

  // Check quota
  if (key.remainingQuota <= 0) {
    reply.status(429).send({ error: 'API key quota exceeded' });
    return;
  }

  // Calculate usage thresholds
  const totalQuota = key.user.tier === 'free' ? 10000 : 100000;
  const currentUsage = totalQuota - key.remainingQuota;
  const usagePercent = (currentUsage / totalQuota) * 100;
  
  // Check for alerts (80% and 100% boundaries)
  // We check if it *just* crossed the threshold to avoid spamming
  const remaining = key.remainingQuota;
  const threshold80 = Math.floor(totalQuota * 0.2); // 20% remaining = 80% used
  
  if (remaining === threshold80) {
    // Exactly hit 80% usage
    sendApiKeyAlert({
      email: key.user.email,
      keyName: key.name || key.keyPrefix,
      usagePercent: 80,
      limit: totalQuota,
    }).catch(console.error);
  } else if (remaining === 1) {
    // About to hit 100% usage (this is the last allowed request)
    sendApiKeyAlert({
      email: key.user.email,
      keyName: key.name || key.keyPrefix,
      usagePercent: 100,
      limit: totalQuota,
    }).catch(console.error);
  }

  // Update last used timestamp
  await prisma.apiKey.update({
    where: { id: key.id },
    data: {
      lastUsedAt: new Date(),
      remainingQuota: { decrement: 1 },
    },
  });

  request.user = key.user;
}
