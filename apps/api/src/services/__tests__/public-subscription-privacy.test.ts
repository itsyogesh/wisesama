import { createHash } from 'node:crypto';
import type { PrismaClient } from '@wisesama/database';
import Fastify from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createPublicSubscriptionRoutes } from '../../modules/intel/public-subscription.routes';
import { PublicSubscriptionService } from '../public-subscription.service';

vi.mock('@wisesama/database', () => ({ prisma: {} }));
const NOW = new Date('2026-11-05T10:00:00Z');
const NEUTRAL = {
  accepted: true,
  message:
    'If this address can receive updates, a link will arrive shortly. Check your inbox and spam folder.',
};
const apps: ReturnType<typeof Fastify>[] = [];
const subscriber = {
  id: 'subscriber1',
  email: 'person@example.test',
  status: 'pending',
  topics: ['all'],
  confirmedAt: null,
  lastRequestAt: new Date(0),
  nextDigestAt: null,
  lastCompiledAt: null,
  unsubscribeVersion: 1,
  adminRevision: 0,
  createdAt: NOW,
  updatedAt: NOW,
};
const cases = [
  { label: 'unknown management address', existing: null, manage: true, sends: false },
  {
    label: 'suppressed address',
    existing: { ...subscriber, status: 'suppressed' },
    manage: false,
    sends: false,
  },
  {
    label: 'address in cooldown',
    existing: { ...subscriber, lastRequestAt: NOW },
    manage: false,
    sends: false,
  },
  { label: 'pending address', existing: subscriber, manage: false, sends: true },
  {
    label: 'active address',
    existing: { ...subscriber, status: 'active', confirmedAt: NOW },
    manage: false,
    sends: true,
  },
  { label: 'known management address', existing: subscriber, manage: true, sends: true },
  { label: 'new signup address', existing: null, manage: false, sends: true },
] as const;
type Scenario = (typeof cases)[number];
async function setup(scenario: Scenario = cases[3], available = true) {
  const db = {
    publicSubscriber: {
      findUnique: vi.fn().mockResolvedValue(subscriber).mockResolvedValueOnce(scenario.existing),
      upsert: vi.fn().mockResolvedValue(subscriber),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    publicSubscriptionToken: {
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    publicMailReceipt: { upsert: vi.fn() },
    publicMailWebhook: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((callback: (tx: typeof db) => unknown) => callback(db));
  const warning = vi.spyOn(console, 'warn').mockImplementation(() => {});
  const send = vi.fn().mockResolvedValue({ status: 'sent', messageId: 'accepted1' });
  const service = new PublicSubscriptionService(db as unknown as PrismaClient, {
    now: () => NOW,
    send,
    available: () => available,
    secret: () => 'test-only-secret-longer-than-thirty-two-bytes',
    appUrl: () => 'https://intel.example.test',
  });
  const app = Fastify();
  apps.push(app);
  await app.register(createPublicSubscriptionRoutes(service), { prefix: '/api/v1' });
  const request = () =>
    app.inject({
      method: 'POST',
      url: `/api/v1/intel/subscriptions/${scenario.manage ? 'manage/request' : 'request'}`,
      payload: { email: subscriber.email },
    });
  return { db, send, service, warning, request };
}
afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
  vi.restoreAllMocks();
});

describe('configured public subscription request privacy', () => {
  describe.each([
    'failed',
    'unavailable',
    'reject',
    'throw',
  ] as const)('when provider reports %s', (failure) => {
    it.each(cases)('returns the identical 202 response for $label', async (scenario) => {
      const { db, send, request } = await setup(scenario);
      send.mockImplementation(() => {
        if (failure === 'throw') throw new Error('Sensitive provider failure');
        if (failure === 'reject') return Promise.reject(new Error('Sensitive provider failure'));
        return Promise.resolve({ status: failure, error: 'Sensitive provider failure' });
      });
      const response = await request();
      expect(response.statusCode).toBe(202);
      expect(response.json()).toEqual(NEUTRAL);
      expect(response.headers['cache-control']).toBe('private, no-store');
      expect(send).toHaveBeenCalledTimes(scenario.sends ? 1 : 0);
      if (scenario.sends) {
        const value = send.mock.calls[0]![0].text.match(/#token=([a-zA-Z0-9_-]+)/)![1];
        expect(db.publicSubscriptionToken.updateMany).toHaveBeenCalledWith({
          where: { tokenHash: createHash('sha256').update(value).digest('hex'), consumedAt: null },
          data: { consumedAt: NOW },
        });
        expect(db.publicSubscriber.updateMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: {
              id: subscriber.id,
              lastRequestAt: { lt: new Date(NOW.getTime() - 5 * 60_000) },
            },
            data: { lastRequestAt: NOW },
          }),
        );
      }
      expect(db.publicMailReceipt.upsert).not.toHaveBeenCalled();
    });
  });

  it('uses the same response after acceptance and preserves receipt correlation', async () => {
    const { db, request } = await setup();
    expect((await request()).json()).toEqual(NEUTRAL);
    expect(db.publicMailReceipt.upsert).toHaveBeenCalledWith({
      where: { id: 'accepted1' },
      create: { id: 'accepted1', subscriberId: subscriber.id },
      update: {},
    });
  });

  it('retains the request throttle when a provider failure is followed by another request', async () => {
    const { db, send, request } = await setup();
    send.mockResolvedValue({ status: 'failed', error: 'Synthetic failure' });
    expect((await request()).statusCode).toBe(202);
    db.publicSubscriber.findUnique.mockResolvedValue({ ...subscriber, lastRequestAt: NOW });
    expect((await request()).json()).toEqual(NEUTRAL);
    expect(send).toHaveBeenCalledTimes(1);
    expect(db.publicSubscriptionToken.create).toHaveBeenCalledTimes(1);
  });

  it('reports failed invalidation safely while preserving the neutral client response', async () => {
    const { db, send, warning, request } = await setup();
    send.mockRejectedValue(new Error('Private provider payload person@example.test'));
    db.publicSubscriptionToken.updateMany.mockRejectedValue(
      new Error('Private database detail token=private'),
    );
    const response = await request();
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual(NEUTRAL);
    expect(warning).toHaveBeenCalledWith(
      '[PublicSubscriptions] Failed email request link could not be invalidated.',
    );
    expect(JSON.stringify(warning.mock.calls)).not.toMatch(/person@example|private|payload/i);
  });

  it.each([
    'lookup',
    'token',
    'receipt',
    'feedback',
  ] as const)('does not disclose an address through a configured %s persistence failure', async (operation) => {
    const { db, request } = await setup();
    const error = new Error('Private persistence details');
    if (operation === 'lookup') db.publicSubscriber.findUnique.mockRejectedValue(error);
    if (operation === 'token') db.publicSubscriptionToken.create.mockRejectedValue(error);
    if (operation === 'receipt') db.publicMailReceipt.upsert.mockRejectedValue(error);
    if (operation === 'feedback') db.publicMailWebhook.findMany.mockRejectedValue(error);
    const response = await request();
    expect(response.statusCode).toBe(202);
    expect(response.json()).toEqual(NEUTRAL);
  });

  it('keeps globally disabled capabilities uniform before any subscriber lookup', async () => {
    const { db, request } = await setup(cases[0], false);
    expect((await request()).statusCode).toBe(503);
    expect(db.publicSubscriber.findUnique).not.toHaveBeenCalled();
  });
});
