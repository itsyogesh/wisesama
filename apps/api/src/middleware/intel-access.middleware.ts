import { type PrismaClient, prisma } from '@wisesama/database';
import { authenticate, authenticateApiKey } from './auth.middleware';

type AuthHandler = typeof authenticate;

/** V2 access is checked against live account state, independently of the old crypto product. */
export function createIntelAccess(
  options: { db?: Pick<PrismaClient, 'user'>; session?: AuthHandler; apiKey?: AuthHandler } = {},
) {
  const db = options.db ?? prisma;
  function guard(handler: AuthHandler): AuthHandler {
    return async (request, reply) => {
      await handler(request, reply);
      if (reply.sent) return;
      if (!request.user) return reply.code(401).send({ error: 'Sign in to continue.' });
      try {
        const user = await db.user.findUnique({
          where: { id: request.user.id },
          select: { id: true, intelSuspendedAt: true },
        });
        if (!user) return reply.code(401).send({ error: 'This account is no longer available.' });
        if (user.intelSuspendedAt)
          return reply.code(403).send({
            error: 'Wisesama workspace access is suspended. Contact the service operator for help.',
          });
      } catch {
        return reply
          .code(503)
          .send({ error: 'Account access could not be checked. Try again later.' });
      }
    };
  }
  return {
    authenticateIntel: guard(options.session ?? authenticate),
    authenticateIntelApiKey: guard(options.apiKey ?? authenticateApiKey),
  };
}
export const { authenticateIntel, authenticateIntelApiKey } = createIntelAccess();
