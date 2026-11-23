/** Disposable CI browser records and immutable transport controls. No live provider or mail calls. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open, unlink, writeFile } from 'node:fs/promises';
import {
  assertCiPreviewDatabase,
  CI_COMMIT_A,
  CI_COMMIT_B,
  CI_CONTROL_PATH,
  CI_FIXTURE_PATH,
  CI_PREVIEW_KEY,
  type CiPreviewControl,
  type CiPreviewFixture,
  ciPreviewIdentity,
  ciPreviewToken,
  readCiPreviewControl,
} from './ci-preview-provider';

process.env.DATABASE_URL = assertCiPreviewDatabase();
const { prisma: db } = await import('@wisesama/database');
const { encryptCredential } = await import('../src/services/repository-provider');
const persist = (value: CiPreviewFixture) =>
  writeFile(CI_FIXTURE_PATH, JSON.stringify(value, null, 2), { mode: 0o600 });
export async function readCiPreviewFixture() {
  const file = await open(CI_FIXTURE_PATH, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > 16_384)
      throw new Error('Invalid fixture manifest.');
    const fixture = JSON.parse(await file.readFile('utf8')) as CiPreviewFixture;
    if (
      !/^[a-f0-9-]{36}$/.test(fixture.run) ||
      [fixture.owner, fixture.outsider].some(
        (account) => !account.email.endsWith(`-ci-${fixture.run}@example.invalid`),
      )
    )
      throw new Error('Unexpected synthetic fixture.');
    return fixture;
  } finally {
    await file.close();
  }
}
async function preflight() {
  const response = await fetch('http://localhost:3001/api/v1/intel/admin/session', {
    redirect: 'error',
  });
  assert.equal(
    response.headers.get('x-wisesama-local-preview'),
    'disposable-wisesama_intel',
    'Refusing HTTP writes to a normal API.',
  );
  assert.equal(
    response.headers.get('x-wisesama-ci-preview'),
    'synthetic-immutable-repositories',
    'Restart the preview with INTEL_CI_PREVIEW=1.',
  );
}
async function main() {
  const mode = process.argv[2];
  if (mode) {
    const saved = await readCiPreviewFixture();
    if (mode === '--cleanup') {
      const emails = [saved.owner.email, saved.outsider.email];
      const found = await db.user.findMany({
        where: { email: { in: emails } },
        select: { id: true, email: true },
      });
      assert.ok(found.every((user) => user.email.endsWith(`-ci-${saved.run}@example.invalid`)));
      await db.user.deleteMany({
        where: { id: { in: found.map((user) => user.id) }, email: { in: emails } },
      });
      await unlink(CI_FIXTURE_PATH);
      const control = await readCiPreviewControl();
      assert.equal(control.run, saved.run);
      await unlink(CI_CONTROL_PATH);
      console.log(
        'Removed the exact synthetic CI accounts, cascading records, and temporary credentials.',
      );
      return;
    }
    const control = await readCiPreviewControl();
    assert.equal(control.run, saved.run);
    if (mode === '--head-a' || mode === '--head-b') control.head = mode === '--head-a' ? 'a' : 'b';
    else if (mode === '--fail-on' || mode === '--fail-off')
      control.failBaseline = mode === '--fail-on';
    else if (mode === '--stale') {
      control.head = 'b';
      await db.projectRepositorySource.updateMany({
        where: { id: saved.sourceId, userId: saved.owner.id },
        data: { observedCommit: CI_COMMIT_B },
      });
    } else if (mode === '--legacy') {
      const source = await db.projectRepositorySource.findFirstOrThrow({
        where: { id: saved.sourceId, userId: saved.owner.id },
      });
      const previous = source.baseline as Record<string, unknown> | null;
      assert.ok(
        previous && Array.isArray(previous.checks),
        'Run a baseline check before simulating an older snapshot.',
      );
      const legacy = Object.fromEntries(
        Object.entries(previous).filter(([key]) => key !== 'ciDependencies'),
      );
      legacy.checks = (previous.checks as Array<{ id?: string }>).filter(
        (check) => check.id !== 'ci_dependencies',
      );
      await db.projectRepositorySource.updateMany({
        where: { id: saved.sourceId, userId: saved.owner.id },
        data: { baseline: JSON.parse(JSON.stringify(legacy)) },
      });
    } else
      throw new Error(
        'Use --head-a, --head-b, --fail-on, --fail-off, --stale, --legacy or --cleanup.',
      );
    await writeFile(CI_CONTROL_PATH, JSON.stringify(control), { mode: 0o600 });
    console.log(
      `Synthetic CI control changed: ${mode}. Immutable commit contents were not changed.`,
    );
    return;
  }
  await preflight();
  const run = randomUUID();
  const repositoryId = BigInt(`0x${run.replaceAll('-', '').slice(0, 12)}`).toString();
  const saved: CiPreviewFixture = {
    run,
    owner: {
      id: '',
      email: `owner-ci-${run}@example.invalid`,
      password: randomBytes(24).toString('base64url'),
    },
    outsider: {
      id: '',
      email: `outsider-ci-${run}@example.invalid`,
      password: randomBytes(24).toString('base64url'),
    },
    organizationId: '',
    projectId: `ci-project-${run}`,
    manualProjectId: `ci-manual-${run}`,
    connectionId: `ci-connection-${run}`,
    sourceId: `ci-source-${run}`,
    repositoryId,
  };
  await writeFile(CI_FIXTURE_PATH, JSON.stringify(saved, null, 2), { mode: 0o600, flag: 'wx' });
  const control: CiPreviewControl = { run, repositoryId, head: 'a', failBaseline: false };
  await writeFile(CI_CONTROL_PATH, JSON.stringify(control), { mode: 0o600, flag: 'wx' });
  for (const [account, name] of [
    [saved.owner, 'Synthetic CI review'],
    [saved.outsider, 'Synthetic unrelated CI account'],
  ] as const) {
    const response = await fetch('http://localhost:3001/api/auth/sign-up/email', {
      method: 'POST',
      redirect: 'error',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3003' },
      body: JSON.stringify({ email: account.email, password: account.password, name }),
    });
    assert.equal(response.status, 200, 'Synthetic registration failed.');
    const result = (await response.json()) as { user: { id: string } };
    account.id = result.user.id;
    await persist(saved);
  }
  const session = await fetch('http://localhost:3001/api/auth/sign-in/email', {
    method: 'POST',
    redirect: 'error',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3003' },
    body: JSON.stringify({ email: saved.owner.email, password: saved.owner.password }),
  });
  assert.equal(session.status, 200);
  const cookie = session.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  const organizations = await fetch('http://localhost:3001/api/v1/intel/organizations', {
    redirect: 'error',
    headers: { Cookie: cookie },
  });
  assert.equal(organizations.status, 200);
  const listed = (await organizations.json()) as { data: { defaultOrganizationId: string } };
  saved.organizationId = listed.data.defaultOrganizationId;
  assert.ok(saved.organizationId);
  await persist(saved);
  await db.securityProject.createMany({
    data: [
      {
        id: saved.projectId,
        userId: saved.owner.id,
        organizationId: saved.organizationId,
        name: 'Synthetic CI checkout · local verification',
        environment: 'staging',
        packages: [{ name: 'synthetic-ci-package', version: '1.0.0', ecosystem: 'npm' }],
        nextScanAt: new Date('2100-01-01'),
      },
      {
        id: saved.manualProjectId,
        userId: saved.owner.id,
        organizationId: saved.organizationId,
        name: 'Synthetic manual inventory · no repository',
        environment: 'development',
        nextScanAt: new Date('2100-01-01'),
      },
    ],
  });
  await db.repositoryConnection.create({
    data: {
      id: saved.connectionId,
      userId: saved.owner.id,
      provider: 'github',
      providerUserId: ciPreviewIdentity(run),
      accountName: 'Synthetic CI transport',
      status: 'connected',
      credentials: encryptCredential(
        JSON.stringify({ accessToken: ciPreviewToken(run) }),
        `wisesama:${saved.owner.id}:github`,
        CI_PREVIEW_KEY,
      ),
    },
  });
  await db.projectRepositorySource.create({
    data: {
      id: saved.sourceId,
      userId: saved.owner.id,
      projectId: saved.projectId,
      connectionId: saved.connectionId,
      provider: 'github',
      repositoryId,
      repositoryName: 'synthetic/ci-checkout',
      repositoryUrl: 'https://github.com/synthetic/ci-checkout',
      branch: 'main',
      paths: ['package.json'],
      status: 'current',
      observedCommit: CI_COMMIT_A,
      importedCommit: CI_COMMIT_A,
      lastSyncedAt: new Date(),
      nextSyncAt: new Date('2100-01-01'),
    },
  });
  console.log(
    `Synthetic CI fixture ready. Credentials and exact IDs saved privately at ${CI_FIXTURE_PATH}.`,
  );
}
try {
  await main();
} finally {
  await db.$disconnect();
}
