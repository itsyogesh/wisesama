# V2 admin verification — 5 November 2026

The dedicated admin, its protected APIs, and additive migration were verified locally against an isolated PostgreSQL database. This record describes the checks actually performed; production integration is separate.

## Automated and database evidence

- API TypeScript check passed. API release build and Intel Next.js release build passed.
- Full API coverage run: **251 tests in 27 suites passed**. Aggregate statement coverage was 74.19%, branch 67.31%, function 76.64%, and line 75.77%; this is whole-API coverage, not an admin-only score. An older Dotsama network-error test emits expected error output while passing.
- Scoped admin/API changes pass Biome. Intel's full lint command completes with 20 existing CSS specificity warnings. The full API lint command still reports 70 errors, 47 warnings and 26 infos across the broader source tree, including preserved Dotsama formatting/imports; it is not a clean repository-wide lint gate.
- The additive admin SQL migration applied transactionally to the disposable local database. No production migration or schema push was performed.
- `verify-admin-workflow.ts` passed with real Prisma transactions and synthetic providers/transport. It covered role isolation, self/administrator protections, suspend/restore, stale revisions, official-fact preservation, cross-alias public hiding, cached fallback, queued digest visibility, consent suppression, source revisions, queue deduplication, exclusive execution claims, retained attempts, revoked actors, and audit evidence. Exact fixture records were removed afterward.
- `preview-admin-fixture.ts` used real local account registration. A client-supplied `intelAdmin:true` did not grant access; only its clearly labelled synthetic operator received an explicit database grant.
- `verify-admin-http.ts` passed against actual Better Auth and Fastify routes. It checked unauthenticated and old-Dotsama-admin denial, Origin rejection, session-cookie suspension and revocation, stale changes, advisory guidance/private-note separation, hide/unhide, stop-only subscription controls, source pause/resume, and no-store responses. Its changes were restored before browser checks.

An independent backend reviewer found two issues during implementation: alias-equivalent advisories could bypass a hidden review, and numeric public-digest failure results could be recorded as a successful scheduler stage. Both were fixed. The reviewer independently reproduced the corrected behavior and reran 36 focused tests; both findings were marked resolved.

## Browser evidence

The production web build used the guarded local preview API with real auth and database storage. Temporary operator/customer records, advisories, subscribers, failures and receipts were explicitly synthetic. Email was disabled.

Actual browser actions covered:

1. Operator sign-in, customer access denial despite its Dotsama admin role, account switching and logout.
2. User and advisory lists, search, cursor pagination, retained filters and full record navigation.
3. User suspension and restoration with saved reasons and audit events.
4. Advisory guidance/internal note saved separately from upstream facts, and hidden publication state.
5. OSV collection pause and resume with revision-backed controls and audit history. A health job ran the fixed public Jinja2 documentation sample against OSV, succeeded, retained its attempt, and saved actual attempt/success timestamps. It sent no customer inventory. A later pause/resume retained that success time while resetting the current check state to unknown.
6. Public subscriber suppression, retained confirmation history, stopped queued digest, and removal of reactivation controls.
7. A targeted unmatched-feedback job queued, explicitly run, shown as failed with its real missing-receipt error, retried from mobile, and run again with both attempt records retained. This reconciliation only accessed the local database.
8. Operator audit navigation and record histories.

Captures under `.impeccable/review/admin` cover desktop 1280×720 and mobile 390×844, both themes, all five management families, audit and denied access. Mobile document width matched the viewport. After the independent review, narrow tables show labelled status, outcomes and timestamps within each identity row; wider overflowing tables retain independent horizontal regions and a visible scrolling/keyboard hint. Browser console inspection returned no errors or warnings. [Flow research](./ADMIN-DESIGN.md) records the separately inspected Mobbin references. [Finish review](./ADMIN-FINISH-REVIEW.md) records the independent visual review and corrections. Its final disposition is **ship** at the scored-fix scope: ADM-FIN01 and ADM-FIN02 were both resolved. The fresh general reviewer used the supplied Impeccable contract because this harness has no custom reviewer type selector; this was not a new whole-surface certification.

## Deployment checks still required

No real account was promoted, real email sent, production schedule enabled, or deployment published. The one live source probe used only its fixed public sample; other source health checks were not run. External provider recovery and real mail acceptance were not established by synthetic checks. Use the normal API entry point, reviewed database baseline, trusted origins, provider credentials and signed job schedule for deployment. Follow [operator setup](./ADMIN-SETUP.md) before enabling real access.

The admin provides scoped single-record controls, a recent failed-work index, paginated run/audit history, and exact-target recovery. Bulk operations, custom source ingestion, arbitrary log access, impersonation, privilege grants, and external immutable audit export are outside this release.

The local admin preview is left signed in to its labelled synthetic operator so the user can inspect the built flows. Its fixture manifest remains mode 0600 under `/private/tmp` for exact cleanup with `preview-admin-fixture.ts --cleanup`. This is an isolated local database; production operator setup is unchanged.
