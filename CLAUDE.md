# Wisesama

Polkadot/Kusama ecosystem fraud detection platform. Live at **wisesama.com**.

## Architecture

pnpm monorepo + Turborepo. All TypeScript strict mode.

| Package | What | Port |
|---------|------|------|
| `apps/web` | Next.js 16 (App Router) - public UI | 3000 |
| `apps/api` | Fastify 5 REST API | 3001 |
| `apps/admin` | Next.js 16 (App Router) - admin console | 3002 |
| `packages/database` | Prisma (PostgreSQL) schema + client | - |
| `packages/types` | Shared TS interfaces/types | - |
| `packages/config` | Base ESLint + TSConfig | - |

**Deployment:** All on Vercel. API uses serverless functions. DB is managed PostgreSQL. Upstash Redis for rate limiting/caching. QStash for background jobs.

## Quick Commands

```bash
pnpm install                          # Install deps
pnpm dev                              # Dev all apps
pnpm --filter @wisesama/web dev       # Dev just web
pnpm --filter @wisesama/api dev       # Dev just api
pnpm --filter @wisesama/admin dev     # Dev just admin
pnpm build                            # Build all
pnpm lint                             # Lint all
pnpm type-check                       # Type-check all
pnpm --filter @wisesama/api test      # Run API tests
pnpm db:generate                      # Generate Prisma client
pnpm db:push                          # Push schema to DB
pnpm db:studio                        # Open Prisma Studio
```

## Key Tech Stack

- **Web/Admin:** Next.js 16, React 18, Tailwind CSS 3, Radix UI, TanStack Query, Zustand, Axios
- **API:** Fastify 5, Prisma, JWT (HS256), Upstash rate limiting, Polkadot.js, Subscan, VirusTotal
- **Fonts:** Satoshi + Clash Display (custom)
- **Theme:** Purple/pink palette, dark mode via `next-themes`

## API Structure

- Routes in `apps/api/src/modules/` (query, auth, report, api-keys, whitelist, admin, jobs, etc.)
- Services in `apps/api/src/services/` (query, polkadot, subscan, phishing-sync, virustotal, ml, email, etc.)
- Auth: JWT Bearer token + API key (`x-api-key` header) with SHA256 hashing
- All responses use standardized envelope: `{ meta: { requestId, timestamp, processingTimeMs }, data }`
- CORS: wisesama.com, www.wisesama.com, localhost in dev

## Database (Prisma/PostgreSQL)

Key models: Entity (risk-scored addresses/domains/handles), Identity (Polkadot People Chain), User, ApiKey, Report, WhitelistedEntity, WhitelistRequest, ActivityLog, CommunityContribution, Search, SyncState.

Enums: EntityType (ADDRESS/DOMAIN/TWITTER/EMAIL), RiskLevel (SAFE/UNKNOWN/CAUTION/FRAUD), ThreatCategory (PHISHING/SCAM/RUG_PULL/etc.)

## Conventions

- Files: kebab-case. Components: PascalCase. Functions/vars: camelCase.
- Tests: `__tests__/*.test.ts` with Vitest. Mock external calls (RPC/Redis/Subscan).
- Commits: Conventional Commits (`feat(web):`, `fix(api):`, etc.)
- Unused args prefixed with `_`. Prefer type-only imports. Minimize `any`.
- Never commit `.env` files or secrets.

## Environment Variables

Required: `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `JWT_SECRET`
Optional: `SUBSCAN_API_KEY`, `VIRUSTOTAL_API_KEY`, `QSTASH_TOKEN`, `NEXT_PUBLIC_API_URL`

API URL defaults: `http://localhost:3001` (dev), `https://api.wisesama.com` (prod)
