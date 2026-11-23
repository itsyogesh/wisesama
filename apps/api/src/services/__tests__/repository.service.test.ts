import type { PrismaClient } from '@wisesama/database';
import { describe, expect, it, vi } from 'vitest';
import { assessCiDependencies } from '../intel/ci-dependencies';
import { projectScope } from '../organization-access';
import { createRepositoryService } from '../repository.service';
import {
  decryptCredential,
  encryptCredential,
  repositoryProvider,
  stateHash,
} from '../repository-provider';
import { organizationFixture } from './organization-fixture';

const now = new Date('2026-11-04T00:00:00Z');
const key = Buffer.alloc(32, 5),
  env = {
    REPOSITORY_TOKEN_ENCRYPTION_KEY: key.toString('base64'),
    GITHUB_APP_WEBHOOK_SECRET: 'hook-key',
  };
const owner = 'alice';
const credentials = (value: unknown) =>
  encryptCredential(JSON.stringify(value), `wisesama:${owner}:gitlab`, key);
const connected = () => ({
  id: 'connection-1',
  userId: owner,
  provider: 'gitlab',
  providerUserId: '1',
  accountName: 'alice-provider',
  installationId: null,
  status: 'connected',
  credentials: credentials({ accessToken: 'old-access', refreshToken: 'old-refresh' }),
  expiresAt: null,
  validatedAt: now,
  refreshLock: null,
  refreshStartedAt: null,
  error: null,
  createdAt: now,
  updatedAt: now,
});
const source = () => ({
  id: 'source-1',
  projectId: 'project-1',
  userId: owner,
  connectionId: 'connection-1',
  provider: 'gitlab',
  repositoryId: '42',
  repositoryName: 'team/service',
  repositoryUrl: 'https://gitlab.com/team/service',
  branch: 'main',
  paths: ['package.json'],
  scope: 'repository_inventory',
  paused: false,
  status: 'current',
  observedCommit: 'a'.repeat(40),
  importedCommit: 'a'.repeat(40),
  inventoryDigest: 'previous-digest',
  importedFiles: [],
  lastSyncedAt: now,
  lastAttemptAt: now,
  nextSyncAt: now,
  syncToken: null,
  syncStartedAt: null,
  error: null,
  createdAt: now,
  updatedAt: now,
});
function harness() {
  const access = organizationFixture(owner);
  const project = { id: 'project-1', organizationId: 'org-1', userId: owner };
  const db = {
    organizationMember: access.organizationMember,
    repositoryConnection: {
      findFirst: vi.fn().mockResolvedValue(connected()),
      findMany: vi.fn().mockResolvedValue([connected()]),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue(connected()),
      update: vi.fn().mockResolvedValue(connected()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    repositoryConnectionAttempt: {
      findFirst: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn(),
    },
    projectRepositorySource: {
      findFirst: vi.fn().mockResolvedValue(source()),
      findMany: vi.fn().mockResolvedValue([source()]),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      create: vi.fn().mockResolvedValue(source()),
    },
    securityProject: {
      findFirst: vi
        .fn()
        .mockImplementation(async ({ where }) =>
          access.projectMatches(where, project) ? project : null,
        ),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      count: vi.fn().mockResolvedValue(1),
      create: vi.fn().mockResolvedValue({ ...project, name: 'Service' }),
    },
    repositoryWebhookDelivery: {
      createMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn: (value: typeof db) => unknown) => fn(db));
  const provider = {
    ...repositoryProvider,
    identity: vi.fn().mockResolvedValue({ id: '1', name: 'alice-provider' }),
    refresh: vi.fn(),
    list: vi.fn().mockResolvedValue({ repositories: [], incomplete: false }),
    selected: vi.fn().mockResolvedValue({ id: '42' }),
    readToken: vi.fn().mockResolvedValue('read-token'),
    snapshot: vi.fn(),
    baseline: vi.fn().mockResolvedValue({
      commit: 'a'.repeat(40),
      inventoryPaths: ['package.json'],
      checks: [],
      scope: 'repository_configuration',
      limitations: [],
    }),
    exchange: vi.fn(),
    authorize: vi.fn().mockReturnValue('https://gitlab.com/oauth/authorize?state=value'),
  };
  const scan = vi.fn();
  const service = createRepositoryService({
    db: db as unknown as PrismaClient,
    provider,
    env,
    now: () => now,
    scan,
  });
  return { db, provider, scan, service, access };
}

describe('repository assessment provenance', () => {
  it('returns persisted assessment health independently of source synchronization', async () => {
    const { db, service } = harness();
    const assessed = new Date('2026-11-03T16:00:00Z');
    db.projectRepositorySource.findMany.mockResolvedValue([
      {
        ...source(),
        observedCommit: 'b'.repeat(40),
        project: { lastScannedAt: assessed, scanError: 'Source refresh unavailable' },
      },
    ]);
    const result = await service.listSources(owner);
    expect(result.sources[0]).toMatchObject({
      observedCommit: 'b'.repeat(40),
      importedCommit: 'a'.repeat(40),
      lastAssessedAt: assessed.toISOString(),
      assessmentError: 'Source refresh unavailable',
    });
    expect(db.projectRepositorySource.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { project: projectScope(owner) },
        include: { project: { select: { lastScannedAt: true, scanError: true } } },
      }),
    );
  });
});

describe('repository security baseline and context', () => {
  const snapshot = {
    commit: 'a'.repeat(40),
    inventoryPaths: ['package.json'],
    checks: [{ id: 'lockfile', state: 'observed' }],
    scope: 'repository_configuration',
    limitations: ['Static configuration only.'],
    ciDependencies: assessCiDependencies({
      paths: ['.github/workflows/ci.yml'],
      contents: {
        '.github/workflows/ci.yml':
          'jobs:\n  build:\n    steps:\n      - uses: actions/checkout@v4\n',
      },
      unreadable: [],
      incomplete: false,
    }),
  };
  it('keeps manual projects explicitly unsupported and context self-reported', async () => {
    const { db, service } = harness();
    db.projectRepositorySource.findFirst.mockResolvedValue(null);
    const result = await service.security(owner, 'project-1');
    expect(result.baseline.status).toBe('unsupported');
    expect(result.baseline.checks).toEqual([]);
    expect(result.context).toMatchObject({
      internetFacing: 'unknown',
      sensitiveData: 'unknown',
      provenance: 'self_reported',
      updatedAt: null,
    });
  });
  it('checks project ownership before reading a source or invoking the provider', async () => {
    const { db, provider, service } = harness();
    db.securityProject.findFirst.mockResolvedValue(null);
    await expect(service.security('bob', 'project-1')).rejects.toThrow('Project not found');
    await expect(service.checkBaseline('bob', 'project-1')).rejects.toThrow('Project not found');
    expect(db.projectRepositorySource.findFirst).not.toHaveBeenCalled();
    expect(provider.baseline).not.toHaveBeenCalled();
  });
  it('keeps old snapshots readable while requiring a CI dependency recheck', async () => {
    const { db, service } = harness();
    db.projectRepositorySource.findFirst.mockResolvedValue({
      ...source(),
      baseline: { ...snapshot, ciDependencies: undefined },
      baselineCheckedAt: now,
    });
    const result = await service.security(owner, 'project-1');
    expect(result.baseline.status).toBe('current');
    expect(result.baseline.checks).toEqual(snapshot.checks);
    expect(result.baseline.ciDependencies).toBeNull();
  });
  it('updates only owner-bound self-reported context without changing finding priority', async () => {
    const { db, service } = harness();
    await service.updateContext(owner, 'project-1', {
      internetFacing: 'no',
      sensitiveData: 'yes',
      hosting: 'Private hosting',
    });
    expect(db.securityProject.updateMany).toHaveBeenCalledWith({
      where: { id: 'project-1', ...projectScope(owner, 'contribute') },
      data: {
        internetFacing: 'no',
        sensitiveData: 'yes',
        hosting: 'Private hosting',
        contextUpdatedAt: now,
      },
    });
    db.securityProject.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.updateContext('bob', 'project-1', {
        internetFacing: 'no',
        sensitiveData: 'no',
        hosting: '',
      }),
    ).rejects.toThrow('Project not found');
  });
  it('shows old evidence as stale after source changes, pauses or collection failure', async () => {
    const { db, service } = harness();
    for (const change of [
      { observedCommit: 'b'.repeat(40) },
      { paused: true },
      { baselineError: 'A check failed.' },
      { status: 'disconnected' },
    ]) {
      db.projectRepositorySource.findFirst.mockResolvedValue({
        ...source(),
        baseline: snapshot,
        baselineCheckedAt: now,
        ...change,
      });
      const result = await service.security(owner, 'project-1');
      expect(result.baseline.status).toBe('stale');
      expect(result.baseline.commit).toBe('a'.repeat(40));
      expect(result.baseline.checks).toEqual(snapshot.checks);
      expect(result.baseline.ciDependencies).toEqual(snapshot.ciDependencies);
    }
  });
  it('reads the imported SHA and conditionally persists only while source identity is unchanged', async () => {
    const { db, provider, service } = harness();
    await service.checkBaseline(owner, 'project-1');
    expect(provider.baseline).toHaveBeenCalledWith(
      'gitlab',
      'read-token',
      { id: '42' },
      'a'.repeat(40),
      ['package.json'],
    );
    expect(db.projectRepositorySource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: owner,
          importedCommit: 'a'.repeat(40),
          branch: 'main',
          paths: { equals: ['package.json'] },
          connection: { status: 'connected' },
        }),
        data: expect.objectContaining({ baselineCheckedAt: now, baselineError: null }),
      }),
    );
    db.projectRepositorySource.updateMany.mockImplementation(async (input) => ({
      count: input.data.baseline ? 0 : 1,
    }));
    await expect(service.checkBaseline(owner, 'project-1')).rejects.toThrow('changed during');
  });
  it('retains previous evidence on provider failure and never stores exception secrets', async () => {
    const { db, provider, service } = harness();
    provider.baseline.mockRejectedValue(new Error('sensitive-token-from-provider'));
    await expect(service.checkBaseline(owner, 'project-1')).rejects.toThrow(
      'sensitive-token-from-provider',
    );
    const failure = db.projectRepositorySource.updateMany.mock.calls.find(
      ([input]) => input.data.baselineError,
    )?.[0];
    expect(failure.data.baselineError).toContain('Previous evidence is retained');
    expect(JSON.stringify(failure)).not.toContain('sensitive-token');
    expect(failure.data).not.toHaveProperty('baseline');
    expect(failure.data).not.toHaveProperty('baselineCheckedAt');
  });
  it('retains stale evidence when paths change at the same commit and inventory sync succeeds before a failed check', async () => {
    const { db, provider, service } = harness();
    const nextPaths = ['services/api/package.json'];
    let current = { ...source(), baseline: snapshot, baselineCheckedAt: now };
    db.projectRepositorySource.findFirst.mockImplementation(async () => current);
    db.projectRepositorySource.updateMany.mockImplementation(async (input) => {
      current = { ...current, ...input.data };
      return { count: 1 };
    });
    provider.snapshot.mockResolvedValue({
      commit: snapshot.commit,
      digest: 'new-selection',
      files: [],
      packages: [],
      warnings: [],
    });
    await service.updateSource(owner, 'source-1', { paths: nextPaths });
    expect((await service.security(owner, 'project-1')).baseline.status).toBe('stale');
    // Inventory sync may complete independently before the configuration collection.
    current = {
      ...current,
      status: 'current',
      importedCommit: snapshot.commit,
      observedCommit: snapshot.commit,
    };
    expect((await service.security(owner, 'project-1')).baseline.status).toBe('stale');
    provider.baseline.mockRejectedValue(new Error('Synthetic collection outage'));
    await service.sync(owner, 'source-1');
    const result = await service.security(owner, 'project-1');
    expect(current.status).toBe('current');
    expect(result.baseline.status).toBe('stale');
    expect(result.baseline.inventoryPaths).toEqual(['package.json']);
    expect(result.repository?.paths).toEqual(nextPaths);
    expect(result.baseline.checks).toEqual(snapshot.checks);
    expect(result.baseline.error).toContain('Previous evidence is retained');
  });
  it('marks old snapshots without path provenance stale and rejects mismatched provider scope', async () => {
    const { db, provider, service } = harness();
    db.projectRepositorySource.findFirst.mockResolvedValue({
      ...source(),
      baseline: { ...snapshot, inventoryPaths: undefined },
      baselineCheckedAt: now,
    });
    expect((await service.security(owner, 'project-1')).baseline.status).toBe('stale');
    provider.baseline.mockResolvedValue({ ...snapshot, inventoryPaths: ['other/package.json'] });
    await expect(service.checkBaseline(owner, 'project-1')).rejects.toThrow('selected paths');
    expect(
      db.projectRepositorySource.updateMany.mock.calls.some(([input]) => input.data.baseline),
    ).toBe(false);
  });
  it('does not run simultaneous checks or check a paused source', async () => {
    const { db, provider, service } = harness();
    db.projectRepositorySource.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.checkBaseline(owner, 'project-1')).rejects.toThrow('already running');
    expect(provider.baseline).not.toHaveBeenCalled();
    db.projectRepositorySource.findFirst.mockResolvedValue({ ...source(), paused: true });
    await expect(service.checkBaseline(owner, 'project-1')).rejects.toThrow('active repository');
  });
});

describe('repository ownership and lifecycle', () => {
  it('returns safe connection metadata without encrypted credentials or refresh material', async () => {
    const { service } = harness();
    const result = await service.listConnections(owner);
    expect(result.connections[0]?.accountName).toBe('alice-provider');
    expect(JSON.stringify(result)).not.toContain('credentials');
    expect(JSON.stringify(result)).not.toContain('old-refresh');
  });
  it('never calls the provider for a connection not owned by the session', async () => {
    const { db, provider, service } = harness();
    db.repositoryConnection.findFirst.mockResolvedValue(null);
    await expect(service.repositories('bob', 'connection-1')).rejects.toThrow('not found');
    expect(db.repositoryConnection.findFirst).toHaveBeenCalledWith({
      where: { id: 'connection-1', userId: 'bob' },
    });
    expect(provider.identity).not.toHaveBeenCalled();
  });
  it('binds callback state to the current owner, expiry and one-time claim before exchanging codes', async () => {
    const { db, provider, service } = harness();
    db.repositoryConnectionAttempt.findFirst.mockResolvedValue({
      id: 'attempt',
      userId: owner,
      provider: 'gitlab',
      stateHash: stateHash('state'),
      verifier: encryptCredential('verifier', `wisesama:${owner}:attempt:gitlab`, key),
      installationId: null,
      consumedAt: null,
      expiresAt: new Date(now.getTime() + 1000),
    });
    db.repositoryConnectionAttempt.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.callback(owner, 'gitlab', { state: 'state', code: 'code' }),
    ).rejects.toThrow('already used');
    expect(db.repositoryConnectionAttempt.findFirst.mock.calls[0]?.[0].where).toMatchObject({
      userId: owner,
      provider: 'gitlab',
      stateHash: stateHash('state'),
      consumedAt: null,
      expiresAt: { gt: now },
    });
    expect(provider.exchange).not.toHaveBeenCalled();
  });
  it('does not save an installation or credentials when verified provider ownership fails', async () => {
    const { db, provider, service } = harness();
    db.repositoryConnectionAttempt.findFirst.mockResolvedValue({
      id: 'attempt',
      verifier: encryptCredential('verifier', `wisesama:${owner}:attempt:github`, key),
      installationId: '9',
    });
    provider.exchange.mockResolvedValue({ accessToken: 'provider-token' });
    provider.identity.mockRejectedValue(new Error('installation not accessible'));
    await expect(
      service.callback(owner, 'github', { state: 'state', code: 'code' }),
    ).rejects.toThrow('installation not accessible');
    expect(db.repositoryConnection.create).not.toHaveBeenCalled();
    expect(db.repositoryConnection.update).not.toHaveBeenCalled();
  });
  it('atomically persists both rotated GitLab tokens and prevents concurrent refresh', async () => {
    const { db, provider, service } = harness();
    const value = { ...connected(), expiresAt: new Date(now.getTime() - 1000) };
    db.repositoryConnection.findFirst.mockResolvedValue(value);
    provider.refresh.mockResolvedValue({
      accessToken: 'new-access',
      refreshToken: 'new-refresh',
      expiresAt: new Date(now.getTime() + 7200_000).toISOString(),
    });
    await service.repositories(owner, 'connection-1');
    const replacement = db.repositoryConnection.updateMany.mock.calls.find(
      ([input]) => typeof input.data.credentials === 'string',
    )?.[0];
    expect(replacement).toBeDefined();
    expect(
      JSON.parse(decryptCredential(replacement!.data.credentials, `wisesama:${owner}:gitlab`, key)),
    ).toMatchObject({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    expect(provider.identity).toHaveBeenCalledWith('gitlab', 'new-access', undefined);
    const blocked = harness();
    blocked.db.repositoryConnection.findFirst.mockResolvedValue(value);
    blocked.db.repositoryConnection.updateMany.mockResolvedValue({ count: 0 });
    await expect(blocked.service.repositories(owner, 'connection-1')).rejects.toThrow(
      'is refreshing',
    );
    expect(blocked.provider.refresh).not.toHaveBeenCalled();
  });
  it('retains the last imported snapshot when refresh fails and exposes the failed state', async () => {
    const { db, provider, service } = harness();
    provider.snapshot.mockRejectedValue(new Error('Provider down'));
    await expect(service.sync(owner, 'source-1')).rejects.toThrow('Provider down');
    expect(db.securityProject.updateMany).not.toHaveBeenCalled();
    const failure = db.projectRepositorySource.updateMany.mock.calls.find(
      ([input]) => input.data.status === 'failed',
    )?.[0];
    expect(failure?.data.error).toContain('previous inventory is retained');
    expect(failure?.data).not.toHaveProperty('importedCommit');
    expect(failure?.data).not.toHaveProperty('lastSyncedAt');
  });
  it('requires a fresh review if the branch changed after inventory preview', async () => {
    const { db, provider, service } = harness();
    provider.snapshot.mockResolvedValue({
      commit: 'b'.repeat(40),
      digest: 'next-digest',
      files: [],
      packages: [],
      warnings: [],
    });
    await expect(
      service.createProject(owner, {
        organizationId: 'org-1',
        connectionId: 'connection-1',
        repositoryId: '42',
        branch: 'main',
        paths: ['package.json'],
        name: 'Service',
        environment: 'development',
        expectedCommit: 'a'.repeat(40),
      }),
    ).rejects.toThrow('changed since your preview');
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.securityProject.create).not.toHaveBeenCalled();
    expect(db.projectRepositorySource.create).not.toHaveBeenCalled();
  });
  it('does not apply an in-flight snapshot after the source is paused or reconfigured', async () => {
    const { db, provider, service } = harness();
    provider.snapshot.mockResolvedValue({
      commit: 'b'.repeat(40),
      digest: 'next-digest',
      files: [],
      packages: [],
      warnings: [],
    });
    db.projectRepositorySource.updateMany.mockImplementation(async (input) => ({
      count: input.data.status === 'current' ? 0 : 1,
    }));
    await expect(service.sync(owner, 'source-1')).rejects.toThrow('changed during sync');
    expect(db.securityProject.updateMany).not.toHaveBeenCalled();
  });
  it('removes provider credentials and detaches linked projects without deleting findings', async () => {
    const { db, service } = harness();
    await service.disconnect(owner, 'connection-1');
    expect(db.repositoryConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'connection-1', userId: owner },
        data: expect.objectContaining({ credentials: null, status: 'disconnected' }),
      }),
    );
    expect(db.projectRepositorySource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: owner, connectionId: 'connection-1' },
        data: expect.objectContaining({ paused: true, status: 'disconnected' }),
      }),
    );
    expect(db.securityProject.updateMany).not.toHaveBeenCalled();
  });
  it('invalidates detached inventory and restores repository packages even if the saved digest matches', async () => {
    const { db, provider, service } = harness();
    await service.disconnectSource(owner, 'source-1');
    expect(db.projectRepositorySource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'disconnected', inventoryDigest: null }),
      }),
    );
    const repositoryPackages = [{ name: 'fixture', version: '2.0.0', ecosystem: 'npm' }];
    db.securityProject.findFirst.mockResolvedValue({
      id: 'project-1',
      organizationId: 'org-1',
      userId: owner,
      packages: [{ name: 'manual-override', version: '1.0.0', ecosystem: 'npm' }],
    });
    provider.snapshot.mockResolvedValue({
      commit: 'a'.repeat(40),
      digest: 'previous-digest',
      files: [],
      packages: repositoryPackages,
      warnings: [],
    });
    await service.sync(owner, 'source-1');
    expect(db.securityProject.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ packages: repositoryPackages }) }),
    );
  });
  it('rejects unsigned webhook payloads before any durable write', async () => {
    const { db, service } = harness();
    await expect(
      service.webhook('github', '{}', {
        'x-github-delivery': 'delivery-id',
        'x-github-event': 'push',
      }),
    ).rejects.toThrow('signature');
    expect(db.$transaction).not.toHaveBeenCalled();
  });
  it('accepts a durably recorded duplicate without queuing work twice', async () => {
    const { createHmac } = await import('node:crypto');
    const { db, service } = harness();
    const raw = '{}';
    db.repositoryWebhookDelivery.createMany.mockResolvedValue({ count: 0 });
    const result = await service.webhook('github', raw, {
      'x-github-delivery': 'delivery-id',
      'x-github-event': 'push',
      'x-hub-signature-256': `sha256=${createHmac('sha256', env.GITHUB_APP_WEBHOOK_SECRET).update(raw).digest('hex')}`,
    });
    expect(result).toEqual({ accepted: true, duplicate: true });
    expect(db.projectRepositorySource.updateMany).not.toHaveBeenCalled();
  });
  it('queues the tracked branch for reconciliation rather than applying webhook-provided commit data', async () => {
    const { createHmac } = await import('node:crypto');
    const { db, service } = harness();
    const raw = JSON.stringify({
      repository: { id: 42 },
      ref: 'refs/heads/main',
      after: 'untrusted-commit',
    });
    await service.webhook('github', raw, {
      'x-github-delivery': 'delivery-id',
      'x-github-event': 'push',
      'x-hub-signature-256': `sha256=${createHmac('sha256', env.GITHUB_APP_WEBHOOK_SECRET).update(raw).digest('hex')}`,
    });
    expect(db.projectRepositorySource.updateMany).toHaveBeenCalledWith({
      where: {
        provider: 'github',
        repositoryId: '42',
        paused: false,
        branch: 'main',
        status: { not: 'disconnected' },
      },
      data: { nextSyncAt: now },
    });
    expect(db.securityProject.updateMany).not.toHaveBeenCalled();
  });
  it('erases revoked GitHub user credentials and pauses their sources immediately', async () => {
    const { createHmac } = await import('node:crypto');
    const { db, service, provider } = harness();
    const raw = JSON.stringify({ action: 'revoked', sender: { id: 1 } });
    await service.webhook('github', raw, {
      'x-github-delivery': 'revoked-delivery',
      'x-github-event': 'github_app_authorization',
      'x-hub-signature-256': `sha256=${createHmac('sha256', env.GITHUB_APP_WEBHOOK_SECRET).update(raw).digest('hex')}`,
    });
    expect(db.repositoryConnection.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { provider: 'github', providerUserId: '1' },
        data: expect.objectContaining({ status: 'access_removed', credentials: null }),
      }),
    );
    expect(db.projectRepositorySource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ paused: true, status: 'access_removed' }),
      }),
    );
    expect(provider.identity).not.toHaveBeenCalled();
  });
});

describe('organization repository boundaries', () => {
  it('lets a member inspect shared evidence and recheck only the linked source using its original connector', async () => {
    const { db, provider, service, access } = harness();
    access.members.set('bob', 'member');
    const result = await service.security('bob', 'project-1');
    expect(result.project.organizationId).toBe('org-1');
    await service.checkBaseline('bob', 'project-1');
    expect(db.repositoryConnection.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'connection-1',
          userId: owner,
          owner: expect.objectContaining({ intelSuspendedAt: null }),
        }),
      }),
    );
    expect(provider.baseline).toHaveBeenCalledWith(
      'gitlab',
      'read-token',
      { id: '42' },
      'a'.repeat(40),
      ['package.json'],
    );
    expect(provider.list).not.toHaveBeenCalled();
    expect(db.projectRepositorySource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: owner, project: projectScope('bob') }),
        data: expect.objectContaining({ baselineCheckedAt: now }),
      }),
    );
  });
  it('allows member context contributions but rejects source management and project creation before provider access', async () => {
    const { db, provider, service, access } = harness();
    access.members.set('bob', 'member');
    await service.updateContext('bob', 'project-1', {
      internetFacing: 'unknown',
      sensitiveData: 'yes',
      hosting: 'Managed hosting',
    });
    await expect(service.sync('bob', 'source-1')).rejects.toMatchObject({ statusCode: 403 });
    await expect(
      service.createProject('bob', {
        organizationId: 'org-1',
        connectionId: 'connection-1',
        repositoryId: '42',
        branch: 'main',
        paths: ['package.json'],
        name: 'New project',
        environment: 'development',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(provider.snapshot).not.toHaveBeenCalled();
    expect(db.repositoryConnection.findFirst).not.toHaveBeenCalled();
    expect(db.securityProject.create).not.toHaveBeenCalled();
  });
  it('retains shared evidence after connector removal but blocks all further credential reads', async () => {
    const { db, provider, service, access } = harness();
    access.members.set('bob', 'member');
    access.members.delete(owner);
    db.projectRepositorySource.findFirst.mockResolvedValue({
      ...source(),
      baseline: {
        commit: 'a'.repeat(40),
        inventoryPaths: ['package.json'],
        checks: [{ id: 'lockfile', state: 'observed' }],
        limitations: [],
      },
    });
    expect((await service.security('bob', 'project-1')).baseline.checks).toHaveLength(1);
    await expect(service.checkBaseline('bob', 'project-1')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(db.repositoryConnection.findFirst).not.toHaveBeenCalled();
    expect(provider.baseline).not.toHaveBeenCalled();
  });
  it('does not persist an in-flight baseline after caller membership is revoked', async () => {
    const { db, provider, service, access } = harness();
    access.members.set('bob', 'member');
    provider.baseline.mockImplementation(async () => {
      access.members.delete('bob');
      return {
        commit: 'a'.repeat(40),
        inventoryPaths: ['package.json'],
        checks: [],
        limitations: [],
      };
    });
    await expect(service.checkBaseline('bob', 'project-1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(
      db.projectRepositorySource.updateMany.mock.calls.some(([query]) => query.data.baseline),
    ).toBe(false);
  });
  it('allows an admin to detach a shared source but not expand the original connector repository access', async () => {
    const { db, provider, service, access } = harness();
    access.members.set('carol', 'admin');
    await expect(
      service.updateSource('carol', 'source-1', { paths: ['package-lock.json'] }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(provider.snapshot).not.toHaveBeenCalled();
    expect(db.repositoryConnection.findFirst).not.toHaveBeenCalled();
    await service.disconnectSource('carol', 'source-1');
    expect(db.projectRepositorySource.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'source-1', userId: owner, project: projectScope('carol', 'manage') },
        data: expect.objectContaining({ status: 'disconnected' }),
      }),
    );
  });
  it('rejects a different organization before listing sources and suspended members before source reads', async () => {
    const { db, provider, service, access } = harness();
    await expect(service.listSources(owner, 'org-other')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(db.projectRepositorySource.findMany).not.toHaveBeenCalled();
    access.suspended.add(owner);
    await expect(service.security(owner, 'project-1')).rejects.toMatchObject({ statusCode: 404 });
    expect(db.projectRepositorySource.findFirst).not.toHaveBeenCalled();
    expect(provider.baseline).not.toHaveBeenCalled();
  });
});

describe('bounded repository jobs', () => {
  it('continues the configured automatic import for an active member connector without granting manual management', async () => {
    const { provider, service, access } = harness();
    access.members.set(owner, 'member');
    provider.snapshot.mockResolvedValue({
      commit: 'a'.repeat(40),
      digest: 'previous-digest',
      packages: [],
      files: [],
      warnings: [],
    });
    await expect(service.sync(owner, 'source-1')).rejects.toMatchObject({ statusCode: 403 });
    await service.syncForJob('source-1');
    expect(provider.snapshot).toHaveBeenCalledWith('gitlab', 'read-token', { id: '42' }, 'main', [
      'package.json',
    ]);
    access.members.delete(owner);
    provider.snapshot.mockClear();
    await expect(service.syncForJob('source-1')).rejects.toMatchObject({ statusCode: 404 });
    expect(provider.snapshot).not.toHaveBeenCalled();
  });
  it('does not continue provider reads when the connector loses membership during identity validation', async () => {
    const { provider, service, access } = harness();
    access.members.set('bob', 'member');
    provider.identity.mockImplementation(async () => {
      access.members.delete(owner);
      return { id: '1', name: 'alice-provider' };
    });
    await expect(service.checkBaseline('bob', 'project-1')).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(provider.selected).not.toHaveBeenCalled();
    expect(provider.readToken).not.toHaveBeenCalled();
    expect(provider.baseline).not.toHaveBeenCalled();
  });
});

describe('scheduled bounded source refresh', () => {
  it('uses the job path for a member connector and stops future reads after removal', async () => {
    const { provider, service, access } = harness();
    access.members.set(owner, 'member');
    provider.snapshot.mockResolvedValue({
      commit: 'a'.repeat(40),
      digest: 'previous-digest',
      packages: [],
      files: [],
      warnings: [],
    });
    expect((await service.runScheduledSyncs()).results[0]).toMatchObject({
      id: 'source-1',
      status: 'synced',
    });
    access.members.delete(owner);
    provider.snapshot.mockClear();
    expect((await service.runScheduledSyncs()).results[0]).toMatchObject({
      id: 'source-1',
      status: 'failed',
    });
    expect(provider.snapshot).not.toHaveBeenCalled();
  });
});

describe('bounded token rotation cancellation', () => {
  it('keeps an accepted personal token rotation but stops provider use after caller revocation', async () => {
    const { db, provider, service, access } = harness();
    access.members.set('bob', 'member');
    db.repositoryConnection.findFirst.mockResolvedValue({
      ...connected(),
      expiresAt: new Date(now.getTime() - 1),
    });
    provider.refresh.mockImplementation(async () => {
      access.members.delete('bob');
      return { accessToken: 'rotated-access', refreshToken: 'rotated-refresh' };
    });
    await expect(service.checkBaseline('bob', 'project-1')).rejects.toMatchObject({
      statusCode: 404,
    });
    expect(provider.identity).not.toHaveBeenCalled();
    expect(provider.baseline).not.toHaveBeenCalled();
    const saved = db.repositoryConnection.updateMany.mock.calls.find(
      ([query]) => query.data.credentials,
    )?.[0];
    expect(saved).toBeDefined();
    expect(
      JSON.parse(decryptCredential(saved!.data.credentials, `wisesama:${owner}:gitlab`, key)),
    ).toMatchObject({ refreshToken: 'rotated-refresh' });
  });
});
