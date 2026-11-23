/** Disposable local PostgreSQL fixture only. Never sends real email or reads live intelligence. */
import assert from 'node:assert/strict';
import { createHmac, randomUUID } from 'node:crypto';
import type { IntelAdvisory } from '../src/services/intel/types';

const input = process.env.INTEL_TEST_DATABASE_URL;
if (!input) throw new Error('Set INTEL_TEST_DATABASE_URL to explicitly select the disposable local database.');
const url = new URL(input);
if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/wisesama_intel' || url.searchParams.has('host') || url.searchParams.has('socket'))
  throw new Error('Verification is restricted to localhost/127.0.0.1 database wisesama_intel.');
process.env.DATABASE_URL = input;
const { prisma: db } = await import('@wisesama/database');
const { PublicSubscriptionService } = await import('../src/services/public-subscription.service');
const { createPublicSubscriptionRoutes } = await import('../src/modules/intel/public-subscription.routes');
const { default: Fastify } = await import('fastify');
const run = randomUUID();
const email = `wisesama-public-fixture-${run}@example.invalid`;
const earlyEmail = `wisesama-public-early-${run}@example.invalid`;
const lostEmail = `wisesama-public-lost-${run}@example.invalid`;
const feedbackIds = [`synthetic-early-${run}`, `synthetic-lost-${run}`];
const advisoryId = `TEST-PUBLIC-${run}`;
let now = new Date('2026-11-04T08:00:00Z');
let failNextDigest = false;
const messages: Array<{ to: string; subject: string; text: string; idempotencyKey: string; headers?: Record<string, string> }> = [];
const advisory: IntelAdvisory = { id: advisoryId, aliases: [], title: 'Synthetic public lifecycle fixture', summary: 'Local fixture only, removed after verification.', severity: 'high', cvss: 8, exploited: false, epss: null, publishedAt: now.toISOString(), modifiedAt: now.toISOString(), references: [{ url: 'https://example.invalid/synthetic-fixture' }], affected: [{ ecosystem: 'npm', name: 'wisesama-synthetic' }], source: 'Synthetic local fixture' };
const service = new PublicSubscriptionService(db, {
  now: () => now, secret: () => 'synthetic-local-signing-secret-longer-than-32-characters', available: () => true,
  appUrl: () => 'https://example.invalid', apiUrl: () => 'https://api.example.invalid',
  getBriefings: async () => ({ advisories: [advisory], sources: [], fetchedAt: now.toISOString(), stale: false }),
  send: async (message) => {
    messages.push(message);
    if (message.subject.startsWith('Wisesama:') && failNextDigest) { failNextDigest = false; return { status: 'failed', error: 'Synthetic retry fixture' }; }
    return { status: 'sent', messageId: `synthetic-public-${run}-${messages.length}` };
  },
});
const app = Fastify();
await app.register(createPublicSubscriptionRoutes(service), { prefix: '/api/v1' });
const capability = (text: string) => text.match(/#token=([a-zA-Z0-9_-]+)/)?.[1] ?? '';
let allocated = false;
try {
  assert.equal(await db.publicSubscriber.count(), 0, 'Use an otherwise empty public-subscriber test fixture database; this test never processes other subscribers.');
  allocated = true;
  await service.request(email, ['npm']);
  assert.equal(messages.length, 1);
  const pending = await db.publicSubscriber.findUniqueOrThrow({ where: { email } });
  assert.equal(pending.status, 'pending');
  const confirmation = capability(messages[0]!.text); assert.ok(confirmation);
  const scanner = await app.inject({ method: 'GET', url: `/api/v1/intel/subscriptions/confirm?token=${confirmation}` });
  assert.equal(scanner.statusCode, 404);
  assert.equal((await db.publicSubscriber.findUniqueOrThrow({ where: { email } })).status, 'pending');
  await service.confirm(confirmation);
  await assert.rejects(service.confirm(confirmation), { statusCode: 400 });
  const active = await db.publicSubscriber.findUniqueOrThrow({ where: { email } });
  assert.equal(active.status, 'active');
  assert.deepEqual(active.topics, ['npm']);
  assert.equal(await db.publicMailReceipt.count({ where: { subscriberId: active.id } }), 1);

  now = new Date('2026-11-04T08:10:00Z');
  await service.recordFeedEvents([advisory]);
  now = new Date('2026-11-04T09:01:00Z');
  await Promise.all([service.runDailyDigest(), service.runDailyDigest()]);
  assert.equal(await db.publicFeedDelivery.count({ where: { subscriberId: active.id } }), 1, 'Concurrent daily jobs create one edition.');
  assert.equal(messages.filter((message) => message.subject.startsWith('Wisesama:')).length, 1, 'A lease prevents concurrent duplicate sends.');
  const first = await db.publicFeedDelivery.findFirstOrThrow({ where: { subscriberId: active.id } });
  assert.equal(first.status, 'sent');
  assert.ok(messages[1]!.headers?.['List-Unsubscribe-Post'] === 'List-Unsubscribe=One-Click');

  now = new Date('2026-11-04T09:07:00Z');
  await service.request(email, ['all'], 'manage');
  const manage = capability(messages.at(-1)!.text); assert.ok(manage);
  assert.deepEqual((await service.readPreferences(manage)).topics, ['npm']);
  await service.updatePreferences(manage, ['all']);
  assert.deepEqual((await service.readPreferences(manage)).topics, ['all']);

  now = new Date('2026-11-05T09:01:00Z');
  advisory.title = 'Synthetic materially changed guidance';
  failNextDigest = true;
  await service.runDailyDigest();
  const failed = await db.publicFeedDelivery.findFirstOrThrow({ where: { subscriberId: active.id, status: 'failed' } });
  const failedBody = messages.at(-1)!;
  now = new Date('2026-11-05T09:07:00Z');
  await service.processDeliveries();
  assert.equal(messages.at(-1)!.text, failedBody.text, 'Retries preserve the provider idempotency payload.');
  assert.equal(messages.at(-1)!.idempotencyKey, failedBody.idempotencyKey);
  assert.equal((await db.publicFeedDelivery.findUniqueOrThrow({ where: { id: failed.id } })).status, 'sent');

  const unsubscribe = service.unsubscribeToken(active);
  const unsubscribeScanner = await app.inject({ method: 'GET', url: `/api/v1/intel/subscriptions/one-click/${unsubscribe}` });
  assert.equal(unsubscribeScanner.statusCode, 405);
  assert.equal((await db.publicSubscriber.findUniqueOrThrow({ where: { email } })).status, 'active');
  const optOut = await app.inject({ method: 'POST', url: `/api/v1/intel/subscriptions/one-click/${unsubscribe}`, headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: 'List-Unsubscribe=One-Click' });
  assert.equal(optOut.statusCode, 200);
  assert.equal((await db.publicSubscriber.findUniqueOrThrow({ where: { email } })).status, 'unsubscribed');
  await assert.rejects(service.readPreferences(manage), { statusCode: 400 });
  const sentBefore = messages.length;
  now = new Date('2026-11-06T09:01:00Z'); advisory.title = 'Synthetic third change';
  await service.runDailyDigest();
  assert.equal(messages.length, sentBefore, 'No editions after opt-out.');

  // Race fixture: the signed callback is delivered before the outbound HTTP response is recorded.
  const signingBytes = Buffer.from(`synthetic-feedback-secret-${run}`);
  process.env.RESEND_WEBHOOK_SECRET = `whsec_${signingBytes.toString('base64')}`;
  const signed = (id: string, messageId: string) => {
    const payload = JSON.stringify({ type: 'email.bounced', data: { email_id: messageId } });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', signingBytes).update(`${id}.${timestamp}.${payload}`).digest('base64');
    return { payload, headers: { id, timestamp, signature: `v1,${signature}` } };
  };
  let earlyService: InstanceType<typeof PublicSubscriptionService>;
  earlyService = new PublicSubscriptionService(db, {
    now: () => now, available: () => true, secret: () => 'synthetic-local-signing-secret-longer-than-32-characters',
    send: async () => {
      const event = signed(feedbackIds[0]!, `early-message-${run}`);
      await earlyService.handleWebhook(event.payload, event.headers);
      assert.equal((await db.publicMailWebhook.findUniqueOrThrow({ where: { id: feedbackIds[0] } })).status, 'pending', 'An early verified bounce remains pending before its receipt exists.');
      return { status: 'sent', messageId: `early-message-${run}` };
    },
  });
  await earlyService.request(earlyEmail);
  assert.equal((await db.publicSubscriber.findUniqueOrThrow({ where: { email: earlyEmail } })).status, 'suppressed', 'Receipt persistence immediately reconciles the early bounce.');
  assert.equal((await db.publicMailWebhook.findUniqueOrThrow({ where: { id: feedbackIds[0] } })).status, 'processed');

  // A database failure after provider acceptance must leave the signed callback available for recovery.
  const receiptFailureDb = db.$extends({ query: { publicMailReceipt: { async upsert() { throw new Error('Synthetic receipt persistence failure'); } } } }) as unknown as typeof db;
  let lostService: InstanceType<typeof PublicSubscriptionService>;
  lostService = new PublicSubscriptionService(receiptFailureDb, {
    now: () => now, available: () => true, secret: () => 'synthetic-local-signing-secret-longer-than-32-characters',
    send: async () => {
      const event = signed(feedbackIds[1]!, `lost-message-${run}`);
      await lostService.handleWebhook(event.payload, event.headers);
      return { status: 'sent', messageId: `lost-message-${run}` };
    },
  });
  await assert.rejects(lostService.request(lostEmail), /Synthetic receipt persistence failure/);
  assert.equal((await db.publicMailWebhook.findUniqueOrThrow({ where: { id: feedbackIds[1] } })).status, 'pending');
  const lostSubscriber = await db.publicSubscriber.findUniqueOrThrow({ where: { email: lostEmail } });
  await db.publicMailReceipt.create({ data: { id: `lost-message-${run}`, subscriberId: lostSubscriber.id } });
  await service.reconcileMailFeedback(25, `lost-message-${run}`);
  assert.equal((await db.publicSubscriber.findUniqueOrThrow({ where: { email: lostEmail } })).status, 'suppressed');
  assert.equal((await db.publicMailWebhook.findUniqueOrThrow({ where: { id: feedbackIds[1] } })).status, 'processed');
  console.log('Public lifecycle verified: consent, scanner-safe links, concurrent daily deduplication, preferences, retry idempotency, one-click opt-out, early signed feedback and receipt-persistence failure recovery. No real email or live provider calls.');
} finally {
  await app.close();
  if (allocated) await db.publicSubscriber.deleteMany({ where: { email: { in: [email, earlyEmail, lostEmail] } } });
  await db.publicMailWebhook.deleteMany({ where: { id: { in: feedbackIds } } });
  await db.publicFeedEvent.deleteMany({ where: { advisoryId } });
  await db.publicFeedState.deleteMany({ where: { advisoryId } });
  await db.$disconnect();
}
