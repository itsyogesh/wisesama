import { createHash, createHmac } from 'node:crypto';
import type { PrismaClient } from '@wisesama/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { IntelAdvisory } from '../intel/index';
import {
  matchesPublicTopics,
  nextPublicDigest,
  PublicSubscriptionService,
  publicAdvisoryFingerprint,
  sendPublicEmail,
} from '../public-subscription.service';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
const NOW = new Date('2026-11-04T10:00:00Z');
const subscriber = {
  id: 'subscriber1',
  email: 'person@example.test',
  status: 'pending',
  topics: ['all'],
  confirmedAt: null as Date | null,
  lastRequestAt: new Date(0),
  nextDigestAt: null,
  lastCompiledAt: null,
  unsubscribeVersion: 1,
  createdAt: NOW,
  updatedAt: NOW,
};
const advisory: IntelAdvisory = {
  id: 'GHSA-test',
  aliases: ['CVE-2026-1234'],
  title: 'A test advisory',
  summary: 'Test-only source data',
  severity: 'high',
  cvss: 8.1,
  exploited: false,
  epss: null,
  publishedAt: NOW.toISOString(),
  modifiedAt: NOW.toISOString(),
  references: [{ url: 'https://example.test/advisory' }],
  affected: [{ ecosystem: 'npm', name: 'test-only', ranges: ['<1.0.1'], fixedVersion: '1.0.1' }],
  source: 'OSV',
};
const digest = {
  id: 'delivery1',
  subscriberId: subscriber.id,
  eventKey: 'digest:subscriber1:2026-11-04',
  items: { advisories: [advisory], omitted: 0 },
  subject: 'Updates',
  status: 'pending',
  attempts: 0,
  nextAttemptAt: NOW,
  claimedAt: null,
};

function setup() {
  const db = {
    intelAdvisoryReview: { findMany: vi.fn().mockResolvedValue([]) },
    securityAdvisory: { findMany: vi.fn().mockResolvedValue([]) },
    publicSubscriber: {
      findUnique: vi.fn().mockResolvedValue(subscriber),
      findUniqueOrThrow: vi
        .fn()
        .mockResolvedValue({ ...subscriber, status: 'active', confirmedAt: NOW }),
      findMany: vi.fn().mockResolvedValue([]),
      upsert: vi.fn().mockResolvedValue(subscriber),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue(subscriber),
    },
    publicSubscriptionToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn(),
    },
    publicFeedState: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() },
    publicFeedEvent: { upsert: vi.fn(), findMany: vi.fn().mockResolvedValue([]) },
    publicFeedDelivery: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
      create: vi.fn(),
      findUnique: vi.fn(),
    },
    publicMailWebhook: {
      upsert: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
      count: vi.fn().mockResolvedValue(0),
    },
    publicMailReceipt: { upsert: vi.fn(), findUnique: vi.fn().mockResolvedValue(null) },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
  const send = vi.fn().mockResolvedValue({ status: 'sent', messageId: 'mail1' });
  const getBriefings = vi.fn().mockResolvedValue({
    advisories: [advisory],
    sources: [],
    fetchedAt: NOW.toISOString(),
    stale: false,
  });
  const service = new PublicSubscriptionService(db as unknown as PrismaClient, {
    now: () => NOW,
    send,
    getBriefings,
    available: () => true,
    secret: () => 'test-only-secret-longer-than-thirty-two-bytes',
    appUrl: () => 'https://intel.example.test',
    apiUrl: () => 'https://api.example.test',
  });
  return { db, send, getBriefings, service };
}
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('public subscription consent and links', () => {
  it('keeps a request pending and stores only a hash of its confirmation capability', async () => {
    const { db, send, service } = setup();
    db.publicSubscriber.findUnique.mockResolvedValueOnce(null);
    expect(await service.request('Person@Example.test', ['npm'])).toMatchObject({ accepted: true });
    expect(db.publicSubscriber.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ email: 'person@example.test' }),
      }),
    );
    expect(db.publicSubscriber.updateMany).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'active' }) }),
    );
    const mail = send.mock.calls[0]![0];
    const token = mail.text.match(/#token=([a-zA-Z0-9_-]+)/)![1];
    expect(db.publicSubscriptionToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tokenHash: createHash('sha256').update(token).digest('hex'),
        purpose: 'confirm',
        topics: ['npm'],
      }),
    });
    expect(JSON.stringify(db.publicSubscriptionToken.create.mock.calls)).not.toContain(token);
  });

  it('does not send or disclose suppressed or nonexistent management addresses', async () => {
    const { db, send, service } = setup();
    db.publicSubscriber.findUnique.mockResolvedValue(null);
    const nonexistent = await service.request('absent@example.test', ['all'], 'manage');
    db.publicSubscriber.findUnique.mockResolvedValue({ ...subscriber, status: 'suppressed' });
    const suppressed = await service.request('person@example.test');
    expect(nonexistent).toEqual(suppressed);
    expect(send).not.toHaveBeenCalled();
  });

  it('throttles repeated requests and cannot alter an active subscriber through the signup form', async () => {
    const { db, send, service } = setup();
    db.publicSubscriber.findUnique.mockResolvedValue({ ...subscriber, lastRequestAt: NOW });
    await service.request(subscriber.email);
    expect(send).not.toHaveBeenCalled();
    db.publicSubscriber.findUnique.mockResolvedValue({ ...subscriber, status: 'active' });
    await service.request(subscriber.email, ['PyPI']);
    expect(db.publicSubscriptionToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ purpose: 'manage' }),
    });
    expect(db.publicSubscriber.update).not.toHaveBeenCalled();
  });

  it('activates only a valid one-time confirmation and rejects replay and expiration', async () => {
    const { db, service } = setup();
    const token = {
      id: 'token1',
      subscriberId: subscriber.id,
      purpose: 'confirm',
      consumedAt: null,
      expiresAt: new Date(NOW.getTime() + 1000),
      topics: ['npm'],
      subscriber,
    };
    db.publicSubscriptionToken.findUnique.mockResolvedValue(token);
    await service.confirm('random-confirmation-capability');
    expect(db.publicSubscriber.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: subscriber.id, status: { not: 'suppressed' } },
        data: expect.objectContaining({ status: 'active', topics: ['npm'] }),
      }),
    );
    db.publicSubscriptionToken.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.confirm('random-confirmation-capability')).rejects.toMatchObject({
      statusCode: 400,
    });
    db.publicSubscriptionToken.findUnique.mockResolvedValue({
      ...token,
      expiresAt: new Date(NOW.getTime() - 1),
    });
    await expect(service.confirm('random-confirmation-capability')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('does not let confirmation capabilities or unsubscribe capabilities manage preferences', async () => {
    const { db, service } = setup();
    db.publicSubscriptionToken.findUnique.mockResolvedValue({
      purpose: 'confirm',
      expiresAt: new Date(NOW.getTime() + 10000),
      consumedAt: null,
      subscriber,
    });
    await expect(service.readPreferences('confirm-value')).rejects.toMatchObject({
      statusCode: 400,
    });
    await expect(
      service.updatePreferences(service.unsubscribeToken(subscriber), ['npm']),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('authenticates stable unsubscribe links and suppresses queued messages', async () => {
    const { db, service } = setup();
    const token = service.unsubscribeToken(subscriber);
    await expect(service.unsubscribe(`${token.slice(0, -1)}x`)).rejects.toMatchObject({
      statusCode: 400,
    });
    expect(db.publicSubscriber.updateMany).not.toHaveBeenCalled();
    await expect(service.unsubscribe(token)).resolves.toEqual({ status: 'unsubscribed' });
    expect(db.publicFeedDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'skipped' }) }),
    );
    expect(db.publicSubscriptionToken.updateMany).toHaveBeenCalled();
  });

  it('keeps provider failure neutral and invalidates that link', async () => {
    const { db, service, send } = setup();
    send.mockResolvedValue({ status: 'failed', error: 'provider down' });
    await expect(service.request(subscriber.email)).resolves.toMatchObject({ accepted: true });
    expect(db.publicSubscriptionToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: { consumedAt: NOW } }),
    );
    const unavailable = new PublicSubscriptionService(db as unknown as PrismaClient, {
      available: () => true,
      secret: () => '',
    });
    expect(unavailable.capabilities().emailAvailable).toBe(false);
  });
});

describe('public digest change detection and delivery', () => {
  it('does not send a previously compiled edition containing a newly hidden advisory', async () => {
    const { db, send, service } = setup();
    db.publicFeedDelivery.findMany.mockResolvedValue([digest]);
    db.publicSubscriber.findUnique.mockResolvedValue({
      ...subscriber,
      status: 'active',
      confirmedAt: NOW,
    });
    db.intelAdvisoryReview.findMany.mockResolvedValue([
      { advisoryId: advisory.id, visibility: 'hidden' },
    ]);
    await service.processDeliveries(1, digest.id);
    expect(send).not.toHaveBeenCalled();
    expect(db.publicFeedDelivery.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: digest.id }) }),
    );
    expect(db.publicFeedDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'skipped' }) }),
    );
  });
  it('ignores collection timestamps and EPSS movement but captures changed fixes or exploitation evidence', () => {
    expect(publicAdvisoryFingerprint(advisory)).toBe(
      publicAdvisoryFingerprint({
        ...advisory,
        modifiedAt: '2026-11-05T00:00:00Z',
        epss: 0.8,
        exploitationCheckedAt: '2026-11-05T00:00:00Z',
      }),
    );
    expect(publicAdvisoryFingerprint(advisory)).not.toBe(
      publicAdvisoryFingerprint({ ...advisory, exploited: true }),
    );
    expect(publicAdvisoryFingerprint(advisory)).not.toBe(
      publicAdvisoryFingerprint({
        ...advisory,
        affected: [{ ...advisory.affected[0]!, fixedVersion: '1.0.2' }],
      }),
    );
    expect(matchesPublicTopics(advisory, ['PyPI', 'known_exploited'])).toBe(false);
    expect(matchesPublicTopics({ ...advisory, exploited: true }, ['known_exploited'])).toBe(true);
    expect(nextPublicDigest(NOW).toISOString()).toBe('2026-11-05T09:00:00.000Z');
  });

  it('deduplicates unchanged events and never sends unconfirmed subscribers', async () => {
    const { db, service, send } = setup();
    db.publicFeedState.findUnique.mockResolvedValue({
      fingerprint: publicAdvisoryFingerprint(advisory),
    });
    await service.recordFeedEvents([advisory]);
    expect(db.publicFeedEvent.upsert).not.toHaveBeenCalled();
    db.publicFeedDelivery.findMany.mockResolvedValue([digest]);
    await service.processDeliveries();
    expect(send).not.toHaveBeenCalled();
    expect(db.publicFeedDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'skipped' }) }),
    );
  });

  it('serializes concurrent digest compilation and records one material edition', async () => {
    const { db, service } = setup();
    db.publicSubscriber.findMany.mockResolvedValue([
      { ...subscriber, status: 'active', confirmedAt: new Date(0), lastCompiledAt: new Date(0) },
    ]);
    db.publicFeedEvent.findMany.mockResolvedValue([
      { data: advisory },
      { data: { ...advisory, title: 'Updated guidance' } },
    ]);
    await service.runDailyDigest();
    expect(db.publicFeedDelivery.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        eventKey: 'digest:subscriber1:2026-11-04',
        items: { advisories: [{ ...advisory, title: 'Updated guidance' }], omitted: 0 },
      }),
    });
    db.publicSubscriber.updateMany.mockResolvedValue({ count: 0 });
    db.publicFeedDelivery.create.mockClear();
    await service.runDailyDigest();
    expect(db.publicFeedDelivery.create).not.toHaveBeenCalled();
  });

  it('retries a failed edition using the same provider idempotency key and includes unsubscribe headers', async () => {
    const { db, service, send } = setup();
    db.publicSubscriber.findUnique.mockResolvedValue({
      ...subscriber,
      status: 'active',
      confirmedAt: NOW,
    });
    db.publicFeedDelivery.findMany.mockResolvedValue([digest]);
    send.mockResolvedValueOnce({ status: 'failed', error: 'Provider down' });
    await service.processDeliveries();
    expect(db.publicFeedDelivery.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'failed', nextAttemptAt: expect.any(Date) }),
      }),
    );
    send.mockResolvedValueOnce({ status: 'sent', messageId: 'accepted1' });
    await service.processDeliveries();
    expect(send.mock.calls.map((call) => call[0].idempotencyKey)).toEqual([
      digest.eventKey,
      digest.eventKey,
    ]);
    expect(send.mock.calls[0]![0].headers).toMatchObject({
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      'List-Unsubscribe': expect.stringContaining('/one-click/'),
    });
    expect(db.publicFeedDelivery.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'sent', providerMessageId: 'accepted1' }),
      }),
    );
  });

  it('records provider unavailable and does not claim a mock send', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    await expect(
      sendPublicEmail({
        to: subscriber.email,
        subject: 'Test',
        text: 'Test',
        idempotencyKey: 'test',
      }),
    ).resolves.toMatchObject({ status: 'unavailable' });
  });

  it('verifies raw signed feedback before suppressing by a known provider message id, deduplicating replay', async () => {
    const { db, service } = setup();
    const signingBytes = Buffer.from('test-only-standard-webhook-secret');
    vi.stubEnv('RESEND_WEBHOOK_SECRET', `whsec_${signingBytes.toString('base64')}`);
    const payload = JSON.stringify({ type: 'email.complained', data: { email_id: 'mail1' } });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', signingBytes)
      .update(`evt1.${timestamp}.${payload}`)
      .digest('base64');
    db.publicFeedDelivery.findUnique.mockResolvedValue(digest);
    db.publicMailWebhook.findMany.mockResolvedValue([
      { id: 'evt1', providerMessageId: 'mail1', attempts: 0 },
    ]);
    await expect(
      service.handleWebhook(`${payload} `, { id: 'evt1', timestamp, signature: `v1,${signature}` }),
    ).rejects.toMatchObject({ statusCode: 401 });
    expect(db.publicSubscriber.update).not.toHaveBeenCalled();
    await service.handleWebhook(payload, { id: 'evt1', timestamp, signature: `v1,${signature}` });
    expect(db.publicSubscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { status: 'suppressed', nextDigestAt: null, adminRevision: { increment: 1 } },
      }),
    );
    db.publicMailWebhook.updateMany.mockResolvedValue({ count: 0 });
    db.publicSubscriber.update.mockClear();
    await service.handleWebhook(payload, { id: 'evt1', timestamp, signature: `v1,${signature}` });
    expect(db.publicSubscriber.update).not.toHaveBeenCalled();
  });

  it('also suppresses feedback for a confirmation email, without trusting an event email address', async () => {
    const { db, service } = setup();
    const signingBytes = Buffer.from('test-only-standard-webhook-secret');
    vi.stubEnv('RESEND_WEBHOOK_SECRET', `whsec_${signingBytes.toString('base64')}`);
    const payload = JSON.stringify({
      type: 'email.bounced',
      data: { email_id: 'confirmation1', to: ['untrusted@example.test'] },
    });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', signingBytes)
      .update(`evt2.${timestamp}.${payload}`)
      .digest('base64');
    db.publicMailReceipt.findUnique.mockResolvedValue({ subscriberId: subscriber.id });
    db.publicMailWebhook.findMany.mockResolvedValue([
      { id: 'evt2', providerMessageId: 'confirmation1', attempts: 0 },
    ]);
    await service.handleWebhook(payload, { id: 'evt2', timestamp, signature: `v1,${signature}` });
    expect(db.publicSubscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: subscriber.id },
        data: { status: 'suppressed', nextDigestAt: null, adminRevision: { increment: 1 } },
      }),
    );
  });

  it('keeps an early signed bounce pending until its send receipt exists, including receipt persistence failure', async () => {
    const { db, service } = setup();
    const signingBytes = Buffer.from('test-only-standard-webhook-secret');
    vi.stubEnv('RESEND_WEBHOOK_SECRET', `whsec_${signingBytes.toString('base64')}`);
    const payload = JSON.stringify({ type: 'email.bounced', data: { email_id: 'mail1' } });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', signingBytes)
      .update(`early1.${timestamp}.${payload}`)
      .digest('base64');
    db.publicMailWebhook.findMany.mockResolvedValue([
      { id: 'early1', providerMessageId: 'mail1', attempts: 0 },
    ]);
    db.publicMailWebhook.count.mockResolvedValue(1);
    await expect(
      service.handleWebhook(payload, { id: 'early1', timestamp, signature: `v1,${signature}` }),
    ).resolves.toMatchObject({ accepted: true, pendingFeedback: 1 });
    expect(db.publicMailWebhook.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({ status: 'pending', providerMessageId: 'mail1' }),
      }),
    );
    expect(db.publicMailWebhook.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'pending', nextAttemptAt: expect.any(Date) }),
      }),
    );
    expect(db.publicSubscriber.update).not.toHaveBeenCalled();
    db.publicMailReceipt.upsert.mockRejectedValueOnce(
      new Error('Synthetic database receipt failure'),
    );
    await expect(service.request(subscriber.email)).resolves.toMatchObject({ accepted: true });
    expect(db.publicMailWebhook.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'processed' }) }),
    );
    // A persisted/recovered provider id resolves the original event; its prior acknowledgement did not discard it.
    db.publicMailReceipt.findUnique.mockResolvedValue({ subscriberId: subscriber.id });
    await service.reconcileMailFeedback(25, 'mail1');
    expect(db.publicSubscriber.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: subscriber.id },
        data: { status: 'suppressed', nextDigestAt: null, adminRevision: { increment: 1 } },
      }),
    );
    expect(db.publicMailWebhook.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { status: 'processed', processedAt: NOW, lastError: null } }),
    );
  });
});
