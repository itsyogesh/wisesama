# Checker source

The standalone checker has no runtime package dependencies. Its Wisesama source is in `source/ci-audit.mjs`, `source/ci-dependencies.ts` and `source/bounded-yaml.ts`; exact build dependencies and source fingerprints are recorded alongside them. The source entry's parser import is adapted to the archive layout.

To rebuild, install the exact development versions listed in `source/package.json` using your chosen reviewed package workflow, then run `node source/build.mjs`. Installing build tools can require network access. Running the already bundled checker requires only Node.js 20+.

The MIT license here covers this skill/package and its Wisesama checker. Bundled yaml retains its separate license in THIRD-PARTY-NOTICES.txt. This license does not apply to the rest of Wisesama.
