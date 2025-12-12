# Production Readiness Plan
Live checklist to reach “production works” for Wisesama. Update status/owners as items progress.

## Status Legend
- [ ] TODO 
- [~] In Progress 
- [x] Done

## Environments (fill with real hosts)
- Dev: `localhost` (web :3000, admin :3002, api :3001)
- Staging: ___ (API base `https://api-stg.wisesama.com`, NEXT_PUBLIC_API_URL set?)
- Prod: ___ (API base `https://api.wisesama.com`, web `https://wisesama.com`, admin `https://admin.wisesama.com`)

## Checklist by Area
**Environments & Secrets**
- [ ] Move all secrets to a manager (Vercel/Neon/Upstash). Populate values from `.env.example` plus `NEXT_PUBLIC_API_URL`, `APP_URL`, `CORS_ORIGIN` per environment.
- [ ] Rotate `JWT_SECRET`, Upstash tokens, QStash signing keys before launch; document rotation steps.
- [x] Lock CORS to real origins (update `apps/api/src/index.ts`).

**Database & Data**
- [ ] Add Prisma migrations and use `prisma migrate deploy` in CI/CD; stop using `db:push` for prod.
- [ ] Create backup/restore runbook for Neon/Postgres; test a restore.
- [ ] Seed strategy: disable `db:seed` in prod; keep staging seed script documented.

**API (Fastify @ apps/api)**
- [ ] Add auth/permission tests for admin + API key flows (Vitest) beyond current single test.
- [x] Add rate-limit headers & trusted proxy handling for real IPs; tune 100 req/min limit.
- [x] Enable HSTS/secure headers in helmet for prod.
- [ ] Add 5xx alerting and slow-request logging; wire to log sink (e.g., Vercel/Logtail).

**Web & Admin (Next.js)**
- [ ] Configure environment-specific `NEXT_PUBLIC_API_URL` in `apps/web` and `apps/admin` builds.
- [x] Restrict Next image remote hosts instead of `**` wildcard.
- [ ] Add smoke/E2E path: landing page render, search flow, admin login/whitelist flow.

**Observability & Ops**
- [ ] Add uptime checks hitting `/api/v1/health` and homepage.
- [ ] Integrate error reporting (Sentry or similar) for API + Next apps.
- [ ] Define on-call/rotation and escalation; add dashboards for DB/Redis/QStash usage.

**Security**
- [ ] Secrets scanning in CI (e.g., gitleaks) and dependency audit (`pnpm audit --prod`).
- [ ] Validate incoming payload signatures for QStash jobs; log failures.
- [ ] Review admin routes for role enforcement and disable Swagger auth bypass in prod.

**Testing & Quality Gates**
- [ ] CI: run `pnpm lint`, `pnpm type-check`, `pnpm --filter @wisesama/api test`, `pnpm build`.
- [ ] Coverage target for API services; fail CI < threshold (e.g., 70%).
- [ ] Add contract tests around critical endpoints: `/api/v1/check`, `/api/v1/report`, `/api/v1/identity/*`.

**Deployment Pipeline**
- [ ] Set up GitHub Actions (or Vercel/Neon pipelines) with caches for pnpm/turbo.
- [ ] Add CD steps: build, run migrations, deploy API, then web/admin.
- [ ] Post-deploy smoke test job to hit API + web.

**Runbooks & Docs**
- [ ] Create incident/rollback runbook (restart API, clear Redis keys, rotate keys).
- [ ] Document schema change process and data migration approvals.
- [ ] Keep Swagger prod URL updated and protected if necessary.

## Open Issues / Tickets
- #8 feat: Exchange address identification — candidate for checklist items under API + data scope. citeturn1view0
- #7 feat: Webhook notifications for watched addresses — ties to Observability/Ops; ensure auth/rate-limit design. citeturn1view0
- #6 feat: Browser extension for real-time protection — out of core launch, prioritize after main API hardening. citeturn1view0
- #5 feat: Multi-chain expansion (Astar, Moonbeam, etc.) — aligns with API + DB chain table; schedule post-MVP. citeturn1view0
- #4 feat: Transaction graph analysis for fraud detection — large scope; spin into a milestone after prod go-live. citeturn1view0
- #3 feat: Train ML model on labeled fraud dataset — depends on data pipeline; treat as R&D track. citeturn1view0
- #2 feat: Add KILT DID identity support — extends `IdentitySource`; pair with multi-chain readiness. citeturn1view0
- #1 feat: Include whitelisted entities in reverse lookups — map to API cache/identity tasks; consider near-term. citeturn1view0
