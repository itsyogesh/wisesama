import { describe, expect, it } from 'vitest';
import {
  assessCiDependencies,
  CI_DEPENDENCY_LIMITS,
  ciDependencyConfigPath,
} from '../ci-dependencies';

const commit = 'a'.repeat(40);
const digest = 'b'.repeat(64);
const workflow = '.github/workflows/ci.yml';
const workflowBody = (body: string) =>
  `name: test\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n${body}`;
const uses = (value: string) => workflowBody(`      - uses: ${value}`);
function assess(
  contents: Record<string, string>,
  options: Partial<{ paths: string[]; incomplete: boolean; unreadable: string[] }> = {},
) {
  return assessCiDependencies({
    contents,
    paths: Object.keys(contents),
    incomplete: false,
    unreadable: [],
    ...options,
  });
}
const lockfile = (overrides = '') =>
  `version: v0.0.3\nworkflows:\n  '${workflow}':\n    - actions/checkout@v6\ndependencies:\n  actions/checkout@v6:\n    ref: v6\n    commit: sha1-${commit}\n    owner_id: 1\n    repo_id: 2\n${overrides}`;

describe('CI dependency metadata extraction', () => {
  it('preserves exact source lines and separates full commits from mutable tags', () => {
    const result = assess({
      [workflow]: workflowBody(
        `      - uses: actions/checkout@${commit}\n      - uses: vendor/deploy@v3\n      - run: echo SECRET_COMMAND`,
      ),
    });
    expect(result.state).toBe('attention');
    expect(result.items.map((item) => [item.name, item.reference, item.line, item.state])).toEqual([
      ['actions/checkout', commit, 7, 'pinned'],
      ['vendor/deploy', 'v3', 8, 'mutable'],
    ]);
    expect(JSON.stringify(result)).not.toContain('SECRET_COMMAND');
    expect(result.limitations.join(' ')).toContain('no workflow execution');
  });
  it('only accepts a supported exact caller lock entry with immutable commit and numeric identities', () => {
    const result = assess({
      [workflow]: uses('actions/checkout@v6'),
      '.github/workflows/actions.lock': lockfile(),
    });
    expect(result.state).toBe('observed');
    expect(result.items[0]).toMatchObject({ state: 'locked', reference: 'v6' });
    expect(result.items[0]?.detail).toContain(commit);
    for (const bad of [
      lockfile().replace(workflow, '.github/workflows/other.yml'),
      lockfile().replace('repo_id: 2', 'repo_id: "2"'),
      lockfile().replace(`sha1-${commit}`, 'sha1-short'),
      lockfile().replace('version: v0.0.3', 'version: future'),
      lockfile().replace('ref: v6', 'ref: v5'),
    ]) {
      const incomplete = assess({
        [workflow]: uses('actions/checkout@v6'),
        '.github/workflows/actions.lock': bad,
      });
      expect(incomplete.items[0]?.state).toBe('mutable');
      expect(incomplete.state).toBe('attention');
    }
  });
  it('keeps partial or malformed lock coverage explicit rather than inferring completeness from a file', () => {
    const partial = lockfile().replace(
      '    - actions/checkout@v6',
      '    - actions/checkout@v6\n    - other/action@v2',
    );
    const result = assess({
      [workflow]: uses('actions/checkout@v6'),
      '.github/workflows/actions.lock': partial,
    });
    expect(result.items[0]?.state).toBe('locked');
    expect(result.incomplete).toBe(true);
    expect(result.state).toBe('unknown');
    expect(
      assess({
        [workflow]: uses('actions/checkout@v6'),
        '.github/workflows/actions.lock': 'version: v0.0.3\nworkflows: bad\ndependencies: bad',
      }).state,
    ).toBe('attention');
  });
  it('does not apply caller action locks to reusable workflow calls', () => {
    const result = assess({
      [workflow]: `jobs:\n  reusable:\n    uses: vendor/repo/.github/workflows/release.yml@main`,
      '.github/workflows/actions.lock': lockfile()
        .replaceAll('actions/checkout@v6', 'vendor/repo/.github/workflows/release.yml@main')
        .replace('ref: v6', 'ref: main'),
    });
    expect(result.items[0]).toMatchObject({
      kind: 'reusable_workflow',
      state: 'mutable',
      reference: 'main',
    });
    expect(result.items[0]?.detail).toContain('does not pin reusable');
  });
  it('reads local composite references at the same source while keeping runner checkouts distinct', () => {
    const action = '.github/actions/build/action.yml';
    const composite = `runs:\n  using: composite\n  steps:\n    - uses: vendor/tool@${commit}`;
    for (const prefix of ['./', '$/']) {
      const result = assess({
        [workflow]: uses(`${prefix}.github/actions/build`),
        [action]: composite,
      });
      expect(result.items[0]?.state).toBe(prefix === './' ? 'local' : 'pinned');
      expect(result.items[1]).toMatchObject({ path: action, line: 4, state: 'pinned' });
      expect(result.state).toBe(prefix === './' ? 'unknown' : 'observed');
    }
    expect(assess({ [workflow]: uses('./outside-scope') }).incomplete).toBe(true);
  });
  it('resolves nested composite locking against the calling workflow instead of an unrelated descriptor', () => {
    const result = assess({
      [workflow]: uses('$/.github/actions/build'),
      '.github/actions/build/action.yml':
        'runs:\n  using: composite\n  steps:\n    - uses: actions/checkout@v6',
      '.github/workflows/actions.lock': lockfile(),
    });
    expect(result.items.map((item) => item.state)).toEqual(['pinned', 'locked']);
    expect(result.state).toBe('observed');
  });
  it('bounds local include cycles without presenting the repeated references as complete coverage', () => {
    const result = assess({
      [workflow]: uses('$/.github/actions/a'),
      '.github/actions/a/action.yml':
        'runs:\n  using: composite\n  steps:\n    - uses: $/.github/actions/b',
      '.github/actions/b/action.yml':
        'runs:\n  using: composite\n  steps:\n    - uses: $/.github/actions/a',
    });
    expect(result.state).toBe('unknown');
    expect(result.issues.some((item) => item.detail.includes('cycle'))).toBe(true);
    expect(result.items.length).toBeLessThan(5);
  });
  it('recognizes job, service and docker-action image digests without accepting ordinary tags as immutable', () => {
    const result = assess({
      [workflow]: `jobs:\n  build:\n    container: registry.example/image@sha256:${digest}\n    services:\n      db:\n        image: postgres:17\n    steps:\n      - uses: docker://alpine@sha256:${digest}`,
    });
    expect(result.items.map((item) => [item.kind, item.name, item.state])).toEqual([
      ['container', 'alpine', 'pinned'],
      ['container', 'registry.example/image', 'pinned'],
      ['container', 'postgres', 'mutable'],
    ]);
    expect(result.items[0]?.line).toBe(8);
  });
  it('reports dynamic references, malformed YAML, duplicate keys, aliases and unsupported mappings as unknown', () => {
    expect(
      assess({ [workflow]: uses('vendor/tool@$' + '{{ inputs.version }}') }).items[0]?.state,
    ).toBe('unknown');
    for (const invalid of [
      'jobs: [',
      'jobs: {}\njobs: {}',
      'jobs: {}\n"jo\\u0062s": {}',
      '? [jobs, other]\n: {}',
      'jobs: {build: {steps: [], "steps": []}}',
      'x: &x {}\njobs: *x',
      'jobs: !custom {}',
      'jobs:\n  build: invalid',
    ]) {
      const result = assess({ [workflow]: invalid });
      expect(result.state).toBe('unknown');
      expect(result.incomplete).toBe(true);
    }
    expect(assess({}).state).toBe('unknown');
    expect(assess({ [workflow]: workflowBody('      - run: npm ci') }).state).toBe('unknown');
  });
  it('retains a safe static action identity when its ref is dynamic, without retaining expression or credential contents', () => {
    const expression = '$' + '{{ vars.ACTION_REF }}';
    const dynamicResult = assess({ [workflow]: uses(`example/action/path@${expression}`) });
    expect(dynamicResult.items[0]).toMatchObject({
      name: 'example/action/path',
      reference: null,
      state: 'unknown',
    });
    expect(JSON.stringify(dynamicResult)).not.toContain(expression);
    const secret = `ghp_${'X'.repeat(36)}`;
    const secretResult = assess({ [workflow]: uses(`example/action@${secret}`) });
    expect(secretResult.items[0]).toMatchObject({
      name: 'example/action',
      reference: null,
      state: 'unknown',
    });
    expect(JSON.stringify(secretResult)).not.toContain(secret);
    expect(assess({ [workflow]: uses(`example/../action@${expression}`) }).items[0]?.name).toBe(
      'Unresolved dependency',
    );
  });
  it('inspects GitLab project refs, remote integrity, components and images without fetching content', () => {
    const integrity = `sha256-${'A'.repeat(43)}=`;
    const result = assess({
      '.gitlab-ci.yml': `include:\n  - project: team/templates\n    ref: ${commit}\n    file: /templates/test.yml\n  - remote: https://example.test/ci.yml?token=SECRET_QUERY\n    integrity: ${integrity}\n  - component: gitlab.com/team/ci/test@1.0.0\ndefault:\n  image: alpine@sha256:${digest}\ntest:\n  services: [postgres:17]\n  script: echo SECRET_SCRIPT`,
    });
    expect(result.items.map((item) => item.state)).toEqual([
      'pinned',
      'pinned',
      'mutable',
      'pinned',
      'mutable',
    ]);
    expect(JSON.stringify(result)).not.toContain('SECRET_');
    expect(result.items[1]?.name).toBe('https://example.test/ci.yml');
    expect(result.limitations.join(' ')).toContain('GitHub lockfile guarantees do not apply');
  });
  it('does not accept missing project include filenames or remote userinfo as complete evidence', () => {
    const result = assess({
      '.gitlab-ci.yml': `include:\n  - project: team/templates\n    ref: ${commit}\n  - remote: https://user:SECRET_PASSWORD@example.test/ci.yml\n  - template: Jobs/Build.gitlab-ci.yml`,
    });
    expect(result.items.map((item) => item.state)).toEqual(['unknown', 'unknown', 'unknown']);
    expect(JSON.stringify(result)).not.toContain('SECRET_PASSWORD');
  });
  it('does not persist recognizable credential-like values in dependency metadata', () => {
    const token = `ghp_${'Z'.repeat(36)}`;
    const result = assess({
      [workflow]: uses(`vendor/tool@${token}`),
      '.gitlab-ci.yml': `include:\n  - remote: https://example.test/${token}/ci.yml\n  - project: team/templates\n    file: ci.yml\n    ref: ${token}\ndefault:\n  image: registry.example/image:${token}`,
    });
    expect(JSON.stringify(result)).not.toContain(token);
    expect(result.items.every((item) => item.state === 'unknown')).toBe(true);
  });
  it('rejects credential-shaped or malformed image references without retaining their contents', () => {
    const result = assess({
      '.gitlab-ci.yml': `default:\n  image: user:PRIVATE_IMAGE_PASSWORD@registry.example/image\ntest:\n  image: alpine@sha256:short\nother:\n  image:\n    name: registry.example:5000/team/image:3.0`,
    });
    expect(result.items.map((item) => item.state)).toEqual(['unknown', 'unknown', 'mutable']);
    expect(result.items[2]).toMatchObject({
      name: 'registry.example:5000/team/image',
      reference: '3.0',
      line: 7,
    });
    expect(JSON.stringify(result)).not.toContain('PRIVATE_IMAGE_PASSWORD');
  });
  it('follows only bounded regular local GitLab includes, and makes skipped includes visible', () => {
    const result = assess({
      '.gitlab-ci.yml': 'include:\n  - local: /.gitlab/ci/test.yml\n  - local: outside-scope.yml',
      '.gitlab/ci/test.yml': `default:\n  image: alpine@sha256:${digest}`,
    });
    expect(result.filesChecked).toContain('.gitlab/ci/test.yml');
    expect(result.items.some((item) => item.kind === 'container' && item.state === 'pinned')).toBe(
      true,
    );
    expect(result.incomplete).toBe(true);
  });
  it('does not inspect symlink paths or content outside the advertised regular-file inventory', () => {
    const result = assess(
      { [workflow]: uses(`actions/checkout@${commit}`) },
      { paths: [], unreadable: [workflow] },
    );
    expect(result.items).toEqual([]);
    expect(result.incomplete).toBe(true);
    for (const path of [
      '../.github/workflows/ci.yml',
      '.github/workflows/../ci.yml',
      '.git/config',
      '.github/actions/a/../../../action.yml',
      '/absolute/.gitlab-ci.yml',
      'node_modules/.gitlab-ci.yml',
    ])
      expect(ciDependencyConfigPath(path)).toBe(false);
    expect(ciDependencyConfigPath('.github/workflows/actions.lock')).toBe(true);
  });
  it('bounds configuration count, bytes, nesting and dependency records without claiming full coverage', () => {
    const contents = Object.fromEntries(
      Array.from({ length: 11 }, (_, i) => [
        `.github/workflows/${i}.yml`,
        uses(`actions/checkout@${commit}`),
      ]),
    );
    expect(assess(contents).filesChecked).toHaveLength(10);
    expect(assess(contents).incomplete).toBe(true);
    expect(assess({ [workflow]: '#'.repeat(CI_DEPENDENCY_LIMITS.fileBytes + 1) }).incomplete).toBe(
      true,
    );
    const many = Array.from({ length: 201 }, () => `      - uses: actions/checkout@${commit}`).join(
      '\n',
    );
    const result = assess({ [workflow]: workflowBody(many) });
    expect(result.items).toHaveLength(200);
    expect(result.state).toBe('unknown');
    expect(result.incomplete).toBe(true);
    expect(assess({ [workflow]: `jobs: ${'['.repeat(35)}x${']'.repeat(35)}` }).state).toBe(
      'unknown',
    );
  });
  it('never projects YAML mappings onto JavaScript prototypes', () => {
    const result = assess({
      [workflow]: `__proto__:\n  polluted: true\njobs:\n  constructor:\n    steps:\n      - uses: actions/checkout@${commit}`,
    });
    expect(Object.getPrototypeOf(result)).toBe(Object.prototype);
    expect(Object.hasOwn({}, 'polluted')).toBe(false);
    expect(result.items[0]?.state).toBe('pinned');
  });
});
