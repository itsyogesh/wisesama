import type { Prisma, PrismaClient } from '@wisesama/database';
import { describe, expect, it, vi } from 'vitest';
import { createAdminJobService, deliveryRetryBlock } from '../admin-job.service';
import { organizationFixture } from './organization-fixture';

const now = new Date('2026-11-05T10:00:00Z');
const makeJob = (): Prisma.IntelAdminJobGetPayload<Record<string, never>> => ({
  id: 'job-1',
  kind: 'source_refresh',
  targetId: 'osv',
  actorId: 'operator',
  reason: 'Investigate and recover this failed operation',
  status: 'queued',
  attempts: 0,
  nextAttemptAt: now,
  startedAt: null,
  finishedAt: null,
  leaseToken: null,
  leaseStartedAt: null,
  error: null,
  activeKey: 'source_refresh:osv',
  createdAt: now,
  updatedAt: now,
});
const delivery = () => ({
  id: 'delivery-1',
  userId: 'owner',
  projectId: 'project-1',
  subscriberId: 'subscriber-1',
  status: 'failed',
  attempts: 5,
  providerMessageId: null,
  sentAt: null,
  claimedAt: null,
  createdAt: now,
  error: 'Email provider could not be reached.',
  subscriber: { status: 'active', confirmedAt: now },
});
function harness() {
  let job = makeJob();
  const access = organizationFixture('owner');
  const db = {
    organizationMember: access.organizationMember,
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'operator',
        intelAdmin: true,
        intelSuspendedAt: null,
        emailVerified: true,
      }),
    },
    intelSourceControl: { findUnique: vi.fn().mockResolvedValue({ paused: false }) },
    intelAdminJob: {
      findUnique: vi.fn(async ({ where }: { where: { id?: string; activeKey?: string } }) =>
        where.activeKey ? null : { ...job, attemptRecords: [] },
      ),
      findMany: vi.fn(async () => [{ ...job }]),
      create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        job = { ...job, ...data };
        return { ...job };
      }),
      updateMany: vi.fn(
        async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          if (
            (where.status && where.status !== job.status) ||
            (where.leaseToken !== undefined && where.leaseToken !== job.leaseToken) ||
            (where.attempts !== undefined && where.attempts !== job.attempts)
          )
            return { count: 0 };
          if (
            where.updatedAt instanceof Date &&
            where.updatedAt.getTime() !== job.updatedAt.getTime()
          )
            return { count: 0 };
          const attempts =
            typeof data.attempts === 'object' && data.attempts !== null
              ? job.attempts + Number((data.attempts as { increment: number }).increment)
              : job.attempts;
          job = { ...job, ...data, attempts };
          return { count: 1 };
        },
      ),
      update: vi.fn(async ({ data }: { data: Record<string, unknown> }) => {
        job = { ...job, ...data };
        return job;
      }),
    },
    intelAdminJobAttempt: { create: vi.fn(), updateMany: vi.fn(), update: vi.fn() },
    intelAdminAudit: { create: vi.fn() },
    projectRepositorySource: {
      findUnique: vi.fn().mockResolvedValue({
        userId: 'owner',
        paused: false,
        status: 'failed',
        connection: { status: 'connected', userId: 'owner' },
        project: { organizationId: 'org-1' },
      }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ userId: 'owner' }),
    },
    securityProject: {
      findUnique: vi.fn().mockResolvedValue({ userId: 'owner', organizationId: 'org-1' }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ userId: 'owner' }),
    },
    securityNotificationSettings: { findUnique: vi.fn().mockResolvedValue({ emailEnabled: true }) },
    securityDelivery: {
      findUnique: vi.fn().mockResolvedValue(delivery()),
      findUniqueOrThrow: vi.fn().mockResolvedValue(delivery()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    publicFeedDelivery: {
      findUnique: vi.fn().mockResolvedValue(delivery()),
      findUniqueOrThrow: vi.fn().mockResolvedValue(delivery()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    publicMailWebhook: {
      findUnique: vi.fn().mockResolvedValue({ id: 'feedback-1', status: 'pending' }),
      findUniqueOrThrow: vi.fn().mockResolvedValue({ status: 'processed' }),
      updateMany: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((input: ((tx: typeof db) => unknown) | Promise<unknown>[]) =>
    typeof input === 'function' ? input(db) : Promise.all(input),
  );
  const operations = {
    probe: vi.fn(),
    refreshFeed: vi.fn().mockResolvedValue({ stale: false, sources: [] }),
    syncRepository: vi.fn(),
    assessProject: vi.fn(),
    privateDeliveries: vi.fn(),
    publicDeliveries: vi.fn(),
    feedback: vi.fn(),
  };
  const service = createAdminJobService({
    db: db as unknown as PrismaClient,
    now: () => now,
    env: { RESEND_API_KEY: 'synthetic-configured' },
    ...operations,
  });
  return {
    db,
    service,
    operations,
    access,
    setJob: (input: Partial<typeof job>) => {
      job = { ...job, ...input };
    },
    job: () => ({ ...job }),
  };
}
describe('durable operator work', () => {
  it('queues a supported exact target with an audit record', async () => {
    const { service, db } = harness();
    const value = await service.enqueue('operator', {
      kind: 'source_refresh',
      targetId: 'osv',
      reason: 'Investigating upstream failure and validating recovery',
    });
    expect(value.job.status).toBe('queued');
    expect(db.intelAdminAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: 'job.enqueue', actorId: 'operator' }),
      }),
    );
  });
  it('deduplicates queued work for the same kind and target', async () => {
    const { service, db } = harness();
    db.intelAdminJob.findUnique.mockResolvedValue({ ...makeJob(), attemptRecords: [] });
    expect(
      (
        await service.enqueue('operator', {
          kind: 'source_refresh',
          targetId: 'osv',
          reason: 'Investigating upstream failure and validating recovery',
        })
      ).deduplicated,
    ).toBe(true);
    expect(db.intelAdminJob.create).not.toHaveBeenCalled();
    expect(db.intelAdminAudit.create).not.toHaveBeenCalled();
  });
  it('rejects invalid target/reason and a source paused after collection', async () => {
    const { service, db } = harness();
    await expect(
      service.enqueue('operator', {
        kind: 'source_refresh',
        targetId: 'http://internal.invalid',
        reason: 'Investigating upstream failure',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.enqueue('operator', { kind: 'source_refresh', targetId: 'osv', reason: 'short' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    db.intelSourceControl.findUnique.mockResolvedValue({ paused: true });
    await expect(
      service.enqueue('operator', {
        kind: 'source_refresh',
        targetId: 'osv',
        reason: 'Investigating upstream failure',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.intelAdminJob.create).not.toHaveBeenCalled();
  });
  it('rechecks operator access inside the enqueue transaction', async () => {
    const { service, db } = harness();
    db.user.findUnique
      .mockResolvedValueOnce({ intelAdmin: true })
      .mockResolvedValueOnce({ intelAdmin: false });
    await expect(
      service.enqueue('operator', {
        kind: 'source_refresh',
        targetId: 'osv',
        reason: 'Investigating upstream failure',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(db.intelAdminJob.create).not.toHaveBeenCalled();
  });
  it('claims queued work once and records an attempt and actual success', async () => {
    const { service, operations, db } = harness();
    expect((await service.run('job-1', 'operator')).job.status).toBe('succeeded');
    expect(operations.probe).toHaveBeenCalledExactlyOnceWith('osv');
    expect(db.intelAdminJobAttempt.create).toHaveBeenCalledOnce();
    await expect(service.run('job-1', 'operator')).rejects.toMatchObject({ statusCode: 409 });
    expect(operations.probe).toHaveBeenCalledOnce();
  });
  it('retains a failed result without leaking arbitrary exception content', async () => {
    const { service, operations, db } = harness();
    operations.probe.mockRejectedValue(new Error('SECRET_TOKEN private upstream payload'));
    const result = await service.run('job-1', 'operator');
    expect(result.job.status).toBe('failed');
    expect(result.job.error).not.toContain('SECRET_TOKEN');
    expect(result.job.retryable).toBe(true);
    expect(db.intelAdminJobAttempt.updateMany).toHaveBeenCalled();
  });
  it('rejects revoked queue actors before invoking the target operation', async () => {
    const { service, operations, db } = harness();
    db.user.findUnique.mockResolvedValue({ intelAdmin: false });
    expect((await service.run('job-1')).job.status).toBe('failed');
    expect((await service.detail('job-1')).job.retryable).toBe(true);
    expect(operations.probe).not.toHaveBeenCalled();
  });
  it('does not advertise unsupported scheduled-stage retries', async () => {
    const { service, setJob } = harness();
    setJob({ kind: 'scheduled_assessment', targetId: null, status: 'failed' });
    expect((await service.detail('job-1')).job.retryable).toBe(false);
  });
  it('retries with a revision claim while preserving attempt history', async () => {
    const { service, setJob, db } = harness();
    setJob({ status: 'failed', activeKey: null, attempts: 2 });
    const result = await service.retry('operator', 'job-1', {
      reason: 'Configuration repaired; retry the same operation',
      expectedUpdatedAt: now.toISOString(),
    });
    expect(result.job.status).toBe('queued');
    expect(result.job.attempts).toBe(2);
    expect(db.intelAdminAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'job.retry' }) }),
    );
  });
  it('blocks stale retries without appending an audit event', async () => {
    const { service, setJob, db } = harness();
    setJob({ status: 'failed', activeKey: null });
    await expect(
      service.retry('operator', 'job-1', {
        reason: 'Configuration repaired; retry the same operation',
        expectedUpdatedAt: '2026-11-04T00:00:00Z',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.intelAdminAudit.create).not.toHaveBeenCalled();
  });
  it('retries only the requested delivery with the existing consent/idempotency processor', async () => {
    const { service, setJob, operations, db } = harness();
    setJob({ kind: 'private_delivery', targetId: 'delivery-1' });
    db.securityDelivery.findUniqueOrThrow
      .mockResolvedValueOnce(delivery())
      .mockResolvedValueOnce({ ...delivery(), status: 'sent' });
    expect((await service.run('job-1', 'operator')).job.status).toBe('succeeded');
    expect(operations.privateDeliveries).toHaveBeenCalledExactlyOnceWith('owner', 1, 'delivery-1');
    expect(db.intelAdminAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'delivery.retry',
          metadata: expect.objectContaining({ previousAttempts: 5, resetAttempts: true }),
        }),
      }),
    );
  });
  it('does not seize a delivery that another worker claimed after initial validation', async () => {
    const { service, setJob, operations, db } = harness();
    setJob({ kind: 'private_delivery', targetId: 'delivery-1' });
    db.securityDelivery.findUniqueOrThrow.mockResolvedValue({
      ...delivery(),
      status: 'processing',
      claimedAt: now,
    });
    expect((await service.run('job-1', 'operator')).job.status).toBe('failed');
    expect(operations.privateDeliveries).not.toHaveBeenCalled();
    expect(db.securityDelivery.updateMany).not.toHaveBeenCalled();
  });
  it('refuses accepted deliveries and inactive public subscriptions', async () => {
    const { service, db } = harness();
    db.securityDelivery.findUnique.mockResolvedValue({
      ...delivery(),
      providerMessageId: 'accepted-message',
    });
    await expect(
      service.enqueue('operator', {
        kind: 'private_delivery',
        targetId: 'delivery-1',
        reason: 'Configuration repaired; retry delivery',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    db.publicFeedDelivery.findUnique.mockResolvedValue({
      ...delivery(),
      subscriber: { status: 'unsubscribed', confirmedAt: now },
    });
    await expect(
      service.enqueue('operator', {
        kind: 'public_delivery',
        targetId: 'delivery-1',
        reason: 'Configuration repaired; retry delivery',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
  });
  it('records a scheduler stage as failed when child work reported failure', async () => {
    const { service, db } = harness();
    const outcome = await service.recordScheduledStage('assessment', async () => ({
      projects: [{ status: 'failed' }],
    }));
    expect(outcome.status).toBe('failed');
    expect(db.intelAdminJob.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'failed' }) }),
    );
  });
  it('records numeric mail failures without confusing consent skips with failures', async () => {
    const { service } = harness();
    expect(
      (
        await service.recordScheduledStage('public_digest', async () => ({
          compiled: 2,
          attempted: 2,
          accepted: 0,
          failed: 1,
          unavailable: 0,
          skipped: 1,
        }))
      ).status,
    ).toBe('failed');
    expect(
      (
        await service.recordScheduledStage('public_digest', async () => ({
          compiled: 1,
          attempted: 1,
          accepted: 0,
          failed: 0,
          unavailable: 0,
          skipped: 1,
        }))
      ).status,
    ).toBe('succeeded');
  });
});

describe('mail recovery eligibility', () => {
  it('blocks accepted, claimed, and old ambiguous mail while allowing never-sent unavailable work', () => {
    expect(deliveryRetryBlock({ ...delivery(), providerMessageId: 'message' }, now)).toMatch(
      /accepted/,
    );
    expect(deliveryRetryBlock({ ...delivery(), claimedAt: now }, now)).toMatch(/progress/);
    const old = { ...delivery(), createdAt: new Date(now.getTime() - 25 * 60 * 60_000) };
    expect(deliveryRetryBlock(old, now)).toMatch(/idempotency/);
    expect(
      deliveryRetryBlock(
        { ...old, status: 'unavailable', error: 'Email delivery is not configured.' },
        now,
      ),
    ).toBeNull();
  });
});

describe('organization-aware operator retry targets', () => {
  it('runs only the exact saved source through the bounded job adapter while the operator is outside its organization', async () => {
    const { service, operations, setJob, access } = harness();
    access.members.set('owner', 'member');
    expect(access.members.has('operator')).toBe(false);
    setJob({
      kind: 'repository_sync',
      targetId: 'source-1',
      activeKey: 'repository_sync:source-1',
    });
    const result = await service.run('job-1', 'operator');
    expect(result.job.status).toBe('succeeded');
    expect(operations.syncRepository).toHaveBeenCalledExactlyOnceWith('source-1');
  });
  it('rejects a removed or suspended connector before queueing repository retry', async () => {
    const { service, operations, db, access } = harness();
    access.members.delete('owner');
    await expect(
      service.enqueue('operator', {
        kind: 'repository_sync',
        targetId: 'source-1',
        reason: 'Recheck the repaired bounded repository source',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    access.members.set('owner', 'owner');
    access.suspended.add('owner');
    await expect(
      service.enqueue('operator', {
        kind: 'repository_sync',
        targetId: 'source-1',
        reason: 'Recheck the repaired bounded repository source',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.intelAdminJob.create).not.toHaveBeenCalled();
    expect(operations.syncRepository).not.toHaveBeenCalled();
  });
  it('fails a queued retry explicitly when its connector is removed before execution', async () => {
    const { service, operations, setJob, access } = harness();
    setJob({
      kind: 'repository_sync',
      targetId: 'source-1',
      activeKey: 'repository_sync:source-1',
    });
    access.members.delete('owner');
    const result = await service.run('job-1', 'operator');
    expect(result.job.status).toBe('failed');
    expect(result.job.error).toContain('no longer has access');
    expect(operations.syncRepository).not.toHaveBeenCalled();
  });
  it('blocks assessment and private alert retry after the original recipient leaves the project organization', async () => {
    const { service, operations, db, access } = harness();
    access.members.delete('owner');
    await expect(
      service.enqueue('operator', {
        kind: 'project_assessment',
        targetId: 'project-1',
        reason: 'Recheck the repaired project assessment source',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    db.securityDelivery.findUnique.mockResolvedValue({ ...delivery(), projectId: 'project-1' });
    await expect(
      service.enqueue('operator', {
        kind: 'private_delivery',
        targetId: 'delivery-1',
        reason: 'Recheck the repaired private email transport',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.intelAdminJob.create).not.toHaveBeenCalled();
    expect(operations.assessProject).not.toHaveBeenCalled();
    expect(operations.privateDeliveries).not.toHaveBeenCalled();
  });
});
