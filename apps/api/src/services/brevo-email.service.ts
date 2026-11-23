import { createHash } from 'node:crypto';

type Mail = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  idempotencyKey?: string;
};

type MailResult =
  | { status: 'sent'; messageId: string }
  | { status: 'failed' | 'unavailable'; error: string };

// Brevo retains an idempotency key for 30 minutes. Leave time for the outbound request.
const BREVO_RETRY_WINDOW_MS = 25 * 60_000;
export const BREVO_RECONCILIATION_REQUIRED =
  'Brevo delivery requires reconciliation before another attempt.';

export function usesBrevo(env: NodeJS.ProcessEnv = process.env) {
  return Boolean(env.BREVO_API_KEY || env.BREVO_SENDER_EMAIL);
}

export function workspaceEmailConfigured(env: NodeJS.ProcessEnv = process.env) {
  if (usesBrevo(env)) return Boolean(env.BREVO_API_KEY?.trim() && env.BREVO_SENDER_EMAIL?.trim());
  return Boolean(env.RESEND_API_KEY);
}

export function brevoRetryBlocked(
  delivery: { attempts: number; createdAt: Date; error: string | null },
  now: Date,
) {
  return (
    delivery.error === BREVO_RECONCILIATION_REQUIRED ||
    (delivery.attempts > 0 && now.getTime() - delivery.createdAt.getTime() >= BREVO_RETRY_WINDOW_MS)
  );
}

function stableBrevoKey(key: string) {
  const bytes = createHash('sha256').update(key).digest().subarray(0, 16);
  // UUID version 8 reserves the remaining bits for application-defined data.
  bytes[6] = (bytes[6]! & 0x0f) | 0x80;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20),
  ].join('-');
}

export async function sendBrevoEmail(message: Mail): Promise<MailResult> {
  const key = process.env.BREVO_API_KEY?.trim();
  const sender = process.env.BREVO_SENDER_EMAIL?.trim();
  if (!key || !sender)
    return { status: 'unavailable', error: 'Brevo email delivery is not configured.' };

  const recipient = { email: message.to };
  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: { 'api-key': key, 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: sender, name: 'Wisesama' },
        subject: message.subject,
        textContent: message.text,
        ...(message.html ? { htmlContent: message.html } : {}),
        tags: ['wisesama'],
        ...(message.idempotencyKey
          ? {
              headers: { idempotencyKey: stableBrevoKey(message.idempotencyKey) },
              messageVersions: [{ to: [recipient] }],
            }
          : { to: [recipient] }),
      }),
      redirect: 'error',
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      // A duplicate response gives no receipt for the earlier send.
      if (response.status === 400 && message.idempotencyKey) {
        const body = (await response.json().catch(() => null)) as { code?: string } | null;
        if (body?.code === 'duplicate_parameter')
          return { status: 'failed', error: BREVO_RECONCILIATION_REQUIRED };
      }
      return {
        status: 'failed',
        error: `Email provider rejected delivery (HTTP ${response.status}).`,
      };
    }
    const data = (await response.json()) as { messageId?: unknown; messageIds?: unknown };
    const messageId =
      data.messageId ??
      (Array.isArray(data.messageIds) && data.messageIds.length === 1
        ? data.messageIds[0]
        : undefined);
    return typeof messageId === 'string' && messageId
      ? { status: 'sent', messageId }
      : { status: 'failed', error: 'Email provider did not confirm delivery acceptance.' };
  } catch {
    return { status: 'failed', error: 'Email provider could not be reached.' };
  }
}
