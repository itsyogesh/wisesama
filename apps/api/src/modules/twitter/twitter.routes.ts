import type { FastifyInstance } from 'fastify';
import { Receiver } from '@upstash/qstash';
import { pollAndProcessMentions } from './twitter.service';

let _receiver: Receiver | null = null;

function getReceiver(): Receiver {
  if (!_receiver) {
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
    if (!currentSigningKey || !nextSigningKey) {
      throw new Error('QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY are required');
    }
    _receiver = new Receiver({ currentSigningKey, nextSigningKey });
  }
  return _receiver;
}

export async function twitterRoutes(fastify: FastifyInstance) {
  // QStash cron endpoint — polls X for new @wisesama_help mentions
  fastify.post(
    '/jobs/twitter-poll',
    {
      schema: {
        tags: ['jobs'],
        description: 'Poll X/Twitter mentions and auto-reply (called by QStash cron)',
        hide: true,
      },
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      // Verify QStash signature in production
      if (process.env.NODE_ENV === 'production' || process.env.QSTASH_CURRENT_SIGNING_KEY) {
        const signature = request.headers['upstash-signature'] as string;
        const body = (request as unknown as { rawBody: string }).rawBody || JSON.stringify(request.body) || '';
        const protocol = (request.headers['x-forwarded-proto'] as string) || 'https';
        const host = (request.headers['x-forwarded-host'] as string) || (request.headers.host as string);
        const requestUrl = `${protocol}://${host}${request.url}`;

        try {
          const isValid = await getReceiver().verify({ signature, body, url: requestUrl });
          if (!isValid) {
            request.log.warn('Invalid QStash signature for twitter-poll');
            reply.status(401);
            return { error: 'Invalid signature' };
          }
        } catch (err) {
          request.log.error({ err }, 'QStash signature verification failed for twitter-poll');
          reply.status(401);
          return { error: 'Signature verification failed' };
        }
      }

      // Check if Twitter is configured
      if (!process.env.TWITTER_BEARER_TOKEN || !process.env.TWITTER_USER_ID) {
        return { success: false, error: 'Twitter credentials not configured' };
      }

      try {
        request.log.info('Starting Twitter mention poll');
        const result = await pollAndProcessMentions();
        request.log.info({ result }, 'Twitter mention poll completed');
        return { success: true, ...result };
      } catch (error) {
        request.log.error({ error }, 'Twitter mention poll failed');
        reply.status(500);
        return { error: 'Twitter poll failed' };
      }
    }
  );

  // Manual trigger (dev only)
  fastify.post(
    '/jobs/twitter-poll/trigger',
    {
      schema: {
        tags: ['jobs'],
        description: 'Manually trigger Twitter mention poll (for testing)',
      },
    },
    async (request, reply) => {
      if (process.env.NODE_ENV === 'production') {
        reply.status(403);
        return { error: 'Manual trigger disabled in production' };
      }

      if (!process.env.TWITTER_BEARER_TOKEN || !process.env.TWITTER_USER_ID) {
        return { success: false, error: 'Twitter credentials not configured' };
      }

      try {
        request.log.info('Manual Twitter poll triggered');
        const result = await pollAndProcessMentions();
        return { success: true, ...result };
      } catch (error) {
        request.log.error({ error }, 'Manual Twitter poll failed');
        reply.status(500);
        return { error: 'Twitter poll failed' };
      }
    }
  );

  // Status endpoint
  fastify.get(
    '/twitter/status',
    {
      schema: {
        tags: ['bots'],
        description: 'Twitter bot status',
      },
    },
    async () => {
      return {
        status: process.env.TWITTER_BEARER_TOKEN ? 'configured' : 'not_configured',
        userId: process.env.TWITTER_USER_ID ? 'set' : 'not_set',
        oauthConfigured: !!(process.env.TWITTER_API_KEY && process.env.TWITTER_ACCESS_TOKEN),
      };
    }
  );
}
