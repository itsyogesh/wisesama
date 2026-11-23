import { build } from 'esbuild';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const source = dirname(fileURLToPath(import.meta.url));
await build({ entryPoints: [resolve(source, 'ci-audit.mjs')], outfile: resolve(source, '../scripts/ci-audit.mjs'), bundle: true, platform: 'node', target: 'node20', format: 'esm', banner: { js: "import { createRequire as __wisesamaCreateRequire } from 'node:module'; const require = __wisesamaCreateRequire(import.meta.url);" }, minify: false, legalComments: 'inline' });
