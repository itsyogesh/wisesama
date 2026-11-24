import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendAuthenticationEmail } from '../auth-email.service';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('authentication email delivery', () => {
  it('sends the one-time sign-in template through Brevo', async () => {
    vi.stubEnv('BREVO_API_KEY', 'synthetic-brevo-key');
    vi.stubEnv('BREVO_SENDER_EMAIL', 'sender@example.invalid');
    const request = vi.fn().mockResolvedValue(Response.json({ messageId: 'synthetic-receipt' }));
    vi.stubGlobal('fetch', request);
    await sendAuthenticationEmail({
      email: 'member@example.invalid',
      url: 'https://www.wisesama.com/sign-in/verify#token=synthetic',
      purpose: 'sign-in',
    });
    expect(request).toHaveBeenCalledWith(
      'https://api.brevo.com/v3/smtp/email',
      expect.objectContaining({ body: expect.stringContaining('Your Wisesama sign-in link') }),
    );
    expect(JSON.parse(request.mock.calls[0]?.[1]?.body).textContent).toContain(
      'expires in 10 minutes',
    );
  });

  it('fails visibly without an email provider and makes no network request', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    const request = vi.fn();
    vi.stubGlobal('fetch', request);
    await expect(
      sendAuthenticationEmail({ email: 'test@example.org', url: 'https://example.org/verify' }),
    ).rejects.toThrow('not configured');
    expect(request).not.toHaveBeenCalled();
  });

  it('does not claim success when the provider rejects or omits its receipt', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-only-key');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 429 })));
    await expect(
      sendAuthenticationEmail({ email: 'test@example.org', url: 'https://example.org/verify' }),
    ).rejects.toThrow('could not be sent');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}')));
    await expect(
      sendAuthenticationEmail({ email: 'test@example.org', url: 'https://example.org/verify' }),
    ).rejects.toThrow('not confirmed');
  });
});
