import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { link, mkdtemp, readFile, rm, symlink, unlink, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { gunzipSync } from 'node:zlib';
import { skillArchive } from '../scripts/archive.mjs';

test('release archive is stable across filesystem timestamps and includes source bytes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wisesama-archive-test-'));
  try {
    await writeFile(join(root, 'SKILL.md'), '---\nname: fixture\n---\n');
    const first = await skillArchive(root, 'wisesama-ci-audit');
    await utimes(join(root, 'SKILL.md'), 123, 456);
    const second = await skillArchive(root, 'wisesama-ci-audit');
    assert.deepEqual(first, second);
    const tar = gunzipSync(first);
    assert.equal(tar.subarray(0, 21).toString().replaceAll('\0', ''), 'wisesama-ci-audit/');
    assert.ok(tar.includes(Buffer.from('name: fixture')));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('release archive refuses symlinked or hard-linked inputs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'wisesama-archive-link-'));
  try {
    await writeFile(join(root, 'source'), 'test');
    await symlink(join(root, 'source'), join(root, 'link'));
    await assert.rejects(skillArchive(root, 'wisesama-ci-audit'), /symlink/u);
    await unlink(join(root, 'link'));
    await link(join(root, 'source'), join(root, 'hard-link'));
    await assert.rejects(skillArchive(root, 'wisesama-ci-audit'), /single-link/u);
    assert.equal(await readFile(join(root, 'source'), 'utf8'), 'test');
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('release includes every parser source, fingerprint and license', async () => {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const repo = resolve(packageRoot, '../..');
  const skill = resolve(packageRoot, 'skills/wisesama-ci-audit');
  const provenance = JSON.parse(await readFile(resolve(skill, 'build-provenance.json'), 'utf8'));
  const expected = [
    'apps/api/src/services/intel/ci-dependencies.ts',
    'apps/api/src/services/intel/bounded-yaml.ts',
  ];
  assert.deepEqual(
    provenance.sources.map((entry) => entry.source),
    expected,
  );
  const tar = gunzipSync(await skillArchive(skill, 'wisesama-ci-audit'));
  for (const entry of provenance.sources) {
    const source = await readFile(resolve(repo, entry.source));
    const archived = await readFile(resolve(skill, entry.archivedAs));
    assert.equal(createHash('sha256').update(source).digest('hex'), entry.sourceSha256);
    assert.deepEqual(archived, source);
    assert.ok(tar.includes(Buffer.from(`wisesama-ci-audit/${entry.archivedAs}`)));
    assert.ok(tar.includes(archived));
  }
  const parser = await readFile(resolve(skill, 'source/ci-dependencies.ts'), 'utf8');
  assert.match(parser, /from '\.\/bounded-yaml'/u);
  const sourceGuide = await readFile(resolve(skill, 'SOURCE.md'), 'utf8');
  assert.ok(sourceGuide.includes('source/bounded-yaml.ts'));
  assert.match(await readFile(resolve(skill, 'LICENSE'), 'utf8'), /MIT License/u);
  assert.match(provenance.licenseScope, /bounded-yaml\.ts/u);
});
