import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  BREVO_RECONCILIATION_REQUIRED,
  brevoRetryBlocked,
  sendBrevoEmail,
  workspaceEmailConfigured,
} from '../brevo-email.service';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

const message = {
  to: 'recipient@example.org',
  subject: 'Wisesama test',
  text: 'A dependency alert',
  idempotencyKey: 'private-delivery-1',
};

describe('Brevo email delivery', () => {
  it('requires both Brevo settings when selecting the Brevo transport', () => {
    expect(workspaceEmailConfigured({ RESEND_API_KEY: 'resend' })).toBe(true);
    expect(workspaceEmailConfigured({ BREVO_API_KEY: 'brevo', RESEND_API_KEY: 'resend' })).toBe(
      false,
    );
  });

  it('uses a stable UUID and returns the receipt for the single recipient', async () => {
    vi.stubEnv('BREVO_API_KEY', 'synthetic-key');
    vi.stubEnv('BREVO_SENDER_EMAIL', 'sender@example.org');
    const request = vi.fn(async (_url: string, _options: RequestInit) =>
      Response.json({ messageIds: ['<provider-receipt@example.org>'] }, { status: 201 }),
    );
    vi.stubGlobal('fetch', request);
    await expect(sendBrevoEmail(message)).resolves.toEqual({
      status: 'sent',
      messageId: '<provider-receipt@example.org>',
    });
    await sendBrevoEmail(message);
    const [url, options] = request.mock.calls[0]!;
    expect(url).toBe('https://api.brevo.com/v3/smtp/email');
    const body = JSON.parse(String(options.body));
    expect(body).toMatchObject({
      sender: { email: 'sender@example.org', name: 'Wisesama' },
      messageVersions: [{ to: [{ email: message.to }] }],
      textContent: message.text,
    });
    expect(body.headers.idempotencyKey).toMatch(
      /^[\da-f]{8}-[\da-f]{4}-8[\da-f]{3}-[89ab][\da-f]{3}-[\da-f]{12}$/,
    );
    expect(JSON.parse(String(request.mock.calls[1]![1].body)).headers).toEqual(body.headers);
  });

  it('stops duplicate or old ambiguous sends before Brevo forgets the send key', async () => {
    vi.stubEnv('BREVO_API_KEY', 'synthetic-key');
    vi.stubEnv('BREVO_SENDER_EMAIL', 'sender@example.org');
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ code: 'duplicate_parameter' }, { status: 400 })),
    );
    await expect(sendBrevoEmail(message)).resolves.toEqual({
      status: 'failed',
      error: BREVO_RECONCILIATION_REQUIRED,
    });
    const old = { attempts: 1, createdAt: new Date(0), error: null };
    expect(brevoRetryBlocked(old, new Date(25 * 60_000))).toBe(true);
    expect(brevoRetryBlocked({ ...old, attempts: 0 }, new Date(25 * 60_000))).toBe(false);
    expect(brevoRetryBlocked({ ...old, error: BREVO_RECONCILIATION_REQUIRED }, new Date(0))).toBe(
      true,
    );
  });
});
