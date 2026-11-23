#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { lstat, open, opendir, realpath } from 'node:fs/promises';
import { basename, dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assessCiDependencies,
  CI_DEPENDENCY_LIMITS,
} from './ci-dependencies.ts';

export const VERSION = '0.1.2';
const MAX_ENTRIES = 2_000;
const MAX_DEPTH = 8;
const MAX_PATH = 512;
const help = `Wisesama CI audit ${VERSION}

Usage: node ci-audit.mjs --root PATH [--output NEW_FILE.json] [--fail-on-attention]

Reads local CI configuration only. No network, project execution, or source uploads.
The JSON report describes configuration evidence; it does not verify a commit or CI run.
Without --output, writes JSON to stdout. Existing output files are never overwritten.
Exit codes: 0 completed, 1 error, 2 attention with --fail-on-attention.
`;
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const isControl = (character) => character.codePointAt(0) < 32 || character.codePointAt(0) === 127;
const within = (root, target) => {
  const part = relative(root, target);
  return part === '' || (!part.startsWith(`..${sep}`) && part !== '..' && !isAbsolute(part));
};
const validRelative = (path) =>
  path.length <= MAX_PATH &&
  !isAbsolute(path) &&
  !path.includes('\\') &&
  !Array.from(path).some(isControl) &&
  path.split('/').every((part) => part !== '' && part !== '.' && part !== '..');
const sameFile = (a, b) => a.dev === b.dev && a.ino === b.ino;

/** Bounded allowlisted collection; no repository scripts or Git commands are executed. */
export async function collectCiFiles(inputRoot) {
  const root = await realpath(resolve(inputRoot));
  const rootStat = await lstat(root);
  if (!rootStat.isDirectory()) throw new Error('The selected root must be a directory.');
  const paths = [];
  const contents = Object.create(null);
  const unreadable = [];
  const fileHashes = [];
  let incomplete = false;
  let entries = 0;
  let bytes = 0;
  const maxFiles = CI_DEPENDENCY_LIMITS.files;
  const maxFileBytes = CI_DEPENDENCY_LIMITS.fileBytes;
  const maxTotalBytes = CI_DEPENDENCY_LIMITS.totalBytes;

  function skipped(path) {
    incomplete = true;
    if (unreadable.length < maxFiles && !unreadable.includes(path)) unreadable.push(path);
  }
  async function checkedDirectory(path) {
    const parts = path ? path.split('/') : [];
    let current = root;
    for (const part of parts) {
      if (!validRelative(part)) throw new Error('Unsupported configuration path.');
      current = resolve(current, part);
      const stat = await lstat(current);
      if (stat.isSymbolicLink() || !stat.isDirectory())
        throw new Error('Configuration directories must be regular directories.');
      const canonical = await realpath(current);
      if (!within(root, canonical) || canonical !== current)
        throw new Error('Configuration path leaves the selected root.');
    }
    if (!sameFile(rootStat, await lstat(root))) throw new Error('The selected root changed.');
    return current;
  }
  async function add(path) {
    if (!validRelative(path)) {
      skipped('Unsupported configuration path');
      return;
    }
    if (paths.includes(path)) return;
    if (paths.length >= maxFiles) {
      skipped(path);
      return;
    }
    paths.push(path);
    let handle;
    try {
      await checkedDirectory(dirname(path) === '.' ? '' : dirname(path));
      const full = resolve(root, path);
      const before = await lstat(full);
      if (before.isSymbolicLink() || !before.isFile() || before.nlink !== 1)
        throw new Error('Only single-link regular configuration files are inspected.');
      if (before.size > maxFileBytes || bytes + before.size > maxTotalBytes)
        throw new Error('Configuration byte limit exceeded.');
      if (typeof constants.O_NOFOLLOW !== 'number')
        throw new Error('This platform cannot enforce no-follow configuration reads.');
      handle = await open(full, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK);
      const opened = await handle.stat();
      if (!opened.isFile() || opened.nlink !== 1 || !sameFile(before, opened))
        throw new Error('Configuration changed before reading.');
      const buffer = Buffer.alloc(maxFileBytes + 1);
      let length = 0;
      while (length < buffer.length) {
        const part = await handle.read(buffer, length, buffer.length - length, length);
        if (!part.bytesRead) break;
        length += part.bytesRead;
      }
      if (length > maxFileBytes || bytes + length > maxTotalBytes)
        throw new Error('Configuration byte limit exceeded.');
      const after = await handle.stat();
      const current = await lstat(full);
      await checkedDirectory(dirname(path) === '.' ? '' : dirname(path));
      if (
        !sameFile(opened, after) ||
        !sameFile(opened, current) ||
        current.isSymbolicLink() ||
        after.nlink !== 1 ||
        opened.size !== after.size ||
        opened.mtimeMs !== after.mtimeMs ||
        opened.ctimeMs !== after.ctimeMs ||
        length !== after.size
      )
        throw new Error('Configuration changed during reading.');
      const content = new TextDecoder('utf-8', { fatal: true }).decode(buffer.subarray(0, length));
      bytes += length;
      contents[path] = content;
      fileHashes.push({ path, sha256: sha256(buffer.subarray(0, length)), bytes: length });
    } catch {
      skipped(path);
    } finally {
      await handle?.close();
    }
  }
  async function walk(path, accepts, recursive, depth = 0) {
    if (depth > MAX_DEPTH) {
      skipped(path);
      return;
    }
    let items;
    try {
      const full = await checkedDirectory(path);
      items = [];
      const directory = await opendir(full);
      for await (const item of directory) {
        entries++;
        if (entries > MAX_ENTRIES) {
          skipped(path);
          break;
        }
        items.push(item);
      }
    } catch (error) {
      if (error && typeof error === 'object' && error.code === 'ENOENT') return;
      skipped(path);
      return;
    }
    for (const item of items.sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const child = `${path}/${item.name}`;
      if (!validRelative(child)) {
        skipped('Unsupported configuration path');
        continue;
      }
      if (item.isSymbolicLink()) {
        if (recursive || accepts(child)) skipped(child);
      } else if (item.isDirectory() && recursive) await walk(child, accepts, true, depth + 1);
      else if (item.isFile() && accepts(child)) await add(child);
      else if (!item.isDirectory() && accepts(child)) skipped(child);
    }
  }
  // Reserve lock/root-CI evidence before bounded descriptor discovery.
  for (const path of ['.github/workflows/actions.lock', '.gitlab-ci.yml']) {
    try {
      await lstat(resolve(root, path));
      await add(path);
    } catch (error) {
      if (!error || typeof error !== 'object' || error.code !== 'ENOENT') skipped(path);
    }
  }
  await walk(
    '.github/workflows',
    (path) => /^\.github\/workflows\/[^/]+\.ya?ml$/u.test(path),
    false,
  );
  await walk('.github/actions', (path) => /\/(?:action\.ya?ml)$/u.test(path), true);
  await walk('.gitlab/ci', (path) => /\.ya?ml$/u.test(path), true);
  fileHashes.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  return {
    name:
      Array.from(basename(root))
        .filter((character) => !isControl(character))
        .join('')
        .slice(0, 120) || 'Local project',
    files: { paths, contents, incomplete, unreadable },
    fileHashes,
    bytes,
  };
}

export async function auditLocalCi(root) {
  const collected = await collectCiFiles(root);
  const assessment = assessCiDependencies(collected.files);
  return {
    schemaVersion: 1,
    tool: { name: 'wisesama-ci-audit', version: VERSION },
    project: collected.name,
    checkedAt: new Date().toISOString(),
    source: {
      kind: 'local_files',
      commit: null,
      commitVerification: 'not_verified',
      contentSha256: sha256(JSON.stringify(collected.fileHashes)),
      files: collected.fileHashes,
    },
    collection: { fileCount: collected.fileHashes.length, bytes: collected.bytes },
    assessment,
    documentation: [
      {
        title: 'GitHub secure use reference',
        url: 'https://docs.github.com/en/actions/reference/security/secure-use',
      },
      {
        title: 'GitHub workflow dependency lockfiles',
        url: 'https://docs.github.com/en/enterprise-cloud@latest/actions/concepts/security/workflow-dependency-lockfiles',
      },
      { title: 'GitLab include configuration', url: 'https://docs.gitlab.com/ci/yaml/#include' },
    ],
    scope: {
      networkUsed: false,
      projectCodeExecuted: false,
      sourceUploaded: false,
      executionVerified: false,
      limitations: [
        'This is local working-file evidence, not a verified Git commit or CI execution result.',
        'Only allowlisted root workflows, lock data and bounded local action/CI descriptors were inspected.',
        'External actions, includes, runtime downloads, provider policies, runner state and deployment are not verified.',
      ],
    },
  };
}

export async function writeNewReport(path, report) {
  const selected = resolve(path);
  const parent = await realpath(dirname(selected));
  const target = resolve(parent, basename(selected));
  const handle = await open(
    target,
    constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL,
    0o600,
  );
  try {
    await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`, 'utf8');
  } finally {
    await handle.close();
  }
}

export async function main(args = process.argv.slice(2)) {
  if (args.length === 1 && ['--help', '-h'].includes(args[0])) {
    process.stdout.write(help);
    return 0;
  }
  let root;
  let output;
  let failOnAttention = false;
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flag === '--fail-on-attention' && !failOnAttention) failOnAttention = true;
    else if (
      ['--root', '--output'].includes(flag) &&
      args[i + 1] &&
      !args[i + 1].startsWith('--')
    ) {
      if (flag === '--root' && !root) root = args[++i];
      else if (flag === '--output' && !output) output = args[++i];
      else throw new Error('Each option can be supplied only once.');
    } else
      throw new Error('Use --root PATH, optional --output NEW_FILE.json, and --fail-on-attention.');
  }
  if (!root)
    throw new Error('Choose the project explicitly with --root PATH. Use --help for usage.');
  const report = await auditLocalCi(root);
  if (output) await writeNewReport(output, report);
  else process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  return failOnAttention && report.assessment.state === 'attention' ? 2 : 0;
}

// Node resolves the main module's symlinks, while argv can retain an aliased
// parent directory (for example /tmp on macOS). Compare canonical file paths.
const entryFile = process.argv[1]
  ? await realpath(resolve(process.argv[1])).catch(() => null)
  : null;
if (entryFile && entryFile === (await realpath(fileURLToPath(import.meta.url)))) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error) => {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
      const text =
        code === 'EEXIST'
          ? 'Output already exists; choose a new report file.'
          : error instanceof Error && !code
            ? error.message
            : 'The selected local files or output could not be accessed. No existing report was replaced.';
      process.stderr.write(`Wisesama CI audit: ${text}\n`);
      process.exitCode = 1;
    });
}
