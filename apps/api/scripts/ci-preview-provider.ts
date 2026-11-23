/** Synthetic repository transport for the strictly guarded disposable local preview only. */
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { assessRepositoryBaseline } from '../src/services/intel/repository-baseline';
import type { RepositoryItem, RepositoryProvider } from '../src/services/repository-provider';
import {
  RepositoryError,
  type repositoryProvider,
  stateHash,
} from '../src/services/repository-provider';

export const CI_CONTROL_PATH = '/private/tmp/wisesama-ci-preview-control.json';
export const CI_FIXTURE_PATH = '/private/tmp/wisesama-ci-preview.json';
export const CI_COMMIT_A = 'a'.repeat(40);
export const CI_COMMIT_B = 'b'.repeat(40);
export const CI_PREVIEW_KEY = createHash('sha256')
  .update('disposable-wisesama-ci-preview-only')
  .digest();
export type CiPreviewControl = {
  run: string;
  repositoryId: string;
  head: 'a' | 'b';
  failBaseline: boolean;
};
export type CiPreviewFixture = {
  run: string;
  owner: { id: string; email: string; password: string };
  outsider: { id: string; email: string; password: string };
  organizationId: string;
  projectId: string;
  manualProjectId: string;
  connectionId: string;
  sourceId: string;
  repositoryId: string;
};

export function assertCiPreviewDatabase() {
  const value = process.env.INTEL_TEST_DATABASE_URL;
  if (!value) throw new Error('Set INTEL_TEST_DATABASE_URL to the disposable loopback database.');
  if (value !== 'postgresql://wisesama_test@127.0.0.1:55439/wisesama_intel')
    throw new Error('Only the exact disposable wisesama_test loopback database is allowed.');
  return value;
}
export async function readCiPreviewControl(): Promise<CiPreviewControl> {
  const file = await open(CI_CONTROL_PATH, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.nlink !== 1 || info.size > 4096)
      throw new Error('Invalid CI preview control.');
    const value = JSON.parse(await file.readFile('utf8')) as CiPreviewControl;
    if (
      !/^[a-f0-9-]{36}$/.test(value.run) ||
      !/^[1-9]\d{0,18}$/.test(value.repositoryId) ||
      !['a', 'b'].includes(value.head) ||
      typeof value.failBaseline !== 'boolean'
    )
      throw new Error('Unexpected CI preview control shape.');
    return value;
  } finally {
    await file.close();
  }
}
export const ciPreviewToken = (run: string) => `synthetic-ci-token-${run}`;
export const ciPreviewIdentity = (run: string) => `synthetic-ci-${run}`;
export function ciPreviewRepository(control: CiPreviewControl): RepositoryItem {
  return {
    id: control.repositoryId,
    name: 'Synthetic CI checkout',
    fullName: 'synthetic/ci-checkout',
    owner: 'synthetic',
    defaultBranch: 'main',
    url: 'https://github.com/synthetic/ci-checkout',
  };
}
export function ciPreviewFiles(commit: string) {
  if (![CI_COMMIT_A, CI_COMMIT_B].includes(commit))
    throw new RepositoryError(404, 'Synthetic commit not found.');
  const checkout = commit === CI_COMMIT_A ? 'v4' : '1'.repeat(40);
  const contents: Record<string, string> = {
    'package.json': JSON.stringify({
      name: 'synthetic-ci-checkout',
      packageManager: 'npm@10.9.0',
      dependencies: { 'synthetic-ci-package': '1.0.0' },
    }),
    '.github/workflows/ci.yml': `name: Synthetic CI verification\non: push\npermissions:\n  contents: read\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@${checkout}\n      - uses: synthetic/reviewed-action@${'2'.repeat(40)}\n      - uses: synthetic/locked-action@v1.2.0\n      - uses: synthetic/dynamic-action@\${{ vars.ACTION_REF }}\n      - uses: ./.github/actions/review\n      - run: npm ci\n  reuse:\n    uses: synthetic/workflows/.github/workflows/test.yml@v1\n`,
    '.github/workflows/actions.lock': `version: 'v0.0.3'\nworkflows:\n  '.github/workflows/ci.yml':\n    - 'synthetic/locked-action@v1.2.0'\ndependencies:\n  'synthetic/locked-action@v1.2.0':\n    ref: 'v1.2.0'\n    commit: 'sha1-${'3'.repeat(40)}'\n    owner_id: 123\n    repo_id: 456\n`,
    '.github/actions/review/action.yml': `name: Synthetic local review\nruns:\n  using: composite\n  steps:\n    - uses: synthetic/nested-action@${'4'.repeat(40)}\n`,
    '.gitlab-ci.yml': `include:\n  - local: /.gitlab/ci/shared.yml\n  - project: synthetic/shared-ci\n    ref: main\n    file: /checks.yml\nimage: alpine:3.20\nchecks:\n  image: alpine@sha256:${'5'.repeat(64)}\n  script: echo synthetic fixture\n`,
    '.gitlab/ci/shared.yml': 'local-check:\n  script: echo synthetic fixture\n',
  };
  return {
    paths: [...Object.keys(contents), 'package-lock.json'],
    contents,
    incomplete: false,
    unreadable: [],
  };
}

export async function createCiPreviewRepositoryService() {
  const database = assertCiPreviewDatabase();
  if (process.env.DATABASE_URL !== database)
    throw new Error('The preview database was not selected before loading the CI service.');
  const { createRepositoryService } = await import('../src/services/repository.service');
  const blocked = () => {
    throw new RepositoryError(
      503,
      'This synthetic CI preview does not perform provider authorization or network calls.',
    );
  };
  async function validate(kind: RepositoryProvider, token: string, repositoryId?: string) {
    const control = await readCiPreviewControl();
    if (
      kind !== 'github' ||
      token !== ciPreviewToken(control.run) ||
      (repositoryId !== undefined && repositoryId !== control.repositoryId)
    )
      throw new RepositoryError(
        403,
        'Only the explicit synthetic CI fixture is available through this transport.',
      );
    return control;
  }
  const provider: typeof repositoryProvider = {
    availability: (kind) => ({
      provider: kind,
      available: false,
      reason: 'Synthetic local transport; no live provider is connected.',
      permissions: 'Synthetic fixture only',
      method: 'Local immutable fixture',
    }),
    authorize: blocked,
    exchange: async () => blocked(),
    refresh: async () => blocked(),
    identity: async (kind, token) => {
      const control = await validate(kind, token);
      return {
        id: ciPreviewIdentity(control.run),
        name: 'Synthetic CI preview',
        installationAccountName: 'synthetic',
        repositorySelection: 'selected',
      };
    },
    list: async (kind, token) => {
      const control = await validate(kind, token);
      return { repositories: [ciPreviewRepository(control)], incomplete: false };
    },
    selected: async (kind, token, id) => ciPreviewRepository(await validate(kind, token, id)),
    readToken: async (kind, token, id) => {
      await validate(kind, token, id);
      return token;
    },
    branches: async (kind, token, repo) => {
      await validate(kind, token, repo.id);
      return { branches: [{ name: 'main' }], incomplete: false };
    },
    discover: async (kind, token, repo) => {
      const control = await validate(kind, token, repo.id);
      return {
        repository: repo,
        commit: control.head === 'a' ? CI_COMMIT_A : CI_COMMIT_B,
        paths: [{ path: 'package.json', format: 'package-json', size: 150 }],
        incomplete: false,
        warnings: ['Synthetic local verification repository.'],
      };
    },
    snapshot: async (kind, token, repo, branch, paths) => {
      const control = await validate(kind, token, repo.id);
      if (branch !== 'main' || paths.length !== 1 || paths[0] !== 'package.json')
        throw new RepositoryError(
          400,
          'Only the fixed synthetic inventory selection is available.',
        );
      const commit = control.head === 'a' ? CI_COMMIT_A : CI_COMMIT_B;
      const content = ciPreviewFiles(commit).contents['package.json']!;
      const files = [
        {
          path: 'package.json',
          format: 'package-json' as const,
          digest: stateHash(content),
          bytes: Buffer.byteLength(content),
          packages: 1,
        },
      ];
      return {
        repository: repo,
        commit,
        scope: 'repository_inventory',
        packages: [{ name: 'synthetic-ci-package', version: '1.0.0', ecosystem: 'npm' }],
        warnings: [
          'Synthetic local verification repository; no provider authorization or deployed exposure is established.',
        ],
        files,
        digest: stateHash(JSON.stringify(files.map(({ path, digest }) => ({ path, digest })))),
      };
    },
    baseline: async (kind, token, repo, commit, paths) => {
      const control = await validate(kind, token, repo.id);
      if (control.failBaseline)
        throw new Error('Synthetic CI collection failure: NEVER_PERSIST_RAW_PROVIDER_SECRET');
      return assessRepositoryBaseline(commit, paths, ciPreviewFiles(commit));
    },
  };
  return createRepositoryService({
    provider,
    env: { REPOSITORY_TOKEN_ENCRYPTION_KEY: CI_PREVIEW_KEY.toString('base64') },
    scan: async () => {
      throw new Error('Synthetic CI verification does not perform advisory network scans.');
    },
  });
}
