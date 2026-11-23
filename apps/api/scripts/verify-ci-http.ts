/** Real local auth/routes/PostgreSQL verification, with the opt-in immutable synthetic transport. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import type { CiDependencyReport } from '../src/services/intel/ci-dependencies';
import {
  assertCiPreviewDatabase,
  CI_COMMIT_A,
  CI_COMMIT_B,
  CI_CONTROL_PATH,
  CI_FIXTURE_PATH,
  type CiPreviewFixture,
  readCiPreviewControl,
} from './ci-preview-provider';

process.env.DATABASE_URL = assertCiPreviewDatabase();
const { prisma: db } = await import('@wisesama/database');
const origin = 'http://localhost:3003';
type Security = {
  project: { id: string };
  repository: { importedCommit: string; observedCommit: string } | null;
  baseline: {
    status: string;
    commit: string | null;
    checkedAt: string | null;
    error: string | null;
    checks: Array<{ id: string }>;
    ciDependencies: CiDependencyReport | null;
  };
};
type Envelope<T> = { data: T };
const fixture = JSON.parse(await readFile(CI_FIXTURE_PATH, 'utf8')) as CiPreviewFixture;
assert.match(fixture.run, /^[a-f0-9-]{36}$/);
assert.ok(
  [fixture.owner, fixture.outsider].every(
    (account) => account.id && account.email.endsWith(`-ci-${fixture.run}@example.invalid`),
  ),
);
const control = await readCiPreviewControl();
assert.equal(control.run, fixture.run);
const results: string[] = [];
async function call<T>(path: string, cookie = '', method = 'GET', body?: unknown) {
  const response = await fetch(`http://localhost:3001${path}`, {
    method,
    redirect: 'error',
    headers: {
      Origin: origin,
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!path.startsWith('/api/auth/')) {
    assert.equal(response.headers.get('x-wisesama-local-preview'), 'disposable-wisesama_intel');
    assert.equal(response.headers.get('x-wisesama-ci-preview'), 'synthetic-immutable-repositories');
  }
  const data = (await response.json()) as T;
  return { response, data };
}
async function signin(account: CiPreviewFixture['owner']) {
  const { response } = await call('/api/auth/sign-in/email', '', 'POST', {
    email: account.email,
    password: account.password,
  });
  assert.equal(response.status, 200);
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  assert.ok(cookie.includes('session_token'));
  return cookie;
}
const securityPath = `/api/v1/intel/projects/${fixture.projectId}/security`;
const baselinePath = `/api/v1/intel/projects/${fixture.projectId}/baseline`;
const syncPath = `/api/v1/intel/repositories/sources/${fixture.sourceId}/sync`;
let ownerCookie = '';
try {
  const preflight = await fetch('http://localhost:3001/api/v1/intel/admin/session', {
    redirect: 'error',
  });
  assert.equal(preflight.headers.get('x-wisesama-local-preview'), 'disposable-wisesama_intel');
  assert.equal(preflight.headers.get('x-wisesama-ci-preview'), 'synthetic-immutable-repositories');
  assert.equal((await call(securityPath)).response.status, 401);
  ownerCookie = await signin(fixture.owner);
  const outsiderCookie = await signin(fixture.outsider);
  const migratedProject = await db.securityProject.findUniqueOrThrow({
    where: { id: fixture.projectId },
    select: { organizationId: true, userId: true },
  });
  assert.equal(migratedProject.userId, fixture.owner.id);
  if (!fixture.organizationId) {
    fixture.organizationId = migratedProject.organizationId;
    await writeFile(CI_FIXTURE_PATH, JSON.stringify(fixture, null, 2), { mode: 0o600 });
  }
  assert.equal(migratedProject.organizationId, fixture.organizationId);
  const organizations = await call<Envelope<{ organizations: Array<{ id: string }> }>>(
    '/api/v1/intel/organizations',
    ownerCookie,
  );
  assert.equal(organizations.response.status, 200);
  assert.ok(
    organizations.data.data.organizations.some((item) => item.id === fixture.organizationId),
  );
  const scoped = await call<Envelope<{ projects: Array<{ id: string; organizationId: string }> }>>(
    `/api/v1/intel/workspace?organizationId=${fixture.organizationId}`,
    ownerCookie,
  );
  assert.equal(scoped.response.status, 200);
  assert.ok(scoped.data.data.projects.some((item) => item.id === fixture.projectId));
  assert.ok(
    scoped.data.data.projects.every((item) => item.organizationId === fixture.organizationId),
  );
  assert.equal(
    (await call(`/api/v1/intel/workspace?organizationId=${fixture.organizationId}`, outsiderCookie))
      .response.status,
    404,
  );
  results.push(
    'Migrated CI projects retain their exact personal organization and live membership scope.',
  );
  assert.equal((await call(securityPath, outsiderCookie)).response.status, 404);
  assert.equal((await call(baselinePath, outsiderCookie, 'POST', {})).response.status, 404);
  assert.equal((await call(syncPath, outsiderCookie, 'POST', {})).response.status, 404);
  results.push('Unauthenticated and cross-owner access/mutations rejected.');

  const manual = await call<Envelope<Security>>(
    `/api/v1/intel/projects/${fixture.manualProjectId}/security`,
    ownerCookie,
  );
  assert.equal(manual.response.status, 200);
  assert.equal(manual.data.data.baseline.status, 'unsupported');
  assert.equal(manual.data.data.baseline.ciDependencies, null);
  assert.equal(
    (
      await call(
        `/api/v1/intel/projects/${fixture.manualProjectId}/baseline`,
        ownerCookie,
        'POST',
        {},
      )
    ).response.status,
    409,
  );
  results.push('Manual inventory stays explicitly unsupported for repository CI evidence.');

  await writeFile(CI_CONTROL_PATH, JSON.stringify({ ...control, head: 'a', failBaseline: false }), {
    mode: 0o600,
  });
  assert.equal((await call(syncPath, ownerCookie, 'POST', {})).response.status, 200);
  const first = await call<Envelope<Security>>(baselinePath, ownerCookie, 'POST', {});
  assert.equal(first.response.status, 200);
  assert.equal(first.data.data.baseline.commit, CI_COMMIT_A);
  assert.equal(first.data.data.baseline.status, 'current');
  const reportA = first.data.data.baseline.ciDependencies;
  assert.ok(reportA && reportA.items.length > 5);
  for (const state of ['mutable', 'pinned', 'locked', 'local', 'unknown'])
    assert.ok(
      reportA.items.some((item) => item.state === state),
      `Missing ${state} fixture case.`,
    );
  assert.ok(
    reportA.items.every(
      (item) => item.path && Number.isInteger(item.line) && item.line > 0 && item.recommendation,
    ),
  );
  assert.equal(reportA.items.find((item) => item.name === 'actions/checkout')?.state, 'mutable');
  assert.equal(
    reportA.items.find((item) => item.name === 'synthetic/dynamic-action')?.state,
    'unknown',
    'Dynamic versions must retain the recognizable static action identity.',
  );
  const persistedA = await db.projectRepositorySource.findUniqueOrThrow({
    where: { id: fixture.sourceId },
  });
  assert.deepEqual(
    (persistedA.baseline as unknown as { ciDependencies: CiDependencyReport }).ciDependencies,
    reportA,
  );
  const reload = await call<Envelope<Security>>(securityPath, ownerCookie);
  assert.deepEqual(reload.data.data.baseline.ciDependencies, reportA);
  assert.ok(reload.response.headers.get('cache-control')?.includes('no-store'));
  assert.ok(!JSON.stringify(reload.data).includes('synthetic-ci-token-'));
  results.push(
    'Real baseline endpoint computed, persisted and reloaded all evidence states with file/line and no-store.',
  );

  await writeFile(CI_CONTROL_PATH, JSON.stringify({ ...control, head: 'a', failBaseline: true }), {
    mode: 0o600,
  });
  const failed = await call<{ error: string }>(baselinePath, ownerCookie, 'POST', {});
  assert.equal(failed.response.status, 500);
  assert.ok(!JSON.stringify(failed.data).includes('NEVER_PERSIST_RAW_PROVIDER_SECRET'));
  const afterFailure = await call<Envelope<Security>>(securityPath, ownerCookie);
  assert.equal(afterFailure.data.data.baseline.status, 'stale');
  assert.deepEqual(afterFailure.data.data.baseline.ciDependencies, reportA);
  assert.equal(afterFailure.data.data.baseline.checkedAt, reload.data.data.baseline.checkedAt);
  assert.ok(afterFailure.data.data.baseline.error?.includes('Previous evidence is retained'));
  assert.ok(!JSON.stringify(afterFailure.data).includes('NEVER_PERSIST_RAW_PROVIDER_SECRET'));
  results.push(
    'Failed collection retained the prior CI report and success timestamp; raw failure detail was omitted.',
  );

  await writeFile(CI_CONTROL_PATH, JSON.stringify({ ...control, head: 'b', failBaseline: false }), {
    mode: 0o600,
  });
  await db.projectRepositorySource.update({
    where: { id: fixture.sourceId },
    data: { baselineError: null, observedCommit: CI_COMMIT_B },
  });
  const stale = await call<Envelope<Security>>(securityPath, ownerCookie);
  assert.equal(stale.data.data.baseline.status, 'stale');
  assert.equal(stale.data.data.baseline.commit, CI_COMMIT_A);
  assert.deepEqual(stale.data.data.baseline.ciDependencies, reportA);
  const sync = await call<
    Envelope<{ source: { importedCommit: string }; assessmentError: string | null }>
  >(syncPath, ownerCookie, 'POST', {});
  assert.equal(sync.response.status, 200);
  assert.equal(sync.data.data.source.importedCommit, CI_COMMIT_B);
  assert.ok(
    sync.data.data.assessmentError,
    'The synthetic transport must not imply a real advisory scan.',
  );
  const updated = await call<Envelope<Security>>(securityPath, ownerCookie);
  assert.equal(updated.data.data.baseline.commit, CI_COMMIT_B);
  assert.equal(updated.data.data.baseline.status, 'current');
  assert.equal(
    updated.data.data.baseline.ciDependencies?.items.find(
      (item) => item.name === 'actions/checkout',
    )?.state,
    'pinned',
  );
  assert.equal(reportA.items.find((item) => item.name === 'actions/checkout')?.state, 'mutable');
  results.push(
    'Observed new commit kept prior evidence stale; actual inventory sync imported immutable B and recomputed checkout mutable→pinned.',
  );

  const currentSource = await db.projectRepositorySource.findUniqueOrThrow({
    where: { id: fixture.sourceId },
  });
  const currentBaseline = currentSource.baseline as Record<string, unknown>;
  const legacy = Object.fromEntries(
    Object.entries(currentBaseline).filter(([key]) => key !== 'ciDependencies'),
  );
  legacy.checks = (currentBaseline.checks as Array<{ id: string }>).filter(
    (check) => check.id !== 'ci_dependencies',
  );
  await db.projectRepositorySource.update({
    where: { id: fixture.sourceId },
    data: { baseline: JSON.parse(JSON.stringify(legacy)) },
  });
  assert.equal(
    (await call<Envelope<Security>>(securityPath, ownerCookie)).data.data.baseline.ciDependencies,
    null,
  );
  const rechecked = await call<Envelope<Security>>(baselinePath, ownerCookie, 'POST', {});
  assert.equal(rechecked.response.status, 200);
  assert.ok(rechecked.data.data.baseline.ciDependencies?.items.length);
  results.push(
    'Older snapshots stayed readable and gained CI dependency evidence through the real recheck action.',
  );

  await writeFile(
    '/private/tmp/wisesama-ci-http-result.json',
    JSON.stringify(
      {
        passed: true,
        checks: results,
        transport: 'synthetic immutable fixtures; actual auth/routes/PostgreSQL',
        noProviderOrEmailCalls: true,
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    `CI HTTP verification passed: ${results.length} workflow groups. Actual auth, routes and PostgreSQL; no provider or email calls.`,
  );
} finally {
  await writeFile(CI_CONTROL_PATH, JSON.stringify({ ...control, head: 'a', failBaseline: false }), {
    mode: 0o600,
  });
  if (ownerCookie) {
    const reset = await call(syncPath, ownerCookie, 'POST', {});
    assert.equal(reset.response.status, 200, 'Synthetic browser fixture reset failed.');
  }
  await db.$disconnect();
}
