import type { FastifyInstance } from 'fastify';
import { type TelegramUpdate, sendMessage, parseCommand } from './telegram.service';
import { handleCheck, handleReport, handleHelp } from './telegram.commands';

export async function telegramRoutes(fastify: FastifyInstance) {
  fastify.post<{ Body: TelegramUpdate }>(
    '/telegram/webhook',
    {
      schema: {
        tags: ['bots'],
        description: 'Telegram bot webhook endpoint',
        hide: true,
      },
    },
    async (request, reply) => {
      // Verify secret token if configured
      const secretToken = process.env.TELEGRAM_WEBHOOK_SECRET;
      if (secretToken) {
        const headerToken = request.headers['x-telegram-bot-api-secret-token'] as string;
        if (headerToken !== secretToken) {
          reply.status(401);
          return { error: 'Invalid secret token' };
        }
      }

      const update = request.body;

      // Respond 200 immediately — Telegram requires fast response
      reply.status(200).send({ ok: true });

      // Process message asynchronously
      if (!update.message?.text) return;

      const parsed = parseCommand(update.message.text);
      if (!parsed) return;

      const chatId = update.message.chat.id;
      const username = update.message.from?.username;

      let result;
      switch (parsed.command) {
        case 'check':
        case 'scan':
          result = await handleCheck(parsed.args);
          break;
        case 'report':
          result = await handleReport(parsed.args, username);
          break;
        case 'help':
        case 'start':
          result = handleHelp();
          break;
        default:
          return;
      }

      await sendMessage({
        chat_id: chatId,
        text: result.text,
        parse_mode: result.parseMode,
        reply_markup: result.replyMarkup,
        reply_to_message_id: update.message.message_id,
      });
    }
  );

  // Health check for telegram bot
  fastify.get(
    '/telegram/status',
    {
      schema: {
        tags: ['bots'],
        description: 'Telegram bot status',
      },
    },
    async () => {
      return {
        status: process.env.TELEGRAM_BOT_TOKEN ? 'configured' : 'not_configured',
        webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ? 'set' : 'not_set',
      };
    }
  );
}
