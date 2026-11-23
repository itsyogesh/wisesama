import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendAuthenticationEmail } from '../auth-email.service';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('authentication email delivery', () => {
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
