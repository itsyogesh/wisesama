import { randomUUID } from 'node:crypto';
import { type Prisma, type PrismaClient, prisma } from '@wisesama/database';
import {
  BREVO_RECONCILIATION_REQUIRED,
  brevoRetryBlocked,
  usesBrevo,
  workspaceEmailConfigured,
} from './brevo-email.service';
import { intelProvider } from './intel/provider';
import { intelWorkspaceService } from './intel-workspace.service';
import { isActiveOrganizationMember } from './organization-access';
import { publicSubscriptionService } from './public-subscription.service';
import { repositoryService } from './repository.service';
import {
  INTEL_SOURCES,
  type IntelSourceId,
  safeOperationError,
  sourceControlService,
} from './source-control.service';

export const ADMIN_JOB_KINDS = [
  'source_refresh',
  'feed_refresh',
  'repository_sync',
  'project_assessment',
  'private_delivery',
  'public_delivery',
  'feedback_reconcile',
] as const;
export type AdminJobKind = (typeof ADMIN_JOB_KINDS)[number];
type Job = Prisma.IntelAdminJobGetPayload<Record<string, never>>;
const LEASE_MS = 10 * 60_000;
const MAX_ATTEMPTS = 10;
export class AdminJobError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'AdminJobError';
  }
}
const iso = (value: Date | null) => value?.toISOString() ?? null;
const jobDto = (value: Job) => ({
  id: value.id,
  kind: value.kind,
  targetId: value.targetId,
  actorId: value.actorId,
  reason: value.reason,
  status: value.status,
  attempts: value.attempts,
  error: value.error,
  createdAt: value.createdAt.toISOString(),
  updatedAt: value.updatedAt.toISOString(),
  nextAttemptAt: value.nextAttemptAt.toISOString(),
  startedAt: iso(value.startedAt),
  finishedAt: iso(value.finishedAt),
  retryable:
    value.status === 'failed' &&
    value.attempts < MAX_ATTEMPTS &&
    (ADMIN_JOB_KINDS as readonly string[]).includes(value.kind),
});

/** An old transport timeout may represent accepted mail after provider idempotency expires. */
export function deliveryRetryBlock(
  value: {
    status: string;
    sentAt: Date | null;
    providerMessageId: string | null;
    claimedAt: Date | null;
    createdAt: Date;
    error: string | null;
  },
  now: Date,
) {
  if (value.sentAt || value.providerMessageId || !['failed', 'unavailable'].includes(value.status))
    return 'This delivery was accepted, is in progress, or is no longer failed.';
  if (value.claimedAt && value.claimedAt.getTime() > now.getTime() - 15 * 60_000)
    return 'A delivery attempt is still in progress.';
  const neverSent =
    value.status === 'unavailable' &&
    /not configured|could not be prepared/i.test(value.error ?? '');
  const rejected = /rejected delivery \(HTTP 4\d\d\)/.test(value.error ?? '');
  if (!neverSent && !rejected && value.createdAt.getTime() < now.getTime() - 20 * 60 * 60_000)
    return 'This older failure may have been accepted beyond the provider idempotency window. Verify the send receipt before separate recovery.';
  return null;
}

export function createAdminJobService(
  options: {
    db?: PrismaClient;
    now?: () => Date;
    env?: NodeJS.ProcessEnv;
    probe?: typeof intelProvider.probe;
    refreshFeed?: typeof intelWorkspaceService.getBriefings;
    syncRepository?: typeof repositoryService.syncForJob;
    assessProject?: typeof intelWorkspaceService.scanProject;
    privateDeliveries?: typeof intelWorkspaceService.processDeliveries;
    publicDeliveries?: typeof publicSubscriptionService.processDeliveries;
    feedback?: typeof publicSubscriptionService.reconcileMailFeedback;
  } = {},
) {
  const db = options.db ?? prisma,
    now = options.now ?? (() => new Date()),
    env = options.env ?? process.env;
  const dependencies = {
    probe: options.probe ?? intelProvider.probe,
    refreshFeed: options.refreshFeed ?? intelWorkspaceService.getBriefings,
    syncRepository: options.syncRepository ?? repositoryService.syncForJob,
    assessProject: options.assessProject ?? intelWorkspaceService.scanProject,
    privateDeliveries: options.privateDeliveries ?? intelWorkspaceService.processDeliveries,
    publicDeliveries:
      options.publicDeliveries ??
      publicSubscriptionService.processDeliveries.bind(publicSubscriptionService),
    feedback:
      options.feedback ??
      publicSubscriptionService.reconcileMailFeedback.bind(publicSubscriptionService),
  };
  const sourceControls = createControls();
  function createControls() {
    return options.db
      ? {
          assertEnabled: async (name: string) => {
            const id =
              name === 'OSV'
                ? 'osv'
                : name === 'CISA KEV'
                  ? 'kev'
                  : name === 'FIRST EPSS'
                    ? 'epss'
                    : 'github';
            if ((await db.intelSourceControl.findUnique({ where: { id } }))?.paused)
              throw new AdminJobError(409, 'Resume this source before refreshing it.');
          },
        }
      : sourceControlService;
  }
  async function actor(actorId: string) {
    const value = await db.user.findUnique({
      where: { id: actorId },
      select: { intelAdmin: true, intelSuspendedAt: true },
    });
    if (!value?.intelAdmin || value.intelSuspendedAt)
      throw new AdminJobError(403, 'Wisesama administrator access is required.');
  }
  async function activeOwner(userId: string) {
    const owner = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, intelSuspendedAt: true },
    });
    if (!owner || owner.intelSuspendedAt)
      throw new AdminJobError(409, 'The target account is unavailable or suspended.');
  }
  async function validate(kind: AdminJobKind, targetId: string | null) {
    if (kind === 'feed_refresh') {
      if (targetId) throw new AdminJobError(400, 'Feed refresh has no target identifier.');
      await sourceControls.assertEnabled('GitHub Advisory Database');
      return;
    }
    if (!targetId) throw new AdminJobError(400, 'Choose an exact target for this job.');
    if (kind === 'source_refresh') {
      const source = INTEL_SOURCES.find((value) => value.id === targetId);
      if (!source) throw new AdminJobError(404, 'Intelligence source not found.');
      await sourceControls.assertEnabled(source.name);
      return;
    }
    if (kind === 'repository_sync') {
      const value = await db.projectRepositorySource.findUnique({
        where: { id: targetId },
        select: {
          userId: true,
          paused: true,
          status: true,
          connection: { select: { status: true, userId: true } },
          project: { select: { organizationId: true } },
        },
      });
      if (!value) throw new AdminJobError(404, 'Repository source not found.');
      await activeOwner(value.userId);
      if (!(await isActiveOrganizationMember(db, value.userId, value.project.organizationId)))
        throw new AdminJobError(
          409,
          'The repository connector no longer has access to its organization. An organization admin must reconnect the source.',
        );
      if (
        value.connection.userId !== value.userId ||
        value.paused ||
        ['disconnected', 'access_removed'].includes(value.status) ||
        value.connection.status !== 'connected'
      )
        throw new AdminJobError(
          409,
          'The owner must reconnect or resume this repository before a retry.',
        );
      return;
    }
    if (kind === 'project_assessment') {
      const value = await db.securityProject.findUnique({
        where: { id: targetId },
        select: { userId: true, organizationId: true },
      });
      if (!value) throw new AdminJobError(404, 'Project not found.');
      await activeOwner(value.userId);
      if (!(await isActiveOrganizationMember(db, value.userId, value.organizationId)))
        throw new AdminJobError(
          409,
          'The original assessment owner no longer has access to this organization. A current organization member can reassess the project.',
        );
      await sourceControls.assertEnabled('OSV');
      return;
    }
    if (kind === 'private_delivery') {
      const value = await db.securityDelivery.findUnique({ where: { id: targetId } });
      if (!value) throw new AdminJobError(404, 'Delivery not found.');
      await activeOwner(value.userId);
      if (value.projectId) {
        const project = await db.securityProject.findUnique({
          where: { id: value.projectId },
          select: { organizationId: true },
        });
        if (
          !project ||
          !(await isActiveOrganizationMember(db, value.userId, project.organizationId))
        )
          throw new AdminJobError(
            409,
            'The alert recipient no longer has access to this organization. This private alert cannot be retried.',
          );
      }
      const block = deliveryRetryBlock(value, now());
      if (block) throw new AdminJobError(409, block);
      if (usesBrevo(env) && brevoRetryBlocked(value, now()))
        throw new AdminJobError(409, BREVO_RECONCILIATION_REQUIRED);
      const [user, settings] = await Promise.all([
        db.user.findUnique({ where: { id: value.userId }, select: { emailVerified: true } }),
        db.securityNotificationSettings.findUnique({ where: { userId: value.userId } }),
      ]);
      if (!user?.emailVerified || !settings?.emailEnabled)
        throw new AdminJobError(
          409,
          'The owner must verify the account email and enable alerts before a retry.',
        );
    } else if (kind === 'public_delivery') {
      const value = await db.publicFeedDelivery.findUnique({
        where: { id: targetId },
        include: { subscriber: { select: { status: true, confirmedAt: true } } },
      });
      if (!value) throw new AdminJobError(404, 'Delivery not found.');
      const block = deliveryRetryBlock(value, now());
      if (block) throw new AdminJobError(409, block);
      if (value.subscriber.status !== 'active' || !value.subscriber.confirmedAt)
        throw new AdminJobError(409, 'Only a confirmed active subscription can receive a retry.');
    } else if (kind === 'feedback_reconcile') {
      const value = await db.publicMailWebhook.findUnique({ where: { id: targetId } });
      if (!value) throw new AdminJobError(404, 'Mail feedback record not found.');
      if (value.status !== 'pending')
        throw new AdminJobError(409, 'Only pending feedback can be reconciled.');
      return;
    } else throw new AdminJobError(400, 'Unsupported operator job.');
    if (!(kind === 'private_delivery' ? workspaceEmailConfigured(env) : env.RESEND_API_KEY))
      throw new AdminJobError(
        409,
        'Email delivery is not configured. Configure it before retrying this delivery.',
      );
  }
  async function list(
    filters: { status?: string; kind?: string; q?: string; cursor?: string; limit?: number } = {},
  ) {
    const take = Math.max(1, Math.min(filters.limit ?? 25, 50));
    const values = await db.intelAdminJob.findMany({
      where: {
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.kind ? { kind: filters.kind } : {}),
        ...(filters.q
          ? {
              OR: [
                { id: { contains: filters.q } },
                { targetId: { contains: filters.q, mode: 'insensitive' } },
                { kind: { contains: filters.q, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(filters.cursor ? { id: { lt: filters.cursor } } : {}),
      },
      orderBy: { id: 'desc' },
      take: take + 1,
    });
    return {
      items: values.slice(0, take).map(jobDto),
      nextCursor: values.length > take ? values[take - 1]!.id : null,
    };
  }
  async function detail(id: string) {
    const value = await db.intelAdminJob.findUnique({
      where: { id },
      include: { attemptRecords: { orderBy: { attempt: 'desc' }, take: MAX_ATTEMPTS } },
    });
    if (!value) throw new AdminJobError(404, 'Operator job not found.');
    return {
      job: jobDto(value),
      attempts: value.attemptRecords.map((item) => ({
        attempt: item.attempt,
        status: item.status,
        error: item.error,
        startedAt: item.startedAt.toISOString(),
        finishedAt: iso(item.finishedAt),
      })),
    };
  }
  async function enqueue(
    actorId: string,
    input: { kind: AdminJobKind; targetId?: string; reason: string },
  ) {
    if (
      !(ADMIN_JOB_KINDS as readonly string[]).includes(input.kind) ||
      input.reason.trim().length < 20 ||
      input.reason.length > 1000 ||
      (input.targetId !== undefined && !/^[a-zA-Z0-9._:-]{1,200}$/.test(input.targetId))
    )
      throw new AdminJobError(400, 'Check the job kind, target, and reason (20–1,000 characters).');
    await actor(actorId);
    const targetId = input.targetId ?? null;
    await validate(input.kind, targetId);
    const activeKey = `${input.kind}:${targetId ?? 'global'}`;
    try {
      const value = await db.$transaction(async (tx) => {
        const actorValue = await tx.user.findUnique({
          where: { id: actorId },
          select: { intelAdmin: true, intelSuspendedAt: true },
        });
        if (!actorValue?.intelAdmin || actorValue.intelSuspendedAt)
          throw new AdminJobError(403, 'Wisesama administrator access is required.');
        const existing = await tx.intelAdminJob.findUnique({ where: { activeKey } });
        if (existing) return { value: existing, deduplicated: true };
        const created = await tx.intelAdminJob.create({
          data: { kind: input.kind, targetId, actorId, reason: input.reason.trim(), activeKey },
        });
        await tx.intelAdminAudit.create({
          data: {
            actorId,
            action: 'job.enqueue',
            targetType: 'job',
            targetId: created.id,
            reason: input.reason.trim(),
            metadata: { kind: input.kind, targetId },
          },
        });
        return { value: created, deduplicated: false };
      });
      return { job: jobDto(value.value), deduplicated: value.deduplicated };
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
        const value = await db.intelAdminJob.findUnique({ where: { activeKey } });
        if (value) return { job: jobDto(value), deduplicated: true };
      }
      throw error;
    }
  }
  async function retry(
    actorId: string,
    id: string,
    input: { reason: string; expectedUpdatedAt: string },
  ) {
    if (
      input.reason.trim().length < 20 ||
      input.reason.length > 1000 ||
      !Number.isFinite(new Date(input.expectedUpdatedAt).getTime())
    )
      throw new AdminJobError(400, 'Provide a reason and the current job revision.');
    await actor(actorId);
    const value = await db.intelAdminJob.findUnique({ where: { id } });
    if (!value) throw new AdminJobError(404, 'Operator job not found.');
    if (value.status !== 'failed' || value.attempts >= MAX_ATTEMPTS)
      throw new AdminJobError(409, 'Only a failed job within its retry limit can be queued again.');
    await validate(value.kind as AdminJobKind, value.targetId);
    try {
      await db.$transaction(async (tx) => {
        const liveActor = await tx.user.findUnique({
          where: { id: actorId },
          select: { intelAdmin: true, intelSuspendedAt: true },
        });
        if (!liveActor?.intelAdmin || liveActor.intelSuspendedAt)
          throw new AdminJobError(403, 'Wisesama administrator access is required.');
        const changed = await tx.intelAdminJob.updateMany({
          where: { id, status: 'failed', updatedAt: new Date(input.expectedUpdatedAt) },
          data: {
            status: 'queued',
            activeKey: `${value.kind}:${value.targetId ?? 'global'}`,
            reason: input.reason.trim(),
            actorId,
            nextAttemptAt: now(),
            error: null,
          },
        });
        if (!changed.count)
          throw new AdminJobError(409, 'This job changed. Reload before retrying.');
        await tx.intelAdminAudit.create({
          data: {
            actorId,
            action: 'job.retry',
            targetType: 'job',
            targetId: id,
            reason: input.reason.trim(),
            metadata: { previousAttempts: value.attempts },
          },
        });
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002')
        throw new AdminJobError(409, 'The same target already has queued or running work.');
      throw error;
    }
    return { job: (await detail(id)).job };
  }
  async function execute(value: Job) {
    const kind = value.kind as AdminJobKind,
      targetId = value.targetId!;
    await validate(kind, value.targetId);
    if (kind === 'source_refresh') {
      await dependencies.probe(targetId as IntelSourceId);
      return;
    }
    if (kind === 'feed_refresh') {
      intelProvider.clearCache();
      const result = await dependencies.refreshFeed();
      if (result.stale || result.sources.some((source) => source.status !== 'healthy'))
        throw new AdminJobError(
          503,
          'Public feed refresh is incomplete or stale. Previous records remain available.',
        );
      return;
    }
    if (kind === 'repository_sync') {
      await dependencies.syncRepository(targetId);
      const outcome = await db.projectRepositorySource.findUniqueOrThrow({
        where: { id: targetId },
        select: { baselineError: true },
      });
      if (outcome.baselineError)
        throw new AdminJobError(
          503,
          'Repository inventory synced, but its configuration baseline remains unavailable. Inspect the source before retrying.',
        );
      return;
    }
    if (kind === 'project_assessment') {
      const project = await db.securityProject.findUniqueOrThrow({
        where: { id: targetId },
        select: { userId: true },
      });
      await dependencies.assessProject(project.userId, targetId);
      return;
    }
    if (kind === 'feedback_reconcile') {
      await db.publicMailWebhook.updateMany({
        where: { id: targetId, status: 'pending' },
        data: { nextAttemptAt: now() },
      });
      await dependencies.feedback(1, undefined, targetId);
      const feedback = await db.publicMailWebhook.findUniqueOrThrow({
        where: { id: targetId },
        select: { status: true },
      });
      if (feedback.status !== 'processed')
        throw new AdminJobError(
          409,
          'Feedback still has no matching send receipt. Reconciliation remains pending.',
        );
      return;
    }
    if (kind === 'private_delivery') {
      const delivery = await db.securityDelivery.findUniqueOrThrow({ where: { id: targetId } });
      const block = deliveryRetryBlock(delivery, now());
      if (block) throw new AdminJobError(409, block);
      if (usesBrevo(env) && brevoRetryBlocked(delivery, now()))
        throw new AdminJobError(409, BREVO_RECONCILIATION_REQUIRED);
      const changed = await db.$transaction(async (tx) => {
        const result = await tx.securityDelivery.updateMany({
          where: {
            id: targetId,
            status: delivery.status,
            attempts: delivery.attempts,
            claimedAt: delivery.claimedAt,
            providerMessageId: null,
            sentAt: null,
          },
          data: {
            nextAttemptAt: now(),
            claimedAt: null,
            ...(delivery.attempts >= 5 ? { attempts: 0 } : {}),
          },
        });
        if (result.count)
          await tx.intelAdminAudit.create({
            data: {
              actorId: value.actorId,
              action: 'delivery.retry',
              targetType: 'private_delivery',
              targetId,
              reason: value.reason,
              metadata: {
                jobId: value.id,
                previousAttempts: delivery.attempts,
                resetAttempts: delivery.attempts >= 5,
              },
            },
          });
        return result;
      });
      if (!changed.count) throw new AdminJobError(409, 'Delivery state changed before retry.');
      await dependencies.privateDeliveries(delivery.userId, 1, targetId);
      const outcome = await db.securityDelivery.findUniqueOrThrow({
        where: { id: targetId },
        select: { status: true },
      });
      if (outcome.status !== 'sent')
        throw new AdminJobError(
          503,
          outcome.status === 'skipped'
            ? 'Delivery was skipped because its account preferences changed.'
            : 'The email provider has not accepted this delivery. Inspect the target error before retrying.',
        );
      return;
    }
    if (kind === 'public_delivery') {
      const delivery = await db.publicFeedDelivery.findUniqueOrThrow({ where: { id: targetId } });
      const block = deliveryRetryBlock(delivery, now());
      if (block) throw new AdminJobError(409, block);
      const changed = await db.$transaction(async (tx) => {
        const result = await tx.publicFeedDelivery.updateMany({
          where: {
            id: targetId,
            status: delivery.status,
            attempts: delivery.attempts,
            claimedAt: delivery.claimedAt,
            providerMessageId: null,
            sentAt: null,
          },
          data: {
            nextAttemptAt: now(),
            claimedAt: null,
            ...(delivery.attempts >= 5 ? { attempts: 0 } : {}),
          },
        });
        if (result.count)
          await tx.intelAdminAudit.create({
            data: {
              actorId: value.actorId,
              action: 'delivery.retry',
              targetType: 'public_delivery',
              targetId,
              reason: value.reason,
              metadata: {
                jobId: value.id,
                previousAttempts: delivery.attempts,
                resetAttempts: delivery.attempts >= 5,
              },
            },
          });
        return result;
      });
      if (!changed.count) throw new AdminJobError(409, 'Delivery state changed before retry.');
      await dependencies.publicDeliveries(1, targetId);
      const outcome = await db.publicFeedDelivery.findUniqueOrThrow({
        where: { id: targetId },
        select: { status: true },
      });
      if (outcome.status !== 'sent')
        throw new AdminJobError(
          503,
          outcome.status === 'skipped'
            ? 'Delivery was skipped because its subscription or public advisory visibility changed.'
            : 'The email provider has not accepted this delivery. Inspect the target error before retrying.',
        );
    }
  }
  async function run(id: string, requestedBy?: string) {
    if (requestedBy) await actor(requestedBy);
    const saved = await db.intelAdminJob.findUnique({ where: { id } });
    if (!saved) throw new AdminJobError(404, 'Operator job not found.');
    if (saved.status !== 'queued')
      throw new AdminJobError(409, 'This job is already running or completed.');
    async function blockQueued() {
      await db.$transaction(async (tx) => {
        const changed = await tx.intelAdminJob.updateMany({
          where: { id, status: 'queued' },
          data: {
            status: 'failed',
            activeKey: null,
            finishedAt: now(),
            error:
              'The requesting administrator no longer has access. An authorized operator must review and retry this intent.',
          },
        });
        if (changed.count)
          await tx.intelAdminAudit.create({
            data: {
              action: 'job.blocked',
              targetType: 'job',
              targetId: id,
              reason: 'Queued authority is missing or revoked; execution was prevented.',
              metadata: { requestingActorId: saved!.actorId },
            },
          });
      });
      return { job: (await detail(id)).job };
    }
    if (!saved.actorId) return blockQueued();
    // Revocation while work is queued prevents its later privileged execution.
    try {
      await actor(saved.actorId);
    } catch (error) {
      if (error instanceof AdminJobError && error.statusCode === 403) return blockQueued();
      throw error;
    }
    const token = randomUUID(),
      startedAt = now(),
      attempt = saved.attempts + 1;
    const claimed = await db.$transaction(async (tx) => {
      const liveActor = await tx.user.findUnique({
        where: { id: saved.actorId! },
        select: { intelAdmin: true, intelSuspendedAt: true },
      });
      if (!liveActor?.intelAdmin || liveActor.intelSuspendedAt)
        throw new AdminJobError(403, 'Wisesama administrator access is required.');
      const changed = await tx.intelAdminJob.updateMany({
        where: {
          id,
          status: 'queued',
          attempts: saved.attempts,
          nextAttemptAt: { lte: startedAt },
          leaseToken: null,
        },
        data: {
          status: 'running',
          attempts: { increment: 1 },
          startedAt,
          finishedAt: null,
          leaseToken: token,
          leaseStartedAt: startedAt,
          error: null,
        },
      });
      if (!changed.count) return false;
      await tx.intelAdminJobAttempt.create({
        data: { jobId: id, attempt, status: 'running', startedAt },
      });
      if (requestedBy)
        await tx.intelAdminAudit.create({
          data: {
            actorId: requestedBy,
            action: 'job.run',
            targetType: 'job',
            targetId: id,
            reason: saved.reason,
            metadata: { attempt, kind: saved.kind, targetId: saved.targetId },
          },
        });
      return true;
    });
    if (!claimed)
      throw new AdminJobError(409, 'This job is already running, completed, or not due.');
    let error: string | null = null;
    try {
      await execute(saved);
    } catch (caught) {
      error = safeOperationError(caught);
    }
    await db.$transaction(async (tx) => {
      const changed = await tx.intelAdminJob.updateMany({
        where: { id, leaseToken: token, status: 'running' },
        data: {
          status: error ? 'failed' : 'succeeded',
          error,
          finishedAt: now(),
          leaseToken: null,
          leaseStartedAt: null,
          activeKey: null,
        },
      });
      if (changed.count)
        await tx.intelAdminJobAttempt.updateMany({
          where: { jobId: id, attempt, status: 'running' },
          data: { status: error ? 'failed' : 'succeeded', error, finishedAt: now() },
        });
    });
    return { job: (await detail(id)).job };
  }
  async function recoverExpired() {
    const expired = await db.intelAdminJob.findMany({
      where: { status: 'running', leaseStartedAt: { lt: new Date(now().getTime() - LEASE_MS) } },
      take: 20,
    });
    for (const value of expired)
      await db.$transaction(async (tx) => {
        const error =
          'The worker lease expired before completion. Inspect target state before retrying; work may have completed.';
        const changed = await tx.intelAdminJob.updateMany({
          where: { id: value.id, status: 'running', leaseToken: value.leaseToken },
          data: {
            status: 'failed',
            activeKey: null,
            leaseToken: null,
            leaseStartedAt: null,
            finishedAt: now(),
            error,
          },
        });
        if (changed.count)
          await tx.intelAdminJobAttempt.updateMany({
            where: { jobId: value.id, attempt: value.attempts, status: 'running' },
            data: { status: 'failed', error, finishedAt: now() },
          });
      });
  }
  async function runPending(limit = 3) {
    await recoverExpired();
    const values = await db.intelAdminJob.findMany({
      where: { status: 'queued', nextAttemptAt: { lte: now() } },
      orderBy: { createdAt: 'asc' },
      take: Math.max(1, Math.min(limit, 5)),
    });
    const results = [];
    for (const value of values) {
      try {
        results.push((await run(value.id)).job);
      } catch (error) {
        if (error instanceof AdminJobError && error.statusCode === 403) {
          await db.intelAdminJob.updateMany({
            where: { id: value.id, status: 'queued' },
            data: {
              status: 'failed',
              activeKey: null,
              error: 'The requesting administrator no longer has access.',
              finishedAt: now(),
            },
          });
        }
      }
    }
    return { attempted: values.length, jobs: results };
  }
  async function failures() {
    const [repos, projects, privateMail, publicMail, feedback] = await Promise.all([
      db.projectRepositorySource.findMany({
        where: { OR: [{ error: { not: null } }, { baselineError: { not: null } }] },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: {
          id: true,
          repositoryName: true,
          userId: true,
          error: true,
          baselineError: true,
          baselineAttemptedAt: true,
          lastAttemptAt: true,
          updatedAt: true,
          paused: true,
          status: true,
        },
      }),
      db.securityProject.findMany({
        where: { scanError: { not: null } },
        orderBy: { updatedAt: 'desc' },
        take: 20,
        select: { id: true, name: true, userId: true, scanError: true, updatedAt: true },
      }),
      db.securityDelivery.findMany({
        where: { status: { in: ['failed', 'unavailable'] } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      db.publicFeedDelivery.findMany({
        where: { status: { in: ['failed', 'unavailable'] } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      db.publicMailWebhook.findMany({
        where: { status: 'pending', lastError: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
    ]);
    const candidates = [
      ...repos.map((value) => ({
        id: `repository:${value.id}`,
        kind: 'repository_sync' as const,
        targetId: value.id,
        label: value.repositoryName,
        ownerLabel: value.userId,
        error: value.error ?? value.baselineError,
        failedAt: (value.baselineError
          ? (value.baselineAttemptedAt ?? value.lastAttemptAt ?? value.updatedAt)
          : (value.lastAttemptAt ?? value.updatedAt)
        ).toISOString(),
      })),
      ...projects.map((value) => ({
        id: `assessment:${value.id}`,
        kind: 'project_assessment' as const,
        targetId: value.id,
        label: value.name,
        ownerLabel: value.userId,
        error: value.scanError,
        failedAt: value.updatedAt.toISOString(),
      })),
      ...privateMail.map((value) => ({
        id: `private_delivery:${value.id}`,
        kind: 'private_delivery' as const,
        targetId: value.id,
        label: 'Private project alert',
        ownerLabel: value.userId,
        error: value.error,
        failedAt: value.createdAt.toISOString(),
      })),
      ...publicMail.map((value) => ({
        id: `public_delivery:${value.id}`,
        kind: 'public_delivery' as const,
        targetId: value.id,
        label: 'Public feed digest',
        ownerLabel: value.subscriberId,
        error: value.error,
        failedAt: value.createdAt.toISOString(),
      })),
      ...feedback.map((value) => ({
        id: `feedback:${value.id}`,
        kind: 'feedback_reconcile' as const,
        targetId: value.id,
        label: 'Mail feedback reconciliation',
        ownerLabel: null,
        error: value.lastError,
        failedAt: value.createdAt.toISOString(),
      })),
    ].sort((a, b) => b.failedAt.localeCompare(a.failedAt));
    const items = [];
    for (const candidate of candidates) {
      let blockedReason: string | null = null;
      try {
        await validate(candidate.kind, candidate.targetId);
      } catch (error) {
        blockedReason = safeOperationError(error);
      }
      items.push({ ...candidate, retryable: !blockedReason, blockedReason });
    }
    return { items, limit: 100 };
  }
  /** Scheduled infrastructure stages are recorded without an administrator or raw payload. */
  async function recordScheduledStage<T>(kind: string, executeStage: () => Promise<T>) {
    const startedAt = now();
    const value = await db.intelAdminJob.create({
      data: {
        kind: `scheduled_${kind}`,
        status: 'running',
        reason: 'Signed security-response scheduler stage.',
        attempts: 1,
        startedAt,
        leaseStartedAt: startedAt,
        leaseToken: randomUUID(),
        attemptRecords: { create: { attempt: 1, status: 'running', startedAt } },
      },
    });
    try {
      const result = await executeStage();
      const failures = countFailures(result);
      if (failures)
        throw new AdminJobError(
          503,
          `Scheduler stage reported ${failures} failed or unavailable operations. Inspect failed work for exact targets.`,
        );
      await db.$transaction([
        db.intelAdminJob.update({
          where: { id: value.id },
          data: { status: 'succeeded', finishedAt: now(), leaseStartedAt: null, leaseToken: null },
        }),
        db.intelAdminJobAttempt.update({
          where: { jobId_attempt: { jobId: value.id, attempt: 1 } },
          data: { status: 'succeeded', finishedAt: now() },
        }),
      ]);
      return { status: 'succeeded', result };
    } catch (error) {
      const safe = safeOperationError(error);
      await db.$transaction([
        db.intelAdminJob.update({
          where: { id: value.id },
          data: {
            status: 'failed',
            finishedAt: now(),
            error: safe,
            leaseStartedAt: null,
            leaseToken: null,
          },
        }),
        db.intelAdminJobAttempt.update({
          where: { jobId_attempt: { jobId: value.id, attempt: 1 } },
          data: { status: 'failed', error: safe, finishedAt: now() },
        }),
      ]);
      return { status: 'failed', error: safe };
    }
  }
  function countFailures(value: unknown, depth = 0): number {
    if (!value || depth > 5) return 0;
    if (Array.isArray(value))
      return value.slice(0, 1000).reduce((sum, item) => sum + countFailures(item, depth + 1), 0);
    if (typeof value !== 'object') return 0;
    const record = value as Record<string, unknown>;
    if (record.status === 'failed' || record.status === 'unavailable') return 1;
    if (typeof record.attempted === 'number' && typeof record.accepted === 'number') {
      return ['failed', 'unavailable'].reduce(
        (sum, key) =>
          sum +
          (typeof record[key] === 'number' &&
          Number.isSafeInteger(record[key]) &&
          Number(record[key]) > 0
            ? Number(record[key])
            : 0),
        0,
      );
    }
    return Object.values(record)
      .slice(0, 100)
      .reduce<number>((sum, item) => sum + countFailures(item, depth + 1), 0);
  }
  return { list, detail, enqueue, retry, run, runPending, failures, recordScheduledStage };
}
export const adminJobService = createAdminJobService();
