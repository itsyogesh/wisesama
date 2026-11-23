import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { after, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  auditLocalCi,
  collectCiFiles,
  writeNewReport,
} from '../skills/wisesama-ci-audit/scripts/ci-audit.mjs';

const base = await mkdtemp(join(tmpdir(), 'wisesama-skill-test-'));
after(() => rm(base, { recursive: true, force: true }));
const binary = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '../skills/wisesama-ci-audit/scripts/ci-audit.mjs',
);
let index = 0;
async function fixture(content) {
  const root = join(base, `project-${++index}`);
  await mkdir(join(root, '.github/workflows'), { recursive: true });
  if (content !== undefined) await writeFile(join(root, '.github/workflows/ci.yml'), content);
  return root;
}
const workflow = (ref, extra = '') => `name: Local fixture
on: push
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@${ref}
${extra}`;

test('reports mutable refs, exact evidence, hashes and local-only scope without exposing scripts', async () => {
  const secret = 'TEST_ONLY_SECRET_DO_NOT_REPORT_29918';
  const root = await fixture(workflow('v4', `      - run: echo ${secret}\n`));
  const report = await auditLocalCi(root);
  const item = report.assessment.items.find((entry) => entry.name === 'actions/checkout');
  assert.equal(item?.state, 'mutable');
  assert.equal(item?.path, '.github/workflows/ci.yml');
  assert.ok(item.line > 0);
  assert.equal(report.source.commit, null);
  assert.equal(report.source.commitVerification, 'not_verified');
  assert.match(report.source.contentSha256, /^[a-f0-9]{64}$/u);
  assert.equal(report.source.files.length, 1);
  assert.equal(report.scope.networkUsed, false);
  assert.equal(report.scope.projectCodeExecuted, false);
  assert.equal(report.scope.sourceUploaded, false);
  assert.ok(!JSON.stringify(report).includes(secret));
  assert.ok(!JSON.stringify(report).includes(root));
});

test('recognizes a full action SHA without inferring executed or safe code', async () => {
  const root = await fixture(workflow('1234567890abcdef1234567890abcdef12345678'));
  const report = await auditLocalCi(root);
  const item = report.assessment.items.find((entry) => entry.name === 'actions/checkout');
  assert.equal(item?.state, 'pinned');
  assert.equal(report.scope.executionVerified, false);
  assert.equal(report.source.files[0].sha256.length, 64);
});

test('retains static action identity for an unresolved dynamic reference without copying the expression', async () => {
  // biome-ignore lint/suspicious/noTemplateCurlyInString: Literal GitHub Actions expression under review.
  const root = await fixture(workflow('${{ vars.ACTION_REF }}'));
  const report = await auditLocalCi(root);
  const item = report.assessment.items.find((entry) => entry.name === 'actions/checkout');
  assert.equal(item?.state, 'unknown');
  assert.equal(item?.reference, null);
  assert.ok(!JSON.stringify(report).includes('vars.ACTION_REF'));
});

test('malformed YAML remains unknown and does not reveal the offending text', async () => {
  const root = await fixture('jobs: [ not valid YAML\nSECRET_TEST_PAYLOAD_2026: {\n');
  const report = await auditLocalCi(root);
  assert.equal(report.assessment.state, 'unknown');
  assert.ok(report.assessment.issues.length > 0);
  assert.ok(!JSON.stringify(report).includes('SECRET_TEST_PAYLOAD_2026'));
});

test('a symlinked workflow is skipped without reading its target', async () => {
  const root = await fixture();
  const external = join(base, 'external-workflow.yml');
  await writeFile(external, workflow('v4', '      - run: echo OUTSIDE_SENTINEL_9921\n'));
  await symlink(external, join(root, '.github/workflows/ci.yml'));
  const collected = await collectCiFiles(root);
  assert.deepEqual(Object.keys(collected.files.contents), []);
  assert.equal(collected.files.incomplete, true);
  assert.ok(collected.files.unreadable.includes('.github/workflows/ci.yml'));
  const report = await auditLocalCi(root);
  assert.ok(!JSON.stringify(report).includes('OUTSIDE_SENTINEL_9921'));
});

test('a symlinked configuration directory is skipped', async () => {
  const root = join(base, `project-${++index}`);
  const outside = join(base, `outside-${index}`);
  await mkdir(root);
  await mkdir(join(outside, 'workflows'), { recursive: true });
  await writeFile(join(outside, 'workflows/ci.yml'), workflow('v4'));
  await symlink(outside, join(root, '.github'));
  const result = await collectCiFiles(root);
  assert.equal(Object.keys(result.files.contents).length, 0);
  assert.equal(result.files.incomplete, true);
});

test('an oversized configuration is an explicit incomplete result', async () => {
  const root = await fixture('x'.repeat(129 * 1024));
  const result = await collectCiFiles(root);
  assert.equal(Object.keys(result.files.contents).length, 0);
  assert.equal(result.files.incomplete, true);
  assert.ok(result.files.unreadable.includes('.github/workflows/ci.yml'));
});

test('does not execute target package scripts or workflow run commands', async () => {
  const root = await fixture(workflow('v4', '      - run: touch workflow-should-not-execute\n'));
  await writeFile(
    join(root, 'package.json'),
    JSON.stringify({ scripts: { test: 'touch should-not-execute' } }),
  );
  await auditLocalCi(root);
  await assert.rejects(readFile(join(root, 'should-not-execute')), { code: 'ENOENT' });
  await assert.rejects(readFile(join(root, 'workflow-should-not-execute')), { code: 'ENOENT' });
});

test('report outputs are exclusive and refuse symlinks or overwrites', async () => {
  const output = join(base, 'report.json');
  await writeNewReport(output, { fixture: true });
  await assert.rejects(writeNewReport(output, { replacement: true }), { code: 'EEXIST' });
  const link = join(base, 'report-link.json');
  await symlink(output, link);
  await assert.rejects(writeNewReport(link, { replacement: true }), { code: 'EEXIST' });
  assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), { fixture: true });
});

test('standalone command produces JSON and a deterministic attention exit code', async () => {
  const root = await fixture(workflow('v4'));
  const result = spawnSync(process.execPath, [binary, '--root', root, '--fail-on-attention'], {
    encoding: 'utf8',
    timeout: 5_000,
    maxBuffer: 512 * 1024,
    env: { PATH: process.env.PATH, TMPDIR: base },
  });
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).tool.name, 'wisesama-ci-audit');
  assert.equal(result.stderr, '');
});

test('standalone command rejects missing input and writes a new report without stdout', async () => {
  const missing = spawnSync(process.execPath, [binary], {
    encoding: 'utf8',
    timeout: 5_000,
    maxBuffer: 128 * 1024,
  });
  assert.equal(missing.status, 1);
  assert.match(missing.stderr, /--root/u);
  const root = await fixture(workflow('v4'));
  const output = join(base, 'cli-output.json');
  const stdout = execFileSync(process.execPath, [binary, '--root', root, '--output', output], {
    encoding: 'utf8',
    timeout: 5_000,
    maxBuffer: 512 * 1024,
  });
  assert.equal(stdout, '');
  assert.equal(JSON.parse(await readFile(output, 'utf8')).tool.name, 'wisesama-ci-audit');
});

test('standalone command runs through a symlinked parent directory', async () => {
  const root = await fixture(workflow('v4'));
  const alias = join(base, 'checker-alias');
  await symlink(dirname(binary), alias, 'dir');
  const result = spawnSync(
    process.execPath,
    [join(alias, 'ci-audit.mjs'), '--root', root, '--fail-on-attention'],
    {
      encoding: 'utf8',
      timeout: 5_000,
      maxBuffer: 512 * 1024,
    },
  );
  assert.equal(result.status, 2, result.stderr);
  assert.equal(JSON.parse(result.stdout).tool.name, 'wisesama-ci-audit');
});
