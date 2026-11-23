/** Explicitly synthetic local UI fixture. No intelligence, email, or job execution is performed. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, unlink, writeFile } from 'node:fs/promises';

const database = process.env.INTEL_TEST_DATABASE_URL;
if (!database)
  throw new Error('Set INTEL_TEST_DATABASE_URL explicitly to the disposable local database.');
const url = new URL(database);
if (
  !['postgres:', 'postgresql:'].includes(url.protocol) ||
  !['localhost', '127.0.0.1'].includes(url.hostname) ||
  url.pathname !== '/wisesama_intel' ||
  url.searchParams.has('host') ||
  url.searchParams.has('socket')
)
  throw new Error('Only the disposable loopback wisesama_intel database is allowed.');
process.env.DATABASE_URL = database;
const { prisma: db } = await import('@wisesama/database');
const path = '/private/tmp/wisesama-admin-preview.json';
type Account = { id: string; email: string; password: string };
type Fixture = {
  run: string;
  operator: Account | null;
  customer: Account | null;
  projectId: string | null;
  advisoryIds: string[];
  subscriberIds: { active?: string; pending?: string; suppressed?: string };
  jobId: string | null;
  privateDeliveryId: string | null;
  publicDeliveryId: string | null;
  feedbackId: string | null;
  pendingFeedbackId?: string;
  signupPrivilegeInjectionRejected: boolean;
};
export type AdminPreviewFixture = Fixture;
const persist = (fixture: Fixture) =>
  writeFile(path, JSON.stringify(fixture, null, 2), { mode: 0o600 });

try {
  if (process.argv.includes('--cleanup')) {
    const saved = JSON.parse(await readFile(path, 'utf8')) as Fixture;
    if (!/^[a-f0-9-]{36}$/.test(saved.run)) throw new Error('Unexpected fixture manifest.');
    const users = [saved.operator?.id, saved.customer?.id].filter((value): value is string =>
      Boolean(value),
    );
    const subscriberIds = Object.values(saved.subscriberIds);
    const targets = [
      ...users,
      ...saved.advisoryIds,
      ...subscriberIds,
      saved.projectId,
      saved.jobId,
      saved.privateDeliveryId,
      saved.publicDeliveryId,
      saved.pendingFeedbackId,
    ].filter((value): value is string => Boolean(value));
    const removed = await db.$transaction(async (tx) => {
      const actual = await tx.user.findMany({
        where: { id: { in: users } },
        select: { id: true, email: true },
      });
      if (actual.some((user) => !user.email.endsWith(`-${saved.run}@example.invalid`)))
        throw new Error('Refusing to remove an account outside the synthetic fixture.');
      await tx.intelAdminAudit.deleteMany({
        where: { OR: [{ actorId: { in: users } }, { targetId: { in: targets } }] },
      });
      await tx.intelAdminJob.deleteMany({
        where: { OR: [{ actorId: { in: users } }, ...(saved.jobId ? [{ id: saved.jobId }] : [])] },
      });
      const feedbackIds = [saved.feedbackId, saved.pendingFeedbackId].filter(
        (value): value is string => Boolean(value),
      );
      if (feedbackIds.length)
        await tx.publicMailWebhook.deleteMany({ where: { id: { in: feedbackIds } } });
      await tx.publicSubscriber.deleteMany({ where: { id: { in: subscriberIds } } });
      await tx.securityAdvisory.deleteMany({ where: { id: { in: saved.advisoryIds } } });
      return tx.user.deleteMany({ where: { id: { in: users } } });
    });
    assert.equal(await db.user.count({ where: { id: { in: users } } }), 0);
    await unlink(path);
    console.log(
      `Removed ${removed.count} synthetic accounts and their fixture records; temporary credentials deleted.`,
    );
  } else if (process.argv.includes('--pending-feedback')) {
    const saved = JSON.parse(await readFile(path, 'utf8')) as Fixture;
    if (!/^[a-f0-9-]{36}$/.test(saved.run) || !saved.operator?.id)
      throw new Error('A complete synthetic fixture is required.');
    const operator = await db.user.findUniqueOrThrow({
      where: { id: saved.operator.id },
      select: { email: true },
    });
    if (!operator.email.endsWith(`-${saved.run}@example.invalid`))
      throw new Error('Unexpected fixture operator.');
    if (saved.pendingFeedbackId) throw new Error('A pending feedback fixture is already tracked.');
    saved.pendingFeedbackId = `synthetic-pending-feedback-${saved.run}`;
    await persist(saved);
    await db.publicMailWebhook.create({
      data: {
        id: saved.pendingFeedbackId,
        type: 'email.bounced',
        providerMessageId: `synthetic-unmatched-${saved.run}`,
        status: 'pending',
        attempts: 1,
        nextAttemptAt: new Date(),
        lastError:
          'Synthetic fixture: no matching send receipt exists. Reconciliation must remain pending.',
      },
    });
    console.log(
      `Pending feedback fixture is tracked as pendingFeedbackId in ${path}. No provider request or email was made.`,
    );
  } else {
    const preview = await fetch('http://localhost:3001/api/v1/intel/admin/session', {
      redirect: 'error',
      signal: AbortSignal.timeout(5000),
    });
    if (preview.headers.get('x-wisesama-local-preview') !== 'disposable-wisesama_intel')
      throw new Error('Start the guarded local preview API before creating synthetic accounts.');
    try {
      await readFile(path);
      throw new Error('A preview manifest already exists. Clean up that fixture first.');
    } catch (error) {
      if (!(error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT'))
        throw error;
    }
    const run = randomUUID();
    const fixture: Fixture = {
      run,
      operator: null,
      customer: null,
      projectId: null,
      advisoryIds: [],
      subscriberIds: {},
      jobId: null,
      privateDeliveryId: null,
      publicDeliveryId: null,
      feedbackId: null,
      signupPrivilegeInjectionRejected: false,
    };
    await persist(fixture);
    async function account(kind: 'operator' | 'customer') {
      const email = `synthetic-admin-${kind}-${run}@example.invalid`;
      const password = randomBytes(24).toString('base64url');
      const response = await fetch('http://localhost:3001/api/auth/sign-up/email', {
        method: 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
        headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3003' },
        body: JSON.stringify({
          email,
          password,
          name: kind === 'operator' ? 'Synthetic Wisesama operator' : 'Synthetic customer account',
          intelAdmin: true,
        }),
      });
      if (!response.ok) throw new Error(`Synthetic account signup failed (${response.status}).`);
      const result = (await response.json()) as { user: { id: string } };
      const record = await db.user.findUniqueOrThrow({
        where: { id: result.user.id },
        select: { intelAdmin: true },
      });
      fixture[kind] = { id: result.user.id, email, password };
      await persist(fixture);
      assert.equal(record.intelAdmin, false, 'Client signup must not grant v2 admin privileges.');
      return result.user.id;
    }
    const operatorId = await account('operator');
    const customerId = await account('customer');
    fixture.signupPrivilegeInjectionRejected = true;
    await db.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: operatorId },
        data: { intelAdmin: true, intelRevision: { increment: 1 } },
      });
      await tx.user.update({ where: { id: customerId }, data: { role: 'ADMIN' } });
      await tx.intelAdminAudit.create({
        data: {
          actorId: operatorId,
          action: 'operator.synthetic_fixture_grant',
          targetType: 'user',
          targetId: operatorId,
          reason:
            'Explicit synthetic local preview grant; no production account or permission was changed.',
          metadata: { synthetic: true, run },
        },
      });
    });
    const now = new Date();
    const future = new Date(now.getTime() + 365 * 24 * 60 * 60_000);
    const project = await db.securityProject.create({
      data: {
        userId: customerId,
        name: 'Synthetic checkout API',
        environment: 'staging',
        packages: [{ ecosystem: 'npm', name: 'synthetic-widget', version: '1.0.0' }],
        scanError:
          'Synthetic fixture: advisory source could not be reached. Previous evidence remains available.',
        lastScannedAt: new Date(now.getTime() - 3_600_000),
        nextScanAt: future,
      },
    });
    fixture.projectId = project.id;
    await persist(fixture);
    for (let index = 1; index <= 2; index++) {
      const id = `TEST-ADMIN-${index}-${run}`;
      await db.securityAdvisory.create({
        data: {
          id,
          aliases: [`TEST-ALIAS-${index}-${run}`],
          fetchedAt: now,
          data: {
            id,
            aliases: [`TEST-ALIAS-${index}-${run}`],
            title:
              index === 1
                ? 'Synthetic dependency request validation issue'
                : 'Synthetic server configuration advisory',
            summary:
              'Clearly labelled local test record. This is not a real vulnerability, affected package, or incident.',
            severity: index === 1 ? 'high' : 'medium',
            cvss: null,
            exploited: false,
            exploitationStatus: 'unknown',
            epss: null,
            publishedAt: now.toISOString(),
            modifiedAt: now.toISOString(),
            references: [{ url: 'https://example.invalid/synthetic-fixture', type: 'ADVISORY' }],
            affected: [
              {
                ecosystem: 'npm',
                name: 'synthetic-widget',
                ranges: ['>=1.0.0 <1.1.0'],
                fixedVersion: '1.1.0',
              },
            ],
            source: 'Synthetic local fixture',
          },
        },
      });
      fixture.advisoryIds.push(id);
      await persist(fixture);
    }
    for (const status of ['active', 'pending', 'suppressed'] as const) {
      const subscriber = await db.publicSubscriber.create({
        data: {
          email: `synthetic-${status}-${run}@example.invalid`,
          status,
          topics: status === 'pending' ? ['npm'] : ['all'],
          confirmedAt: status === 'pending' ? null : now,
          nextDigestAt: status === 'active' ? future : null,
        },
      });
      fixture.subscriberIds[status] = subscriber.id;
      await persist(fixture);
    }
    const privateDelivery = await db.securityDelivery.create({
      data: {
        userId: customerId,
        projectId: project.id,
        eventKey: `synthetic-private-${run}`,
        subject: 'Synthetic private assessment delivery',
        body: 'Synthetic local fixture only. No message should be sent.',
        status: 'failed',
        attempts: 2,
        nextAttemptAt: future,
        error: 'Synthetic fixture: delivery was not accepted. Email is disabled in this preview.',
      },
    });
    fixture.privateDeliveryId = privateDelivery.id;
    await persist(fixture);
    const publicDelivery = await db.publicFeedDelivery.create({
      data: {
        subscriberId: fixture.subscriberIds.active!,
        eventKey: `synthetic-public-${run}`,
        items: [],
        subject: 'Synthetic public digest delivery',
        status: 'failed',
        attempts: 1,
        nextAttemptAt: future,
        error: 'Synthetic fixture: email delivery is disabled in this preview.',
      },
    });
    fixture.publicDeliveryId = publicDelivery.id;
    await persist(fixture);
    const receipt = `synthetic-receipt-${run}`;
    await db.publicMailReceipt.create({
      data: { id: receipt, subscriberId: fixture.subscriberIds.suppressed! },
    });
    const feedback = await db.publicMailWebhook.create({
      data: {
        id: `synthetic-feedback-${run}`,
        type: 'email.bounced',
        providerMessageId: receipt,
        status: 'processed',
        attempts: 1,
        processedAt: now,
      },
    });
    fixture.feedbackId = feedback.id;
    await persist(fixture);
    const started = new Date(now.getTime() - 20 * 60_000);
    const job = await db.intelAdminJob.create({
      data: {
        kind: 'source_refresh',
        targetId: 'osv',
        actorId: operatorId,
        reason: 'Synthetic local failed-job fixture. No provider request was made.',
        status: 'failed',
        attempts: 1,
        nextAttemptAt: future,
        startedAt: started,
        finishedAt: new Date(started.getTime() + 1000),
        error: 'Synthetic fixture: source refresh timed out. Review configuration before retrying.',
        attemptRecords: {
          create: {
            attempt: 1,
            status: 'failed',
            startedAt: started,
            finishedAt: new Date(started.getTime() + 1000),
            error: 'Synthetic fixture: no upstream request was made.',
          },
        },
      },
    });
    fixture.jobId = job.id;
    await persist(fixture);
    console.log(
      `Synthetic local preview fixture ready. Credentials and exact IDs are stored at ${path}.`,
    );
  }
} finally {
  await db.$disconnect();
}
