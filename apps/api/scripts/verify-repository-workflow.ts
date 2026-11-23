/**
 * Disposable PostgreSQL persistence verification with synthetic repository/intelligence providers.
 * INTEL_TEST_DATABASE_URL=postgresql://wisesama_test@127.0.0.1:55439/wisesama_intel \
 *   pnpm --filter @wisesama/api exec node --import tsx scripts/verify-repository-workflow.ts
 * No production configuration, external provider requests, or email delivery are used.
 */
import assert from 'node:assert/strict';
import { createHmac, randomBytes, randomUUID } from 'node:crypto';

function disposableDatabase() {
  const input = process.env.INTEL_TEST_DATABASE_URL;
  if (!input)
    throw new Error('Set INTEL_TEST_DATABASE_URL explicitly to use the disposable local database.');
  const url = new URL(input);
  if (
    !['postgresql:', 'postgres:'].includes(url.protocol) ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.pathname !== '/wisesama_intel' ||
    url.searchParams.has('host') ||
    url.searchParams.has('socket')
  )
    throw new Error('Repository verification is restricted to loopback database wisesama_intel.');
  return input;
}

async function verify() {
  process.env.DATABASE_URL = disposableDatabase();
  const { prisma: db } = await import('@wisesama/database');
  const { createRepositoryProvider } = await import('../src/services/repository-provider');
  const { createRepositoryService } = await import('../src/services/repository.service');
  const { createIntelWorkspaceService } = await import('../src/services/intel-workspace.service');
  const run = randomUUID(),
    advisoryId = `TEST-REPOSITORY-${run}`;
  const users: string[] = [],
    deliveryId = `repository-smoke-${run}`;
  const key = randomBytes(32),
    signingKey = randomBytes(32);
  const env = {
    REPOSITORY_TOKEN_ENCRYPTION_KEY: key.toString('base64'),
    REPOSITORY_API_URL: 'https://api.example.invalid',
    INTEL_APP_URL: 'https://app.example.invalid',
    GITLAB_CLIENT_ID: 'synthetic-client',
    GITLAB_CLIENT_SECRET: 'synthetic-secret',
    GITLAB_WEBHOOK_SIGNING_SECRET: `whsec_${signingKey.toString('base64')}`,
  };
  const now = new Date();
  let currentCommit = 'a'.repeat(40),
    unavailable = false,
    refreshCount = 0,
    readCount = 0;
  const versions = new Map([
    ['a'.repeat(40), '1.0.0'],
    ['b'.repeat(40), '2.0.0'],
  ]);
  const response = (value: unknown, status = 200) =>
    new Response(JSON.stringify(value), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });
  const fetchFixture: typeof fetch = async (input, init) => {
    const url = new URL(String(input));
    readCount++;
    assert.equal(
      url.origin,
      'https://gitlab.com',
      'Provider calls must use the fixed GitLab.com origin.',
    );
    if (url.pathname === '/oauth/token') {
      const form = new URLSearchParams(String(init?.body));
      assert.equal(form.get('client_id'), env.GITLAB_CLIENT_ID);
      if (form.get('grant_type') === 'refresh_token') {
        assert.equal(form.get('refresh_token'), 'synthetic-refresh');
        refreshCount++;
      } else {
        assert.ok(form.get('code_verifier'));
        assert.equal(form.get('code'), 'synthetic-code');
      }
      return response({
        access_token: refreshCount ? 'rotated-access' : 'synthetic-access',
        refresh_token: refreshCount ? 'rotated-refresh' : 'synthetic-refresh',
        expires_in: 7200,
      });
    }
    if (unavailable) return response({ error: 'Synthetic revoked access' }, 403);
    const project = {
      id: 42,
      name: 'fixture-service',
      path_with_namespace: 'synthetic/fixture-service',
      default_branch: 'main',
      web_url: 'https://gitlab.com/synthetic/fixture-service',
    };
    if (url.pathname === '/api/v4/user') return response({ id: 1, username: 'synthetic-owner' });
    if (url.pathname === '/api/v4/projects') return response([project]);
    if (url.pathname === '/api/v4/projects/42') return response(project);
    if (url.pathname === '/api/v4/projects/42/repository/branches')
      return response([{ name: 'main' }]);
    if (url.pathname === '/api/v4/projects/42/repository/commits/main')
      return response({ id: currentCommit });
    if (url.pathname === '/api/v4/projects/42/repository/tree')
      return response([{ path: 'package.json', type: 'blob', mode: '100644' }]);
    if (url.pathname === '/api/v4/projects/42/repository/files/package.json') {
      const commit = url.searchParams.get('ref');
      assert.ok(
        commit && versions.has(commit),
        'Every selected file must use an immutable known SHA.',
      );
      const content = JSON.stringify({
        name: 'synthetic-service',
        dependencies: { 'wisesama-repository-fixture': versions.get(commit) },
      });
      return response({
        encoding: 'base64',
        size: Buffer.byteLength(content),
        content: Buffer.from(content).toString('base64'),
      });
    }
    throw new Error(`Unexpected synthetic provider path: ${url.pathname}`);
  };
  const provider = createRepositoryProvider({ env, fetch: fetchFixture });
  const advisory = {
    id: advisoryId,
    aliases: [],
    title: 'Synthetic repository workflow advisory',
    summary: 'Disposable verification fixture only.',
    severity: 'high' as const,
    cvss: 8,
    exploited: false,
    exploitationStatus: 'not_in_kev' as const,
    epss: 0.01,
    publishedAt: now.toISOString(),
    modifiedAt: now.toISOString(),
    references: [],
    affected: [{ ecosystem: 'npm', name: 'wisesama-repository-fixture' }],
    source: 'Synthetic fixture',
  };
  const workspace = createIntelWorkspaceService({
    db,
    provider: {
      scan: async (packages) => ({
        matches: packages
          .filter((pkg) => pkg.version === '1.0.0')
          .map((pkg) => ({
            advisory,
            packageName: pkg.name,
            installedVersion: pkg.version,
            ecosystem: pkg.ecosystem,
            fixedVersion: '2.0.0',
          })),
        warnings: [],
        sources: [
          { name: 'Synthetic fixture', status: 'healthy' as const, checkedAt: now.toISOString() },
        ],
        scannedAt: new Date().toISOString(),
      }),
      getBriefings: async () => ({
        advisories: [advisory],
        sources: [],
        fetchedAt: now.toISOString(),
      }),
    },
    mail: async () => ({ status: 'unavailable', error: 'Synthetic verification sends no email.' }),
  });
  const service = createRepositoryService({ db, provider, env, scan: workspace.scanProject });
  try {
    const owner = await db.user.create({
      data: {
        email: `repository-owner-${run}@example.invalid`,
        name: 'Synthetic repository owner',
        emailVerified: true,
      },
    });
    users.push(owner.id);
    const other = await db.user.create({
      data: { email: `repository-other-${run}@example.invalid`, name: 'Synthetic unrelated owner' },
    });
    users.push(other.id);
    const started = await service.start(owner.id, 'gitlab');
    const state = new URL(started.authorizationUrl).searchParams.get('state');
    assert.ok(state);
    await assert.rejects(service.callback(other.id, 'gitlab', { state, code: 'synthetic-code' }), {
      statusCode: 400,
    });
    const connected = await service.callback(owner.id, 'gitlab', { state, code: 'synthetic-code' });
    assert.ok('connection' in connected && connected.connection);
    const connection = connected.connection;
    await assert.rejects(service.callback(owner.id, 'gitlab', { state, code: 'synthetic-code' }), {
      statusCode: 400,
    });
    const beforeIntrusion = readCount;
    await assert.rejects(service.repositories(other.id, connection.id), { statusCode: 404 });
    assert.equal(readCount, beforeIntrusion);
    assert.equal((await service.repositories(owner.id, connection.id)).repositories[0]?.id, '42');
    const stored = await db.repositoryConnection.findUniqueOrThrow({
      where: { id: connection.id },
    });
    assert.ok(!stored.credentials?.includes('synthetic-access'));
    const selection = { repositoryId: '42', branch: 'main', paths: ['package.json'] };
    const discovery = await service.discovery(owner.id, connection.id, selection);
    assert.equal(discovery.commit, currentCommit);
    assert.equal(discovery.paths[0]?.path, 'package.json');
    const preview = await service.preview(owner.id, connection.id, selection);
    assert.equal(preview.packages[0]?.version, '1.0.0');
    const created = await service.createProject(owner.id, {
      ...selection,
      connectionId: connection.id,
      name: 'Synthetic repository service',
      environment: 'development',
      expectedCommit: preview.commit,
    });
    assert.equal(created.assessmentError, null);
    const projectId = created.project.id,
      sourceId = created.source.id;
    const initialSecurity = await service.security(owner.id, projectId);
    assert.equal(initialSecurity.baseline.status, 'current');
    assert.equal(initialSecurity.baseline.commit, preview.commit);
    assert.equal(initialSecurity.baseline.checks.length, 4);
    assert.equal(initialSecurity.context.provenance, 'self_reported');
    await service.updateContext(owner.id, projectId, { internetFacing: 'yes', sensitiveData: 'unknown', hosting: 'Synthetic private verification' });
    assert.equal((await service.security(owner.id, projectId)).context.internetFacing, 'yes');
    await assert.rejects(service.security(other.id, projectId), { statusCode: 404 });
    assert.equal(
      await db.securityFinding.count({ where: { projectId } }),
      1,
      'Imported repository inventory must run the actual assessment persistence flow.',
    );
    await assert.rejects(
      workspace.updateInventory(owner.id, projectId, {
        inventory: {
          format: 'inventory',
          content: JSON.stringify([{ name: 'override', ecosystem: 'npm', version: '1.0.0' }]),
        },
      }),
      { statusCode: 409 },
    );
    await db.repositoryConnection.update({
      where: { id: connection.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    await service.repositories(owner.id, connection.id);
    assert.equal(
      refreshCount,
      1,
      'Expired GitLab credentials must rotate through persisted locking.',
    );
    await service.updateSource(owner.id, sourceId, { paused: true });
    await assert.rejects(service.sync(owner.id, sourceId), { statusCode: 409 });
    await service.updateSource(owner.id, sourceId, { paused: false });
    currentCommit = 'b'.repeat(40);
    const body = JSON.stringify({
      project: { id: 42 },
      ref: 'refs/heads/main',
      after: 'untrusted-webhook-value',
    });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = {
      'webhook-id': deliveryId,
      'webhook-timestamp': timestamp,
      'webhook-signature': `v1,${createHmac('sha256', signingKey).update(`${deliveryId}.${timestamp}.${body}`).digest('base64')}`,
      'x-gitlab-event': 'Push Hook',
    };
    assert.equal((await service.webhook('gitlab', body, headers)).duplicate, false);
    assert.equal((await service.webhook('gitlab', body, headers)).duplicate, true);
    const synced = await service.sync(owner.id, sourceId);
    assert.equal(synced.source.importedCommit, currentCommit);
    assert.equal((await service.security(owner.id, projectId)).baseline.commit, currentCommit);
    const project = await db.securityProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.equal((project.packages as Array<{ version: string }>)[0]?.version, '2.0.0');
    assert.equal(
      await db.securityFinding.count({ where: { projectId, status: 'open' } }),
      1,
      'A changed repository inventory must not assert a deployed fix or silently close history.',
    );
    // Detach allows manual inventory, but reattachment must restore the repository snapshot
    // even when its commit/content did not change while it was detached.
    await service.disconnectSource(owner.id, sourceId);
    await workspace.updateInventory(owner.id, projectId, {
      inventory: {
        format: 'inventory',
        content: JSON.stringify([{ name: 'manual-override', ecosystem: 'npm', version: '9.0.0' }]),
      },
    });
    await service.updateSource(owner.id, sourceId, { paused: false });
    await service.sync(owner.id, sourceId);
    const reattached = await db.securityProject.findUniqueOrThrow({ where: { id: projectId } });
    assert.equal(
      (reattached.packages as Array<{ name: string; version: string }>)[0]?.name,
      'wisesama-repository-fixture',
    );
    assert.equal(
      (reattached.packages as Array<{ version: string }>)[0]?.version,
      '2.0.0',
      'Reattachment must re-import unchanged repository contents after a manual edit.',
    );
    unavailable = true;
    await assert.rejects(service.sync(owner.id, sourceId), { statusCode: 403 });
    const stale = await db.projectRepositorySource.findUniqueOrThrow({ where: { id: sourceId } });
    assert.equal(stale.importedCommit, currentCommit);
    assert.equal(stale.status, 'failed');
    const staleSecurity = await service.security(owner.id, projectId);
    assert.equal(staleSecurity.baseline.status, 'stale');
    assert.equal(staleSecurity.baseline.commit, currentCommit);
    assert.equal(staleSecurity.baseline.checks.length, 4);
    assert.equal(
      (await db.repositoryConnection.findUniqueOrThrow({ where: { id: connection.id } })).status,
      'reconnect_required',
    );
    await service.disconnect(owner.id, connection.id);
    assert.equal(
      (await db.repositoryConnection.findUniqueOrThrow({ where: { id: connection.id } }))
        .credentials,
      null,
    );
    assert.equal(
      (await db.projectRepositorySource.findUniqueOrThrow({ where: { id: sourceId } })).status,
      'disconnected',
    );
    assert.equal(await db.securityFinding.count({ where: { projectId } }), 1);
    console.log(
      'Repository persistence verified: owner-bound one-use OAuth, provider isolation, encrypted rotating tokens, immutable inventory, assessment, security baseline collection at imported SHA, self-reported context, manual-override guard, pause/resume, durable webhook dedup, changed SHA, failure retention, and disconnect. Synthetic providers only; no live provider or email claim.',
    );
  } finally {
    await db.repositoryWebhookDelivery.deleteMany({ where: { provider: 'gitlab', deliveryId } });
    await db.projectRepositorySource.deleteMany({ where: { userId: { in: users } } });
    await db.repositoryConnectionAttempt.deleteMany({ where: { userId: { in: users } } });
    await db.repositoryConnection.deleteMany({ where: { userId: { in: users } } });
    await db.user.deleteMany({ where: { id: { in: users } } });
    await db.securityAdvisory.deleteMany({ where: { id: advisoryId } });
    await db.$disconnect();
  }
}
verify().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Repository verification failed.');
  process.exitCode = 1;
});
