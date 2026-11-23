# Wisesama security response

The selected Response desk direction, with the Mobbin workflow corrections, is implemented here. The existing crypto UI remains in `apps/dotsama-web`.

## Run

Set `NEXT_PUBLIC_API_URL` to the API origin before building. The default is `http://localhost:3001`. The API must allow this app's origin through `INTEL_APP_URL` and have the additive security-response, repository, public-delivery, feedback and ownership migrations applied to its intended database.

```sh
pnpm --filter @wisesama/intel dev
pnpm --filter @wisesama/intel type-check
pnpm --filter @wisesama/intel lint
pnpm --filter @wisesama/intel build
pnpm --filter @wisesama/intel start
```

Open **http://localhost:3003** for the public site and **http://localhost:3003/app/inbox** for the workspace, matching the API's trusted local origin. Use the existing Wisesama account system, or create an account. Inventory review uses the same pure parser as the API; it does not execute source code or contact intelligence providers. An assessment saves the inventory and calls the actual authenticated scan endpoint.

## Implemented workflow

Account access → project details → inventory preview → live assessment → response inbox → finding investigation → evidence-required resolution → retained history and reopening. Supporting views cover project reassessment, public briefings and RSS entry pages, verified-account email opt-in, tests and delivery history. Dark and light themes share the same hierarchy; mobile retains project identity and places assessment signals before the suggested response and activity.

The public homepage labels its synthetic product example explicitly. Private findings and delivery states use the real API; no successful connection or delivery is simulated. A scan covers exact npm/PyPI metadata, not deployment or code reachability. Closing a finding records a user attestation, not an independently verified fix. The inbox currently loads at most 1,000 recent findings and labels that limit. Email-provider acceptance is distinguished from delivery or reading.

## Public site and repository workflow

Public pages cover product, GitHub/GitLab.com integration details, a filtered feed and matching RSS, seven task guides, API/RSS/MCP reference, early-access pricing and data-handling information. Private routes live under `/app`; previous `/projects`, `/findings/*`, `/notifications` and `/briefings*` links redirect to their equivalents.

Repository onboarding is account → provider authorization → accessible repository → branch and inventory paths → exact-version preview → assessment. Project creation rejects a changed preview commit. Ongoing connection settings cover branch/path changes, sync, pause/resume, access failures, detach and disconnect. Stored provider credentials are encrypted; project inventory/history are retained after disconnect. Repository scope does not establish deployment or service-specific dependency closure.

Public email subscriptions require no account. Explicit confirmation, separate preferences and unsubscribe flows use protected links. GET requests never activate or unsubscribe. Daily digest processing is 09:00 UTC when matching updates exist, conditional on the signed production job being scheduled. Bounce/complaint feedback is verified and durably reconciled. Local email is disabled and shown as unavailable.

`POST /api/v1/mcp` exposes only `search_advisories` and `get_advisory`. Public data requires no account; private projects and provider tokens are outside this endpoint. Current and legacy supported protocol shapes are in `/docs/mcp` and `docs/PUBLIC-DELIVERY.md`; named-client compatibility remains a deployment check.

## Local verification server

`apps/api/scripts/preview-intel.ts` is a separate, loopback-only verification entry point. It requires `INTEL_TEST_DATABASE_URL` to select a disposable local database named `wisesama_intel`, serves the real auth and intelligence routes, generates an ephemeral signing secret, and disables email. It does not apply migrations, connect to the production database, or run the normal API's Redis rate limiter. It is not a deployment entry point.

## V2 administration

`/admin` has independent navigation and a live operator-access check. It manages V2 users, advisory visibility and guidance, fixed intelligence sources, public email subscriptions, and failed jobs. Detail pages retain state, consequences, reasons, and audit history. Dark/light modes and responsive tables follow the existing Response desk system.

Apply the additive `20261105010000_intel_admin` migration through the existing database baseline. An existing account needs the separate `intelAdmin` privilege; the Dotsama admin role does not grant it. No public UI grants operator access. Follow [admin setup](../../docs/ADMIN-SETUP.md), [API contract](../../docs/ADMIN-API-CONTRACT.md), and [source/job operations](../../docs/ADMIN-OPS.md). Local verification does not enable production grants, mail, schedules, or deployment.

## Deployment configuration

Use the normal API entry point and its configured database, Redis, trusted origin, email provider and signed background job. Set the frontend API origin at build time. Apply the reviewed additive migration using the repository's existing database baseline; do not use production `db:push`. Configure and verify the background refresh schedule, real verification email, and alert acceptance before launch. Search indexing remains disabled until the launch configuration is reviewed.

See `docs/SECURITY-RESPONSE.md` for the API and rollout details.

## Project baseline and incident responses

`/app/projects/:id/security` adds four static repository checks, with the checked commit, selected inventory paths, collection time, and stale/error state. Package-manager and CI configuration are read at the imported revision; these observations do not verify CI enforcement or deployment safety. The same page saves explicitly self-reported internet-facing, sensitive-data, and hosting context. Manual inventory projects can save context but require a repository for configuration evidence.

`/playbooks` and `/playbooks/:id` publish the response guidance. A signed-in owner can choose a project via `/app/responses/new?playbook=:id`, then save a response at `/app/projects/:id/responses/:playbookId`. Applicability, task completion, evidence, optimistic save conflicts, closure, reopening, and event history use actual authenticated storage. Closure remains a team attestation. The first playbooks cover malicious dependencies and the October Cursor extension incident. There is no automated endpoint or editor-extension inventory.

Apply the additive `20261105000000_security_baseline` migration after the earlier migrations using the existing database baseline. See [baseline contract](../../docs/BASELINE-CONTRACT.md) and [response playbooks](../../docs/RESPONSE-PLAYBOOKS.md) for source research and exact verification boundaries. The original crypto source now lives under [Dotsama](../../docs/DOTSAMA.md).

Provider registration and secret configuration: [repository setup](../../docs/REPOSITORY-SETUP.md). Subscription, digest, feedback and MCP setup: [public delivery](../../docs/PUBLIC-DELIVERY.md). Current page map and production release gates: [public site](../../docs/PUBLIC-SITE-PLAN.md). Paid billing, shared memberships and private agent tools are not offered as working features.
