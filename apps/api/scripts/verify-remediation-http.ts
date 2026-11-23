/** Full HTTP regression against the disposable local preview; never accepts a remote database. */
import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import {
  assertCiPreviewDatabase,
  CI_COMMIT_A,
  CI_FIXTURE_PATH,
  type CiPreviewFixture,
} from './ci-preview-provider';

process.env.DATABASE_URL = assertCiPreviewDatabase();
const { prisma: db } = await import('@wisesama/database');
const fixture = JSON.parse(await readFile(CI_FIXTURE_PATH, 'utf8')) as CiPreviewFixture;
assert.ok(fixture.owner.email.endsWith(`-ci-${fixture.run}@example.invalid`));
const origin = 'http://localhost:3003';
let cookie = '';
async function call(path: string, method = 'GET', body?: unknown, includeOrigin = true) {
  const response = await fetch(`http://localhost:3001${path}`, {
    method,
    redirect: 'error',
    headers: {
      ...(cookie ? { Cookie: cookie } : {}),
      ...(includeOrigin ? { Origin: origin } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!path.startsWith('/api/auth/'))
    assert.equal(response.headers.get('x-wisesama-ci-preview'), 'synthetic-immutable-repositories');
  return response;
}
async function signIn(account: CiPreviewFixture['owner']) {
  const response = await call('/api/auth/sign-in/email', 'POST', {
    email: account.email,
    password: account.password,
  });
  assert.equal(response.status, 200);
  cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
}
try {
  await signIn(fixture.owner);
  const advisoryId = `WS-LOCAL-${fixture.run}`;
  const now = new Date().toISOString();
  await db.securityAdvisory.upsert({
    where: { id: advisoryId },
    update: {},
    create: {
      id: advisoryId,
      aliases: [],
      data: {
        id: advisoryId,
        aliases: [],
        title: 'Example dependency finding · local verification',
        summary: 'Synthetic fixture for testing the remediation flow. No live security claim.',
        severity: 'high',
        cvss: 8,
        exploited: false,
        epss: null,
        publishedAt: now,
        modifiedAt: now,
        references: [],
        affected: [{ name: 'synthetic-ci-package', ecosystem: 'npm', fixedVersion: '1.0.1' }],
        source: 'Synthetic local verification',
      },
    },
  });
  const findingId = `remediation-${fixture.run}`;
  await db.securityFinding.upsert({
    where: { id: findingId },
    update: { remediation: {}, remediationRevision: 0 },
    create: {
      id: findingId,
      projectId: fixture.projectId,
      advisoryId,
      packageName: 'synthetic-ci-package',
      installedVersion: '1.0.0',
      fixedVersion: '1.0.1',
      ecosystem: 'npm',
    },
  });
  const base = `/api/v1/intel/findings/${findingId}/remediation`;
  assert.equal((await call(`${base}/handoff`, 'POST', {}, false)).status, 403);
  const handoffResponse = await call(`${base}/handoff`, 'POST', {});
  assert.equal(handoffResponse.status, 200);
  const handoff = (await handoffResponse.json()).data;
  assert.ok(handoff.prompt.includes('untrusted reference data'));
  assert.ok(!JSON.stringify(handoff).includes('synthetic-ci-token'));
  const fields = {
    pullRequestUrl: 'https://github.com/synthetic/ci-checkout/pull/42',
    fixedCommit: CI_COMMIT_A,
    testResult: 'passed',
    testEvidence: 'Example test command passed · synthetic local record',
    deployedCommit: CI_COMMIT_A,
    deploymentUrl: 'https://example.invalid/releases/42',
    deploymentNote: 'Example deployment evidence · synthetic local record',
  };
  assert.equal((await call(base, 'PATCH', { revision: 0, fields })).status, 200);
  assert.equal((await call(base, 'PATCH', { revision: 0, fields })).status, 409);
  const recheck = await call(`${base}/recheck`, 'POST', { revision: 1 });
  assert.equal(recheck.status, 200);
  const result = (await recheck.json()).data;
  assert.equal(
    result.verification.inventory,
    'incomplete',
    'Synthetic partial inventory must not clear a finding.',
  );
  assert.equal(result.response.status, 'open');
  const exported = await call(`${base}/evidence`);
  assert.equal(exported.status, 200);
  assert.match(exported.headers.get('content-disposition') || '', /attachment/);
  const evidence = (await exported.json()).data;
  assert.equal(evidence.fields.pullRequestUrl, fields.pullRequestUrl);
  assert.equal(evidence.verification.tests.provenance, 'team_reported');
  assert.ok(evidence.history.length >= 3);
  assert.ok(!JSON.stringify(evidence).includes('synthetic-ci-token'));
  await db.securityProject.update({
    where: { id: fixture.manualProjectId },
    data: {
      packages: [{ name: 'synthetic-ci-package', version: '1.0.1', ecosystem: 'npm' }],
      warnings: [],
      inventoryRevision: 'manual-remediation-1',
    },
  });
  const manualId = `remediation-manual-${fixture.run}`;
  await db.securityFinding.upsert({
    where: { id: manualId },
    update: { remediation: {}, remediationRevision: 0 },
    create: {
      id: manualId,
      projectId: fixture.manualProjectId,
      advisoryId,
      packageName: 'synthetic-ci-package',
      installedVersion: '1.0.0',
      fixedVersion: '1.0.1',
      ecosystem: 'npm',
    },
  });
  const manualBase = `/api/v1/intel/findings/${manualId}/remediation`;
  const clear = await call(`${manualBase}/recheck`, 'POST', { revision: 0 });
  assert.equal(clear.status, 200);
  assert.equal((await clear.json()).data.verification.inventory, 'clear');
  await db.securityProject.update({
    where: { id: fixture.manualProjectId },
    data: { inventoryRevision: 'manual-remediation-2' },
  });
  assert.equal((await (await call(manualBase)).json()).data.verification.inventory, 'stale');
  await signIn(fixture.outsider);
  for (const suffix of ['', '/evidence']) assert.equal((await call(base + suffix)).status, 404);
  assert.equal((await call(`${base}/handoff`, 'POST', {})).status, 404);
  await signIn(fixture.owner);
  await db.organizationMember.deleteMany({
    where: { organizationId: fixture.organizationId, userId: fixture.owner.id },
  });
  assert.equal((await call(base)).status, 404);
  await db.organizationMember.create({
    data: { organizationId: fixture.organizationId, userId: fixture.owner.id, role: 'owner' },
  });
  await writeFile(
    '/private/tmp/wisesama-remediation-browser.json',
    JSON.stringify({ findingId, manualId, owner: fixture.owner }),
    { mode: 0o600 },
  );
  const browserSource = `async () => { const response = await fetch('http://localhost:3001/api/auth/sign-in/email', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(${JSON.stringify({ email: fixture.owner.email, password: fixture.owner.password })}) }); if (!response.ok) throw new Error('Synthetic sign-in failed'); return { signedIn: true }; }`;
  await writeFile('/private/tmp/wisesama-remediation-browser-login.js', browserSource, {
    mode: 0o600,
  });
  console.log(
    'PASS: real session → private finding → agent handoff → saved PR/test/deployment references → repository sync/recheck → JSON export. Missing origin, stale writes, incomplete sources, cross-org reads and removed membership rejected. Complete manual recheck clears only the inventory signal, and inventory changes invalidate it.',
  );
  console.log(`Local review: http://localhost:3003/app/findings/${findingId}`);
} finally {
  if (cookie) await call('/api/auth/sign-out', 'POST', {}).catch(() => undefined);
  await db.$disconnect();
}
