import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Equivalent frontmatter checks when the skill-creator Python validator lacks PyYAML.
const here = dirname(fileURLToPath(import.meta.url));
const req = createRequire(resolve(here, '../../../apps/api/package.json'));
const { parseDocument } = req('yaml');
const text = await readFile(resolve(here, '../skills/wisesama-ci-audit/SKILL.md'), 'utf8');
const match = /^---\n([\s\S]*?)\n---/u.exec(text);
assert.ok(match, 'Valid YAML frontmatter is required.');
const document = parseDocument(match[1], { uniqueKeys: true });
assert.deepEqual(document.errors, []);
const data = document.toJS({ maxAliasCount: 0 });
assert.ok(data && typeof data === 'object' && !Array.isArray(data));
const allowed = new Set(['name', 'description', 'license', 'allowed-tools', 'metadata']);
assert.ok(
  Object.keys(data).every((key) => allowed.has(key)),
  'Unexpected frontmatter property.',
);
assert.equal(typeof data.name, 'string');
assert.match(data.name, /^[a-z0-9]+(?:-[a-z0-9]+)*$/u);
assert.ok(data.name.length <= 64);
assert.equal(typeof data.description, 'string');
assert.ok(data.description.length > 0 && data.description.length <= 1024);
assert.ok(!/[<>]/u.test(data.description));
assert.ok(!data.description.startsWith('[TODO:'));
assert.ok(!/^ {0,3}\[TODO:[^\n]*\]\s*$/mu.test(text));
const ui = parseDocument(
  await readFile(resolve(here, '../skills/wisesama-ci-audit/agents/openai.yaml'), 'utf8'),
);
assert.deepEqual(ui.errors, []);
const metadata = ui.toJS({ maxAliasCount: 0 });
assert.ok(metadata.interface.default_prompt.includes('$wisesama-ci-audit'));
assert.ok(
  metadata.interface.short_description.length >= 25 &&
    metadata.interface.short_description.length <= 64,
);
console.log('Skill frontmatter, naming, scaffold and UI metadata validation passed (Node/YAML).');
