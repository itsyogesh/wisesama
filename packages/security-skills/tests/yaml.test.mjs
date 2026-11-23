import assert from 'node:assert/strict';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, test } from 'node:test';
import { auditLocalCi } from '../skills/wisesama-ci-audit/scripts/ci-audit.mjs';

const base = await mkdtemp(join(tmpdir(), 'wisesama-skill-yaml-test-'));
after(() => rm(base, { recursive: true, force: true }));

test('bundled checker keeps duplicate resolved keys, aliases and complex keys unknown', async () => {
  const cases = [
    'jobs: {}\n"jo\\u0062s": {}',
    'jobs: {build: {steps: [], "steps": []}}',
    'value: &value {}\njobs: *value',
    '? [jobs, other]\n: {}',
  ];
  for (const [index, content] of cases.entries()) {
    const root = join(base, `fixture-${index}`);
    await mkdir(join(root, '.github/workflows'), { recursive: true });
    await writeFile(join(root, '.github/workflows/ci.yml'), content);
    const { assessment } = await auditLocalCi(root);
    assert.equal(assessment.state, 'unknown');
    assert.equal(assessment.incomplete, true);
    assert.deepEqual(assessment.items, []);
    assert.deepEqual(assessment.filesChecked, []);
    assert.equal(assessment.issues[0]?.path, '.github/workflows/ci.yml');
  }
});
