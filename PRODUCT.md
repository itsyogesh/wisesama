# Wisesama

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Small software teams are the confirmed initial audience. They need to understand which new security advisories affect their software and how to respond.

## Product Purpose

Connect an exact software inventory to sourced vulnerability intelligence, explain the evidence and unknowns, notify the responsible user, and record remediation evidence.

## Operating Context

The first complete workflow is project creation, inventory import, vulnerability matching, notification, assessment, and remediation verification. The original crypto fraud detection product is preserved as Dotsama (working name) in `apps/dotsama-web`, `apps/dotsama-admin`, and `apps/api/src/dotsama`. Its API URLs and database records are retained; authentication and database infrastructure remain shared.

The launch workflow must include GitHub-backed onboarding and continuing repository inventory management. GitLab.com is also in the initial integration scope; self-managed GitLab is deferred. Manual upload remains a supported entry path. Repository access is a distinct connection from signing in to Wisesama.

Public discovery includes a free feed, RSS, practical guides, and agent/developer information. Public feed email subscriptions use a verified address without requiring an account, as confirmed by the user. These preferences remain separate from private account/project alerts.

Platform operators use a separate `/admin` experience for users, advisory curation, source controls, public subscriptions, failed work, and audit history. Live V2 administrator access is independent of Dotsama roles. Operator changes require a reason and current record revision; public mail controls stop delivery without granting consent. Upstream advisory facts remain distinct from Wisesama guidance.

## Capabilities and Constraints

Reuse the pnpm monorepo, Fastify API, PostgreSQL/Prisma foundation, Better Auth, QStash, and Resend integrations where appropriate. Preserve existing crypto data and routes. Never infer deployment exposure solely from a repository dependency match. Source lifecycle and customer response status are independent. Missing or failed upstream checks must remain visible. Breach monitoring, automated fixes, billing prices, and production domain cutover are not confirmed launch scope.

The local build implements manual inventory import, GitHub App and GitLab.com connection flows, immutable repository inventory and continuing management, a public site and feed, verified-email public subscriptions, daily digest processing, and a public read-only MCP endpoint. Provider registration, actual private-repository authorization, real email delivery, production scheduling and domain cutover still require deployment verification. Organizations, owner/admin/member roles and verified-email invitation links are implemented locally. Billing and private MCP scopes remain planned. Setup and exact boundaries are in `docs/REPOSITORY-SETUP.md`, `docs/PUBLIC-DELIVERY.md` and `docs/PUBLIC-SITE-PLAN.md`.

The current shared pnpm-lock parser can produce a repository-wide package inventory. A selected service directory alone does not prove a service-specific dependency set; implement importer-aware dependency closure or label the broader scope explicitly.

## Brand Commitments

Keep the Wisesama name and current dark pink/purple identity. The user also requested a light mode and image mockups before interface implementation.

## Evidence on Hand

The repository contains the existing web app, original logo assets, Satoshi and Clash Display font files, API accounts, email and notification code. Intelligence comes from official upstream sources; sample inventories and any illustrative dashboard counts must be labeled as demonstration data. There are no verified customers or performance claims to publish for the new product.

## Product Principles

- Explain every match with package, version, source, and collection time.
- Distinguish severity, observed exploitation, predicted exploitation, and customer exposure.
- Prioritize meaningful changes over repeated notifications.
- Show delivery failures and unknown assessment states honestly.
- Require evidence when closing a finding.
- Track repository synchronization separately from intelligence freshness and response completion.
- Show the assessed commit, inventory scope and last successful sync; retain that evidence through access loss.
- Keep public subscriptions and public agent intelligence independent from authorized private project access.

## Repository baseline and incident response

Repository projects now have four static configuration checks: exact package manager declaration, committed lockfile, candidate reproducible CI install, and version-compatible dependency cooldown. Checks bind to the imported commit and selected inventory roots. Source changes or failed checks preserve previous evidence and show it as stale. This workflow reads allowlisted configuration without running repository code, follows no external CI includes, and stores extracted facts rather than raw configuration. It establishes neither enforced CI policy nor deployed safety.

Project owners can record internet-facing status, sensitive-data handling, and hosting as explicitly self-reported context. These answers never automatically close or downgrade findings. Public incident-response playbooks can be read without an account; private project responses persist answers, task completion, evidence references, and change history. The first templates cover malicious dependencies and the October 2026 Cursor extension incident. Closure is a team attestation, requires evidence, and supports reopening. Automated developer-tool inventory, device inspection, credential rotation, MDM/EDR, and cloud log collection remain outside this release.


## Organizations and CI dependency review

Private work uses Organization → Project → inventory, findings, baseline and response records. Users may belong to multiple organizations as owner, admin or member. Existing projects migrate into separate personal organizations. Invitations are expiring manually shared links accepted by a verified matching email; no invitation email delivery is claimed. Provider connections remain personal. Live organization membership and original connector provenance govern repository access, and membership never grants platform operator privileges.

The repository baseline now includes bounded GitHub Actions and GitLab CI dependency reference evidence at an imported commit, with file/line, pinned/locked/mutable/local/unknown states, collection limits, source freshness and explicit rechecks. Configuration observations are separate from vulnerability matches, execution or deployment exposure. A free MIT-scoped standalone `wisesama-ci-audit` archive is served from `/skills` and runs offline without an account or project execution; external GitHub/npm publication is not implied.
