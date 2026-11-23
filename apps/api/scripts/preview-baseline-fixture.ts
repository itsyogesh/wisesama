/** Explicitly synthetic local UI fixture; never a provider authorization or scan result. */
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const database = process.env.INTEL_TEST_DATABASE_URL;
if (!database) throw new Error('Set INTEL_TEST_DATABASE_URL to the disposable local database.');
const url = new URL(database);
if (!['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/wisesama_intel' || url.searchParams.has('host') || url.searchParams.has('socket')) throw new Error('Only the disposable loopback database is allowed.');
process.env.DATABASE_URL = database;
const { prisma } = await import('@wisesama/database');
const fixturePath = '/private/tmp/wisesama-baseline-preview.json';
if (process.argv.includes('--cleanup')) {
  const saved = JSON.parse(await readFile(fixturePath, 'utf8')) as { userId: string; projectId: string };
  if (!saved.userId || !saved.projectId) throw new Error('Missing fixture identifiers.');
  await prisma.user.deleteMany({ where: { id: saved.userId, name: 'Synthetic baseline review' } });
  await prisma.$disconnect();
} else {
  const email = `baseline-preview-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const signup = await fetch('http://localhost:3001/api/auth/sign-up/email', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3003' }, body: JSON.stringify({ email, password, name: 'Synthetic baseline review' }) });
  if (!signup.ok) throw new Error(`Synthetic account creation failed (${signup.status}).`);
  const { user } = await signup.json() as { user: { id: string } };
  const project = await prisma.securityProject.create({ data: { userId: user.id, name: 'Synthetic checkout service', environment: 'staging', packages: [{ name: 'synthetic-package', version: '1.0.0', ecosystem: 'npm' }], internetFacing: 'unknown', sensitiveData: 'unknown' } });
  const connection = await prisma.repositoryConnection.create({ data: { userId: user.id, provider: 'github', providerUserId: 'synthetic-fixture', accountName: 'synthetic-fixture', status: 'disconnected' } });
  const { assessRepositoryBaseline } = await import('../src/services/intel/repository-baseline');
  const commit = 'b'.repeat(40);
  const baseline = assessRepositoryBaseline(commit, ['pnpm-lock.yaml'], { paths: ['package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml', '.github/workflows/test.yml'], contents: { 'package.json': JSON.stringify({ packageManager: 'pnpm@9.14.2' }), 'pnpm-workspace.yaml': 'packages:\n  - apps/*\nminimumReleaseAge: 10080', '.github/workflows/test.yml': 'jobs:\n  test:\n    steps:\n      - run: pnpm install --frozen-lockfile' }, incomplete: false, unreadable: [] });
  await prisma.projectRepositorySource.create({ data: { projectId: project.id, userId: user.id, connectionId: connection.id, provider: 'github', repositoryId: 'synthetic-fixture', repositoryName: 'synthetic/checkout-fixture', repositoryUrl: 'https://github.com/example/synthetic-fixture', branch: 'main', paths: ['pnpm-lock.yaml'], scope: 'repository_inventory', paused: true, status: 'disconnected', observedCommit: 'c'.repeat(40), importedCommit: commit, baseline, baselineCheckedAt: new Date(Date.now() - 3600000), baselineAttemptedAt: new Date(), baselineError: 'Synthetic fixture: provider disconnected. Previous configuration evidence is retained.', lastSyncedAt: new Date(Date.now() - 3600000), lastAttemptAt: new Date(), nextSyncAt: new Date(Date.now() + 86400000) } });
  await writeFile(fixturePath, JSON.stringify({ userId: user.id, projectId: project.id, email, password }), { mode: 0o600 });
  console.log(`Synthetic preview fixture ready. Local identifiers saved at ${fixturePath}.`);
  await prisma.$disconnect();
}
