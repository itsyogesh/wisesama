# Repository Guidelines
Wisesama is a pnpm/turbo monorepo for Polkadot/Kusama fraud detection; use these guardrails when contributing.

## Project Structure & Module Ownership
- `apps/api` – Fastify REST API (default `PORT=3001`), Swagger at `/docs`.
- `apps/web` – Next.js 16 public UI on :3000; `apps/admin` – Next.js 16 admin console on :3002.
- `packages/database` – Prisma schema/client and seeds; `packages/types` – shared TypeScript; `packages/config` – base ESLint/TS configs.
- `docs/` holds architecture docs; `turbo.json` and `pnpm-workspace.yaml` orchestrate tasks.

## Setup & Tooling
- Requires Node 20+, pnpm 9.x, Turbo 2.x; install deps with `pnpm install`.
- Env vars (keep in `.env`/`.env.local`, never commit): required `DATABASE_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `JWT_SECRET`; optional `SUBSCAN_API_KEY`, `VIRUSTOTAL_API_KEY`.
- Prisma scripts read the root `.env`; app dev scripts load `.env.local`.

## Build, Test, and Development Commands
- `pnpm dev` runs all apps via Turbo; scope with `pnpm --filter @wisesama/api|web|admin dev`.
- Quality gates: `pnpm lint`, `pnpm type-check`; release build with `pnpm build`.
- Tests: `pnpm --filter @wisesama/api test` (watch `test:watch`, coverage `test:coverage`).
- Database: `pnpm --filter @wisesama/database db:generate | db:push | db:migrate | db:seed | db:studio`.

## Coding Style & Naming Conventions
- TypeScript strict; base config targets ES2022 with bundler module resolution.
- ESLint extends `eslint:recommended`, `@typescript-eslint/recommended`, `prettier`; prefix unused args with `_`; prefer type-only imports; keep `any` rare.
- Files use kebab-case; React components PascalCase; functions/vars camelCase; tests mirror subjects under `__tests__`.

## Testing Guidelines
- Vitest powers API specs (`apps/api/vitest.config.ts`); name files `*.test.ts` inside `__tests__`.
- Mock RPC/Redis/Subscan calls; focus on service-level behavior; run `test:coverage` on API changes.
- For web/admin, run `pnpm lint` and do local manual checks until UI tests exist.

## Commit & Pull Request Guidelines
- Use Conventional Commits (`feat`, `fix`, `docs`, `chore`, scopes like `feat(web): …`) in imperative mood.
- PRs: short summary, linked issue, commands run (tests/lint/db), screenshots or GIFs for UI, note env or migration impacts.
- Keep changes scoped; avoid mixing apps unless required; request review after checks pass.

## Security & Configuration
- Never commit secrets or generated Prisma output; rotate tokens if exposed.
- Validate inputs at API edges and avoid logging sensitive values; rely on Fastify schemas/Zod validators; run `db:migrate` locally before sharing `db:push` and document breaking schema changes in PRs.
