import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  sign,
  timingSafeEqual,
} from 'node:crypto';
import { ciDependencyConfigPath } from './intel/ci-dependencies';
import { parseInventory } from './intel/inventory';
import {
  assessRepositoryBaseline,
  baselineConfigPath,
  baselineRoots,
} from './intel/repository-baseline';
import type { InventoryFormat, InventoryPackage } from './intel/types';

export type RepositoryProvider = 'github' | 'gitlab';
export type RepositoryTokens = { accessToken: string; refreshToken?: string; expiresAt?: string };
export type RepositoryIdentity = {
  id: string;
  name: string;
  installationId?: string;
  installationAccountName?: string;
  repositorySelection?: 'all' | 'selected';
};
export const MAX_REPOSITORY_PAGES = 10;
export type RepositoryItem = {
  id: string;
  name: string;
  fullName: string;
  owner: string;
  defaultBranch: string;
  url: string;
};
export type RepositoryFile = { path: string; format: InventoryFormat; size: number | null };
export class RepositoryError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'RepositoryError';
  }
}

export const stateHash = (value: string) => createHash('sha256').update(value).digest('hex');
export const randomSecret = () => randomBytes(32).toString('base64url');
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
const str = (value: unknown) => (typeof value === 'string' ? value : '');
const numericId = (value: unknown) => {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value);
  if (typeof value === 'string' && /^[1-9]\d{0,18}$/.test(value)) return value;
  throw new RepositoryError(502, 'The repository provider returned an invalid identifier.');
};

export function encryptionKey(env: NodeJS.ProcessEnv) {
  const value = env.REPOSITORY_TOKEN_ENCRYPTION_KEY?.trim();
  if (!value || !/^[A-Za-z0-9+/]{43}=$/.test(value))
    throw new RepositoryError(503, 'Repository credential storage is not configured.');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32)
    throw new RepositoryError(503, 'Repository credential storage is not configured.');
  return key;
}

export function encryptCredential(value: string, context: string, key: Buffer) {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  cipher.setAAD(Buffer.from(context));
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return [
    'v1',
    nonce.toString('base64url'),
    cipher.getAuthTag().toString('base64url'),
    encrypted.toString('base64url'),
  ].join('.');
}

export function decryptCredential(envelope: string, context: string, key: Buffer) {
  try {
    const [version, iv, tag, ciphertext, extra] = envelope.split('.');
    if (version !== 'v1' || !iv || !tag || !ciphertext || extra) throw new Error('Envelope');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'base64url'));
    decipher.setAAD(Buffer.from(context));
    decipher.setAuthTag(Buffer.from(tag, 'base64url'));
    return Buffer.concat([
      decipher.update(Buffer.from(ciphertext, 'base64url')),
      decipher.final(),
    ]).toString('utf8');
  } catch {
    throw new RepositoryError(
      503,
      'Stored repository access could not be opened. Reconnect the provider.',
    );
  }
}

export function supportedFile(path: string): InventoryFormat | null {
  if (!validInventoryPath(path)) return null;
  const name = path.split('/').at(-1);
  if (name === 'package-lock.json' || name === 'npm-shrinkwrap.json') return 'package-lock';
  if (name === 'pnpm-lock.yaml') return 'pnpm-lock';
  if (name === 'package.json') return 'package-json';
  if (name === 'wisesama-inventory.json') return 'inventory';
  return null;
}

export function validInventoryPath(path: string) {
  return (
    path.length > 0 &&
    path.length <= 600 &&
    !path.startsWith('/') &&
    !path.includes('\\') &&
    !Array.from(path).some(
      (character) => character.charCodeAt(0) < 32 || character.charCodeAt(0) === 127,
    ) &&
    path.split('/').length <= 12 &&
    path
      .split('/')
      .every(
        (part) =>
          part !== '' &&
          part !== '.' &&
          part !== '..' &&
          !['node_modules', '.git', '.next', 'dist', 'vendor', '.venv', 'build'].includes(part),
      )
  );
}

export function validateGithubWebhook(raw: string, signature: string, secret: string) {
  if (!secret || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = `sha256=${createHmac('sha256', secret).update(raw).digest('hex')}`;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}

export function validateGitlabWebhook(
  raw: string,
  headers: { id: string; timestamp: string; signature: string },
  secret: string,
  now = new Date(),
) {
  if (
    !secret.startsWith('whsec_') ||
    !/^\d{10,12}$/.test(headers.timestamp) ||
    Math.abs(now.getTime() / 1000 - Number(headers.timestamp)) > 300 ||
    !headers.id ||
    headers.id.length > 150
  )
    return false;
  const key = Buffer.from(secret.slice(6), 'base64');
  if (key.length < 16) return false;
  const expected = `v1,${createHmac('sha256', key).update(`${headers.id}.${headers.timestamp}.${raw}`).digest('base64')}`;
  return headers.signature
    .split(' ')
    .some(
      (value) =>
        value.length === expected.length &&
        timingSafeEqual(Buffer.from(value), Buffer.from(expected)),
    );
}

export function createRepositoryProvider(
  options: { env?: NodeJS.ProcessEnv; fetch?: typeof fetch; now?: () => Date } = {},
) {
  const env = options.env ?? process.env;
  const fetcher = options.fetch ?? fetch;
  const now = options.now ?? (() => new Date());
  const reportedSetup = new Set<RepositoryProvider>();
  function availability(provider: RepositoryProvider) {
    const keys =
      provider === 'github'
        ? [
            'GITHUB_APP_ID',
            'GITHUB_APP_PRIVATE_KEY',
            'GITHUB_APP_CLIENT_ID',
            'GITHUB_APP_CLIENT_SECRET',
            'GITHUB_APP_SLUG',
            'GITHUB_APP_WEBHOOK_SECRET',
          ]
        : ['GITLAB_CLIENT_ID', 'GITLAB_CLIENT_SECRET'];
    let storage = false;
    try {
      encryptionKey(env);
      storage = true;
    } catch {
      /* Expose safe setup status only. */
    }
    const available =
      storage &&
      keys.every((name) => Boolean(env[name])) &&
      Boolean(env.REPOSITORY_API_URL) &&
      Boolean(env.INTEL_APP_URL);
    if (!available && !reportedSetup.has(provider)) {
      reportedSetup.add(provider);
      console.warn('Repository integration setup incomplete', {
        provider,
        credentialStorageConfigured: storage,
        missingSettings: keys.filter((name) => !env[name]?.trim()),
        callbackConfigured: Boolean(env.REPOSITORY_API_URL?.trim()),
        applicationConfigured: Boolean(env.INTEL_APP_URL?.trim()),
      });
    }
    return {
      provider,
      available,
      reason: available ? null : 'Provider setup is required before connecting.',
      permissions:
        provider === 'github'
          ? 'Read-only contents and metadata within the GitHub installation grant'
          : 'GitLab.com read_api (user-wide read access)',
      method:
        provider === 'github'
          ? 'Signed push webhooks and scheduled reconciliation'
          : 'Scheduled polling',
    };
  }
  function configured(provider: RepositoryProvider) {
    if (!availability(provider).available)
      throw new RepositoryError(
        503,
        `${provider === 'github' ? 'GitHub' : 'GitLab.com'} is not configured yet.`,
      );
  }
  function callback(provider: RepositoryProvider) {
    const base = new URL(env.REPOSITORY_API_URL || 'http://localhost:3001');
    if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname))
      throw new RepositoryError(503, 'Repository callbacks require HTTPS.');
    return new URL(`/api/v1/intel/repositories/callback/${provider}`, base).toString();
  }
  async function request(
    url: string,
    init: RequestInit = {},
    limit = 4 * 1024 * 1024,
  ): Promise<unknown> {
    let response: Response;
    try {
      response = await fetcher(url, {
        ...init,
        redirect: 'error',
        signal: AbortSignal.timeout(15_000),
      });
    } catch {
      throw new RepositoryError(502, 'The repository provider could not be reached. Try again.');
    }
    if (!response.ok)
      throw new RepositoryError(
        response.status === 401 || response.status === 403
          ? 403
          : response.status === 404
            ? 404
            : 502,
        response.status === 401 || response.status === 403
          ? 'Provider access is unavailable. Reconnect or update repository permissions.'
          : response.status === 404
            ? 'Repository or branch not found, or access was removed.'
            : 'The repository provider could not complete the request.',
      );
    const length = Number(response.headers.get('content-length'));
    if (length > limit)
      throw new RepositoryError(413, 'The provider response exceeds the safe import limit.');
    const reader = response.body?.getReader();
    if (!reader) throw new RepositoryError(502, 'The repository provider returned no response.');
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      total += chunk.value.byteLength;
      if (total > limit) {
        await reader.cancel();
        throw new RepositoryError(413, 'The provider response exceeds the safe import limit.');
      }
      chunks.push(chunk.value);
    }
    try {
      return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    } catch {
      throw new RepositoryError(502, 'The repository provider returned an invalid response.');
    }
  }
  const gh = (path: string, token: string, init?: RequestInit, limit?: number) =>
    request(
      `https://api.github.com${path}`,
      {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          Authorization: `Bearer ${token}`,
          ...init?.headers,
        },
      },
      limit,
    );
  const gl = (path: string, token: string) =>
    request(`https://gitlab.com/api/v4${path}`, { headers: { Authorization: `Bearer ${token}` } });
  function authorize(
    provider: RepositoryProvider,
    state: string,
    verifier: string,
    userAuthorization = false,
  ) {
    configured(provider);
    if (provider === 'github' && !userAuthorization)
      return `https://github.com/apps/${encodeURIComponent(env.GITHUB_APP_SLUG!)}/installations/new?state=${encodeURIComponent(state)}`;
    const url = new URL(
      provider === 'github'
        ? 'https://github.com/login/oauth/authorize'
        : 'https://gitlab.com/oauth/authorize',
    );
    url.searchParams.set(
      'client_id',
      provider === 'github' ? env.GITHUB_APP_CLIENT_ID! : env.GITLAB_CLIENT_ID!,
    );
    url.searchParams.set('redirect_uri', callback(provider));
    url.searchParams.set('state', state);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('scope', provider === 'gitlab' ? 'read_api' : 'offline_access');
    url.searchParams.set(
      'code_challenge',
      createHash('sha256').update(verifier).digest('base64url'),
    );
    url.searchParams.set('code_challenge_method', 'S256');
    return url.toString();
  }
  async function tokenRequest(provider: RepositoryProvider, fields: Record<string, string>) {
    configured(provider);
    const url =
      provider === 'github'
        ? 'https://github.com/login/oauth/access_token'
        : 'https://gitlab.com/oauth/token';
    const input = {
      ...fields,
      client_id: provider === 'github' ? env.GITHUB_APP_CLIENT_ID! : env.GITLAB_CLIENT_ID!,
      client_secret:
        provider === 'github' ? env.GITHUB_APP_CLIENT_SECRET! : env.GITLAB_CLIENT_SECRET!,
    };
    const data = object(
      await request(
        url,
        {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams(input).toString(),
        },
        20_000,
      ),
    );
    if (!str(data.access_token) || data.error)
      throw new RepositoryError(
        403,
        'Repository authorization expired or was denied. Reconnect the provider.',
      );
    if (
      !str(data.refresh_token) ||
      typeof data.expires_in !== 'number' ||
      !Number.isFinite(data.expires_in) ||
      data.expires_in <= 0
    )
      throw new RepositoryError(
        502,
        `${provider === 'github' ? 'GitHub' : 'GitLab'} did not return expiring rotating access credentials.`,
      );
    return {
      accessToken: str(data.access_token),
      ...(str(data.refresh_token) ? { refreshToken: str(data.refresh_token) } : {}),
      ...(typeof data.expires_in === 'number'
        ? { expiresAt: new Date(now().getTime() + data.expires_in * 1000).toISOString() }
        : {}),
    } satisfies RepositoryTokens;
  }
  async function exchange(provider: RepositoryProvider, code: string, verifier: string) {
    return tokenRequest(provider, {
      grant_type: 'authorization_code',
      code,
      redirect_uri: callback(provider),
      code_verifier: verifier,
    });
  }
  async function refresh(provider: RepositoryProvider, refreshToken: string) {
    return tokenRequest(provider, {
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      ...(provider === 'gitlab' ? { redirect_uri: callback(provider) } : {}),
    });
  }
  async function identity(
    provider: RepositoryProvider,
    token: string,
    installationId?: string,
  ): Promise<RepositoryIdentity> {
    const user = object(await (provider === 'github' ? gh('/user', token) : gl('/user', token)));
    const id = numericId(user.id);
    const name = str(user.login) || str(user.username);
    if (!name) throw new RepositoryError(502, 'The provider identity could not be verified.');
    if (provider === 'github') {
      if (!installationId)
        throw new RepositoryError(400, 'Choose a GitHub App installation first.');
      for (let page = 1; page <= 10; page++) {
        const result = object(await gh(`/user/installations?per_page=100&page=${page}`, token));
        const installations = Array.isArray(result.installations)
          ? result.installations.map(object)
          : [];
        const match = installations.find((item) => String(item.id) === installationId);
        if (match) {
          if (match.suspended_at)
            throw new RepositoryError(403, 'This GitHub installation is suspended.');
          const selection = match.repository_selection;
          return {
            id,
            name,
            installationId,
            installationAccountName: str(object(match.account).login) || undefined,
            repositorySelection:
              selection === 'all' || selection === 'selected' ? selection : undefined,
          };
        }
        if (installations.length < 100) break;
      }
      throw new RepositoryError(
        403,
        'This GitHub installation is not accessible to the authorized GitHub account.',
      );
    }
    return { id, name, ...(installationId ? { installationId } : {}) };
  }
  function repository(provider: RepositoryProvider, item: Record<string, unknown>): RepositoryItem {
    const fullName = str(item.full_name) || str(item.path_with_namespace);
    const url = str(item.html_url) || str(item.web_url);
    const expectedOrigin = provider === 'github' ? 'https://github.com' : 'https://gitlab.com';
    if (!fullName || !url.startsWith(`${expectedOrigin}/`))
      throw new RepositoryError(502, 'The provider repository metadata is incomplete.');
    return {
      id: numericId(item.id),
      name: str(item.name),
      fullName,
      owner: fullName.split('/').slice(0, -1).join('/'),
      defaultBranch: str(item.default_branch),
      url,
    };
  }
  async function list(
    provider: RepositoryProvider,
    token: string,
    installationId?: string,
    requestedPage?: number,
  ): Promise<{ repositories: RepositoryItem[]; incomplete: boolean; nextPage?: number }> {
    const repositories: RepositoryItem[] = [];
    const lastPage = requestedPage ?? MAX_REPOSITORY_PAGES;
    for (let page = requestedPage ?? 1; page <= lastPage; page++) {
      const value =
        provider === 'github'
          ? object(
              await gh(
                `/user/installations/${numericId(installationId)}/repositories?per_page=100&page=${page}`,
                token,
              ),
            ).repositories
          : await gl(
              `/projects?membership=true&per_page=100&page=${page}&order_by=path&sort=asc`,
              token,
            );
      const items = Array.isArray(value) ? value : [];
      repositories.push(...items.map((item) => repository(provider, object(item))));
      if (items.length < 100) return { repositories, incomplete: false };
      if (page === MAX_REPOSITORY_PAGES) return { repositories, incomplete: true };
      if (requestedPage !== undefined)
        return { repositories, incomplete: false, nextPage: page + 1 };
    }
    return { repositories, incomplete: false };
  }
  async function selected(
    provider: RepositoryProvider,
    token: string,
    repositoryId: string,
    installationId?: string,
  ) {
    numericId(repositoryId);
    if (provider === 'gitlab')
      return repository(provider, object(await gl(`/projects/${repositoryId}`, token)));
    // The user's installation intersection is the access boundary, not installation-wide access.
    for (let page = 1; page <= MAX_REPOSITORY_PAGES; page++) {
      const result = await list(provider, token, installationId, page);
      const match = result.repositories.find((item) => item.id === repositoryId);
      if (match) return match;
      if (!result.nextPage)
        throw new RepositoryError(
          403,
          result.incomplete
            ? 'Repository not found within the first 1,000 accessible repositories.'
            : 'This repository is no longer accessible to your GitHub account and installation.',
        );
    }
    throw new RepositoryError(403, 'Repository access could not be verified.');
  }
  function appJwt() {
    const timestamp = Math.floor(now().getTime() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ iat: timestamp - 60, exp: timestamp + 540, iss: env.GITHUB_APP_ID }),
    ).toString('base64url');
    const input = `${header}.${payload}`;
    try {
      return `${input}.${sign('RSA-SHA256', Buffer.from(input), env.GITHUB_APP_PRIVATE_KEY!.replace(/\\n/g, '\n')).toString('base64url')}`;
    } catch {
      throw new RepositoryError(503, 'GitHub App signing is not configured correctly.');
    }
  }
  async function readToken(
    provider: RepositoryProvider,
    userToken: string,
    repositoryId: string,
    installationId?: string,
  ) {
    if (provider === 'gitlab') return userToken;
    const data = object(
      await gh(
        `/app/installations/${numericId(installationId)}/access_tokens`,
        appJwt(),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            repository_ids: [Number(numericId(repositoryId))],
            permissions: { contents: 'read', metadata: 'read' },
          }),
        },
        20_000,
      ),
    );
    if (!str(data.token))
      throw new RepositoryError(502, 'GitHub did not issue a repository access token.');
    return str(data.token);
  }
  const ghRepo = (repo: RepositoryItem) =>
    `/repos/${repo.fullName.split('/').map(encodeURIComponent).join('/')}`;
  async function branches(provider: RepositoryProvider, token: string, repo: RepositoryItem) {
    const items =
      provider === 'github'
        ? await gh(`${ghRepo(repo)}/branches?per_page=100`, token)
        : await gl(`/projects/${repo.id}/repository/branches?per_page=100`, token);
    const values = Array.isArray(items) ? items.map(object) : [];
    return {
      branches: values.map((item) => ({ name: str(item.name) })).filter((item) => item.name),
      incomplete: values.length === 100,
    };
  }
  async function commit(
    provider: RepositoryProvider,
    token: string,
    repo: RepositoryItem,
    branch: string,
  ) {
    const data = object(
      await (provider === 'github'
        ? gh(`${ghRepo(repo)}/commits/${encodeURIComponent(branch)}`, token)
        : gl(`/projects/${repo.id}/repository/commits/${encodeURIComponent(branch)}`, token)),
    );
    const sha = str(data.sha) || str(data.id);
    if (!/^[a-f0-9]{40,64}$/.test(sha))
      throw new RepositoryError(502, 'The provider did not identify an immutable commit.');
    return sha;
  }
  async function discover(
    provider: RepositoryProvider,
    token: string,
    repo: RepositoryItem,
    branch: string,
  ) {
    const sha = await commit(provider, token, repo, branch);
    const paths: RepositoryFile[] = [];
    let incomplete = false;
    if (provider === 'github') {
      const tree = object(
        await gh(`${ghRepo(repo)}/git/trees/${sha}?recursive=1`, token, undefined, 8 * 1024 * 1024),
      );
      incomplete = Boolean(tree.truncated);
      const items = Array.isArray(tree.tree) ? tree.tree.slice(0, 20_000).map(object) : [];
      if (Array.isArray(tree.tree) && tree.tree.length > 20_000) incomplete = true;
      for (const item of items) {
        const path = str(item.path),
          format = supportedFile(path);
        if (format && item.type === 'blob' && ['100644', '100755'].includes(str(item.mode)))
          paths.push({ path, format, size: typeof item.size === 'number' ? item.size : null });
      }
    } else {
      for (let page = 1; page <= 10; page++) {
        const result = await gl(
          `/projects/${repo.id}/repository/tree?ref=${sha}&recursive=true&per_page=100&page=${page}`,
          token,
        );
        const items = Array.isArray(result) ? result.map(object) : [];
        for (const item of items) {
          const path = str(item.path),
            format = supportedFile(path);
          if (format && item.type === 'blob' && ['100644', '100755'].includes(str(item.mode)))
            paths.push({ path, format, size: null });
        }
        if (items.length < 100) break;
        if (page === 10) incomplete = true;
      }
    }
    if (paths.length > 100) incomplete = true;
    return {
      repository: repo,
      commit: sha,
      paths: paths.slice(0, 100).sort((a, b) => a.path.localeCompare(b.path)),
      incomplete,
      warnings: incomplete
        ? [
            'Discovery was bounded or truncated. Enter an exact supported file path if it is missing.',
          ]
        : [],
    };
  }
  async function file(
    provider: RepositoryProvider,
    token: string,
    repo: RepositoryItem,
    sha: string,
    path: string,
    configuration = false,
  ) {
    if (
      configuration
        ? !validInventoryPath(path) && !ciDependencyConfigPath(path)
        : !supportedFile(path)
    )
      throw new RepositoryError(400, 'Choose a supported inventory file path.');
    const data = object(
      await (provider === 'github'
        ? gh(
            `${ghRepo(repo)}/contents/${path.split('/').map(encodeURIComponent).join('/')}?ref=${sha}`,
            token,
          )
        : gl(
            `/projects/${repo.id}/repository/files/${encodeURIComponent(path)}?ref=${sha}`,
            token,
          )),
    );
    if (provider === 'github' && (data.type !== 'file' || data.submodule_git_url || data.target))
      throw new RepositoryError(400, 'Symlinks and submodules cannot be imported.');
    if (
      data.encoding !== 'base64' ||
      typeof data.content !== 'string' ||
      typeof data.size !== 'number' ||
      data.size > (configuration ? 128 * 1024 : 2 * 1024 * 1024)
    )
      throw new RepositoryError(413, 'The selected inventory file is unavailable or exceeds 2 MB.');
    const bytes = Buffer.from(data.content.replace(/\n/g, ''), 'base64');
    if (
      bytes.byteLength > (configuration ? 128 * 1024 : 2 * 1024 * 1024) ||
      bytes.byteLength !== data.size
    )
      throw new RepositoryError(413, 'The selected file size is invalid or exceeds 2 MB.');
    return bytes.toString('utf8');
  }
  async function baseline(
    provider: RepositoryProvider,
    token: string,
    repo: RepositoryItem,
    sha: string,
    inventoryPaths: string[],
  ) {
    if (
      !/^[a-f0-9]{40,64}$/.test(sha) ||
      !inventoryPaths.length ||
      inventoryPaths.length > 10 ||
      inventoryPaths.some((path) => !supportedFile(path))
    )
      throw new RepositoryError(
        400,
        'A valid imported commit and inventory selection are required.',
      );
    const paths: string[] = [];
    const unsafe: string[] = [];
    const roots = baselineRoots(inventoryPaths);
    let incomplete = false;
    const consume = (items: unknown[]) => {
      for (const raw of items) {
        const item = object(raw),
          path = str(item.path);
        if (!validInventoryPath(path) && !baselineConfigPath(path, roots)) continue;
        if (item.type === 'blob' && ['100644', '100755'].includes(str(item.mode))) paths.push(path);
        else if (baselineConfigPath(path, roots)) unsafe.push(path);
      }
    };
    if (provider === 'github') {
      const tree = object(
        await gh(`${ghRepo(repo)}/git/trees/${sha}?recursive=1`, token, undefined, 8 * 1024 * 1024),
      );
      const items = Array.isArray(tree.tree) ? tree.tree : [];
      incomplete = Boolean(tree.truncated) || items.length > 20_000;
      consume(items.slice(0, 20_000));
    } else {
      for (let page = 1; page <= 10; page++) {
        const data = await gl(
          `/projects/${repo.id}/repository/tree?ref=${sha}&recursive=true&per_page=100&page=${page}`,
          token,
        );
        const items = Array.isArray(data) ? data : [];
        consume(items);
        if (items.length < 100) break;
        if (page === 10) incomplete = true;
      }
    }
    const candidates = paths.filter((path) => baselineConfigPath(path, roots)).sort();
    const workflows = candidates.filter((path) => /^\.github\/workflows\/[^/]+\.ya?ml$/.test(path));
    if (candidates.length > 40 || workflows.length > 10) incomplete = true;
    const selected = candidates
      .filter((path) => !workflows.includes(path) || workflows.indexOf(path) < 10)
      .slice(0, 40);
    const contents: Record<string, string> = {};
    const unreadable = [...unsafe];
    let total = 0;
    for (const path of selected) {
      try {
        const content = await file(provider, token, repo, sha, path, true);
        total += Buffer.byteLength(content);
        if (total > 512 * 1024) {
          unreadable.push(path);
          incomplete = true;
          break;
        }
        contents[path] = content;
      } catch (error) {
        if (error instanceof RepositoryError && [400, 413].includes(error.statusCode))
          unreadable.push(path);
        else throw error;
      }
    }
    return assessRepositoryBaseline(sha, inventoryPaths, {
      paths,
      contents,
      incomplete,
      unreadable,
    });
  }
  async function assertRegularFiles(
    provider: RepositoryProvider,
    token: string,
    repo: RepositoryItem,
    sha: string,
    paths: string[],
  ) {
    // Contents endpoints may dereference symlinks. Verify git-tree modes before fetching bytes.
    const regular = new Set<string>();
    if (provider === 'github') {
      const tree = object(
        await gh(`${ghRepo(repo)}/git/trees/${sha}?recursive=1`, token, undefined, 8 * 1024 * 1024),
      );
      const items = Array.isArray(tree.tree) ? tree.tree.map(object) : [];
      for (const item of items)
        if (item.type === 'blob' && ['100644', '100755'].includes(str(item.mode)))
          regular.add(str(item.path));
    } else {
      const parents = [...new Set(paths.map((path) => path.split('/').slice(0, -1).join('/')))];
      for (const parent of parents) {
        for (let page = 1; page <= 10; page++) {
          const result = await gl(
            `/projects/${repo.id}/repository/tree?ref=${sha}&path=${encodeURIComponent(parent)}&per_page=100&page=${page}`,
            token,
          );
          const items = Array.isArray(result) ? result.map(object) : [];
          for (const item of items)
            if (item.type === 'blob' && ['100644', '100755'].includes(str(item.mode)))
              regular.add(str(item.path));
          if (items.length < 100) break;
        }
      }
    }
    if (paths.some((path) => !regular.has(path)))
      throw new RepositoryError(
        400,
        'A selected path is missing, is not a regular file, or falls outside bounded tree discovery. Symlinks and submodules are not imported.',
      );
  }
  async function snapshot(
    provider: RepositoryProvider,
    token: string,
    repo: RepositoryItem,
    branch: string,
    paths: string[],
  ) {
    if (
      !paths.length ||
      paths.length > 10 ||
      new Set(paths).size !== paths.length ||
      paths.some((path) => !supportedFile(path))
    )
      throw new RepositoryError(
        400,
        'Choose between one and ten distinct supported inventory paths.',
      );
    const sha = await commit(provider, token, repo, branch);
    await assertRegularFiles(provider, token, repo, sha, paths);
    const packages = new Map<string, InventoryPackage>();
    const warnings: string[] = [];
    const files: Array<{
      path: string;
      format: InventoryFormat;
      digest: string;
      bytes: number;
      packages: number;
    }> = [];
    let totalBytes = 0;
    for (const path of paths) {
      const content = await file(provider, token, repo, sha, path);
      totalBytes += Buffer.byteLength(content);
      if (totalBytes > 4 * 1024 * 1024)
        throw new RepositoryError(413, 'Selected inventory files exceed the combined 4 MB limit.');
      const format = supportedFile(path)!;
      const parsed = parseInventory(content, format);
      for (const item of parsed.packages)
        packages.set(`${item.ecosystem}:${item.name}:${item.version}`, item);
      if (packages.size > 2000)
        throw new RepositoryError(413, 'The combined inventory exceeds 2,000 packages.');
      warnings.push(...parsed.warnings.map((value) => `${path}: ${value}`));
      files.push({
        path,
        format,
        digest: stateHash(content),
        bytes: Buffer.byteLength(content),
        packages: parsed.packages.length,
      });
    }
    warnings.push(
      'Repository inventory does not establish deployed versions or runtime reachability.',
    );
    if (paths.some((path) => path.endsWith('pnpm-lock.yaml')))
      warnings.push(
        'The shared pnpm lockfile is assessed as repository-wide inventory; importer-specific dependency closure is not inferred.',
      );
    return {
      repository: repo,
      commit: sha,
      scope: 'repository_inventory' as const,
      packages: [...packages.values()],
      warnings: warnings.slice(0, 100),
      files,
      digest: stateHash(JSON.stringify(files.map(({ path, digest }) => ({ path, digest })))),
    };
  }
  return {
    availability,
    authorize,
    exchange,
    refresh,
    identity,
    list,
    selected,
    readToken,
    branches,
    discover,
    snapshot,
    baseline,
  };
}

export const repositoryProvider = createRepositoryProvider();
