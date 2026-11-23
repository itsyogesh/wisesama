/** Actual HTTP verification against the guarded disposable preview. Never executes a job or sends mail. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import type { intelAdminService } from '../src/services/admin.service';
import type { sourceControlService } from '../src/services/source-control.service';
import type { AdminPreviewFixture } from './preview-admin-fixture';

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
const fixture = JSON.parse(
  await readFile('/private/tmp/wisesama-admin-preview.json', 'utf8'),
) as AdminPreviewFixture;
if (
  !fixture.operator ||
  !fixture.customer ||
  !fixture.projectId ||
  fixture.advisoryIds.length !== 2 ||
  !fixture.subscriberIds.active ||
  !fixture.subscriberIds.pending ||
  !fixture.subscriberIds.suppressed ||
  !fixture.jobId ||
  !fixture.publicDeliveryId
)
  throw new Error('Create a complete synthetic admin fixture first.');
const operator = fixture.operator,
  customer = fixture.customer;
type UserDetail = Awaited<ReturnType<typeof intelAdminService.user>>;
type AdvisoryDetail = Awaited<ReturnType<typeof intelAdminService.advisory>>;
type SubscriptionDetail = Awaited<ReturnType<typeof intelAdminService.subscription>>;
type Sources = Awaited<ReturnType<typeof sourceControlService.list>>;
const base = 'http://localhost:3001';
const reason = `Synthetic HTTP verification ${fixture.run}; no production user, source request, or mail operation.`;
let previewConfirmed = false;
async function request<T = unknown>(
  path: string,
  options: { method?: string; cookie?: string; body?: unknown; origin?: string } = {},
) {
  const response = await fetch(base + path, {
    method: options.method ?? 'GET',
    redirect: 'error',
    signal: AbortSignal.timeout(10_000),
    headers: {
      Accept: 'application/json',
      ...(options.cookie ? { Cookie: options.cookie } : {}),
      ...(options.body !== undefined
        ? { 'Content-Type': 'application/json', Origin: options.origin ?? 'http://localhost:3003' }
        : {}),
    },
    ...(options.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });
  const marked = response.headers.get('x-wisesama-local-preview') === 'disposable-wisesama_intel';
  if (marked) previewConfirmed = true;
  // The auth plugin writes its own raw response, bypassing Fastify onSend headers.
  assert.ok(
    marked || (previewConfirmed && path.startsWith('/api/auth/')),
    'Only the preflight-verified disposable preview API may be used.',
  );
  const payload = (await response.json()) as { data?: T; meta?: unknown };
  return {
    status: response.status,
    data: ('meta' in payload ? payload.data : payload) as T,
    response,
  };
}
async function signIn(account: { email: string; password: string }) {
  const result = await request('/api/auth/sign-in/email', {
    method: 'POST',
    body: { email: account.email, password: account.password },
  });
  assert.equal(result.status, 200, 'Synthetic sign-in must succeed before further writes.');
  const cookies = result.response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0]!)
    .join('; ');
  assert.ok(cookies, 'The API must issue a session cookie.');
  return cookies;
}
const admin = '/api/v1/intel/admin';
let originalSource: Awaited<ReturnType<typeof db.intelSourceControl.findUnique>> | undefined;
let sourceRevisionAfterTest: number | undefined;
const originalCustomer = await db.user.findUniqueOrThrow({ where: { id: customer.id } });
const originalReview = await db.intelAdvisoryReview.findUnique({
  where: { advisoryId: fixture.advisoryIds[0]! },
});
const originalSubscriptions = await db.publicSubscriber.findMany({
  where: { id: { in: Object.values(fixture.subscriberIds) as string[] } },
});
const originalDelivery = await db.publicFeedDelivery.findUniqueOrThrow({
  where: { id: fixture.publicDeliveryId },
});
let readyForWrites = false;
try {
  assert.equal((await request(`${admin}/session`)).status, 401);
  assert.equal(fixture.signupPrivilegeInjectionRejected, true);
  const customerState = await db.user.findUniqueOrThrow({
    where: { id: customer.id },
    select: { role: true, intelAdmin: true },
  });
  assert.equal(customerState.role, 'ADMIN');
  assert.equal(customerState.intelAdmin, false);
  const customerCookie = await signIn(customer),
    operatorCookie = await signIn(operator);
  assert.equal(
    (await request(`${admin}/session`, { cookie: customerCookie })).status,
    403,
    'Dotsama ADMIN does not grant v2 operator access.',
  );
  const operatorSession = await request<{ user: { id: string }; access: string }>(
    `${admin}/session`,
    { cookie: operatorCookie },
  );
  assert.equal(operatorSession.status, 200);
  assert.equal(operatorSession.data.user.id, operator.id);
  assert.equal(operatorSession.data.access, 'intel_admin');
  readyForWrites = true;
  for (const path of [
    '/overview',
    '/users',
    '/advisories',
    '/subscriptions',
    '/sources',
    '/jobs',
    '/failures',
    '/audit',
    `/jobs/${fixture.jobId}`,
  ]) {
    const result = await request(admin + path, { cookie: operatorCookie });
    assert.equal(result.status, 200, `Admin read failed for ${path}.`);
    const serialized = JSON.stringify(result.data);
    assert.ok(!serialized.includes(operator.password) && !serialized.includes(customer.password));
    for (const secret of ['credentials', 'refreshToken', 'accessToken', 'leaseToken', 'keyHash'])
      assert.ok(
        !serialized.includes(`"${secret}"`),
        'Admin diagnostic projection exposed a forbidden field.',
      );
  }
  const target = await request<UserDetail>(`${admin}/users/${customer.id}`, {
    cookie: operatorCookie,
  });
  assert.equal(target.status, 200);
  const revision = target.data.user.revision;
  const accessBody = { suspended: true, expectedRevision: revision, reason };
  assert.equal(
    (
      await request(`${admin}/users/${customer.id}/access`, {
        method: 'PATCH',
        cookie: operatorCookie,
        origin: 'https://attacker.invalid',
        body: accessBody,
      })
    ).status,
    403,
  );
  assert.equal(
    (
      await request(`${admin}/users/${customer.id}/access`, {
        method: 'PATCH',
        cookie: operatorCookie,
        body: accessBody,
      })
    ).status,
    200,
  );
  assert.equal(
    (await request('/api/v1/intel/workspace', { cookie: customerCookie })).status,
    403,
    'A pre-existing customer session must lose v2 access immediately.',
  );
  assert.equal(
    (await db.user.findUniqueOrThrow({ where: { id: customer.id } })).role,
    'ADMIN',
    'V2 suspension must not change the Dotsama role.',
  );
  assert.equal(
    (
      await request(`${admin}/users/${customer.id}/access`, {
        method: 'PATCH',
        cookie: operatorCookie,
        body: accessBody,
      })
    ).status,
    409,
  );
  const suspended = await request<UserDetail>(`${admin}/users/${customer.id}`, {
    cookie: operatorCookie,
  });
  assert.equal(
    (
      await request(`${admin}/users/${customer.id}/access`, {
        method: 'PATCH',
        cookie: operatorCookie,
        body: { suspended: false, expectedRevision: suspended.data.user.revision, reason },
      })
    ).status,
    200,
  );
  assert.equal((await request('/api/v1/intel/workspace', { cookie: customerCookie })).status, 200);
  const advisoryId = fixture.advisoryIds[0]!;
  const sourceBefore = (await db.securityAdvisory.findUniqueOrThrow({ where: { id: advisoryId } }))
    .data;
  const advisory = await request<AdvisoryDetail>(`${admin}/advisories/${advisoryId}`, {
    cookie: operatorCookie,
  });
  const guidance = 'Synthetic operator guidance for this local fixture only.';
  const note = 'Synthetic internal note. Never publish this private note.';
  const reviewed = await request<AdvisoryDetail>(`${admin}/advisories/${advisoryId}/review`, {
    method: 'PATCH',
    cookie: operatorCookie,
    body: {
      expectedRevision: advisory.data.advisory.review.revision,
      visibility: 'published',
      guidance,
      note,
      reason,
    },
  });
  assert.equal(reviewed.status, 200);
  const publicDetail = await request<{ editorial: { guidance: string } }>(
    `/api/v1/intel/briefings/${advisoryId}`,
  );
  assert.equal(publicDetail.status, 200);
  assert.equal(publicDetail.data.editorial.guidance, guidance);
  assert.ok(!JSON.stringify(publicDetail.data).includes(note));
  assert.deepEqual(
    (await db.securityAdvisory.findUniqueOrThrow({ where: { id: advisoryId } })).data,
    sourceBefore,
  );
  const hidden = await request<AdvisoryDetail>(`${admin}/advisories/${advisoryId}/review`, {
    method: 'PATCH',
    cookie: operatorCookie,
    body: {
      expectedRevision: reviewed.data.advisory.review.revision,
      visibility: 'hidden',
      guidance,
      note,
      reason,
    },
  });
  assert.equal(hidden.status, 200);
  assert.equal((await request(`/api/v1/intel/briefings/${advisoryId}`)).status, 404);
  assert.equal(
    (
      await request(`${admin}/advisories/${advisoryId}/review`, {
        method: 'PATCH',
        cookie: operatorCookie,
        body: {
          expectedRevision: hidden.data.advisory.review.revision,
          visibility: 'published',
          guidance: '',
          note: '',
          reason,
        },
      })
    ).status,
    200,
  );
  const subscriberId = fixture.subscriberIds.active!;
  const subscriber = await request<SubscriptionDetail>(`${admin}/subscriptions/${subscriberId}`, {
    cookie: operatorCookie,
  });
  const confirmedAt = subscriber.data.subscriber.confirmedAt;
  assert.equal(
    (
      await request(`${admin}/subscriptions/${subscriberId}/status`, {
        method: 'PATCH',
        cookie: operatorCookie,
        body: { status: 'active', expectedRevision: subscriber.data.subscriber.revision, reason },
      })
    ).status,
    400,
  );
  const stopped = await request<SubscriptionDetail>(
    `${admin}/subscriptions/${subscriberId}/status`,
    {
      method: 'PATCH',
      cookie: operatorCookie,
      body: {
        status: 'unsubscribed',
        expectedRevision: subscriber.data.subscriber.revision,
        reason,
      },
    },
  );
  assert.equal(stopped.status, 200);
  assert.equal(stopped.data.subscriber.confirmedAt, confirmedAt);
  assert.equal(
    (await db.publicFeedDelivery.findUniqueOrThrow({ where: { id: fixture.publicDeliveryId } }))
      .status,
    'skipped',
  );
  const pendingId = fixture.subscriberIds.pending!;
  const pending = await request<SubscriptionDetail>(`${admin}/subscriptions/${pendingId}`, {
    cookie: operatorCookie,
  });
  const suppressed = await request<SubscriptionDetail>(
    `${admin}/subscriptions/${pendingId}/status`,
    {
      method: 'PATCH',
      cookie: operatorCookie,
      body: { status: 'suppressed', expectedRevision: pending.data.subscriber.revision, reason },
    },
  );
  assert.equal(suppressed.status, 200);
  assert.equal(suppressed.data.subscriber.confirmedAt, null);
  assert.equal(
    (
      await request(`${admin}/subscriptions/${pendingId}/status`, {
        method: 'PATCH',
        cookie: operatorCookie,
        body: {
          status: 'unsubscribed',
          expectedRevision: suppressed.data.subscriber.revision,
          reason,
        },
      })
    ).status,
    409,
  );
  originalSource = await db.intelSourceControl.findUnique({ where: { id: 'epss' } });
  const sources = await request<Sources>(`${admin}/sources`, { cookie: operatorCookie });
  const source = sources.data.items.find((value) => value.id === 'epss')!;
  const flipped = await request<{ source: Sources['items'][number] }>(`${admin}/sources/epss`, {
    method: 'PATCH',
    cookie: operatorCookie,
    body: { paused: !source.paused, expectedRevision: source.revision, reason },
  });
  assert.equal(flipped.status, 200);
  sourceRevisionAfterTest = flipped.data.source.revision;
  assert.equal(
    (
      await request(`${admin}/sources/epss`, {
        method: 'PATCH',
        cookie: operatorCookie,
        body: { paused: source.paused, expectedRevision: source.revision, reason },
      })
    ).status,
    409,
  );
  const restored = await request<{ source: Sources['items'][number] }>(`${admin}/sources/epss`, {
    method: 'PATCH',
    cookie: operatorCookie,
    body: { paused: source.paused, expectedRevision: flipped.data.source.revision, reason },
  });
  assert.equal(restored.status, 200);
  sourceRevisionAfterTest = restored.data.source.revision;
  await db.user.update({ where: { id: operator.id }, data: { intelAdmin: false } });
  assert.equal(
    (await request(`${admin}/session`, { cookie: operatorCookie })).status,
    403,
    'V2 operator revocation must defeat an existing cached session.',
  );
  await db.user.update({ where: { id: operator.id }, data: { intelAdmin: true } });
  assert.equal((await request(`${admin}/session`, { cookie: operatorCookie })).status, 200);
  console.log(
    'PASS: actual HTTP signup privilege isolation, fresh operator access/revocation, all admin reads, customer suspension/resume, stale edits, Origin protection, separate editorial guidance/visibility, consent-safe subscription stops, and source pause/resume. No provider probe, job execution, or email was requested.',
  );
} finally {
  if (readyForWrites) {
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id: operator.id }, data: { intelAdmin: true } });
      await tx.user.update({
        where: { id: customer.id },
        data: {
          intelSuspendedAt: originalCustomer.intelSuspendedAt,
          intelSuspensionReason: originalCustomer.intelSuspensionReason,
          intelRevision: originalCustomer.intelRevision,
          role: originalCustomer.role,
          updatedAt: originalCustomer.updatedAt,
        },
      });
      if (originalReview)
        await tx.intelAdvisoryReview.upsert({
          where: { advisoryId: fixture.advisoryIds[0]! },
          create: originalReview,
          update: originalReview,
        });
      else
        await tx.intelAdvisoryReview.deleteMany({ where: { advisoryId: fixture.advisoryIds[0]! } });
      for (const subscriber of originalSubscriptions)
        await tx.publicSubscriber.update({
          where: { id: subscriber.id },
          data: {
            status: subscriber.status,
            confirmedAt: subscriber.confirmedAt,
            nextDigestAt: subscriber.nextDigestAt,
            adminRevision: subscriber.adminRevision,
            unsubscribeVersion: subscriber.unsubscribeVersion,
            updatedAt: subscriber.updatedAt,
          },
        });
      await tx.publicFeedDelivery.update({
        where: { id: originalDelivery.id },
        data: {
          status: originalDelivery.status,
          error: originalDelivery.error,
          nextAttemptAt: originalDelivery.nextAttemptAt,
        },
      });
      if (sourceRevisionAfterTest !== undefined) {
        const current = await tx.intelSourceControl.findUnique({ where: { id: 'epss' } });
        if (current?.revision !== sourceRevisionAfterTest)
          throw new Error('A concurrent source change prevents safe fixture restoration.');
        if (originalSource)
          await tx.intelSourceControl.update({ where: { id: 'epss' }, data: originalSource });
        else await tx.intelSourceControl.delete({ where: { id: 'epss' } });
      }
      await tx.intelAdminAudit.deleteMany({ where: { actorId: operator.id, reason } });
    });
  }
  await db.$disconnect();
}
