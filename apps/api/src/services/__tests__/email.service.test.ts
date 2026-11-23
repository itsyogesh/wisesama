import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { send } = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('resend', () => ({
  Resend: class {
    emails = { send };
  },
}));

const LABEL = `Research & <Community> "Team" 'Group'`;
const HTML_LABEL = 'Research &amp; &lt;Community&gt; &quot;Team&quot; &#39;Group&#39;';
const ID = 'request /draft?part=one&part=two';
const ENCODED_ID = 'request%20%2Fdraft%3Fpart%3Done%26part%3Dtwo';

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('RESEND_API_KEY', 'test-only-provider-key');
  vi.stubEnv('APP_URL', 'https://app.example.test');
  send.mockReset().mockResolvedValue({ data: { id: 'test-message' }, error: null });
});

afterEach(() => vi.unstubAllEnvs());

function delivered() {
  expect(send).toHaveBeenCalledOnce();
  return send.mock.calls[0]![0] as { html: string; subject: string; text?: string };
}

describe('email HTML boundaries', () => {
  it('escapes API-key labels while preserving the subject and branded markup', async () => {
    const { sendApiKeyAlert } = await import('../email.service');
    await sendApiKeyAlert({
      email: 'recipient@example.test',
      keyName: LABEL,
      usagePercent: 80,
      limit: 100,
    });
    const message = delivered();
    expect(message.html).toContain(HTML_LABEL);
    expect(message.html).not.toContain(LABEL);
    expect(message.html).toContain(
      '<h1 style="color: white; margin: 0; font-size: 24px;">Wisesama</h1>',
    );
    expect(message.html).toContain('href="https://app.example.test/dashboard"');
    expect(message.subject).toBe(`[Alert] API Key Usage at 80%: ${LABEL}`);
  });

  it.each([
    'sendReportConfirmation',
    'sendReportVerified',
    'sendReportRejected',
    'sendAdminNewReportAlert',
    'sendAdminNewRequestAlert',
    'sendWhitelistRequestConfirmation',
    'sendWhitelistRequestApproved',
    'sendWhitelistRequestRejected',
  ] as const)('escapes every dynamic display field in %s', async (method) => {
    const service = await import('../../dotsama/services/email.service');
    await service[method]({
      email: 'recipient@example.test',
      adminEmail: 'admin@example.test',
      reportId: LABEL,
      requestId: LABEL,
      entityValue: LABEL,
      entityType: LABEL,
      threatCategory: LABEL,
      name: LABEL,
      category: LABEL,
      reason: LABEL,
      reporterEmail: 'research&community@example.test',
      requesterEmail: 'research&community@example.test',
      addedToBlacklist: true,
    });
    const message = delivered();
    expect(message.html).toContain(HTML_LABEL);
    expect(message.html).not.toContain(LABEL);
    expect(message.html).not.toContain('research&community@example.test');
    expect(message.html).toContain('Dotsama');
    expect(message.subject).toContain(LABEL);
    expect(message.subject).not.toContain('&amp;');
    if (message.text) {
      expect(message.text).toContain(LABEL);
      expect(message.text).not.toContain(HTML_LABEL);
    }
  });

  it('encodes request/report IDs within links before escaping attributes', async () => {
    const service = await import('../../dotsama/services/email.service');
    await service.sendAdminNewReportAlert({
      adminEmail: 'admin@example.test',
      reportId: ID,
      entityValue: 'example.test',
      entityType: 'DOMAIN',
      threatCategory: 'PHISHING',
    });
    expect(delivered().html).toContain(
      `href="https://app.example.test/admin/reports/${ENCODED_ID}"`,
    );
    send.mockClear();
    await service.sendAdminNewRequestAlert({
      adminEmail: 'admin@example.test',
      requestId: ID,
      entityValue: 'example.test',
      entityType: 'DOMAIN',
      name: 'Community',
      category: 'project',
      requesterEmail: 'recipient@example.test',
    });
    expect(delivered().html).toContain(
      `href="https://app.example.test/admin/whitelist/requests/${ENCODED_ID}"`,
    );
    send.mockClear();
    await service.sendWhitelistRequestConfirmation({
      email: 'recipient@example.test',
      requestId: ID,
      entityValue: 'example.test',
      entityType: 'DOMAIN',
      name: 'Community',
    });
    const message = delivered();
    expect(message.html).toContain(
      `href="https://app.example.test/whitelist/request/status?id=${ENCODED_ID}"`,
    );
    expect(message.text).toContain(`id=${ID}`);
  });

  it('escapes configured URL text in quoted HTML attributes', async () => {
    vi.stubEnv('APP_URL', 'https://app.example.test/?label="Community"&view=mail');
    const { sendApiKeyAlert } = await import('../email.service');
    await sendApiKeyAlert({
      email: 'recipient@example.test',
      keyName: 'Community',
      usagePercent: 80,
      limit: 100,
    });
    expect(delivered().html).toContain(
      'href="https://app.example.test/?label=&quot;Community&quot;&amp;view=mail"',
    );
  });
});
