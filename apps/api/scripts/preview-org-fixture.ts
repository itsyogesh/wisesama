/** Synthetic organization browser fixture. Exact disposable database; no outbound delivery. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { unlink, writeFile } from 'node:fs/promises';
import {
  assertCiPreviewDatabase,
  CI_COMMIT_A,
  CI_COMMIT_B,
  CI_PREVIEW_KEY,
  ciPreviewIdentity,
  ciPreviewToken,
  readCiPreviewControl,
} from './ci-preview-provider';
import {
  call,
  ORG_FIXTURE_PATH,
  type Organization,
  type OrgPreviewFixture,
  persistOrgFixture,
  preflight,
  readCiFixture,
  readOrgFixture,
  signin,
} from './org-preview';

process.env.DATABASE_URL = assertCiPreviewDatabase();
const { prisma: db } = await import('@wisesama/database');
const { encryptCredential } = await import('../src/services/repository-provider');

async function main() {
  await preflight();
  if (process.argv[2] === '--cleanup') {
    const saved = await readOrgFixture(true);
    const accounts = [saved.member, saved.admin, saved.connector, saved.invitee];
    const users = await db.user.findMany({
      where: { email: { in: accounts.map((account) => account.email) } },
      select: { id: true, email: true },
    });
    assert.ok(users.every((user) => user.email.endsWith(`-org-${saved.run}@example.invalid`)));
    await db.$transaction(async (tx) => {
      const organization = saved.organizationId
        ? await tx.organization.findUnique({ where: { id: saved.organizationId } })
        : null;
      assert.ok(!organization || organization.createdById === saved.owner.id);
      assert.ok(!organization || organization.name.startsWith('Synthetic organization'));
      const projectIds = [
        saved.manualProjectId,
        saved.projectId,
        saved.connectorProjectId,
        saved.connectorPersonalProjectId,
      ].filter(Boolean);
      await tx.securityProject.deleteMany({
        where: { id: { in: projectIds }, userId: { in: [saved.owner.id, saved.connector.id] } },
      });
      await tx.organization.deleteMany({
        where: { id: saved.organizationId, createdById: saved.owner.id },
      });
      await tx.organization.deleteMany({
        where: { personalForUserId: { in: users.map((user) => user.id) } },
      });
      await tx.user.deleteMany({
        where: { OR: users.map((user) => ({ id: user.id, email: user.email })) },
      });
    });
    await unlink(ORG_FIXTURE_PATH);
    console.log(
      'Removed only the exact synthetic organization fixture. Existing CI records remain.',
    );
    return;
  }
  assert.equal(process.argv[2], undefined, 'Only --cleanup is supported.');
  const ci = await readCiFixture();
  const control = await readCiPreviewControl();
  assert.equal(control.run, ci.run);
  assert.equal(control.failBaseline, false);
  const run = randomUUID();
  const account = (name: string) => ({
    id: '',
    email: `${name}-org-${run}@example.invalid`,
    password: randomBytes(24).toString('base64url'),
  });
  const saved: OrgPreviewFixture = {
    run,
    owner: ci.owner,
    outsider: ci.outsider,
    member: account('member'),
    admin: account('admin'),
    connector: account('connector'),
    invitee: account('invitee'),
    organizationId: '',
    personalOrganizationId: '',
    manualProjectId: '',
    projectId: '',
    sourceId: '',
    connectorConnectionId: `org-connection-${run}`,
    connectorProjectId: `org-project-${run}`,
    connectorSourceId: `org-source-${run}`,
    connectorPersonalProjectId: `org-personal-project-${run}`,
    connectorPersonalSourceId: `org-personal-source-${run}`,
  };
  await writeFile(ORG_FIXTURE_PATH, JSON.stringify(saved, null, 2), { mode: 0o600, flag: 'wx' });
  for (const [kind, current] of [
    ['member', saved.member],
    ['admin', saved.admin],
    ['connector', saved.connector],
    ['invitee', saved.invitee],
  ] as const) {
    const registered = await call<{ user: { id: string } }>('/api/auth/sign-up/email', '', 'POST', {
      email: current.email,
      password: current.password,
      name: `Synthetic organization ${kind}`,
    });
    assert.equal(registered.response.status, 200, 'Synthetic organization registration failed.');
    current.id = registered.data.user.id;
    await persistOrgFixture(saved);
  }
  // Registration mail is disabled by preview-intel. Only these exact synthetic accounts are verified.
  await db.user.updateMany({
    where: {
      id: { in: [saved.admin.id, saved.connector.id, saved.invitee.id] },
      email: { endsWith: `-org-${run}@example.invalid` },
    },
    data: { emailVerified: true },
  });
  const owner = await signin(saved.owner);
  const organizations = await call<{ defaultOrganizationId: string }>(
    '/api/v1/intel/organizations',
    owner,
  );
  assert.equal(organizations.response.status, 200);
  saved.personalOrganizationId = organizations.data.defaultOrganizationId;
  const created = await call<{ organization: Organization }>(
    '/api/v1/intel/organizations',
    owner,
    'POST',
    { name: `Synthetic organization ${run.slice(0, 8)}` },
  );
  assert.equal(created.response.status, 201);
  saved.organizationId = created.data.organization.id;
  await persistOrgFixture(saved);
  const manual = await call<{ project: { id: string; organizationId: string } }>(
    '/api/v1/intel/projects',
    owner,
    'POST',
    {
      organizationId: saved.organizationId,
      name: 'Synthetic organization manual inventory',
      environment: 'staging',
      inventory: {
        format: 'package-json',
        content: JSON.stringify({
          name: 'synthetic-org',
          dependencies: { 'synthetic-org-package': '1.0.0' },
        }),
      },
    },
  );
  assert.equal(manual.response.status, 201);
  saved.manualProjectId = manual.data.project.id;
  assert.equal(manual.data.project.organizationId, saved.organizationId);
  await persistOrgFixture(saved);
  const repository = await call<{
    project: { id: string };
    source: { id: string };
    assessmentError: string;
  }>('/api/v1/intel/repositories/projects', owner, 'POST', {
    organizationId: saved.organizationId,
    connectionId: ci.connectionId,
    repositoryId: ci.repositoryId,
    branch: 'main',
    paths: ['package.json'],
    name: 'Synthetic organization repository',
    environment: 'staging',
    expectedCommit: control.head === 'a' ? CI_COMMIT_A : CI_COMMIT_B,
  });
  assert.equal(repository.response.status, 201);
  assert.ok(
    repository.data.assessmentError,
    'Synthetic transport must not perform an advisory scan.',
  );
  saved.projectId = repository.data.project.id;
  saved.sourceId = repository.data.source.id;
  await persistOrgFixture(saved);
  await db.securityProject.updateMany({
    where: { id: { in: [saved.manualProjectId, saved.projectId] } },
    data: { nextScanAt: new Date('2100-01-01') },
  });
  await db.projectRepositorySource.update({
    where: { id: saved.sourceId },
    data: { nextSyncAt: new Date('2100-01-01') },
  });
  // The removal verifier installs connector sources only after its invitation is accepted.
  await db.repositoryConnection.create({
    data: {
      id: saved.connectorConnectionId,
      userId: saved.connector.id,
      provider: 'github',
      providerUserId: ciPreviewIdentity(ci.run),
      accountName: 'Synthetic organization connector',
      status: 'connected',
      credentials: encryptCredential(
        JSON.stringify({ accessToken: ciPreviewToken(ci.run) }),
        `wisesama:${saved.connector.id}:github`,
        CI_PREVIEW_KEY,
      ),
    },
  });
  console.log(
    `Organization fixture ready. Private credentials and exact IDs: ${ORG_FIXTURE_PATH}.`,
  );
}
try {
  await main();
} finally {
  await db.$disconnect();
}
