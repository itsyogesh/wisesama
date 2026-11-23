# Baseline and incident response verification

Verified November 5, 2026. This records local build evidence, not a production authorization or security certification.

## Story and boundaries

Owner opens project security → authenticated API reads project and repository configuration evidence → owner saves self-reported context → public guidance hands off to a chosen private project → owner starts/saves a response → PostgreSQL retains answers, tasks, evidence, and history → reload restores the saved record. Existing Dotsama source remains available under renamed product directories with the same crypto API URLs.

| Boundary | Evidence |
| --- | --- |
| API validation and behavior | 188 tests across19 files pass with coverage collection. Whole API75.63% line coverage; static baseline analyzer98.41%. API type-check and production build pass. |
| New UI | Intel production build/type-check pass. Biome passes with20 pre-existing nonblocking CSS/reduced-motion warnings. New response/playbook scoped checks pass. |
| Static repository reads | Synthetic provider and real PostgreSQL verification checks immutable SHA, extracted configuration facts, self-reported context, sync, access loss, and retained stale baseline. Source changes within the same SHA are covered by a selected-path regression. |
| Response persistence | Real PostgreSQL verification checks GET without mutation, idempotent start, ownership rejection, one winner for concurrent revisions, evidence/task closure gates, reopening, attested not-affected, history, and cascade cleanup. |
| Actual HTTP | Public guidance returns two templates; public pages return200. Unauthenticated baseline and private response endpoints return401. |
| Browser | Actual local sign-in; context saved; incident started; one task and partial applicability saved; progress survives reload and API preview restart. Public playbook CTA retains the selected incident at project choice. No browser console errors in the response view. |
| Responsive rendering | Default1280×720 desktop and390×844 mobile; dark and light captures. Corrected inherited flex layout on paragraph notices, back-arrow direction, and accidental extra index padding. Final captures are in `.impeccable/review/baseline/`. |
| Dotsama preservation | All203 originally tracked public/admin source and asset files have moved counterparts. API/web/admin type-checks, crypto route registrar smoke check, and both moved app builds pass. Dotsama builds used webpack after the local Turbopack port-permission restriction. |

## Independent review

The integration reviewer found two material baseline issues: a same-commit selected-path change could make older evidence appear current, and permissive TOML extraction could miss malformed documents or table-form uv exceptions. Both were corrected. The reviewer independently reran exact reproduction cases and58 focused tests and scored both findings resolved. That verdict covers those findings, not a general security certification.

The independent finish reviewer opened14 final baseline/context, response/chooser, and public playbook captures. The rendered layouts met the established direction; the reviewer identified two private-record gaps: exact guidance version and history inspection for saves without evidence text. Both were fixed. The replacement five response captures show the exact version and an expanded empty-evidence event with identifiable completed/incomplete tasks. The reviewer scored FIN01/FIN02 resolved and gave a ship verdict at that fix-list scope; its prior layout assessment remains applicable to unchanged surfaces. That review does not certify keyboard access, calculated contrast, browser compatibility, or production operation.

## Local database and fixtures

Only the explicit disposable loopback database `wisesama_intel` was changed. Its previous migrations were applied as SQL without Prisma migration history, so `prisma migrate deploy` correctly refused the populated unbaselined schema. The new additive migration was then applied directly as one SQL transaction to that local database. Production requires the documented migration-baseline/release process; no production schema push or data migration was performed.

The preview account/project and repository source are labelled synthetic. The baseline failure is intentional fixture data; no real provider authorization, endpoint inspection, credential revocation, or email delivery is claimed. The fixture account/project is removed after capture, and the temporary synthetic credential file is deleted. Preserved Dotsama business data is untouched.

## Deployment work still required

Register/configure GitHub and GitLab.com applications and verify live authorization, configure real email and signed recurring jobs, finalize operator/legal publication details, and verify production origins/migration baseline before domain cutover. Dotsama deployments need their root directories updated to the relocated apps. Domain bindings and production deployments were not changed. Billing, shared account memberships, private MCP access, automated editor/plugin inventory, MDM/EDR, and broad cloud monitoring remain outside this release.
