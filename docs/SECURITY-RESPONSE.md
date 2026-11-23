# Wisesama security response

The security-response backend is additive. The original crypto product and its data remain in place. The user selected A — Response desk as the functional foundation; the later Mobbin workflow corrections are implemented in `apps/intel`, with dark and light themes.

## First workflow

1. Sign in with the existing Better Auth account system.
2. Create a private project and import a pinned inventory, npm package-lock v2/v3, pnpm lockfile, or exact package.json versions.
3. Explicitly scan the saved project. OSV checks exact npm/PyPI package versions; CISA KEV and FIRST EPSS enrich matching records.
4. Review the package, installed version, affected advisory, source health, and available fixed version.
5. Verify the account email and opt into email notifications. The app records provider acceptance, failure, and missing configuration. Use **Send test email** under notification settings to exercise the same delivery path as a project alert.
6. Record an investigation or mitigation. Closing a finding requires evidence; this is a user attestation, not independent proof of a deployed fix.

## API

Routes are below `/api/v1`. Existing successful JSON responses use the API's `{ data, meta }` wrapper.

| Route | Access | Purpose |
| --- | --- | --- |
| `GET /intel/briefings` | Public | Recent GitHub advisories with source health and optional filters |
| `GET /intel/briefings/:id` | Public | Read collected public advisory data |
| `GET /intel/feed.xml` | Public | RSS of public advisories; no private inventory or matches |
| `GET /intel/workspace` | Session | Private projects, findings, settings, delivery history |
| `POST /intel/projects` | Session or API key | Create a project and save parsed inventory |
| `POST /intel/projects/:id/inventory` | Session or API key | Replace inventory and increment its revision |
| `POST /intel/projects/:id/scan` | Session or API key | Assess saved package versions |
| `PATCH /intel/findings/:id` | Session | Update response with notes and evidence |
| `GET/PATCH /intel/notifications` | Session | Inspect or change email opt-in |
| `POST /intel/notifications/test` | Session | Test delivery to the verified account address |
| `GET /intel/deliveries` | Session | Inspect delivery results |
| `POST /jobs/security-response` | QStash signature | Bounded refresh batch and due delivery retries |
| `/intel/admin/*` | Live V2 operator session | Users, advisory reviews, sources, subscriptions, failed work and audit history |

Mutations require JSON. Ownership is checked before private reads, writes, or outbound matching. Upload limits are 2 MB and 2,000 distinct package versions. Package ranges are not treated as installed versions. Imports are metadata only; no source code is executed. Matching sends package names and versions to OSV, which must be disclosed in the eventual import interface.

The V2 admin lives at `/admin` in the Intel app and uses a separate `intelAdmin` privilege. V2 suspension also blocks the user's private workspace and future background activity without changing the shared crypto role. The additive `20261105010000_intel_admin` migration, explicit operator bootstrap, curation boundaries and recovery controls are documented in [admin setup](./ADMIN-SETUP.md), [API contract](./ADMIN-API-CONTRACT.md) and [operations](./ADMIN-OPS.md). Local verification is recorded in [admin verification](./ADMIN-VERIFICATION.md).

Project creation body:

```json
{
  "name": "example-api",
  "environment": "production",
  "inventory": {
    "format": "inventory",
    "content": "[{\"ecosystem\":\"npm\",\"name\":\"next\",\"version\":\"15.2.2\"}]"
  },
  "runtime": { "name": "Node.js", "version": "22.23.4" }
}
```

This example is a test input, not a claim about any deployed project.

## Environment and rollout

- Reuse `DATABASE_URL`, Better Auth configuration, and existing Redis configuration.
- `INTEL_APP_URL` sets the new application's trusted origin and RSS links. Local port 3003 is trusted alongside the existing apps.
- `BREVO_API_KEY` and `BREVO_SENDER_EMAIL` enable Brevo for account verification and private project alerts. Use a sender verified in the same Brevo account and store the API key as a server-only secret. With neither Brevo setting present, these flows use the existing Resend configuration. Public digest delivery has its own [configuration](./PUBLIC-DELIVERY.md).
- A Brevo send receipt confirms acceptance. Check Brevo’s transactional logs for delivery to the recipient’s mail server. Reconcile ambiguous sends in those logs before retrying after the provider's idempotency window.
- Sign-in methods must be linked explicitly from an authenticated account (`account.accountLinking.disableImplicitLinking: true`), avoiding implicit email-based account linking. This is the maintainer-supported mitigation for [GHSA-g38m-r43w-p2q7](https://github.com/better-auth/better-auth/security/advisories/GHSA-g38m-r43w-p2q7) while retaining the installed Better Auth version.
- `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY` validate the scheduler endpoint. A production schedule has not been created.
- Before deploying code, apply `packages/database/prisma/migrations/20261104000000_security_response/migration.sql` to the intended PostgreSQL database through the normal reviewed migration process. It adds new tables and preserves existing ones. Do not use production `db:push` as a substitute.
- The repository previously had no migration baseline. Baseline an existing database appropriately before using a fresh Prisma migration history; do not run the new migration against an empty database without the original schema.

## Truth boundaries

- Live matching currently covers npm/PyPI package metadata. Runtime metadata is context only; runtime, container, operating-system, and deployed-code reachability are not yet assessed.
- The original mockups contain illustrative runtime findings. The actual interface uses supported API data and does not ship those fixtures as coverage.
- `known_exploited` means supported CISA KEV membership. `not_in_kev` does not prove absence of exploitation; unavailable checks remain unknown. Previously collected exploitation evidence is retained through source outages.
- Failed or partial matching does not clear prior findings. Removing a package from an imported file does not independently verify remediation.
- Email delivery status means provider acceptance, not proof the recipient read the message. Outbox retries are bounded, opted in, and idempotent.
- Before launch, verify real account sign-in and verification, a real provider-backed scan, email delivery, responsive UI, and production scan duration. Large inventories require measured execution-budget checks and may need further job partitioning.

## Validation

```sh
pnpm --filter @wisesama/api type-check
pnpm --filter @wisesama/api test:coverage
pnpm --filter @wisesama/intel type-check
pnpm --filter @wisesama/intel lint
pnpm --filter @wisesama/intel build
```

The additive migration has also been applied to a disposable local PostgreSQL database after recreating the original schema. The explicitly opted-in `apps/api/scripts/verify-intel-workflow.ts` check passed against that database with deterministic intelligence and email fixtures: inventory persistence, separate versioned findings, tenant isolation, delivery deduplication, evidence-required closure, and response history. A separate live provider check returned real OSV findings for lodash 4.17.20 with CISA and FIRST enrichment available. No production database was changed and no real email was sent during these checks.

The frontend was also checked in the browser against real auth/routes and the disposable database: sign-in, file import and preview, project persistence, live OSV/CISA/FIRST assessment, evidence-required closure, persistence after refresh, reopening, and visible unavailable email delivery. An intentionally outdated two-package test inventory returned 41 real provider matches. The local preview's account and inventory are synthetic; those are not claims about Wisesama's deployed software. Invalid, empty and oversized preview requests were rejected. Both themes and a 390px mobile viewport were visually checked; the independent reviewer scored the two listed mobile fixes resolved. This review does not certify untested production configuration.

The new app uses Next.js 16.4.5, which supersedes the vulnerable inherited 16.0.7 baseline. Other existing apps' framework versions were not changed by this interface build. Production rollout still needs the intended migration, configured verification/alert delivery, and the signed refresh schedule; the local verification entry point is not the production API.

## Public and repository expansion (2026-11-04)

The public site now lives at `/`; private response routes live under `/app`. Old public `/briefings*` and private project/finding/notification paths redirect. The `/feed.xml` convenience route proxies the API's XML with q/severity/exploited/ecosystem filters. Public and private account data remain separate.

Repository connections add dedicated GitHub App and GitLab.com PKCE authorization, access-checked immutable snapshot imports, expected-commit creation, durable signed webhook deduplication, scheduled reconciliation and persistent source management. Source records cannot silently survive manual inventory replacement as current repository evidence. Owner/project/provider foreign keys cascade on deletion. Setup: REPOSITORY-SETUP.md; exact routes: repository-api-contract.md.

Verified-email public subscriptions and read-only public MCP are implemented separately from private notification settings. The signed job processes repository synchronization, existing assessments, due digests and pending mail-feedback reconciliation. Provider credentials and private project evidence are never MCP output. Unconfigured providers and email are unavailable rather than successful placeholders. See PUBLIC-DELIVERY.md for request shapes, current protocol support, daily cadence and recovery of unmatched feedback.

All new migrations are additive. Baseline the existing schema before applying them to an established production database; the isolated local verification database has them applied. No production database, provider installation, email send, schedule or domain cutover was performed by this expansion.

Expansion validation: 145 API tests across 15 files pass with coverage collection; API type-check/build and the intelligence app production build pass. Web lint passes with non-blocking CSS/reduced-motion warnings. The repository and public-delivery scripts exercised the isolated PostgreSQL workflow with synthetic provider/mail transports and exact cleanup. Live public MCP list/search, filtered RSS and unauthenticated private-endpoint rejection were checked over HTTP. Desktop/mobile captures cover the main page families in both themes. Independent review scored the listed source-provenance correction resolved; these checks do not certify real provider authorization, email delivery or production operation.
# November 5 extension

Repository security baseline, explicitly self-reported project context, and persisted incident-response playbooks now extend the workflow. New public guidance lives at `/playbooks`; private baseline and response records live under `/app/projects/:id`. The original crypto source is preserved as Dotsama. Exact boundaries, source research, additive migration, and the final188-test/local-database/browser evidence are in [baseline contract](./BASELINE-CONTRACT.md), [playbooks](./RESPONSE-PLAYBOOKS.md), [verification](./BASELINE-VERIFICATION.md), and [Dotsama](./DOTSAMA.md). Earlier verification counts below describe the preceding implementation stage.

