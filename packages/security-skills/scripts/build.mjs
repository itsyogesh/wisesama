import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { skillArchive } from './archive.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const repo = resolve(root, '../..');
const apiRequire = createRequire(resolve(repo, 'apps/api/package.json'));
const tsupRequire = createRequire(apiRequire.resolve('tsup'));
const esbuild = tsupRequire('esbuild');
const version = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8')).version;
const skill = resolve(root, 'skills/wisesama-ci-audit');
const out = resolve(skill, 'scripts/ci-audit.mjs');
const parser = resolve(repo, 'apps/api/src/services/intel/ci-dependencies.ts');
const yamlGuard = resolve(repo, 'apps/api/src/services/intel/bounded-yaml.ts');
const cli = resolve(root, 'src/cli.mjs');
const parserBytes = await readFile(parser);
const yamlGuardBytes = await readFile(yamlGuard);
const cliBytes = await readFile(cli);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const yamlPackage = apiRequire.resolve('yaml/package.json');
const yaml = JSON.parse(await readFile(yamlPackage, 'utf8'));
const banner =
  "import { createRequire as __wisesamaCreateRequire } from 'node:module'; const require = __wisesamaCreateRequire(import.meta.url);";
await mkdir(dirname(out), { recursive: true });
await esbuild.build({
  entryPoints: [cli],
  outfile: out,
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  banner: { js: banner },
  minify: false,
  legalComments: 'inline',
  logLevel: 'warning',
});
if (
  digest(parserBytes) !== digest(await readFile(parser)) ||
  digest(yamlGuardBytes) !== digest(await readFile(yamlGuard)) ||
  digest(cliBytes) !== digest(await readFile(cli))
)
  throw new Error('Checker source changed during bundling. Build again after edits finish.');
const license = await readFile(resolve(root, 'LICENSE'), 'utf8');
const yamlLicense = await readFile(resolve(dirname(yamlPackage), 'LICENSE'), 'utf8');
await copyFile(resolve(root, 'LICENSE'), resolve(skill, 'LICENSE'));
await writeFile(
  resolve(skill, 'THIRD-PARTY-NOTICES.txt'),
  `The standalone checker bundles yaml ${yaml.version}.\n\n${yamlLicense}\n`,
);
const source = resolve(skill, 'source');
await mkdir(source, { recursive: true });
await writeFile(resolve(source, 'ci-dependencies.ts'), parserBytes);
await writeFile(resolve(source, 'bounded-yaml.ts'), yamlGuardBytes);
await writeFile(
  resolve(source, 'ci-audit.mjs'),
  cliBytes
    .toString('utf8')
    .replace('../../../apps/api/src/services/intel/ci-dependencies.ts', './ci-dependencies.ts'),
);
await writeFile(
  resolve(source, 'package.json'),
  `${JSON.stringify({ private: true, type: 'module', devDependencies: { esbuild: esbuild.version, yaml: yaml.version } }, null, 2)}\n`,
);
await writeFile(
  resolve(source, 'build.mjs'),
  `import { build } from 'esbuild';\nimport { dirname, resolve } from 'node:path';\nimport { fileURLToPath } from 'node:url';\nconst source = dirname(fileURLToPath(import.meta.url));\nawait build({ entryPoints: [resolve(source, 'ci-audit.mjs')], outfile: resolve(source, '../scripts/ci-audit.mjs'), bundle: true, platform: 'node', target: 'node20', format: 'esm', banner: { js: ${JSON.stringify(banner)} }, minify: false, legalComments: 'inline' });\n`,
);
await writeFile(
  resolve(skill, 'build-provenance.json'),
  `${JSON.stringify(
    {
      version,
      source: 'apps/api/src/services/intel/ci-dependencies.ts',
      sourceSha256: digest(parserBytes),
      cliSourceSha256: digest(cliBytes),
      sources: [
        {
          source: 'apps/api/src/services/intel/ci-dependencies.ts',
          archivedAs: 'source/ci-dependencies.ts',
          sourceSha256: digest(parserBytes),
        },
        {
          source: 'apps/api/src/services/intel/bounded-yaml.ts',
          archivedAs: 'source/bounded-yaml.ts',
          sourceSha256: digest(yamlGuardBytes),
        },
      ],
      bundled: [{ name: 'yaml', version: yaml.version, license: yaml.license }],
      buildTool: { name: 'esbuild', version: esbuild.version },
      runtimeDependencies: [],
      licenseScope:
        'This package and its bundled Wisesama CI checker, including bounded-yaml.ts, only; not the rest of the Wisesama repository.',
    },
    null,
    2,
  )}\n`,
);
await writeFile(
  resolve(skill, 'SOURCE.md'),
  `# Checker source\n\nThe standalone checker has no runtime package dependencies. Its Wisesama source is in \`source/ci-audit.mjs\`, \`source/ci-dependencies.ts\` and \`source/bounded-yaml.ts\`; exact build dependencies and source fingerprints are recorded alongside them. The source entry's parser import is adapted to the archive layout.\n\nTo rebuild, install the exact development versions listed in \`source/package.json\` using your chosen reviewed package workflow, then run \`node source/build.mjs\`. Installing build tools can require network access. Running the already bundled checker requires only Node.js 20+.\n\nThe MIT license here covers this skill/package and its Wisesama checker. Bundled yaml retains its separate license in THIRD-PARTY-NOTICES.txt. This license does not apply to the rest of Wisesama.\n`,
);
await mkdir(resolve(root, 'releases'), { recursive: true });
const filename = `wisesama-ci-audit-${version}.tar.gz`;
const archiveBytes = await skillArchive(skill, 'wisesama-ci-audit');
const archiveDigest = digest(archiveBytes);
await writeFile(resolve(root, 'releases', filename), archiveBytes);
await writeFile(resolve(root, 'releases', `${filename}.sha256`), `${archiveDigest}  ${filename}\n`);
await writeFile(resolve(root, 'releases', 'SHA256SUMS'), `${archiveDigest}  ${filename}\n`);
await writeFile(
  resolve(root, 'releases', 'manifest.json'),
  `${JSON.stringify(
    {
      name: 'wisesama-ci-audit',
      version,
      filename,
      sha256: archiveDigest,
      bytes: archiveBytes.length,
      node: '>=20',
      license: 'MIT',
      accountRequired: false,
      networkRequired: false,
      sourceUploaded: false,
    },
    null,
    2,
  )}\n`,
);
if (!license.includes('MIT License')) throw new Error('Package license is missing.');
console.log(`Built ${filename} (${archiveBytes.length} bytes), with no runtime dependencies.`);
