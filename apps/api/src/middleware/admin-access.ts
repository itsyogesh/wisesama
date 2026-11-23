import { type PrismaClient, prisma } from '@wisesama/database';
import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { auth } from '../lib/auth';

type AdminSession = { user: { id: string }; session: { id: string } } | null;
type SessionGetter = (headers: Headers) => Promise<AdminSession>;

/** The operator boundary never trusts Dotsama roles or the five-minute cookie cache. */
export function createAdminGuard(
  options: { db?: PrismaClient; getSession?: SessionGetter; now?: () => Date } = {},
) {
  const db = options.db ?? prisma;
  const getSession: SessionGetter =
    options.getSession ??
    ((headers) => auth.api.getSession({ headers, query: { disableCookieCache: true } }));
  const now = options.now ?? (() => new Date());
  return async function requireIntelAdmin(request: FastifyRequest, reply: FastifyReply) {
    let session: AdminSession;
    try {
      session = await getSession(fromNodeHeaders(request.headers));
    } catch {
      return reply.code(401).send({ error: 'Sign in to continue.' });
    }
    if (!session?.user?.id || !session.session?.id)
      return reply.code(401).send({ error: 'Sign in to continue.' });
    const active = await db.session.findFirst({
      where: { id: session.session.id, userId: session.user.id, expiresAt: { gt: now() } },
      select: { id: true },
    });
    if (!active) return reply.code(401).send({ error: 'Your session has ended. Sign in again.' });
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        tier: true,
        remainingQuota: true,
        intelAdmin: true,
        intelSuspendedAt: true,
      },
    });
    if (!user?.intelAdmin || user.intelSuspendedAt)
      return reply.code(403).send({ error: 'Wisesama administrator access is required.' });
    request.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      tier: user.tier,
      remainingQuota: user.remainingQuota,
    };
  };
}

export function createAdminJsonGuard(env: NodeJS.ProcessEnv = process.env) {
  const origins = new Set<string>();
  if (env.INTEL_APP_URL) {
    try {
      const url = new URL(env.INTEL_APP_URL);
      if (
        url.protocol === 'https:' ||
        (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
      )
        origins.add(url.origin);
    } catch {
      /* Invalid deployment configuration fails closed. */
    }
  }
  if (env.NODE_ENV !== 'production') {
    origins.add('http://localhost:3003');
    origins.add('http://127.0.0.1:3003');
  }
  return async function requireAdminJson(request: FastifyRequest, reply: FastifyReply) {
    if (request.headers['content-type']?.split(';')[0]?.trim().toLowerCase() !== 'application/json')
      return reply.code(415).send({ error: 'Use application/json for this action.' });
    const origin = request.headers.origin;
    if (typeof origin !== 'string' || !origins.has(origin))
      return reply.code(403).send({ error: 'Open this action from the Wisesama admin.' });
  };
}

export const requireIntelAdmin = createAdminGuard();
export const requireAdminJson = createAdminJsonGuard();
