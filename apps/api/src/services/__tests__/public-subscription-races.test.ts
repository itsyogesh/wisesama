import { createHmac } from 'node:crypto';
import type { PrismaClient } from '@wisesama/database';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createIntelAdminService } from '../admin.service';
import type { IntelAdvisory } from '../intel/index';
import { PublicSubscriptionService } from '../public-subscription.service';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
const NOW = new Date('2026-11-05T10:00:00Z');
type Send = NonNullable<
  NonNullable<ConstructorParameters<typeof PublicSubscriptionService>[1]>['send']
>;
type Result = Awaited<ReturnType<Send>>;
type Row = Record<string, unknown>;
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
};
const numeric = (value: unknown) => (value instanceof Date ? value.getTime() : Number(value));
function matches(row: Row, where: Row): boolean {
  return Object.entries(where).every(([key, expected]) => {
    if (key === 'OR') return (expected as Row[]).some((part) => matches(row, part));
    const actual = row[key];
    if (expected instanceof Date) return numeric(actual) === expected.getTime();
    if (expected === null || typeof expected !== 'object') return actual === expected;
    const filter = expected as Row;
    return (
      (!('in' in filter) || (filter.in as unknown[]).includes(actual)) &&
      (!('not' in filter) || actual !== filter.not) &&
      (!('equals' in filter) || actual === filter.equals) &&
      (!('lt' in filter) || numeric(actual) < numeric(filter.lt)) &&
      (!('lte' in filter) || numeric(actual) <= numeric(filter.lte))
    );
  });
}
function apply<T extends Row>(row: T, data: Row): T {
  const next: Row = { ...row };
  for (const [key, value] of Object.entries(data)) {
    next[key] =
      value && typeof value === 'object' && 'increment' in value
        ? Number(next[key]) + Number(value.increment)
        : value;
  }
  return next as T;
}
const advisory: IntelAdvisory = {
  id: 'GHSA-race',
  aliases: [],
  title: 'Synthetic advisory',
  summary: 'Synthetic advisory',
  severity: 'high',
  cvss: 8.1,
  exploited: false,
  epss: null,
  publishedAt: NOW.toISOString(),
  modifiedAt: NOW.toISOString(),
  references: [],
  affected: [],
  source: 'OSV',
};
type Stop = 'unsubscribe' | 'admin' | 'signed feedback';
function harness() {
  let subscriber = {
    id: 'subscriber1',
    email: 'person@example.test',
    status: 'active',
    topics: ['all'],
    confirmedAt: NOW,
    lastRequestAt: NOW,
    nextDigestAt: NOW,
    lastCompiledAt: NOW,
    unsubscribeVersion: 1,
    adminRevision: 0,
    createdAt: NOW,
    updatedAt: NOW,
  };
  let delivery = {
    id: 'delivery1',
    subscriberId: subscriber.id,
    eventKey: 'digest:subscriber1:2026-11-05',
    items: { advisories: [advisory], omitted: 0 },
    subject: 'Synthetic updates',
    status: 'pending',
    attempts: 0,
    nextAttemptAt: NOW,
    claimedAt: null as Date | null,
    providerMessageId: null as string | null,
    sentAt: null as Date | null,
    createdAt: NOW,
    error: null as string | null,
  };
  const receipts = new Map<string, Row>([
    ['previous-mail', { id: 'previous-mail', subscriberId: subscriber.id }],
  ]);
  const webhooks = new Map<string, Row>();
  let transactionOpen = false;
  let subscriberRowLocked = false;
  let failCommit = false;
  let queue = Promise.resolve();
  const locksAtSend: boolean[] = [];
  const db = {
    user: { findFirst: vi.fn().mockResolvedValue({ id: 'operator' }) },
    intelAdminAudit: { findMany: vi.fn().mockResolvedValue([]), create: vi.fn() },
    intelAdvisoryReview: { findMany: vi.fn().mockResolvedValue([]) },
    securityAdvisory: { findMany: vi.fn().mockResolvedValue([]) },
    publicSubscriber: {
      findUnique: vi.fn(async ({ where }: { where: Row }) =>
        matches(subscriber, where) ? { ...subscriber } : null,
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        if (!matches(subscriber, where)) return { count: 0 };
        subscriberRowLocked = transactionOpen;
        subscriber = apply(subscriber, data);
        return { count: 1 };
      }),
      update: vi.fn(async ({ data }: { data: Row }) => {
        subscriberRowLocked = transactionOpen;
        subscriber = apply(subscriber, data);
        return subscriber;
      }),
    },
    publicFeedDelivery: {
      findMany: vi.fn(async ({ where }: { where: Row }) =>
        matches(delivery, where) ? [{ ...delivery }] : [],
      ),
      findUnique: vi.fn(async ({ where }: { where: Row }) =>
        matches(delivery, where) ? { ...delivery } : null,
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        if (!matches(delivery, where)) return { count: 0 };
        delivery = apply(delivery, data);
        return { count: 1 };
      }),
      update: vi.fn(async ({ data }: { data: Row }) => {
        delivery = apply(delivery, data);
        return delivery;
      }),
    },
    publicSubscriptionToken: {
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn(),
    },
    publicMailReceipt: {
      upsert: vi.fn(async ({ create }: { create: { id: string; subscriberId: string } }) => {
        if (!receipts.has(create.id)) receipts.set(create.id, create);
        return receipts.get(create.id);
      }),
      findUnique: vi.fn(
        async ({ where }: { where: { id: string } }) => receipts.get(where.id) ?? null,
      ),
      findMany: vi.fn().mockResolvedValue([]),
    },
    publicMailWebhook: {
      upsert: vi.fn(async ({ create }: { create: { id: string } & Row }) => {
        if (!webhooks.has(create.id))
          webhooks.set(create.id, { attempts: 0, nextAttemptAt: NOW, ...create });
      }),
      findMany: vi.fn(async ({ where }: { where: Row }) =>
        [...webhooks.values()].filter((row) => matches(row, where)),
      ),
      updateMany: vi.fn(async ({ where, data }: { where: Row; data: Row }) => {
        const row = [...webhooks.values()].find((value) => matches(value, where));
        if (!row) return { count: 0 };
        webhooks.set(String(row.id), apply(row, data));
        return { count: 1 };
      }),
      update: vi.fn(async ({ where, data }: { where: { id: string }; data: Row }) => {
        const row = webhooks.get(where.id);
        if (!row) throw new Error('Missing synthetic webhook');
        webhooks.set(where.id, apply(row, data));
      }),
      count: vi.fn(
        async ({ where }: { where: Row }) =>
          [...webhooks.values()].filter((row) => matches(row, where)).length,
      ),
    },
    $transaction: vi.fn(),
  };
  // The serial transaction queue models contention on this single subscriber. An unresolved
  // provider response must never prevent a later stop transaction from completing.
  db.$transaction.mockImplementation(async (callback: (tx: typeof db) => Promise<unknown>) => {
    const previous = queue;
    const released = deferred<void>();
    queue = released.promise;
    await previous;
    transactionOpen = true;
    subscriberRowLocked = false;
    try {
      const result = await callback(db);
      if (failCommit) {
        failCommit = false;
        throw new Error('Synthetic commit failure');
      }
      return result;
    } finally {
      transactionOpen = false;
      subscriberRowLocked = false;
      released.resolve();
    }
  });
  const send = vi.fn<Send>().mockResolvedValue({ status: 'sent', messageId: 'accepted1' });
  const service = new PublicSubscriptionService(db as unknown as PrismaClient, {
    now: () => NOW,
    secret: () => 'test-only-secret-longer-than-thirty-two-bytes',
    available: () => true,
    send: (mail) => {
      locksAtSend.push(transactionOpen && subscriberRowLocked);
      return send(mail);
    },
    appUrl: () => 'https://intel.example.test',
    apiUrl: () => 'https://api.example.test',
  });
  const admin = createIntelAdminService({ db: db as unknown as PrismaClient, now: () => NOW });
  async function signedFeedback(messageId = 'previous-mail') {
    const key = Buffer.from('test-only-webhook-signing-bytes');
    vi.stubEnv('RESEND_WEBHOOK_SECRET', `whsec_${key.toString('base64')}`);
    const payload = JSON.stringify({ type: 'email.complained', data: { email_id: messageId } });
    const id = `signed-${messageId}`;
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = createHmac('sha256', key)
      .update(`${id}.${timestamp}.${payload}`)
      .digest('base64');
    return service.handleWebhook(payload, { id, timestamp, signature: `v1,${signature}` });
  }
  async function stop(kind: Stop) {
    if (kind === 'unsubscribe') await service.unsubscribe(service.unsubscribeToken(subscriber));
    else if (kind === 'admin')
      await admin.subscriptionStatus('operator', subscriber.id, {
        status: 'unsubscribed',
        expectedRevision: subscriber.adminRevision,
        reason: 'Synthetic requested delivery stop',
      });
    else await signedFeedback();
  }
  return {
    db,
    send,
    service,
    stop,
    signedFeedback,
    receipts,
    locksAtSend,
    prepareRequest: () => {
      subscriber = { ...subscriber, lastRequestAt: new Date(0) };
    },
    suppress: async (kind: 'admin' | 'signed feedback') => {
      if (kind === 'signed feedback') await signedFeedback();
      else
        await admin.subscriptionStatus('operator', subscriber.id, {
          status: 'suppressed',
          expectedRevision: subscriber.adminRevision,
          reason: 'Synthetic suppression regression',
        });
    },
    current: () => ({ subscriber: { ...subscriber }, delivery: { ...delivery } }),
    replaceDelivery: (changes: Partial<typeof delivery>) => {
      delivery = { ...delivery, ...changes };
    },
    failNextCommit: () => {
      failCommit = true;
    },
  };
}
afterEach(() => {
  vi.unstubAllEnvs();
});

describe('public delivery consent boundaries', () => {
  it.each([
    'admin',
    'signed feedback',
  ] as const)('blocks request mail after %s suppression completes', async (kind) => {
    const h = harness();
    h.prepareRequest();
    const checking = deferred<void>();
    const resume = deferred<void>();
    const update = h.db.publicSubscriber.updateMany.getMockImplementation()!;
    h.db.publicSubscriber.updateMany.mockImplementationOnce(async (input) => {
      checking.resolve();
      await resume.promise;
      return update(input);
    });
    const worker = h.service.request('person@example.test', ['all'], 'manage');
    await checking.promise;
    await h.suppress(kind);
    resume.resolve();
    await expect(worker).resolves.toMatchObject({ accepted: true });
    expect(h.current().subscriber.status).toBe('suppressed');
    expect(h.db.publicSubscriptionToken.create).not.toHaveBeenCalled();
    expect(h.send).not.toHaveBeenCalled();
  });

  it.each([
    'admin',
    'signed feedback',
  ] as const)('lets %s suppression complete while request mail is in flight', async (kind) => {
    const h = harness();
    h.prepareRequest();
    const invoked = deferred<void>();
    const response = deferred<Result>();
    h.send.mockImplementation(() => {
      invoked.resolve();
      return response.promise;
    });
    const worker = h.service.request('person@example.test', ['all'], 'manage');
    await invoked.promise;
    expect(h.locksAtSend).toEqual([true]);
    await h.suppress(kind);
    expect(h.current().subscriber.status).toBe('suppressed');
    response.resolve({ status: 'sent', messageId: 'request-inflight' });
    await worker;
    expect(h.receipts.get('request-inflight')).toMatchObject({ subscriberId: 'subscriber1' });
  });

  it('retains a request send receipt when the dispatch commit fails after invocation', async () => {
    const h = harness();
    h.prepareRequest();
    h.failNextCommit();
    await h.service.request('person@example.test', ['all'], 'manage');
    expect(h.receipts.get('accepted1')).toMatchObject({ subscriberId: 'subscriber1' });
  });

  it.each<Stop>([
    'unsubscribe',
    'admin',
    'signed feedback',
  ])('does not begin send after %s completes during advisory checks', async (kind) => {
    const h = harness();
    const checking = deferred<void>();
    const resume = deferred<[]>();
    h.db.intelAdvisoryReview.findMany.mockImplementationOnce(() => {
      checking.resolve();
      return resume.promise;
    });
    const worker = h.service.processDeliveries();
    await checking.promise;
    await h.stop(kind);
    expect(h.current().delivery.status).toBe('skipped');
    resume.resolve([]);
    await worker;
    expect(h.send).not.toHaveBeenCalled();
    expect(h.current().delivery.status).toBe('skipped');
  });

  it.each<Stop>([
    'unsubscribe',
    'admin',
    'signed feedback',
  ])('lets %s complete after transport invocation and preserves skipped delivery plus receipt', async (kind) => {
    const h = harness();
    const invoked = deferred<void>();
    const response = deferred<Result>();
    h.send.mockImplementation(() => {
      invoked.resolve();
      return response.promise;
    });
    const worker = h.service.processDeliveries();
    await invoked.promise;
    expect(h.locksAtSend).toEqual([true]);
    // This must complete while the provider response is still unresolved.
    await h.stop(kind);
    expect(h.current().delivery.status).toBe('skipped');
    response.resolve({ status: 'sent', messageId: 'late-mail' });
    await expect(worker).resolves.toMatchObject({ accepted: 1 });
    expect(h.current().delivery.status).toBe('skipped');
    expect(h.receipts.get('late-mail')).toMatchObject({ subscriberId: 'subscriber1' });
    await h.service.processDeliveries();
    expect(h.send).toHaveBeenCalledTimes(1);
  });

  it.each([
    'failed',
    'unavailable',
  ] as const)('does not revive a skipped delivery after an in-flight %s response', async (status) => {
    const h = harness();
    const invoked = deferred<void>();
    const response = deferred<Result>();
    h.send.mockImplementation(() => {
      invoked.resolve();
      return response.promise;
    });
    const worker = h.service.processDeliveries();
    await invoked.promise;
    await h.stop('unsubscribe');
    response.resolve({ status, error: 'Synthetic provider failure' });
    await worker;
    expect(h.current().delivery.status).toBe('skipped');
    expect(h.current().delivery.error).toBe('Subscription is no longer active.');
  });

  it('does not send a delivery whose lease was replaced during advisory checks', async () => {
    const h = harness();
    const checking = deferred<void>();
    const resume = deferred<[]>();
    h.db.intelAdvisoryReview.findMany.mockImplementationOnce(() => {
      checking.resolve();
      return resume.promise;
    });
    const worker = h.service.processDeliveries();
    await checking.promise;
    h.replaceDelivery({ attempts: 2, claimedAt: NOW, error: 'Newer worker owns this claim' });
    resume.resolve([]);
    await worker;
    expect(h.send).not.toHaveBeenCalled();
    expect(h.current().delivery).toMatchObject({
      status: 'pending',
      attempts: 2,
      error: 'Newer worker owns this claim',
    });
  });

  it('keeps late signed feedback correlated when a stopped delivery cannot record its provider id', async () => {
    const h = harness();
    const invoked = deferred<void>();
    const response = deferred<Result>();
    h.send.mockImplementation(() => {
      invoked.resolve();
      return response.promise;
    });
    const worker = h.service.processDeliveries();
    await invoked.promise;
    await h.stop('unsubscribe');
    expect(await h.signedFeedback('late-mail')).toMatchObject({ pendingFeedback: 1 });
    response.resolve({ status: 'sent', messageId: 'late-mail' });
    await worker;
    expect(h.current().subscriber.status).toBe('suppressed');
    expect(h.current().delivery.status).toBe('skipped');
    expect(h.current().delivery.providerMessageId).toBeNull();
  });

  it('does not overwrite a newer delivery claim even when the timestamp is identical', async () => {
    const h = harness();
    const invoked = deferred<void>();
    const response = deferred<Result>();
    h.send.mockImplementation(() => {
      invoked.resolve();
      return response.promise;
    });
    const worker = h.service.processDeliveries();
    await invoked.promise;
    h.replaceDelivery({ attempts: 2, claimedAt: NOW, error: 'Newer worker owns this claim' });
    response.resolve({ status: 'failed', error: 'Old worker result' });
    await worker;
    expect(h.current().delivery).toMatchObject({
      status: 'pending',
      attempts: 2,
      error: 'Newer worker owns this claim',
    });
  });

  it('rechecks retry bounds when a stale candidate has already exhausted its attempts', async () => {
    const h = harness();
    const stale = { ...h.current().delivery, attempts: 4 };
    h.db.publicFeedDelivery.findMany.mockResolvedValueOnce([stale]);
    h.replaceDelivery({ attempts: 5 });
    await h.service.processDeliveries();
    expect(h.send).not.toHaveBeenCalled();
    expect(h.current().delivery.attempts).toBe(5);
  });

  it('retains acceptance and correlation if the dispatch transaction fails after transport invocation', async () => {
    const h = harness();
    const invoked = deferred<void>();
    const response = deferred<Result>();
    h.send.mockImplementation(() => {
      invoked.resolve();
      return response.promise;
    });
    h.failNextCommit();
    const worker = h.service.processDeliveries();
    await invoked.promise;
    await h.stop('unsubscribe');
    response.resolve({ status: 'sent', messageId: 'commit-failed-mail' });
    await worker;
    expect(h.current().delivery.status).toBe('skipped');
    expect(h.receipts.get('commit-failed-mail')).toMatchObject({ subscriberId: 'subscriber1' });
  });

  it.each([
    'throw',
    'reject',
  ] as const)('bounds a synchronous %s transport failure without leaving a transaction open', async (mode) => {
    const h = harness();
    h.send.mockImplementation(() => {
      if (mode === 'throw') throw new Error('Synthetic transport failure');
      return Promise.reject(new Error('Synthetic transport failure'));
    });
    await expect(h.service.processDeliveries()).resolves.toMatchObject({ unavailable: 1 });
    expect(h.current().delivery).toMatchObject({
      status: 'unavailable',
      attempts: 1,
      claimedAt: null,
    });
    expect(h.current().delivery.nextAttemptAt.getTime()).toBeGreaterThan(NOW.getTime());
    await h.stop('unsubscribe');
    expect(h.current().delivery.status).toBe('skipped');
  });
});
