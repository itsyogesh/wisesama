import type { FastifyInstance } from 'fastify';
import { verifyDiscordSignature } from './discord.verify';
import {
  handleCheckCommand,
  handleReportCommand,
  handleHelpCommand,
  createDeferredResponse,
} from './discord.commands';

// Discord interaction types
const INTERACTION_TYPE = {
  PING: 1,
  APPLICATION_COMMAND: 2,
} as const;

interface DiscordInteraction {
  type: number;
  id: string;
  token: string;
  data?: {
    name: string;
    options?: Array<{ name: string; value: string }>;
  };
  member?: {
    user?: { username: string; id: string };
  };
  user?: { username: string; id: string };
}

export async function discordRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: DiscordInteraction }>(
    '/discord/interactions',
    {
      schema: {
        tags: ['bots'],
        description: 'Discord interactions endpoint (slash commands)',
        hide: true,
      },
      config: {
        rawBody: true,
      },
    },
    async (request, reply) => {
      const publicKey = process.env.DISCORD_PUBLIC_KEY;
      if (!publicKey) {
        reply.status(500);
        return { error: 'Discord public key not configured' };
      }

      // Verify Ed25519 signature
      const signature = request.headers['x-signature-ed25519'] as string;
      const timestamp = request.headers['x-signature-timestamp'] as string;
      const rawBody = (request as unknown as { rawBody: string }).rawBody || JSON.stringify(request.body);

      if (!signature || !timestamp) {
        reply.status(401);
        return { error: 'Missing signature headers' };
      }

      const isValid = await verifyDiscordSignature(publicKey, signature, timestamp, rawBody);
      if (!isValid) {
        reply.status(401);
        return { error: 'Invalid signature' };
      }

      const interaction = request.body;

      // Handle PING (Discord verification)
      if (interaction.type === INTERACTION_TYPE.PING) {
        return { type: 1 }; // PONG
      }

      // Handle slash commands
      if (interaction.type === INTERACTION_TYPE.APPLICATION_COMMAND) {
        const commandName = interaction.data?.name;
        const options = interaction.data?.options ?? [];
        const appId = process.env.DISCORD_APP_ID;
        if (!appId) {
          reply.status(500);
          return { error: 'Discord app ID not configured' };
        }
        const username = interaction.member?.user?.username ?? interaction.user?.username;

        switch (commandName) {
          case 'check': {
            // Defer the response (shows "thinking...")
            const deferred = createDeferredResponse();
            // Process async — edit the deferred response when done
            handleCheckCommand(options, interaction.token, appId).catch((err) => {
              request.log.error({ err }, 'Discord check command failed');
            });
            return deferred;
          }

          case 'report': {
            const deferred = createDeferredResponse(true); // ephemeral
            handleReportCommand(options, interaction.token, appId, username).catch((err) => {
              request.log.error({ err }, 'Discord report command failed');
            });
            return deferred;
          }

          case 'help':
            return handleHelpCommand();

          default:
            return {
              type: 4,
              data: { content: '❌ Unknown command.' },
            };
        }
      }

      return { type: 1 };
    }
  );

  // Status endpoint
  fastify.get(
    '/discord/status',
    {
      schema: {
        tags: ['bots'],
        description: 'Discord bot status',
      },
    },
    async () => {
      return {
        status: process.env.DISCORD_PUBLIC_KEY ? 'configured' : 'not_configured',
        appId: process.env.DISCORD_APP_ID ? 'set' : 'not_set',
      };
    }
  );
}
