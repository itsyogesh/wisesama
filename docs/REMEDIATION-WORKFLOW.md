# Finding remediation workflow

A workspace finding can now produce an agent handoff and retain a structured fix record. Repository integrations keep their current read permissions. The user's coding agent performs changes and tests in their own development environment; Wisesama does not execute repository code or publish a PR.

## User flow

1. Open a finding and choose **Prepare agent handoff**. Copy or download the instructions for the coding agent in the authorized repository.
2. Review the proposed upgrade and tests. Record the repository PR/MR URL, full fix commit, test result and evidence.
3. Save, then **Recheck inventory**. A connected project refreshes its existing tracked branch and inventory selection before the check. A PR branch is not assessed until its change is on that tracked branch.
4. After shipping, record the deployed commit, deployment reference and evidence. Export the saved finding, references, recheck and activity as JSON.
5. Record the response using the existing finding status controls. A successful recheck never closes a finding automatically.

The evidence editor is collapsed until needed so the finding's response, next action and inventory signal remain easy to scan. The existing dark/light palette and Base UI form controls apply.

## Evidence and freshness

PR references are team supplied and, for connected projects, restricted to PR/MR URLs in that repository. Tests and deployments are explicitly `team_reported`. Their links are not fetched by this feature. No automatic PR, CI or deployment attestation is claimed.

A recheck searches the current inventory for the finding's package/ecosystem and advisory aliases, including affected matches at a different installed version. `clear` requires nonempty inventory, healthy source collection including OSV, and no inventory or scan warnings. Failed source requests yield `incomplete`, replacing any earlier result. The recheck stores the inventory revision, repository commit, advisory modification date, source status and timestamp.

A result becomes stale after 24 hours or when inventory, advisory or repository state changes. Repository errors, pauses and in-progress imports invalidate freshness. Concurrent evidence updates and inventories changed during a check return 409. Uploaded inventories can be rechecked without a repository; they cannot establish an assessed repository commit or deployment identity.

`matchesAssessedFix` only compares the team's supplied deployed SHA with a fresh clear inventory recheck of its supplied fix SHA. It remains team reported, not independent deployment verification. Closure continues to require the existing written attestation.

## API and storage

All endpoints require a live unsuspended Wisesama session and current organization membership. Mutations use the existing origin/content-type checks. Repository refresh follows existing owner/admin permissions. Responses are private/no-store.

- `GET /api/v1/intel/findings/:id/remediation`
- `PATCH /api/v1/intel/findings/:id/remediation` with `{revision,fields}`
- `POST .../handoff` with `{}`
- `POST .../recheck` with `{revision}`
- `GET .../evidence` as a JSON attachment

Migration `20261124000000_remediation_evidence` adds `SecurityFinding.remediation`, `remediationRevision`, and optional immutable event snapshots. Apply it before deploying the API. Existing findings default to an empty record. Never change previously applied migrations.

Exports include the saved response, private project references, provenance and change history. Agent context includes only selected finding, repository and advisory fields; connector credentials and unrelated inventory are excluded. Upstream text is explicitly untrusted data. Public MCP remains public-advisory-only.

## Verification

Service and route regression tests cover membership, suspension, cross-repository links, URL/commit validation, credential exclusion, concurrent edits, advisory aliases, source failures and freshness.

`apps/api/scripts/verify-remediation-http.ts` exercises real issued sessions and database records against the existing isolated preview. It accepts only `postgresql://wisesama_test@127.0.0.1:55439/wisesama_intel`, requires the synthetic CI preview header, and never uses production credentials. Start `preview-intel.ts` with `INTEL_CI_PREVIEW=1`, create `preview-ci-fixture.ts`, then run it with the same `INTEL_TEST_DATABASE_URL`. The CI fixture cleanup removes its exact accounts and cascaded records.

## Launch hygiene

Retired crypto discovery/report routes return 410, while legacy policy and authentication aliases redirect to current equivalents. Public routes have indexable metadata and a sitemap; private/auth/subscription screens are noindex. Unknown top-level pages return a real 404. Search engines need to recrawl for old search results to disappear.

Droidsize's published company, contact, privacy and support pages were checked on 24 November 2026 to replace operator placeholders. Wisesama's product-specific notice describes its actual data, cookie, repository, intelligence and evidence handling. Fixed deletion SLAs, certifications, paid plans and compliance guarantees are not promised.
