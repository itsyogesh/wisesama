# Local organization verification

The verification harness exercises browser-session authentication, actual HTTP routes and real PostgreSQL transactions against the disposable database only. Repository content comes from the opt-in immutable synthetic CI transport. It sends no invitation email, provider requests or advisory scans, and grants no operator privileges.

## Reproduce

Apply the additive organization migration and generate the Prisma client before starting `apps/api/scripts/preview-intel.ts` with `INTEL_CI_PREVIEW=1`. The synthetic CI fixture and immutable A/B control must already exist. Every organization/CI fixture and verifier rejects a database URL other than exactly:

```text
postgresql://wisesama_test@127.0.0.1:55439/wisesama_intel
```

From `apps/api`, run these commands with `INTEL_TEST_DATABASE_URL` set to that exact URL:

```sh
pnpm exec tsx scripts/preview-org-fixture.ts
pnpm exec tsx scripts/verify-org-http.ts
pnpm exec tsx scripts/verify-ci-http.ts
```

Each HTTP helper requires the local-preview and synthetic-CI response markers before private writes. The fixture creates four `example.invalid` accounts through the real sign-up route and creates its organization, manual project and repository project through authenticated HTTP. Only those exact synthetic invitees are marked verified directly in the disposable database. The member starts unverified so the verifier can prove that acceptance fails before this fixture-only change.

The credential manifest `/private/tmp/wisesama-org-preview.json` is a private `0600` file. It reuses the existing CI owner/outsider, records the exact new account/project/source IDs, and retains a fresh pending invitation for browser verification. Never print its passwords, session cookies or invitation URL in logs. The machine-readable result is `/private/tmp/wisesama-org-http-result.json`; the CI result is `/private/tmp/wisesama-ci-http-result.json`.

The organization verifier expects a fresh fixture and performs its lifecycle once. The fixture is then intentionally retained for browser review. After that review, `pnpm exec tsx scripts/preview-org-fixture.ts --cleanup` removes only its exact synthetic organization, projects and four new accounts, including partial fixture setup. It preserves the existing CI accounts, connection, immutable transport control and projects. Clean up and recreate the organization fixture before another full organization run. The harness does not reset unrelated local records.

## Workflow coverage

- Approved-origin JSON writes, strict unknown-property rejection, session-only membership administration and cross-organization project/source denial.
- Concurrent first visits converge on one personal organization and owner. Existing CI projects retain the personal organization assigned by migration.
- Public invitation GET leaves membership, status and revision unchanged; its response omits invitee email and organization ID, disables caching and uses `no-referrer`.
- Only the SHA-256 token digest is stored. Acceptance requires a matching verified account; replay and concurrent double acceptance have one successful membership.
- Members read shared inventories and the member directory, contribute context and attributed response progress, and run bounded saved-resource baseline checks. Project creation, inventory replacement/sync, source configuration and membership management are denied.
- Live role changes enforce target revisions; stale member/rename writes conflict. Admins cannot grant ownership, change another owner or rename the organization. Self-demotion/removal cannot remove the sole active owner.
- A demoted inviter loses invitation authority, old rotated links fail, expired links fail and stale revocation conflicts.
- Member removal blocks the next request, pauses only that connector's saved sources in the selected organization and clears sync/baseline leases in the membership transaction. Inventory/baseline evidence, other-organization sources and the personal encrypted connection remain intact.
- Organization actions persist in their dedicated audit table without bearer tokens. Organization roles do not grant operator-console access.
- Adapted CI HTTP verification checks personal organization scoping and reruns persistence, failure retention, immutable A→B evidence changes and legacy snapshot recheck behavior.

`apps/api/src/lib/__tests__/request-log.test.ts` covers query stripping and preview/acceptance path-token masking. These tests do not make production logging, provider setup, email delivery or deployment claims.

## Local evidence

Verified November 5, 2026 against the exact disposable database above:

| Check | Result |
| --- | --- |
| Organization HTTP/PostgreSQL workflow | Passed all 8 workflow groups, including real serializable acceptance, stale revision conflicts and transactional source removal effects. |
| Adapted CI HTTP/PostgreSQL workflow | Passed all 7 workflow groups, including migrated personal-organization scope, persisted evidence, retained failure evidence, immutable A→B changes and legacy recheck. The original CI fixture was restored to commit A afterward. |
| Request logging security regressions | All 3 focused tests passed: query bearer stripping, invitation preview/acceptance path masking and safe-path retention. |
| Verification scripts | Standalone strict TypeScript check passed; scoped Biome check passed. |

The retained credential manifest is `0600` and the result file contains check descriptions only. Production migration, provider authorization and email delivery remain separate launch work.
