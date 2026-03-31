const TELEGRAM_API = 'https://api.telegram.org/bot';

function getToken(): string {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN is not configured');
  return token;
}

export interface TelegramUpdate {
  update_id: number;
  message?: {
    message_id: number;
    from?: {
      id: number;
      username?: string;
      first_name?: string;
    };
    chat: {
      id: number;
      type: string;
    };
    text?: string;
    entities?: Array<{
      type: string;
      offset: number;
      length: number;
    }>;
  };
}

interface SendMessageParams {
  chat_id: number;
  text: string;
  parse_mode?: string;
  reply_markup?: unknown;
  reply_to_message_id?: number;
}

export async function sendMessage(params: SendMessageParams): Promise<void> {
  const token = getToken();
  const url = `${TELEGRAM_API}${token}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Telegram] sendMessage failed:', response.status, error);
  }
}

export async function sendMessageToChannel(channelId: string, text: string, parseMode = 'MarkdownV2'): Promise<void> {
  const token = getToken();
  const url = `${TELEGRAM_API}${token}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: channelId,
      text,
      parse_mode: parseMode,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[Telegram] sendMessageToChannel failed:', response.status, error);
  }
}

export function parseCommand(text: string): { command: string; args: string } | null {
  if (!text || !text.startsWith('/')) return null;

  // Handle /command@botname format
  const match = text.match(/^\/(\w+)(?:@\w+)?\s*(.*)/s);
  if (!match) return null;

  return {
    command: match[1]!.toLowerCase(),
    args: (match[2] ?? '').trim(),
  };
}
