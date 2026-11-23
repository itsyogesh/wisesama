# Incident response playbooks

This extension implements the practical product recommendations from [Jack Cable’s November 3 article](https://cognition.com/blog/practical-guide-to-security-november-2026): add deployment context, assess repository hygiene, and carry an incident through to a recorded response. Tool inventory and broad endpoint/cloud monitoring remain deferred.

## Workflow

Connect/import a repository → inspect `/app/projects/:id/security` → record self-reported project context → choose a response playbook → review applicability → record containment/recovery tasks and evidence → save an attested outcome → reopen if new evidence appears.

Manual inventory projects can save context and incident responses but have no repository configuration baseline. Existing vulnerability findings keep their own lifecycle. An incident response does not silently change those findings.

Public `/playbooks` and `/playbooks/:id` expose guidance only. “Choose a project to start” preserves the selected playbook through sign-in and opens `/app/responses/new?playbook=:id`. Private records live at `/app/projects/:id/responses/:playbookId` and belong to the account that owns the project. Shared membership is not implemented.

## Templates and sources

The API’s `services/intel/playbooks.ts` is the single source for public and private guidance. Each template has a stable ID, explicit version, update date, applicability questions, phases/tasks, evidence prompts, primary-source links, and assessment boundaries.

- `malicious-dependency`: manually review a reported malicious release, execution, containment, recovery, accessible credentials, and downstream activity. A package metadata match does not prove execution.
- `cursor-extension-oct-2026`: manual review against [Cursor’s authoritative notice](https://cursor.com/blog/claude-code-extension-security-notice). Scope includes platform, exact historical extension versions, marketplace channel, and the vendor’s installation/update window. Wisesama does not infer extension installation from npm/PyPI inventories. Removing an extension alone is not recorded as verified recovery.

Applicability is a conjunction of necessary conditions in each template. Any recorded No means a condition was not met; unanswered/Unknown conditions remain open. “Potentially affected” is based on the owner’s answers, not an automated device inspection. A negative condition can justify an attested not-affected record only with a written summary and supporting evidence. Source guidance may change; compare the current notice before acting.

## API

All routes use `/api/v1`. Public reads:

- `GET /intel/playbooks`
- `GET /intel/playbooks/:playbookId`

Session-authenticated, owner-bound routes:

- `GET /intel/projects/:id/responses`
- `GET /intel/projects/:id/responses/:playbookId` (no mutation)
- `POST /intel/projects/:id/responses/:playbookId` with `{}` (idempotent start)
- `PATCH /intel/projects/:id/responses/:playbookId`

PATCH requires `expectedRevision`, `status`, `answers`, `checks`, `note`, and `evidence`. Statuses: `investigating`, `contained`, `recovering`, `closed`, `not_affected`. Answers only accept current question IDs and `yes|no|unknown`; checks only accept current task IDs and booleans. Extra fields and client-supplied ownership are rejected. Mutations require JSON, and private records use no-store responses.

Both `closed` and `not_affected` require at least 20 trimmed characters each in the response summary and evidence references. Closed additionally requires every task checked. Not affected requires an explicitly negative applicability answer. These are response-record requirements, not proof that a machine is safe. Every saved change appends an event in the same transaction as an optimistic revision claim. A conflicting update returns409 and does not append an event. Reopening clears `closedAt` while retaining events. Reads show the latest30 events; older events remain stored.

Evidence fields must contain references to the team’s approved evidence system, not secrets, raw logs, or personal data. The app never runs detection scripts, isolates hosts, revokes tokens, or rotates credentials. Current playbook versions live in source; keep stable question/task IDs or add a new template when changing the meaning of a condition. The record warns if the stored template version differs from current guidance.

## Verification and migration

The additive `20261105000000_security_baseline` migration adds project context, repository baseline state, `SecurityPlaybookResponse`, and `SecurityPlaybookEvent`. User/project deletion cascades private responses and events; no crypto data or existing routes are removed. Existing populated databases require the repository’s migration baseline/release process before production deployment.

`verify-response-playbooks.ts` restricts itself to an explicit loopback `wisesama_intel` database. It checks real PostgreSQL persistence, idempotent start, foreign-owner rejection, one winner for concurrent edits, closure gates, reopening, not-affected attestation, event history, and cascading cleanup. `preview-baseline-fixture.ts` creates an explicitly labelled synthetic UI fixture and supports `--cleanup`. Neither script performs real provider authorization or sends mail.

Repository baseline limits, version support, and research are in [BASELINE-CONTRACT.md](./BASELINE-CONTRACT.md). Dotsama separation is in [DOTSAMA.md](./DOTSAMA.md).
