# Wisesama security skills

Free, open-source tools for reviewing a project's security evidence locally. The first package is **wisesama-ci-audit**: a focused GitHub Actions and GitLab CI dependency configuration review. It requires Node.js 20+, no Wisesama account, and no runtime package installation.

The checker makes no network requests, uploads no source, and runs no project scripts. Its JSON report keeps dependency identity/reference, file/line, local-file fingerprints, collection limits and unresolved evidence together. It is a configuration review, not a comprehensive code audit or proof that CI or deployed code is safe.

## Use the release

Download the archive and `SHA256SUMS` from Wisesama's Skills page, or use the files in `releases/` in this checkout. No public GitHub repository or npm publication is implied by this local release.

Verify the downloaded archive against the separately obtained checksum file, then extract it into a directory you choose:

```sh
shasum -a 256 -c SHA256SUMS
tar -xzf wisesama-ci-audit-0.1.2.tar.gz
node ./wisesama-ci-audit/scripts/ci-audit.mjs --root /absolute/path/to/project
```

For an agent, point it to the extracted `wisesama-ci-audit/SKILL.md` and request a CI dependency review. Compatible agents can also install the folder using their documented local-skill workflow. The direct Node command works without an agent integration.

`--output /absolute/path/to/new-report.json` writes a new mode-0600 report instead of stdout. Its parent directory is resolved to its real path; existing files and leaf symlinks are never replaced. `--fail-on-attention` returns 2 for attention results, making it useful in a reviewed CI step; ordinary completion returns 0 and errors return 1. Unknown coverage is explicit and is not reported as a passing security result.

## Coverage

The shared Wisesama parser reviews bounded root GitHub workflows, `actions.lock`, referenced `.github/actions/**/action.yml` or `.yaml`, root `.gitlab-ci.yml`, and allowlisted `.gitlab/ci` includes. Full action/workflow SHAs, container digests, applicable workflow-lock data, mutable references, local references and unresolved expressions are distinguished. External actions/includes and runtime downloads are never fetched.

Collection stops at 40 configuration files, 128KiB per file, 512KiB total, 2,000 discovered entries and eight nested descriptor directories. Parser limits include 10 root workflows, 200 dependency records, 20,000 YAML key/value nodes per file and depth 32. Duplicate keys are checked in a bounded AST walk after parsing; these limits do not bound every YAML parser CPU path. Rejected symlinks, unsupported encoding, unreadable or changed files, unsupported YAML and skipped coverage produce explicit incomplete/unknown evidence. Git commit, remote identity, provider enforcement and execution are not verified. Only extracted CI dependency metadata is returned; script/environment content is not copied into the report.

## Develop and rebuild

From the Wisesama monorepo with its existing dependencies installed:

```sh
pnpm --filter @wisesama/security-skills build
pnpm --filter @wisesama/security-skills test
pnpm --filter @wisesama/security-skills lint
pnpm --filter @wisesama/security-skills type-check
```

The build bundles the same pure parser used by Wisesama's repository baseline with YAML support into the standalone script. It writes the parser/CLI source and shared bounded YAML validator, exact build versions, source hashes, licenses, deterministic archive and checksums. Archive timestamps/owners/order/modes are fixed; the same source and build toolchain produce the same release bytes. This package's Turbo build cache is disabled because the shared parser lives outside the package. Development-only bundling tools are resolved from the existing API toolchain; the downloaded runtime has no external package dependencies. `SOURCE.md` in the archive explains standalone source rebuilding.

The MIT license applies to this package and its bundled Wisesama CI checker. It does not relicense the rest of the Wisesama repository. Bundled `yaml` retains its own license in `THIRD-PARTY-NOTICES.txt`. Cloudflare's broader security-audit skill is separate; this package neither bundles it nor claims its full-audit coverage.
