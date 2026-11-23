---
name: wisesama-ci-audit
description: Inspect a local project's GitHub Actions and GitLab CI dependency references, explain mutable or unresolved dependencies, and suggest bounded configuration fixes. Use for CI dependency integrity reviews; this is not a comprehensive code audit or evidence that a workflow executed.
---

# Wisesama CI audit

Review CI dependency configuration locally without a Wisesama account or uploading source. This skill includes a standalone Node.js 20+ checker. It reads bounded workflow/configuration files; it does not install packages, execute project code, fetch actions/includes, or contact Wisesama or another service.

## Run the local check

Honor the project's instructions and the user's requested repository and scope. Resolve `<skill-dir>` to the folder containing this file, then run:

```sh
node <skill-dir>/scripts/ci-audit.mjs --root /absolute/path/to/project
```

The default output is JSON on stdout. For a retained report, add `--output /absolute/path/to/new-report.json` with the user's chosen destination. The checker resolves that directory's real path, creates a new file, and refuses to replace an existing file or follow a leaf symlink. `--fail-on-attention` returns exit code 2 when the report has configuration needing attention; errors return 1, while a completed report normally returns 0. Unknown or incomplete coverage stays explicit in the report.

If Node is unavailable, say the executable check did not run. Source inspection can still help, but do not manufacture its JSON result or install tools without authorization.

## Interpret the evidence

Keep the reviewed local-file fingerprint, coverage limits, dependency identity, path/line, and reference together. The checker inspects local files as they exist now; it does not verify a Git commit, remote repository identity, GitHub lockfile enforcement, CI execution, or deployed exposure.

- `pinned` and `locked` describe observed reference/lock configuration. They do not establish that the dependency code is safe. A full SHA still needs a reviewed source and an update policy.
- `mutable` means a tag or branch can resolve to different code. Explain the exact reference and the applicable SHA, digest or workflow-lockfile approach.
- `local` means a reference points within the repository. Any descriptor the check did not inspect remains outside coverage.
- `unknown` means a dynamic expression, unreadable/unsupported configuration, external content, or incomplete collection prevented a conclusion. Preserve the exact limitation.

Do not convert a missing pin into a confirmed CVE or claim that secrets were stolen. A package/action advisory match, an execution log, and a reproduced security boundary failure are different evidence. Do not attach vulnerability severity to configuration observations.

## Respond and recheck

Lead with the actionable references, then unresolved coverage. Explain the smallest applicable configuration change with the report's official documentation links and the checked file/line. Use the repository's existing update/review process. Avoid showing unrelated CI scripts, environment values or secrets in the response.

This request does not authorize automatic edits, commits, dependency updates or provider policy changes. If the user asks for fixes, preserve their scope and approvals, inspect the actual source before editing, then rerun this checker against the changed files. Report the new fingerprint and whether the relevant observation changed. Unresolved transitive or provider-policy evidence remains unresolved.

A broader application security audit needs its own scope, architecture mapping, independent verification and execution isolation. This skill does not stand in for that workflow.
