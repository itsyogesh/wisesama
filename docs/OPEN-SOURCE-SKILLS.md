# Free Wisesama skills

The first working package is `packages/security-skills/skills/wisesama-ci-audit`, distributed as `packages/security-skills/releases/wisesama-ci-audit-0.1.1.tar.gz`. Its archive contains the skill instructions, standalone Node.js checker, original Wisesama parser/CLI source, exact build metadata, MIT license and bundled YAML license. `SHA256SUMS`, the per-file `.sha256` and `manifest.json` identify the generated artifact. This is a local build artifact; a public source repository, registry package and production download have not been published.

## Product contract

- Free and usable without creating a Wisesama account.
- Local files only; no telemetry, source uploads, network requests, project-code execution or automatic edits.
- GitHub Actions and GitLab CI dependency configuration evidence, with the same parser as the authenticated repository baseline.
- Explicit full-SHA/digest, lock configuration, mutable, local and unknown states. These are observations, not vulnerability severity or exposure claims.
- Local working-file hashes identify reviewed input. The CLI does not assert a Git commit, CI execution, provider policy, remote action identity or deployed safety.
- Bounded collection and parsing; symlinks, unreadable/changed files and unsupported configuration remain visible as incomplete coverage.

Public page download links should serve the generated archive and exact checksum file. Installation examples can use the archive or a local checkout, not a guessed GitHub/npm URL. The page should state Node.js 20+ and show a direct offline command alongside instructions for a compatible agent. Do not require a customer account, an API key or private MCP access for this tool.

```sh
node /path/to/wisesama-ci-audit/scripts/ci-audit.mjs --root /path/to/project
```

Optional `--output NEW_REPORT.json` exclusively creates a mode-0600 report in the resolved output directory. Existing output files and leaf symlinks are not replaced. `--fail-on-attention` returns 2 when a completed assessment needs attention; errors return 1. Unknown coverage remains explicit rather than becoming an affirmative security result.

## Scope and future packages

The collector reads at most 40 configuration files, 128KiB per file and 512KiB total, with 2,000 discovered entries and bounded descriptor depth. The parser limits root workflows to 10 and extracted dependencies to 200. Only selected CI dependency facts and their source fingerprints are returned. It never uploads or retains raw workflow bodies, environment values or target scripts in its report.

The skill explains how to review results, suggest a scoped change and recheck the new input fingerprint. A mutable reference is a configuration weakness; evidence of a known affected action or a workflow actually running requires separate data. The skill does not run a comprehensive application security audit.

Cloudflare's `security-audit` methodology is used separately for Wisesama's prelaunch review. A future broader Wisesama audit skill can build on independently verified findings, exact unresolved blockers, source/coverage ledgers and safe execution isolation. That future capability is not advertised as part of this release. Private report import, hosted execution, automatic fix pull requests and security guarantees are also outside this package.

## Verification

The package contains behavioral tests for mutable/full-SHA evidence, malformed configuration, secret-content omission, symlinked files/directories, file byte limits, target-script nonexecution, exclusive output files and actual standalone command exit behavior. Build and release checks validate source inclusion, deterministic archive behavior and checksums. The required skill-creator Python validator was attempted; this machine lacks PyYAML, so equivalent frontmatter/schema checks use the already installed Node YAML parser. A fresh independent agent completed forward tests against normal mixed-provider input, changed file fingerprints, partial/ambiguous input, project paths with spaces, outside symlinks, and existing/symlink output files. It found a dynamic-reference identity gap, which was corrected in the shared parser and bundled release with a regression test. All 13 package tests passed. The actual browser-downloaded archive was separately checksum-verified, extracted and run against a synthetic mutable-action project; it returned the expected attention exit code 2.

The package MIT license is deliberately scoped to the distributable Wisesama skill/checker. The main product is not relicensed. Exact third-party notices ship with the archive. See [package instructions](../packages/security-skills/README.md) for rebuild and command details.
