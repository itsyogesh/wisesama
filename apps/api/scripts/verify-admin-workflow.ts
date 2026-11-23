/** Real PostgreSQL operator workflow with synthetic providers and mail. No production configuration. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const database = process.env.INTEL_TEST_DATABASE_URL;
if (!database) throw new Error('Set INTEL_TEST_DATABASE_URL to the disposable local database.');
const databaseUrl = new URL(database);
if (
  !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
  !['localhost', '127.0.0.1'].includes(databaseUrl.hostname) ||
  databaseUrl.pathname !== '/wisesama_intel' ||
  databaseUrl.searchParams.has('host') ||
  databaseUrl.searchParams.has('socket')
)
  throw new Error('Only the disposable loopback wisesama_intel database is allowed.');
process.env.DATABASE_URL = database;
const { prisma: db } = await import('@wisesama/database');
const { createIntelAdminService } = await import('../src/services/admin.service');
const { createSourceControlService } = await import('../src/services/source-control.service');
const { createAdminJobService } = await import('../src/services/admin-job.service');
const { createIntelWorkspaceService } = await import('../src/services/intel-workspace.service');
const { PublicSubscriptionService } = await import('../src/services/public-subscription.service');
const run = randomUUID();
const operatorId = `admin-verify-${run}`,
  targetId = `admin-target-${run}`,
  advisoryId = `TEST-ADMIN-${run}`,
  aliasId = `TEST-ADMIN-ALIAS-${run}`;
let subscriberId = '',
  publicDeliveryId = '';
const jobIds: string[] = [];
const savedSource = await db.intelSourceControl.findUnique({ where: { id: 'osv' } });
const admin = createIntelAdminService({ db });
const sources = createSourceControlService({ db });
const status = (error: unknown, code: number) =>
  Boolean(error && typeof error === 'object' && 'statusCode' in error && error.statusCode === code);
try {
  await db.user.createMany({
    data: [
      {
        id: operatorId,
        email: `admin-${run}@example.invalid`,
        name: 'Synthetic admin verification',
        intelAdmin: true,
      },
      {
        id: targetId,
        email: `target-${run}@example.invalid`,
        name: 'Synthetic target verification',
        role: 'ADMIN',
        emailVerified: true,
      },
    ],
  });
  await db.securityProject.create({
    data: {
      userId: targetId,
      name: 'Synthetic admin project',
      environment: 'development',
      scanError: 'Synthetic assessment failed.',
    },
  });
  const user = (await admin.user(targetId)).user;
  assert.equal(user.intelAdmin, false, 'Dotsama ADMIN must not imply v2 operator access.');
  await assert.rejects(
    admin.access(targetId, operatorId, {
      suspended: false,
      expectedRevision: 0,
      reason: 'Synthetic unauthorized access check',
    }),
    (error) => status(error, 403),
  );
  await assert.rejects(
    admin.access(operatorId, operatorId, {
      suspended: true,
      expectedRevision: 0,
      reason: 'Synthetic self suspension check',
    }),
    (error) => status(error, 409),
  );
  const suspended = (
    await admin.access(operatorId, targetId, {
      suspended: true,
      expectedRevision: user.revision,
      reason: 'Synthetic access suspension verification',
    })
  ).user;
  assert.equal(suspended.status, 'suspended');
  assert.equal((await db.user.findUniqueOrThrow({ where: { id: targetId } })).role, 'ADMIN');
  await assert.rejects(
    admin.access(operatorId, targetId, {
      suspended: false,
      expectedRevision: user.revision,
      reason: 'Synthetic stale revision check',
    }),
    (error) => status(error, 409),
  );
  await admin.access(operatorId, targetId, {
    suspended: false,
    expectedRevision: suspended.revision,
    reason: 'Synthetic access restored after check',
  });
  const now = new Date();
  const advisory = {
    id: advisoryId,
    aliases: [],
    title: 'Synthetic admin advisory',
    summary: 'Synthetic source facts for a local operator workflow.',
    severity: 'high' as const,
    cvss: 8.1,
    exploited: false,
    epss: null,
    publishedAt: now.toISOString(),
    modifiedAt: now.toISOString(),
    references: [{ url: 'https://example.invalid/synthetic' }],
    affected: [{ ecosystem: 'npm', name: 'synthetic-package', fixedVersion: '1.0.1' }],
    source: 'Synthetic verification',
  };
  await db.securityAdvisory.create({ data: { id: advisoryId, data: advisory } });
  const alias = { ...advisory, id: aliasId, aliases: [advisoryId] };
  await db.securityAdvisory.create({ data: { id: aliasId, aliases: alias.aliases, data: alias } });
  const workspace = createIntelWorkspaceService({
    db,
    provider: {
      getBriefings: async () => ({
        advisories: [advisory, alias],
        sources: [],
        fetchedAt: now.toISOString(),
      }),
      scan: async () => ({ matches: [], sources: [], warnings: [], scannedAt: now.toISOString() }),
    },
    mail: async () => {
      throw new Error('Mail must not run in this verification.');
    },
  });
  const review = (
    await admin.review(operatorId, advisoryId, {
      expectedRevision: 0,
      visibility: 'published',
      guidance: 'Synthetic editorial response guidance.',
      note: 'Internal-only synthetic note.',
      reason: 'Synthetic editorial review verification',
    })
  ).advisory.review;
  assert.equal(
    (await workspace.getBriefing(advisoryId)).editorial?.guidance,
    'Synthetic editorial response guidance.',
  );
  await admin.review(operatorId, advisoryId, {
    expectedRevision: review.revision,
    visibility: 'hidden',
    guidance: review.guidance,
    note: 'Internal-only synthetic note.',
    reason: 'Synthetic public visibility verification',
  });
  assert.equal((await workspace.getBriefings()).advisories.length, 0);
  await assert.rejects(workspace.getBriefing(advisoryId), (error) => status(error, 404));
  await assert.rejects(workspace.getBriefing(aliasId), (error) => status(error, 404));
  const unavailable = createIntelWorkspaceService({
    db,
    provider: {
      getBriefings: async () => {
        throw new Error('Synthetic source outage.');
      },
      scan: async () => {
        throw new Error('Not used.');
      },
    },
  });
  const fallback = await unavailable.getBriefings();
  assert.equal(fallback.stale, true);
  assert.ok(
    !fallback.advisories.some((item) => [advisoryId, aliasId].includes(item.id)),
    'Alias records must remain hidden in cached fallback.',
  );
  const stored = (await db.securityAdvisory.findUniqueOrThrow({ where: { id: advisoryId } }))
    .data as { title: string };
  assert.equal(
    stored.title,
    advisory.title,
    'Operator guidance must not mutate authoritative source data.',
  );
  const subscriber = await db.publicSubscriber.create({
    data: { email: `sub-${run}@example.invalid`, status: 'active', confirmedAt: now },
  });
  subscriberId = subscriber.id;
  const edition = await db.publicFeedDelivery.create({
    data: {
      subscriberId,
      eventKey: `admin-verify-${run}`,
      subject: 'Synthetic hidden edition',
      items: { advisories: [alias], omitted: 0 },
    },
  });
  publicDeliveryId = edition.id;
  let sent = 0;
  const publicMail = new PublicSubscriptionService(db, {
    send: async () => {
      sent++;
      return { status: 'sent', messageId: 'must-not-be-sent' };
    },
    getBriefings: workspace.getBriefings,
  });
  await publicMail.processDeliveries(1, publicDeliveryId);
  assert.equal(sent, 0);
  assert.equal(
    (await db.publicFeedDelivery.findUniqueOrThrow({ where: { id: publicDeliveryId } })).status,
    'skipped',
  );
  const sub = (await admin.subscription(subscriberId)).subscriber;
  await admin.subscriptionStatus(operatorId, subscriberId, {
    status: 'suppressed',
    expectedRevision: sub.revision,
    reason: 'Synthetic consent protection verification',
  });
  await assert.rejects(
    admin.subscriptionStatus(operatorId, subscriberId, {
      status: 'unsubscribed',
      expectedRevision: sub.revision + 1,
      reason: 'Synthetic no unsuppression verification',
    }),
    (error) => status(error, 409),
  );
  const before = (await sources.list()).items.find((item) => item.id === 'osv')!;
  const paused = (
    await sources.update(operatorId, 'osv', {
      paused: true,
      expectedRevision: before.revision,
      reason: 'Synthetic source pause verification',
    })
  ).source;
  await assert.rejects(sources.assertEnabled('OSV'), (error) => status(error, 409));
  await assert.rejects(
    sources.update(operatorId, 'osv', {
      paused: false,
      expectedRevision: before.revision,
      reason: 'Synthetic stale source revision check',
    }),
    (error) => status(error, 409),
  );
  await sources.update(operatorId, 'osv', {
    paused: false,
    expectedRevision: paused.revision,
    reason: 'Synthetic source resumed after check',
  });
  let failProbe = true,
    probes = 0;
  const jobs = createAdminJobService({
    db,
    env: {},
    probe: async () => {
      probes++;
      if (failProbe) throw new Error('Synthetic source unavailable');
    },
    refreshFeed: workspace.getBriefings,
  });
  const queued = (
    await jobs.enqueue(operatorId, {
      kind: 'source_refresh',
      targetId: 'osv',
      reason: 'Synthetic exact source job verification',
    })
  ).job;
  jobIds.push(queued.id);
  assert.equal(
    (
      await jobs.enqueue(operatorId, {
        kind: 'source_refresh',
        targetId: 'osv',
        reason: 'Synthetic duplicate queue request verification',
      })
    ).deduplicated,
    true,
  );
  const failed = (await jobs.run(queued.id, operatorId)).job;
  assert.equal(failed.status, 'failed');
  assert.equal(probes, 1);
  assert.equal((await jobs.detail(queued.id)).attempts.length, 1);
  const retry = (
    await jobs.retry(operatorId, queued.id, {
      expectedUpdatedAt: failed.updatedAt,
      reason: 'Synthetic source recovery retry verification',
    })
  ).job;
  assert.equal(retry.status, 'queued');
  failProbe = false;
  const attempts = await Promise.allSettled([
    jobs.run(queued.id, operatorId),
    jobs.run(queued.id, operatorId),
  ]);
  assert.equal(attempts.filter((item) => item.status === 'fulfilled').length, 1);
  assert.equal((await jobs.detail(queued.id)).job.status, 'succeeded');
  assert.equal(probes, 2);
  const revokedJob = (
    await jobs.enqueue(operatorId, {
      kind: 'source_refresh',
      targetId: 'osv',
      reason: 'Synthetic operator revocation verification',
    })
  ).job;
  jobIds.push(revokedJob.id);
  await db.user.update({ where: { id: operatorId }, data: { intelAdmin: false } });
  await assert.rejects(jobs.run(revokedJob.id, operatorId), (error) => status(error, 403));
  await assert.rejects(
    admin.review(operatorId, advisoryId, {
      expectedRevision: 2,
      visibility: 'published',
      guidance: '',
      note: '',
      reason: 'Synthetic revoked operator verification',
    }),
    (error) => status(error, 403),
  );
  assert.equal(probes, 2);
  const audit = await db.intelAdminAudit.findMany({ where: { actorId: operatorId } });
  assert.ok(audit.length >= 10);
  assert.ok(audit.every((event) => event.reason.length >= 10));
  assert.ok(!JSON.stringify(audit).includes('Internal-only synthetic note.'));
  console.log(
    'PASS: real database v2-only access, source facts/editorial visibility, consent, hidden queued editions, source revision/pause, durable jobs/retry/claim, operator revocation, and transactional audit. Synthetic providers only.',
  );
} finally {
  await db.intelAdminJob.deleteMany({ where: { id: { in: jobIds } } });
  await db.intelAdminAudit.deleteMany({ where: { actorId: operatorId } });
  if (subscriberId) await db.publicSubscriber.deleteMany({ where: { id: subscriberId } });
  await db.securityAdvisory.deleteMany({ where: { id: { in: [advisoryId, aliasId] } } });
  await db.user.deleteMany({ where: { id: { in: [operatorId, targetId] } } });
  if (savedSource) {
    const { id, ...data } = savedSource;
    await db.intelSourceControl.upsert({ where: { id }, create: savedSource, update: data });
  } else await db.intelSourceControl.deleteMany({ where: { id: 'osv' } });
  await db.$disconnect();
}
