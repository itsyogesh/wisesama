import { createHmac, generateKeyPairSync } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import {
  createRepositoryProvider,
  decryptCredential,
  encryptCredential,
  encryptionKey,
  supportedFile,
  validateGithubWebhook,
  validateGitlabWebhook,
} from '../repository-provider';

const key = Buffer.alloc(32, 7);
const privateKey = generateKeyPairSync('rsa', { modulusLength: 2048 })
  .privateKey.export({ type: 'pkcs8', format: 'pem' })
  .toString();
const env = {
  REPOSITORY_TOKEN_ENCRYPTION_KEY: key.toString('base64'),
  REPOSITORY_API_URL: 'https://api.example.test',
  INTEL_APP_URL: 'https://app.example.test',
  GITHUB_APP_ID: '123',
  GITHUB_APP_PRIVATE_KEY: privateKey,
  GITHUB_APP_CLIENT_ID: 'client',
  GITHUB_APP_CLIENT_SECRET: 'secret',
  GITHUB_APP_SLUG: 'test-app',
  GITHUB_APP_WEBHOOK_SECRET: 'webhook-key',
  GITLAB_CLIENT_ID: 'gitlab-client',
  GITLAB_CLIENT_SECRET: 'gitlab-secret',
};
const repo = {
  id: '42',
  name: 'service',
  fullName: 'team/service',
  owner: 'team',
  defaultBranch: 'main',
  url: 'https://github.com/team/service',
};
const sha = 'a'.repeat(40);
const json = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json' } });

describe('repository provider safety', () => {
  it('accepts surrounding deployment whitespace without accepting malformed encryption keys', () => {
    expect(
      encryptionKey({ REPOSITORY_TOKEN_ENCRYPTION_KEY: ` ${key.toString('base64')}\n` }),
    ).toEqual(key);
    for (const value of [
      '',
      'not-a-key',
      Buffer.alloc(16).toString('base64'),
      key.toString('base64').slice(1),
    ])
      expect(() => encryptionKey({ REPOSITORY_TOKEN_ENCRYPTION_KEY: value })).toThrow(
        'not configured',
      );
  });

  it('keeps actions.lock and local descriptors within scope without counting them as root workflows', async () => {
    const files: Record<string, string> = {
      'package.json': '{}',
      '.github/actions/build/action.yml':
        'runs:\n  using: composite\n  steps:\n    - uses: actions/checkout@v6',
      '.github/workflows/actions.lock': `version: v0.0.3\nworkflows:\n${Array.from({ length: 10 }, (_, i) => `  .github/workflows/${i}.yml:\n    - actions/checkout@v6`).join('\n')}\ndependencies:\n  actions/checkout@v6:\n    ref: v6\n    commit: sha1-${sha}\n    owner_id: 1\n    repo_id: 2`,
      ...Object.fromEntries(
        Array.from({ length: 10 }, (_, i) => [
          `.github/workflows/${i}.yml`,
          'jobs:\n  build:\n    steps:\n      - uses: $/.github/actions/build',
        ]),
      ),
    };
    const request = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/git/trees/'))
        return json({
          tree: Object.keys(files).map((path) => ({ path, type: 'blob', mode: '100644' })),
        });
      const path = new URL(url).pathname.split('/contents/')[1]!;
      const content = files[path];
      if (content === undefined) throw new Error('Unrequested path');
      return json({
        type: 'file',
        encoding: 'base64',
        size: Buffer.byteLength(content),
        content: Buffer.from(content).toString('base64'),
      });
    });
    const result = await createRepositoryProvider({ env, fetch: request }).baseline(
      'github',
      'token',
      repo,
      sha,
      ['package.json'],
    );
    expect(result.ciDependencies.issues).toEqual([]);
    expect(result.ciDependencies.incomplete).toBe(false);
    expect(result.ciDependencies.state).toBe('observed');
    expect(result.ciDependencies.items).toHaveLength(20);
    expect(result.ciDependencies.items.filter((item) => item.state === 'locked')).toHaveLength(10);
    expect(result.ciDependencies.filesChecked).toContain('.github/workflows/actions.lock');
    for (const [url] of request.mock.calls) expect(String(url)).toContain(sha);
  });
  it('collects only allowlisted regular configuration at the imported immutable commit', async () => {
    const files: Record<string, string> = {
      'package.json': JSON.stringify({
        packageManager: 'pnpm@10.16.0',
        privateSecret: 'DO_NOT_STORE_THIS',
      }),
      'pnpm-workspace.yaml': 'minimumReleaseAge: 1440',
      '.github/workflows/ci.yml':
        'jobs:\n  build:\n    steps:\n      - run: pnpm install --frozen-lockfile',
    };
    const request = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/git/trees/'))
        return json({
          tree: [
            ...Object.keys(files).map((path) => ({ path, type: 'blob', mode: '100644' })),
            { path: 'pnpm-lock.yaml', type: 'blob', mode: '100644' },
            { path: '.npmrc', type: 'blob', mode: '100644' },
            { path: '.env', type: 'blob', mode: '100644' },
          ],
        });
      const path = new URL(url).pathname.split('/contents/')[1]!;
      if (!(path in files)) throw new Error(`Unexpected file: ${path}`);
      const content = files[path]!;
      return json({
        type: 'file',
        encoding: 'base64',
        size: Buffer.byteLength(content),
        content: Buffer.from(content).toString('base64'),
      });
    });
    const provider = createRepositoryProvider({ env, fetch: request });
    const result = await provider.baseline('github', 'read-token', repo, sha, ['pnpm-lock.yaml']);
    expect(result.commit).toBe(sha);
    expect(result.checks.find((check) => check.id === 'dependency_cooldown')?.state).toBe(
      'observed',
    );
    expect(JSON.stringify(result)).not.toContain('DO_NOT_STORE_THIS');
    for (const [url] of request.mock.calls) {
      expect(String(url)).toContain(sha);
      expect(String(url)).not.toMatch(/\.env|\.npmrc|commits/);
    }
  });
  it('reads GitLab includes and images from regular files at the same commit without fetching remote includes', async () => {
    const files: Record<string, string> = {
      'package.json': '{}',
      '.gitlab-ci.yml': `include:\n  - local: /.gitlab/ci/test.yml\n  - remote: https://outside.example/ci.yml\ndefault:\n  image: node:22`,
      '.gitlab/ci/test.yml': 'test:\n  image: alpine:3.20\n  script: echo PRIVATE_JOB_SCRIPT',
    };
    const request = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes('/repository/tree?'))
        return json(Object.keys(files).map((path) => ({ path, type: 'blob', mode: '100644' })));
      const path = decodeURIComponent(new URL(url).pathname.split('/repository/files/')[1]!);
      const content = files[path];
      if (content === undefined) throw new Error('Unrequested path');
      return json({
        encoding: 'base64',
        size: Buffer.byteLength(content),
        content: Buffer.from(content).toString('base64'),
      });
    });
    const result = await createRepositoryProvider({ env, fetch: request }).baseline(
      'gitlab',
      'token',
      repo,
      sha,
      ['package.json'],
    );
    expect(
      result.ciDependencies.items.some(
        (item) => item.kind === 'gitlab_include' && item.name === 'https://outside.example/ci.yml',
      ),
    ).toBe(true);
    expect(result.ciDependencies.filesChecked).toContain('.gitlab/ci/test.yml');
    expect(result.ciDependencies.items.filter((item) => item.kind === 'container')).toHaveLength(2);
    expect(JSON.stringify(result)).not.toContain('PRIVATE_JOB_SCRIPT');
    for (const [url] of request.mock.calls) {
      expect(String(url)).toContain('https://gitlab.com/api/v4/');
      expect(String(url)).toContain(sha);
      expect(String(url)).not.toContain('outside.example');
    }
  });
  it('never dereferences a configuration symlink and leaves truncated discovery unknown', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        json({ truncated: true, tree: [{ path: 'package.json', type: 'blob', mode: '120000' }] }),
      );
    const result = await createRepositoryProvider({ env, fetch: request }).baseline(
      'github',
      'read-token',
      repo,
      sha,
      ['package.json'],
    );
    expect(request).toHaveBeenCalledTimes(1);
    expect(result.checks.find((check) => check.id === 'lockfile')?.state).toBe('unknown');
    expect(result.limitations.join(' ')).toContain('could not be read');
  });
  it('does not persist oversized configuration bytes and leaves checks unknown', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(
        json({ tree: [{ path: 'package.json', type: 'blob', mode: '100644' }] }),
      )
      .mockResolvedValueOnce(
        json({ type: 'file', encoding: 'base64', size: 200000, content: 'oversized' }),
      );
    const result = await createRepositoryProvider({ env, fetch: request }).baseline(
      'github',
      'read-token',
      repo,
      sha,
      ['package.json'],
    );
    expect(result.checks.some((check) => check.state === 'unknown')).toBe(true);
    expect(JSON.stringify(result)).not.toContain('oversized');
  });
  it('encrypts credentials with owner/provider binding and rejects tampering', () => {
    const encrypted = encryptCredential('private-token', 'owner1:github', key);
    expect(encrypted).not.toContain('private-token');
    expect(decryptCredential(encrypted, 'owner1:github', key)).toBe('private-token');
    expect(() => decryptCredential(encrypted, 'owner2:github', key)).toThrow('could not be opened');
    expect(() => decryptCredential(encrypted.slice(0, -5), 'owner1:github', key)).toThrow(
      'could not be opened',
    );
  });
  it('fails closed before creating an authorization URL when setup is missing', () => {
    const provider = createRepositoryProvider({ env: {} });
    expect(provider.availability('github').available).toBe(false);
    expect(() => provider.authorize('github', 'state', 'verifier')).toThrow('not configured');
  });
  it('uses GitLab.com read_api with PKCE and a fixed callback origin', () => {
    const provider = createRepositoryProvider({ env });
    const url = new URL(provider.authorize('gitlab', 'state', 'verifier'));
    expect(url.origin).toBe('https://gitlab.com');
    expect(url.searchParams.get('scope')).toBe('read_api');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).not.toBe('verifier');
    expect(url.searchParams.get('redirect_uri')).toBe(
      'https://api.example.test/api/v1/intel/repositories/callback/gitlab',
    );
  });
  it('does not accept an installation merely because its ID appeared in the callback', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 1, login: 'alice' }))
      .mockResolvedValueOnce(json({ installations: [{ id: 9 }] }));
    const provider = createRepositoryProvider({ env, fetch: request });
    await expect(provider.identity('github', 'user-token', '999')).rejects.toThrow(
      'not accessible',
    );
    expect(request.mock.calls[1]?.[0]).toContain('/user/installations?');
  });
  it('uses GitHub App PKCE and requests expiring access without broadening repository permissions', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(
        json({ access_token: 'access', refresh_token: 'refresh', expires_in: 28800 }),
      );
    const provider = createRepositoryProvider({ env, fetch: request });
    const url = new URL(provider.authorize('github', 'state', 'verifier', true));
    expect(url.searchParams.get('scope')).toBe('offline_access');
    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    await provider.exchange('github', 'code', 'verifier');
    expect(
      new URLSearchParams(String((request.mock.calls[0]?.[1] as RequestInit).body)).get(
        'code_verifier',
      ),
    ).toBe('verifier');
  });
  it('limits the repository picker to the user/installation intersection', async () => {
    const request = vi.fn().mockResolvedValue(
      json({
        repositories: [
          {
            id: 42,
            name: 'service',
            full_name: 'team/service',
            default_branch: 'main',
            html_url: repo.url,
          },
        ],
      }),
    );
    const provider = createRepositoryProvider({ env, fetch: request });
    await expect(provider.selected('github', 'user-token', '43', '9')).rejects.toThrow(
      'no longer accessible',
    );
    expect(request.mock.calls[0]?.[0]).toContain('/user/installations/9/repositories');
  });
  it.each([
    'all',
    'selected',
  ] as const)('reports the verified %s installation grant', async (scope) => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(json({ id: 1, login: 'alice' }))
      .mockResolvedValueOnce(
        json({
          installations: [
            { id: 8, account: { login: 'other' }, repository_selection: 'all' },
            { id: 9, account: { login: 'example-team' }, repository_selection: scope },
          ],
        }),
      );
    const provider = createRepositoryProvider({ env, fetch: request });
    await expect(provider.identity('github', 'user-token', '9')).resolves.toEqual({
      id: '1',
      name: 'alice',
      installationId: '9',
      installationAccountName: 'example-team',
      repositorySelection: scope,
    });
  });
  it('pages the authorized list and rechecks a later-page selection against that same installation', async () => {
    const remote = (id: number) => ({
      id,
      name: `service-${id}`,
      full_name: `team/service-${id}`,
      default_branch: 'main',
      html_url: `https://github.com/team/service-${id}`,
    });
    const request = vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      expect(url.pathname).toBe('/user/installations/9/repositories');
      const page = url.searchParams.get('page');
      return json({
        repositories:
          page === '1' ? Array.from({ length: 100 }, (_, i) => remote(i + 1)) : [remote(101)],
      });
    });
    const provider = createRepositoryProvider({ env, fetch: request });
    const first = await provider.list('github', 'user-token', '9', 1);
    expect(first.repositories).toHaveLength(100);
    expect(first.nextPage).toBe(2);
    expect(request).toHaveBeenCalledTimes(1);
    await expect(provider.selected('github', 'user-token', '101', '9')).resolves.toMatchObject({
      id: '101',
    });
    expect(request).toHaveBeenCalledTimes(3);
    await expect(provider.selected('github', 'user-token', '102', '9')).rejects.toThrow(
      'no longer accessible',
    );
  });
  it('narrows short-lived installation tokens to one repository and read permissions', async () => {
    const request = vi.fn().mockResolvedValue(json({ token: 'short-lived' }));
    const provider = createRepositoryProvider({ env, fetch: request });
    expect(await provider.readToken('github', 'user-token', '42', '9')).toBe('short-lived');
    const init = request.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(init.body))).toEqual({
      repository_ids: [42],
      permissions: { contents: 'read', metadata: 'read' },
    });
    expect((init.headers as Record<string, string>).Authorization).not.toBe('Bearer user-token');
  });
  it('reads all selected files at one immutable SHA and reports repository-wide scope', async () => {
    const content = JSON.stringify({ name: 'service', dependencies: { lodash: '4.17.20' } });
    const request = vi
      .fn()
      .mockResolvedValueOnce(json({ sha }))
      .mockResolvedValueOnce(
        json({ tree: [{ path: 'package.json', type: 'blob', mode: '100644' }] }),
      )
      .mockResolvedValueOnce(
        json({
          type: 'file',
          encoding: 'base64',
          size: Buffer.byteLength(content),
          content: Buffer.from(content).toString('base64'),
        }),
      );
    const provider = createRepositoryProvider({ env, fetch: request });
    const snapshot = await provider.snapshot('github', 'read-token', repo, 'main', [
      'package.json',
    ]);
    expect(snapshot.commit).toBe(sha);
    expect(snapshot.packages).toEqual([{ name: 'lodash', version: '4.17.20', ecosystem: 'npm' }]);
    expect(snapshot.scope).toBe('repository_inventory');
    expect(String(request.mock.calls[2]?.[0])).toContain(`?ref=${sha}`);
    expect(snapshot.warnings.join(' ')).toContain('does not establish deployed');
  });
  it('rejects symlinks before an endpoint can dereference their contents', async () => {
    const request = vi
      .fn()
      .mockResolvedValueOnce(json({ sha }))
      .mockResolvedValueOnce(
        json({ tree: [{ path: 'package.json', type: 'blob', mode: '120000' }] }),
      );
    const provider = createRepositoryProvider({ env, fetch: request });
    await expect(
      provider.snapshot('github', 'token', repo, 'main', ['package.json']),
    ).rejects.toThrow('Symlinks');
    expect(request).toHaveBeenCalledTimes(2);
  });
  it('does not follow provider redirects or expose rejected response contents', async () => {
    const request = vi.fn().mockResolvedValue(json({ secret: 'do-not-reflect' }, 403));
    const provider = createRepositoryProvider({ env, fetch: request });
    await expect(provider.list('gitlab', 'token')).rejects.toThrow('Provider access');
    expect((request.mock.calls[0]?.[1] as RequestInit).redirect).toBe('error');
  });
  it('rejects traversal and generated paths while supporting nested lockfiles', () => {
    for (const path of [
      '../package.json',
      '/package.json',
      'node_modules/a/package.json',
      'a\\package.json',
      '.git/package.json',
    ])
      expect(supportedFile(path)).toBeNull();
    expect(supportedFile('services/api/pnpm-lock.yaml')).toBe('pnpm-lock');
  });
  it('validates GitHub signatures over the exact body', () => {
    const body = '{"ref":"refs/heads/main"}',
      secret = 'test-key';
    const signature = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
    expect(validateGithubWebhook(body, signature, secret)).toBe(true);
    expect(validateGithubWebhook(`${body} `, signature, secret)).toBe(false);
    expect(validateGithubWebhook(body, 'sha256=bad', secret)).toBe(false);
  });
  it('validates modern GitLab signed headers and rejects stale replays', () => {
    const now = new Date('2026-11-04T00:00:00Z'),
      timestamp = String(now.getTime() / 1000),
      body = '{}',
      id = 'delivery-1';
    const secret = `whsec_${key.toString('base64')}`;
    const signature = `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
    expect(validateGitlabWebhook(body, { id, timestamp, signature }, secret, now)).toBe(true);
    expect(
      validateGitlabWebhook(
        body,
        { id, timestamp, signature },
        secret,
        new Date(now.getTime() + 301_000),
      ),
    ).toBe(false);
    expect(validateGitlabWebhook(body, { id: 'other', timestamp, signature }, secret, now)).toBe(
      false,
    );
  });
  it('requires both rotating GitLab credentials instead of retaining an invalidated refresh token', async () => {
    const request = vi
      .fn()
      .mockResolvedValue(json({ access_token: 'new-token', expires_in: 7200 }));
    const provider = createRepositoryProvider({ env, fetch: request });
    await expect(provider.refresh('gitlab', 'old-refresh')).rejects.toThrow(
      'rotating access credentials',
    );
  });
});
