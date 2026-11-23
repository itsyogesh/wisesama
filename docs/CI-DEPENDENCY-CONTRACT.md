# CI dependency integrity

Implemented as the fifth repository baseline check, `ci_dependencies`. The existing authenticated project security and explicit recheck endpoints return the extracted report in `baseline.ciDependencies`. It is stored with the baseline's checked commit, selected inventory paths and collection time. No new database table or provider permission is required.

These are configuration observations. A mutable reference is a hardening issue, not evidence that a dependency was compromised or executed. A pinned reference identifies bytes; it does not establish their safety. Old saved snapshots can lack this report until the next baseline check. Existing baseline stale/error handling retains prior evidence and makes changed selection, changed commit, paused/disconnected source and failed reads explicit.

## Extraction and result

`assessCiDependencies(files)` is a pure module with only the existing YAML dependency. Input is `{paths,contents,incomplete,unreadable}`: the provider supplies regular-file paths and transient allowlisted bytes from one immutable commit. It neither executes repository code nor makes network requests.

The report is `{version:1,state,items,filesChecked,issues,incomplete,limitations}`. Each item has `id,path,line,kind,name,reference,state,detail,recommendation`. `kind` is action, reusable_workflow, container, gitlab_include or local_action. `line` is the parsed scalar's one-based source line. IDs identify report rows, not a stable cross-revision vulnerability. The report preserves the configured reference; a matching lock's commit is explicitly recorded in detail.

| Item state | Observation |
| --- | --- |
| `pinned` | A supported full commit, SHA256 image digest, remote integrity binding, or same-workflow-commit local reference is configured. Remote ownership, runtime enforcement and code behavior remain unverified. |
| `locked` | The exact action reference is listed for this caller workflow in a supported `actions.lock` and has a full locked commit plus positive numeric repository/owner identities. This is static lock configuration only. |
| `mutable` | A supported branch/tag, implicit latest image, or remote include lacks an immutable binding. |
| `local` | A same-repository descriptor was read, but runner checkout or effective pipeline contents remain a separate unknown. |
| `unknown` | Dynamic, unsupported, invalid or out-of-scope metadata prevents the relevant integrity observation. |

Overall state is `attention` when any inspected reference is mutable, otherwise `unknown` when the read is incomplete, a local/dynamic result remains, or no dependency was established. It is `observed` only when all extracted metadata satisfies the stated bounded configuration observation. `incomplete` and `issues` remain visible even when a known mutable reference makes the overall state attention.

## GitHub

Root workflow action steps, reusable workflow calls, job/service containers and Docker actions are inspected. Full 40-character action/reusable-workflow commits and full SHA256 container digests are recognized. Branches and version tags remain mutable.

The current supported lock format is `v0.0.3` at `.github/workflows/actions.lock`. Presence alone grants no lock state: the caller path must be onboarded with the exact dependency string, matching ref, `sha1-` plus full commit, and positive numeric owner/repository IDs. Malformed/unsupported mappings, versions and missing listed dependency entries keep incomplete coverage explicit. Caller locks never pin external reusable workflow calls or the workflow's own dependencies. Remote transitive source is not fetched, so the report does not establish that all actual transitive actions appear in a supplied lockfile. GitHub documents lockfiles for Enterprise Cloud; plan availability, enforcement and remote reachability require owner verification.

`./` actions execute against the runner's checkout, whose revision/modifications cannot be inferred from a workflow file. `$/` references use the workflow's commit. Referenced local action descriptors under `.github/actions/` are read within scope; composite steps use the calling workflow's lock context. Local reusable workflows are inspected within the same bounded root workflow set. Dockerfiles, JavaScript action bodies and runtime downloads are outside this metadata check.

Primary references: [GitHub secure use](https://docs.github.com/en/actions/reference/security/secure-use), [workflow dependency lockfiles](https://docs.github.com/en/enterprise-cloud@latest/actions/concepts/security/workflow-dependency-lockfiles), [lock creation and local action semantics](https://docs.github.com/en/enterprise-cloud@latest/actions/how-tos/secure-your-work/lock-workflow-dependencies).

## GitLab.com

Root `.gitlab-ci.yml` and referenced local `.gitlab/ci/**/*.yml|yaml` files are inspected. Project includes need supported filenames and a full 40-character ref for a pinned observation. Remote HTTPS includes can declare a SHA256 integrity binding; the bytes and runtime verification are not checked. Component full commits, image digests, movable image tags, missing refs, dynamic inputs and unsupported platform templates remain distinct. Includes from other projects or remote URLs are never fetched. Includes outside the local allowlist, globs, YAML aliases and unsupported YAML tags remain unknown. Effective pipeline merging, provider settings and custom CI configuration locations are not established.

Primary references: [GitLab includes](https://docs.gitlab.com/ci/yaml/#include), [remote integrity](https://docs.gitlab.com/ci/yaml/#includeintegrity), [images](https://docs.gitlab.com/ci/yaml/#image).

## Bounds and data handling

The existing provider reads at most 40 allowlisted configuration files and 10 root GitHub workflows, 128KiB per configuration file and 512KiB total. Actions locks/descriptors do not count as workflows. Tree discovery remains bounded to 20,000 GitHub entries or 1,000 GitLab entries; truncation never proves an absent file. Inventory path restrictions are unchanged. Only the explicit CI allowlist permits descriptor directory names such as `.github/actions/build`; regular-file checks still reject symlinks and submodules before reading.

The pure parser independently limits configuration files/workflows/bytes, YAML depth 32 and 20,000 visited nodes, include nesting 8, extracted rows 200 and issues 50. Duplicate YAML keys, aliases, unknown tags and malformed documents are not treated as valid dependency evidence. AST access avoids projecting mapping keys onto JavaScript prototypes. No raw script, environment value, workflow body or provider response is persisted. URL userinfo is rejected, URL query/hash are omitted, and recognizable credential-like dependency values become unknown without retaining the value. Repository identities and configuration filenames are still private project metadata.

Tests cover source lines, exact/partial/malformed locks, caller isolation, reusable/local/composite semantics, images, GitLab includes, dynamic/malformed/aliased YAML, private-value omission, collection limits, immutable provider requests, symlinks and traversal. Local fixtures and unit tests are synthetic; no customer repository workflow or external include is executed.
