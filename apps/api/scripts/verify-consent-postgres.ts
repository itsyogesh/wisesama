/** Development regression: exact disposable PostgreSQL only; no external mail. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const database = process.env.INTEL_TEST_DATABASE_URL;
assert.equal(database, 'postgresql://wisesama_test@127.0.0.1:55439/wisesama_intel');
process.env.DATABASE_URL = database;
delete process.env.RESEND_API_KEY;
globalThis.fetch = async () => {
  throw new Error('External transport is disabled in this regression.');
};
const { prisma: db } = await import('@wisesama/database');
const { PublicSubscriptionService } = await import('../src/services/public-subscription.service');
const run = randomUUID();
const owned: string[] = [];
const ownedFeedback: string[] = [];
function barrier<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
async function bounded<T>(promise: Promise<T>, label: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} exceeded five seconds.`)), 5_000);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}
async function fixture(label: string) {
  const subscriber = await db.publicSubscriber.create({
    data: {
      email: `consent-${label}-${run}@example.invalid`,
      status: 'active',
      confirmedAt: new Date(),
      lastRequestAt: new Date(0),
    },
  });
  owned.push(subscriber.id);
  const delivery = await db.publicFeedDelivery.create({
    data: {
      subscriberId: subscriber.id,
      eventKey: `consent-${label}-${run}`,
      subject: 'Synthetic public digest',
      items: {
        omitted: 0,
        advisories: [
          {
            id: `synthetic-${run}`,
            aliases: [],
            title: 'Synthetic advisory',
            severity: 'unknown',
            exploited: false,
            modifiedAt: new Date().toISOString(),
          },
        ],
      },
      nextAttemptAt: new Date(0),
    },
  });
  return { subscriber, delivery };
}
function scopedDb(beforePolicy?: () => Promise<void>, beforeRequestClaim?: () => Promise<void>) {
  return new Proxy(db, {
    get(target, property) {
      if (property === 'publicMailWebhook')
        return { findMany: async () => [], count: async () => 0 };
      if (property === 'publicSubscriber' && beforeRequestClaim)
        return new Proxy(target.publicSubscriber, {
          get(delegate, key) {
            if (key === 'updateMany')
              return async (input: Parameters<typeof delegate.updateMany>[0]) => {
                if (input?.where?.lastRequestAt) await beforeRequestClaim();
                return delegate.updateMany(input);
              };
            const value = Reflect.get(delegate, key);
            return typeof value === 'function' ? value.bind(delegate) : value;
          },
        });
      if (property === 'securityAdvisory')
        return {
          findMany: async () => {
            await beforePolicy?.();
            return [];
          },
        };
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
}
const secret = () => 'disposable-consent-regression-secret-32-bytes';
async function suppressThroughFeedback(subscriberId: string) {
  const id = `consent-feedback-${randomUUID()}`;
  const messageId = `consent-prior-${randomUUID()}`;
  await db.publicMailReceipt.create({ data: { id: messageId, subscriberId } });
  await db.publicMailWebhook.create({
    data: { id, type: 'email.complained', providerMessageId: messageId },
  });
  ownedFeedback.push(id);
  await new PublicSubscriptionService(db, { secret }).reconcileMailFeedback(1, undefined, id);
  assert.equal(
    (await db.publicSubscriber.findUniqueOrThrow({ where: { id: subscriberId } })).status,
    'suppressed',
  );
}
try {
  // Recover only this regression's abandoned synthetic fixture after an interrupted run.
  const abandoned = await db.publicSubscriber.findMany({
    where: { email: { startsWith: 'consent-before-', endsWith: '@example.invalid' } },
    include: { deliveries: { select: { eventKey: true } } },
  });
  for (const row of abandoned) {
    const match = /^consent-before-([a-f0-9-]{36})@example\.invalid$/.exec(row.email);
    if (
      match &&
      row.deliveries.length === 1 &&
      row.deliveries[0]?.eventKey === `consent-before-${match[1]}`
    )
      owned.push(row.id);
  }
  const first = await fixture('before');
  const atPolicy = barrier();
  const resumePolicy = barrier();
  let sends = 0;
  const service = new PublicSubscriptionService(
    scopedDb(async () => {
      atPolicy.resolve();
      await resumePolicy.promise;
    }),
    {
      secret,
      send: async () => {
        sends++;
        return { status: 'sent', messageId: `before-${run}` };
      },
    },
  );
  const processing = service.processDeliveries(1, first.delivery.id);
  try {
    await bounded(atPolicy.promise, 'Policy barrier');
    await bounded(
      service.unsubscribe(service.unsubscribeToken(first.subscriber)),
      'Completed opt-out',
    );
  } finally {
    resumePolicy.resolve();
  }
  await bounded(processing, 'Stopped delivery');
  assert.equal(sends, 0);
  assert.equal(
    (await db.publicFeedDelivery.findUniqueOrThrow({ where: { id: first.delivery.id } })).status,
    'skipped',
  );

  const second = await fixture('inflight');
  const invoked = barrier();
  const provider = barrier<{ status: 'sent'; messageId: string }>();
  const inflight = new PublicSubscriptionService(scopedDb(), {
    secret,
    send: () => {
      sends++;
      invoked.resolve();
      return provider.promise;
    },
  });
  const processingInflight = inflight.processDeliveries(1, second.delivery.id);
  try {
    await bounded(invoked.promise, 'Transport start');
    // This must commit before the provider response, using real PostgreSQL row locks.
    await bounded(
      inflight.unsubscribe(inflight.unsubscribeToken(second.subscriber)),
      'In-flight opt-out',
    );
    assert.equal(
      (await db.publicSubscriber.findUniqueOrThrow({ where: { id: second.subscriber.id } })).status,
      'unsubscribed',
    );
  } finally {
    provider.resolve({ status: 'sent', messageId: `inflight-${run}` });
  }
  await bounded(processingInflight, 'Provider completion');
  assert.equal(
    (await db.publicFeedDelivery.findUniqueOrThrow({ where: { id: second.delivery.id } })).status,
    'skipped',
  );
  assert.equal(
    (await db.publicMailReceipt.findUniqueOrThrow({ where: { id: `inflight-${run}` } }))
      .subscriberId,
    second.subscriber.id,
  );
  assert.equal(sends, 1);
  const third = await fixture('request-before');
  const claiming = barrier();
  const resumeClaim = barrier();
  const requestBefore = new PublicSubscriptionService(
    scopedDb(undefined, async () => {
      claiming.resolve();
      await resumeClaim.promise;
    }),
    {
      secret,
      available: () => true,
      send: async () => {
        sends++;
        return { status: 'sent', messageId: `blocked-request-${run}` };
      },
    },
  );
  const request = requestBefore.request(third.subscriber.email, ['all'], 'manage');
  try {
    await bounded(claiming.promise, 'Request cooldown barrier');
    await bounded(suppressThroughFeedback(third.subscriber.id), 'Completed suppression');
  } finally {
    resumeClaim.resolve();
  }
  await bounded(request, 'Suppressed request');
  assert.equal(sends, 1);
  assert.equal(
    await db.publicSubscriptionToken.count({ where: { subscriberId: third.subscriber.id } }),
    0,
  );

  const fourth = await fixture('request-inflight');
  const requestInvoked = barrier();
  const requestProvider = barrier<{ status: 'sent'; messageId: string }>();
  const requestInflight = new PublicSubscriptionService(scopedDb(), {
    secret,
    available: () => true,
    send: () => {
      sends++;
      requestInvoked.resolve();
      return requestProvider.promise;
    },
  });
  const inflightRequest = requestInflight.request(fourth.subscriber.email, ['all'], 'manage');
  try {
    await bounded(requestInvoked.promise, 'Request transport start');
    await bounded(suppressThroughFeedback(fourth.subscriber.id), 'In-flight request suppression');
  } finally {
    requestProvider.resolve({ status: 'sent', messageId: `request-inflight-${run}` });
  }
  await bounded(inflightRequest, 'Request provider completion');
  assert.equal(
    (await db.publicMailReceipt.findUniqueOrThrow({ where: { id: `request-inflight-${run}` } }))
      .subscriberId,
    fourth.subscriber.id,
  );
  assert.equal(sends, 2);
  console.log(
    'PASS: PostgreSQL blocks digest dispatch after opt-out and request mail after suppression; in-flight stops commit before provider responses; skipped status and independent receipts remain correct.',
  );
} finally {
  await db.publicMailWebhook.deleteMany({ where: { id: { in: ownedFeedback } } });
  await db.publicSubscriber.deleteMany({ where: { id: { in: owned } } });
  await db.$disconnect();
}
