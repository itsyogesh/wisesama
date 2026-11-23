# Wisesama v2 admin setup

The V2 admin is served by `apps/intel` at `/admin`; it uses the shared Fastify host at `/api/v1/intel/admin`. Dotsama's console and crypto routes remain separate. No new frontend deployment is required.

## Database and application configuration

Generate the Prisma client and apply the additive `20261105010000_intel_admin` migration after the earlier Wisesama migrations. Use the installation's existing migration baseline. A populated database without Prisma migration history needs an explicit baseline before `migrate deploy`; do not substitute production `db:push`.

The migration adds a distinct V2 operator flag, V2 suspension state, record revisions, advisory reviews, fixed source controls, append-only application audit events, and durable job/attempt records. Ordinary accounts default to no V2 operator access. Existing crypto roles are retained.

Use the normal API entry point with its database, Better Auth, Redis and trusted `INTEL_APP_URL`. Build `apps/intel` with `NEXT_PUBLIC_API_URL` set to that API origin. Admin writes require an approved Origin and JSON. Session existence, expiry, operator privilege and suspension are checked against current database state; an old role or client-supplied profile field grants no access. Admin responses use private no-store caching and pages disable search indexing.

## First operator

Create the intended account through normal account registration. An authorized database operator can then use the explicit CLI from the API directory. The CLI previews an existing account; it never creates one or changes its Dotsama role.

```sh
pnpm --filter @wisesama/api exec tsx scripts/manage-intel-admin.ts \
  --email operator@example.com --grant --reason 'Authorize the designated Wisesama operator'
```

Review the returned account ID and email. Apply that exact change by adding `--apply --confirm-user-id ID` to the same invocation. `--revoke` follows the same preview/apply process and protects the final active operator. Run with the intended environment loaded; this command does not select a deployment for you. The applied change writes an audit event. No real operator has been granted access as part of the local verification.

## Management boundaries

- Users: search, inspect project/delivery health, suspend or restore V2 workspace access. Operator targets and self-suspension are protected. No deletion, impersonation or UI privilege grants.
- Advisories: inspect upstream evidence, add separately labelled Wisesama guidance and internal notes, or hide public publication. Equivalent aliases and queued public editions respect hiding. Private findings and source facts remain intact. Already delivered messages cannot be recalled.
- Sources: inspect and pause/resume OSV, GitHub advisory feeds, CISA KEV and EPSS. An explicit health job tests a fixed public sample. There is no custom URL or credential editor.
- Subscriptions: inspect confirmation, topics, delivery and verified feedback; unsubscribe or suppress public mail. Operators cannot confirm, reactivate or bypass consent. Private project alerts remain separate.
- Failed jobs: inspect bounded existing failures, queue exact work, explicitly run it, or retry an eligible failure. Current consent, owner access, idempotency and target state are checked again before execution. Queueing is distinct from completion.

Each change requires a reason; editable records use revision checks. Audit views show actor, target, time and safe change metadata. Application audit records are not an external immutable archive.

## Workers and mail

The signed `/jobs/security-response` schedule processes a bounded batch of operator jobs and records recurring-stage results. Configure and verify the production scheduler separately. Explicit Run works without a scheduler, subject to current permissions and target checks. Expired leases become reviewable failures and are not replayed automatically. See [operations contract](./ADMIN-OPS.md) for attempt limits and mail recovery windows.

Configure and verify Resend and signed feedback on the normal API before enabling real mail. Admin retry cannot override recipients, message bodies, acceptance receipts, consent or idempotency keys. The local verification server disables mail.

## Isolated local verification

`scripts/preview-intel.ts` accepts only a loopback PostgreSQL database named `wisesama_intel` via `INTEL_TEST_DATABASE_URL`, creates an ephemeral auth secret, and disables email. Its disposable-preview response header lets fixture scripts reject a normal API before creating test accounts. It does not apply migrations or run the normal Redis rate limiter.

`verify-admin-workflow.ts` exercises real database transactions with synthetic providers and transport. `preview-admin-fixture.ts` creates clearly labelled temporary accounts and records; credentials stay in a mode-0600 file under `/private/tmp`. `verify-admin-http.ts` exercises the real local auth/routes and database. Fixture cleanup removes only the recorded synthetic IDs and restores controls touched by verification. None of these scripts is a production seed or deployment entry point.

Flow references: [Mobbin research](./ADMIN-DESIGN.md). Access and data shapes: [API contract](./ADMIN-API-CONTRACT.md). Completed evidence and remaining deployment checks: [verification](./ADMIN-VERIFICATION.md).
