# Repository security baseline and project context

Implemented for the Wisesama response product. All private routes require an owning account session, return `Cache-Control: private, no-store`, and use the existing `/api/v1` API envelope. Writes require JSON; API keys do not grant this access.

## Routes and DTO

- `GET /intel/projects/:id/security` reads the last collected configuration evidence and self-reported context.
- `PATCH /intel/projects/:id/context` requires `{ internetFacing: 'yes'|'no'|'unknown', sensitiveData: 'yes'|'no'|'unknown', hosting: string }` (all three fields; hosting one line, at most120 characters). It does not change finding severity, status or priority. Returns the complete security DTO.
- `POST /intel/projects/:id/baseline` accepts `{}`. It checks the active source at its **imported commit**, rather than silently advancing the tracked branch. Connect, resume/reconnect and sync first where needed. Returns the complete security DTO. Manual or inactive sources return409.

```ts
type Security = {
  project: { id: string; name: string; environment: string };
  context: {
    internetFacing: 'yes' | 'no' | 'unknown';
    sensitiveData: 'yes' | 'no' | 'unknown';
    hosting: string;
    updatedAt: string | null;
    provenance: 'self_reported';
  };
  repository: null | {
    provider: string; repositoryName: string; branch: string;
    importedCommit: string | null; observedCommit: string | null;
    status: string; paused: boolean; paths: string[];
  };
  baseline: {
    status: 'unsupported' | 'not_checked' | 'current' | 'stale' | 'unavailable';
    commit: string | null;
    inventoryPaths: string[];
    checkedAt: string | null;
    attemptedAt: string | null;
    error: string | null;
    checks: Array<{
      id: 'package_manager' | 'lockfile' | 'ci_install' | 'dependency_cooldown';
      title: string;
      state: 'observed' | 'attention' | 'unknown';
      summary: string;
      evidence: Array<{ path: string; detail: string }>;
      recommendation: string;
      documentationUrl: string;
    }>;
    scope: 'repository_configuration';
    limitations: string[];
  };
};
```

`observed` means a static configuration signal was found. It never means verified enforcement, a successful CI run, deployed exposure, reachability, or a security guarantee. There is no aggregate score. `current` means the snapshot matches the imported commit and normalized selected-path set; it is not a claim that a deployment uses that commit. A path change at the same SHA still makes the old snapshot stale, including while a new inventory sync completes before configuration collection. Older snapshots missing path provenance remain stale until recollection. Changes, pausing/disconnection, or collection failures show retained evidence as stale. `checkedAt` remains the last successful check and `attemptedAt` records the most recent attempt. Manual inventory has unsupported configuration evidence and empty checks.

## Collection and limits

Automatic collection follows repository creation and each successful sync, independently of vulnerability assessment. Configuration is collected at the imported immutable SHA. A separate token/lease prevents overlapping checks; conditional persistence rejects source changes, pause/disconnect and lost connection while in flight. A failed collection never overwrites previous evidence or its successful timestamp. Credentials remain in the existing encrypted provider connection and never enter the evidence payload.

The reader only fetches `package.json`, `pnpm-workspace.yaml`, `pyproject.toml`, and `uv.toml` at selected inventory roots and ancestors; root `.github/workflows/*.yml|yaml` (at most10) and `.gitlab-ci.yml`. `.env`, `.npmrc`, secrets files, unrelated source, arbitrary include URLs and executable actions are never fetched by this check. Tree metadata provides lockfile presence, not lockfile consistency. Only regular file modes100644/100755 are read; symlinks and submodules are never followed. GitHub tree is capped20,000 entries; GitLab tree10pages of100. Config fetches are at most40files,128KB each,512KB total. Truncation/unreadable files remain visible uncertainty. No repository code or dependency installation is executed.

Only recognized static facts and paths persist. Raw manifests, CI scripts, registry URLs, tokens, and config contents are transient and excluded from persisted baseline data. YAML aliases are not expanded. The TOML reader validates a conservative structural subset across the whole file: bare-key tables and single-line string, integer or boolean settings. Malformed lines, duplicate fields/tables, arrays, inline tables, escaped/multiline strings and other unsupported syntax invalidate the whole TOML check and remain unknown. Table-form uv package exceptions are recognized and need attention. This favors uncertainty over accepting partial configuration.

## Meaning of the checks

- Package manager: exact supported `packageManager` declaration, or exact uv `required-version`. Declared versions do not establish actual CI tool execution.
- Lockfile: matching committed file at the selected root or an ancestor. An ancestor/shared lock explicitly remains repository/workspace evidence; service-specific closure is unverified.
- CI install: parsed GitHub `run` or GitLab `script`/`before_script` with a candidate `npm ci`, `pnpm install --frozen-lockfile`, or `uv sync --locked`. Comments, display names and echo commands do not count. Job conditions, working directories, setup, reusable workflows, includes and branch protection are unverified.
- Cooldown: explicit positive pnpm `minimumReleaseAge` with a compatible exact stable declaration (introduced10.16.0), or duration-based uv `exclude-newer` with exact uv0.9.17+. Older/unknown versions, fixed dates, disabled settings and exceptions do not receive an unconditional observed result. CLI/global/.npmrc/environment overrides, registry timestamps, exceptions and tool-specific lockfile semantics still need human review. Keep reviewed urgent-security-patch exceptions; a waiting period does not establish safety.

Primary sources: [pnpm10.16.0 release](https://github.com/pnpm/pnpm/releases/tag/v10.16.0), [pnpm dependency resolution](https://pnpm.io/settings/dependency-resolution#minimumreleaseage), [uv0.9.17 release](https://github.com/astral-sh/uv/releases/tag/0.9.17), [uv cooldown semantics](https://docs.astral.sh/uv/concepts/resolution/#dependency-cooldowns), [npm ci](https://docs.npmjs.com/cli/v11/commands/npm-ci), [Node packageManager](https://nodejs.org/api/packages.html#packagemanager).

## Database

`20261105000000_security_baseline` adds context fields to `SecurityProject`, last snapshot/attempt/error/lease fields to `ProjectRepositorySource`, and the parent-owned incident response/event models. Existing crypto and security response data are preserved. This migration is additive and is applied only to an explicitly isolated local database during verification; production baseline/release procedures remain required.
