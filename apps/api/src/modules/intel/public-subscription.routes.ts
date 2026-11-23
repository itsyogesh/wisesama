import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { z } from 'zod';
import {
  PublicSubscriptionError,
  publicSubscriptionService,
} from '../../services/public-subscription.service';

const email = z.string().trim().toLowerCase().email().max(254);
const token = z
  .string()
  .min(32)
  .max(250)
  .regex(/^[a-zA-Z0-9_.-]+$/);
const topics = z
  .array(z.enum(['all', 'npm', 'PyPI', 'known_exploited']))
  .min(1)
  .max(4)
  .transform((values) => [...new Set(values)]);
const json = async (request: FastifyRequest, reply: FastifyReply) => {
  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json'))
    reply.code(415).send({ error: 'Use application/json for this request.' });
};

export function createPublicSubscriptionRoutes(service = publicSubscriptionService) {
  return async function publicSubscriptions(fastify: FastifyInstance) {
    fastify.setErrorHandler((error, _request, reply) => {
      if (error instanceof z.ZodError)
        return reply.code(400).send({ error: 'Check the email, topics or link and try again.' });
      if (error instanceof PublicSubscriptionError)
        return reply.code(error.statusCode).send({ error: error.message });
      return reply
        .code(500)
        .send({ error: 'This subscription request could not complete. Please try again.' });
    });
    fastify.addHook('onRequest', async (_request, reply) => {
      reply.header('Cache-Control', 'private, no-store').header('Referrer-Policy', 'no-referrer');
    });
    const base = '/intel/subscriptions';
    fastify.get(`${base}/capabilities`, async () => service.capabilities());
    fastify.post(`${base}/request`, { preHandler: json }, async (request, reply) => {
      const input = z
        .object({ email, topics: topics.default(['all']) })
        .strict()
        .parse(request.body);
      const result = await service.request(input.email, input.topics);
      return reply.code(202).send(result);
    });
    fastify.post(`${base}/confirm`, { preHandler: json }, async (request) => {
      const input = z.object({ token }).strict().parse(request.body);
      return service.confirm(input.token);
    });
    fastify.post(`${base}/manage/request`, { preHandler: json }, async (request, reply) => {
      const input = z.object({ email }).strict().parse(request.body);
      return reply.code(202).send(await service.request(input.email, ['all'], 'manage'));
    });
    fastify.post(`${base}/manage/read`, { preHandler: json }, async (request) => {
      return service.readPreferences(z.object({ token }).strict().parse(request.body).token);
    });
    fastify.patch(`${base}/manage`, { preHandler: json }, async (request) => {
      const input = z.object({ token, topics }).strict().parse(request.body);
      return service.updatePreferences(input.token, input.topics);
    });
    fastify.post(`${base}/unsubscribe`, { preHandler: json }, async (request) => {
      return service.unsubscribe(z.object({ token }).strict().parse(request.body).token);
    });
    // RFC 8058: a signed, unsubscribe-only capability; ordinary scanner GETs never opt out.
    // Route logging is silent because this URL necessarily contains a capability token.
    fastify.register(async (oneClick) => {
      oneClick.addContentTypeParser(
        'application/x-www-form-urlencoded',
        { parseAs: 'string' },
        (_request, body, done) => done(null, body),
      );
      oneClick.post(`${base}/one-click/:token`, { logLevel: 'silent' }, async (request, reply) => {
        const body = request.body;
        if (
          request.headers['content-type']?.split(';')[0] !== 'application/x-www-form-urlencoded' ||
          typeof body !== 'string' ||
          new URLSearchParams(body).get('List-Unsubscribe') !== 'One-Click'
        )
          return reply.code(400).send({ error: 'A one-click unsubscribe POST is required.' });
        return service.unsubscribe(z.object({ token }).parse(request.params).token);
      });
      oneClick.get(`${base}/one-click/:token`, { logLevel: 'silent' }, async (_request, reply) =>
        reply.code(405).header('Allow', 'POST').send({
          error:
            'Opening this URL does not unsubscribe. Use the unsubscribe link in the email or send a one-click POST.',
        }),
      );
    });
    fastify.post(`${base}/webhooks/resend`, { config: { rawBody: true } }, async (request) => {
      const headers = z
        .object({
          'svix-id': z.string().min(1).max(250),
          'svix-timestamp': z.string().min(1).max(100),
          'svix-signature': z.string().min(1).max(2000),
        })
        .parse(request.headers);
      const raw = (request as unknown as { rawBody?: string }).rawBody;
      if (typeof raw !== 'string')
        throw new PublicSubscriptionError(400, 'Original webhook body required.');
      return service.handleWebhook(raw, {
        id: headers['svix-id'],
        timestamp: headers['svix-timestamp'],
        signature: headers['svix-signature'],
      });
    });
  };
}

export const publicSubscriptionRoutes = createPublicSubscriptionRoutes();
