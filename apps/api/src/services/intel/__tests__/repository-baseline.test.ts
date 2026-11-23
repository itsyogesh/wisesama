import { describe, expect, it } from 'vitest';
import {
  assessRepositoryBaseline,
  BASELINE_YAML_LIMITS,
  type BaselineFiles,
} from '../repository-baseline';

const commit = 'a'.repeat(40);
function assess(
  contents: Record<string, string>,
  paths = Object.keys(contents),
  incomplete = false,
  unreadable: string[] = [],
  inventory = ['package.json'],
) {
  return assessRepositoryBaseline(commit, inventory, {
    paths,
    contents,
    incomplete,
    unreadable,
  } satisfies BaselineFiles);
}
function check(result: ReturnType<typeof assess>, id: string) {
  return result.checks.find((item) => item.id === id)!;
}
const pkg = (version: string) => JSON.stringify({ packageManager: `pnpm@${version}` });

describe('static repository configuration baseline', () => {
  it('persists CI dependency facts and a dedicated check without copying workflow commands', () => {
    const result = assess({
      '.github/workflows/ci.yml':
        'jobs:\n  build:\n    steps:\n      - uses: actions/checkout@v6\n      - run: echo PRIVATE_COMMAND',
    });
    expect(check(result, 'ci_dependencies').state).toBe('attention');
    expect(result.ciDependencies.items[0]).toMatchObject({
      name: 'actions/checkout',
      line: 4,
      reference: 'v6',
      state: 'mutable',
    });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_COMMAND');
    expect(check(result, 'ci_dependencies').summary).toContain('does not establish a compromise');
  });
  it('distinguishes old pnpm from a compatible explicit cooldown', () => {
    for (const version of ['9.14.2', '10.15.1']) {
      const result = assess({
        'package.json': pkg(version),
        'pnpm-workspace.yaml': 'minimumReleaseAge: 1440',
      });
      expect(check(result, 'dependency_cooldown').state).toBe('attention');
      expect(check(result, 'dependency_cooldown').evidence[0]?.detail).toContain('10.16.0');
    }
    const result = assess({
      'package.json': pkg('10.16.0'),
      'pnpm-workspace.yaml': 'minimumReleaseAge: 1440',
    });
    expect(check(result, 'dependency_cooldown').state).toBe('observed');
    expect(check(result, 'dependency_cooldown').summary).toContain(
      'enforcement remains unverified',
    );
  });
  it('never treats an unknown manager, a range, or an absent policy as a pass', () => {
    for (const value of ['pnpm@^10.16.0', 'pnpm@latest', undefined]) {
      const result = assess({
        'package.json': JSON.stringify({ packageManager: value }),
        'pnpm-workspace.yaml': 'minimumReleaseAge: 1440',
      });
      expect(check(result, 'package_manager').state).toBe('attention');
      expect(check(result, 'dependency_cooldown').state).toBe('unknown');
    }
    expect(check(assess({ 'package.json': pkg('12.1.0') }), 'dependency_cooldown').state).toBe(
      'unknown',
    );
  });
  it('makes explicit exclusions, disabled settings and trust bypasses need attention', () => {
    for (const setting of [
      'minimumReleaseAge: 0',
      'minimumReleaseAge: 1440\nminimumReleaseAgeExclude: [foo]',
      'minimumReleaseAge: 1440\nminimumReleaseAgeStrict: false',
      'minimumReleaseAge: 1440\ntrustLockfile: true',
    ]) {
      expect(
        check(
          assess({ 'package.json': pkg('12.1.0'), 'pnpm-workspace.yaml': setting }),
          'dependency_cooldown',
        ).state,
      ).toBe('attention');
    }
  });
  it('does not persist raw registry credentials, scripts, or other repository config', () => {
    const result = assess({
      'package.json': JSON.stringify({
        packageManager: 'pnpm@10.16.0',
        scripts: { build: 'SECRET_BUILD' },
      }),
      'pnpm-workspace.yaml':
        'minimumReleaseAge: 1440\nregistry: https://token:SECRET_REGISTRY@example.test',
      '.github/workflows/ci.yml':
        'jobs:\n  build:\n    steps:\n      - run: npm ci\n      - run: echo SECRET_COMMAND',
    });
    expect(JSON.stringify(result)).not.toContain('SECRET_');
    expect(JSON.stringify(result)).not.toContain('token:');
  });
  it('keeps workspace lockfile evidence at repository scope', () => {
    const result = assess(
      { 'package.json': pkg('10.16.0') },
      ['package.json', 'pnpm-lock.yaml', 'apps/api/package.json'],
      false,
      [],
      ['apps/api/package.json'],
    );
    expect(check(result, 'lockfile').state).toBe('observed');
    expect(check(result, 'lockfile').evidence[0]?.detail).toContain(
      'service-specific dependency closure is not established',
    );
  });
  it('does not call missing files absent when a tree is incomplete or files are unreadable', () => {
    const result = assess({ 'package.json': pkg('10.16.0') }, ['package.json'], true, [
      'pnpm-workspace.yaml',
    ]);
    expect(check(result, 'lockfile').state).toBe('unknown');
    expect(check(result, 'package_manager').state).toBe('unknown');
    expect(result.limitations.join(' ')).toContain('bounded or truncated');
  });
  it('accepts only parsed CI run/script fields as command candidates', () => {
    const result = assess({
      'package.json': JSON.stringify({ packageManager: 'npm@11.0.0' }),
      '.github/workflows/ci.yml':
        '# npm ci\njobs:\n  build:\n    name: npm ci\n    steps:\n      - run: echo npm ci',
    });
    expect(check(result, 'ci_install').state).toBe('unknown');
    for (const command of ['npm ci', 'pnpm install --frozen-lockfile', 'uv sync --locked']) {
      const seen = assess({
        '.github/workflows/ci.yml': `jobs:\n  build:\n    steps:\n      - run: ${command}`,
      });
      expect(check(seen, 'ci_install').state).toBe('observed');
      expect(check(seen, 'ci_install').summary).toContain('enforcement is unverified');
    }
  });
  it('keeps rejected YAML unknown even when another CI file has an install candidate', () => {
    const depth = BASELINE_YAML_LIMITS.depth + 1;
    for (const content of [
      'jobs: {}\njobs: {}',
      'jobs: {}\n"jo\\u0062s": {}',
      '? [jobs, other]\n: {}',
      'value: &value {}\njobs: *value',
      `jobs: ${'['.repeat(depth)}value${']'.repeat(depth)}`,
      '#'.repeat(BASELINE_YAML_LIMITS.bytes + 1),
    ]) {
      const result = assess({
        '.github/workflows/good.yml': 'jobs: {build: {steps: [{run: npm ci}]}}',
        '.github/workflows/other.yml': content,
      });
      expect(check(result, 'ci_install').state).toBe('unknown');
      expect(check(result, 'ci_install').evidence).toEqual([
        expect.objectContaining({ path: '.github/workflows/good.yml' }),
      ]);
      expect(result.limitations.join(' ')).toContain('install-command coverage remains unknown');
    }
  });

  it('does not follow GitLab includes or external reusable workflows', () => {
    const result = assess({ '.gitlab-ci.yml': 'include: [{remote: https://example.test/ci.yml}]' });
    expect(check(result, 'ci_install').state).toBe('unknown');
    expect(result.limitations.join(' ')).toContain('External includes');
  });
  it('requires compatible uv version plus a duration instead of mistaking a date for cooldown', () => {
    for (const setting of [
      'required-version = "==0.9.16"\nexclude-newer = "1 week"',
      'required-version = "==0.9.17"\nexclude-newer = "2026-01-01"',
      'exclude-newer = "1 week"',
    ]) {
      expect(
        check(assess({ 'uv.toml': setting }, ['uv.toml', 'uv.lock']), 'dependency_cooldown').state,
      ).toBe('unknown');
    }
    const result = assess(
      { 'pyproject.toml': '[tool.uv]\nrequired-version = "==0.9.17"\nexclude-newer = "1 week"' },
      ['pyproject.toml', 'uv.lock'],
    );
    expect(check(result, 'dependency_cooldown').state).toBe('observed');
    expect(check(result, 'package_manager').evidence[0]?.detail).toContain('uv 0.9.17');
  });
  it('does not accept commented, aliased or malformed cooldown declarations', () => {
    for (const config of [
      '# minimumReleaseAge: 1440',
      'minimumReleaseAge: 1440\nminimumReleaseAge: 0',
      'a: &x 1440\nminimumReleaseAge: *x',
      'minimumReleaseAge: 1440\n? [unsupported, key]\n: value',
      'minimumReleaseAge: 1440\nunused: {value: one, "value": two}',
    ]) {
      expect(
        check(
          assess({ 'package.json': pkg('10.16.0'), 'pnpm-workspace.yaml': config }),
          'dependency_cooldown',
        ).state,
      ).toBe('unknown');
    }
    expect(check(assess({ 'package.json': '{invalid' }), 'package_manager').state).toBe('unknown');
    expect(
      check(
        assess({
          'package.json': pkg('10.16.0'),
          'pnpm-workspace.yaml': 'minimumReleaseAge: 1440\nminimumReleaseAgeExclude: malformed',
        }),
        'dependency_cooldown',
      ).state,
    ).toBe('unknown');
    expect(
      check(
        assess(
          { 'uv.toml': 'text = """\nrequired-version = "==0.9.17"\nexclude-newer = "1 week"\n"""' },
          ['uv.toml', 'uv.lock'],
        ),
        'dependency_cooldown',
      ).state,
    ).toBe('unknown');
  });
  it('keeps per-root uncertainty instead of passing a multi-root repository from one declaration', () => {
    const result = assess(
      {
        'a/package.json': pkg('10.16.0'),
        'a/pnpm-workspace.yaml': 'minimumReleaseAge: 1440',
        'b/package.json': '{}',
      },
      ['a/package.json', 'a/pnpm-workspace.yaml', 'a/pnpm-lock.yaml', 'b/package.json'],
      false,
      [],
      ['a/package.json', 'b/package.json'],
    );
    expect(check(result, 'package_manager').state).toBe('attention');
    expect(check(result, 'dependency_cooldown').state).toBe('unknown');
  });
  it('recognizes table-form uv package exceptions and rejects whole unsupported or malformed TOML documents', () => {
    for (const [path, section] of [
      ['uv.toml', ''],
      ['pyproject.toml', 'tool.uv'],
    ] as const) {
      const header = section ? `[${section}]\n` : '';
      const settings = `${header}required-version = "==0.9.17"\nexclude-newer = "1 week"`;
      const except = `${settings}\n[${section ? `${section}.` : ''}exclude-newer-package]\nflask = false`;
      expect(
        check(assess({ [path]: except }, [path, 'uv.lock']), 'dependency_cooldown').state,
      ).toBe('attention');
      for (const suffix of [
        '\nthis is invalid TOML',
        '\nunused = ["unsupported-array"]',
        '\nrequired-version = "==0.9.17"',
        '\n[[index]]\nname = "private"',
      ]) {
        const result = assess({ [path]: settings + suffix }, [path, 'uv.lock']);
        expect(check(result, 'package_manager').state).toBe('unknown');
        expect(check(result, 'dependency_cooldown').state).toBe('unknown');
      }
    }
  });
  it('binds evidence to a normalized exact selected-path set', () => {
    const result = assess(
      {},
      [],
      false,
      [],
      ['z/package.json', 'a/package.json', 'z/package.json'],
    );
    expect(result.inventoryPaths).toEqual(['a/package.json', 'z/package.json']);
  });
});
