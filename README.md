# Wisesama

Vulnerability intelligence and response for small software teams. The new product connects an exact software inventory to sourced advisories, helps teams assess what matters, and records their response evidence.

The original Polkadot/Kusama fraud detection product is preserved under **Dotsama** (working name). Its source was moved into clearly named folders; its API URLs and database records are unchanged.

## Products and shared infrastructure

| Location | Purpose | Local port |
|---|---|---|
| `apps/intel` | Wisesama public site, response workspace and V2 admin | 3003 |
| `apps/dotsama-web` | Original crypto public UI, now Dotsama | 3000 |
| `apps/dotsama-admin` | Original crypto admin console | 3002 |
| `apps/api` | Shared Fastify host, authentication, API keys and Wisesama services | 3001 |
| `apps/api/src/dotsama` | Preserved crypto routes, services and helpers | Shared API |
| `packages/database` | Shared PostgreSQL/Prisma schema and client | — |
| `packages/types` | Original crypto API types | — |
| `packages/config` | Shared TypeScript configuration | — |

## Run locally

Node 20+ and pnpm 9 are required. Install dependencies and generate the existing Prisma client before starting the apps. Keep credentials in ignored environment files.

```bash
pnpm install
pnpm --filter @wisesama/database db:generate
pnpm dev                 # Wisesama UI and shared API
pnpm dev:dotsama         # Dotsama public UI, admin and shared API
pnpm dev:all             # All apps
```

Run one of those development groups at a time; they share the API port. Existing database installations need the documented migration baseline before applying new additive migrations. Do not push the schema over a populated database as a substitute for that process.

## Documentation

- [Wisesama implementation and local setup](./apps/intel/README.md)
- [Product purpose and current boundaries](./PRODUCT.md)
- [Security-response workflow](./docs/SECURITY-RESPONSE.md)
- [GitHub and GitLab.com setup](./docs/REPOSITORY-SETUP.md)
- [Public email, RSS and MCP delivery](./docs/PUBLIC-DELIVERY.md)
- [Dotsama code and existing crypto capabilities](./docs/DOTSAMA.md)
- [Repository security baseline and project context](./docs/BASELINE-CONTRACT.md)
- [Incident response playbooks and saved evidence](./docs/RESPONSE-PLAYBOOKS.md)
- [Organization hierarchy, roles and invitation contract](./docs/ORGANIZATIONS-CONTRACT.md)
- [Organization end-to-end verification](./docs/ORGANIZATIONS-VERIFICATION.md)
- [CI dependency integrity contract](./docs/CI-DEPENDENCY-CONTRACT.md)
- [Free open-source CI audit skill](./packages/security-skills/README.md)
- [V2 admin setup and operator access](./docs/ADMIN-SETUP.md)
- [Admin flow research](./docs/ADMIN-DESIGN.md) and [verification](./docs/ADMIN-VERIFICATION.md)
- [Original crypto API reference](./docs/API.md)

Provider registration, production email delivery, scheduling, domain cutover, legal details and billing have separate deployment requirements. A local working preview does not establish that those services are configured in production.

## Checks

```bash
pnpm --filter @wisesama/api test
pnpm --filter @wisesama/api type-check
pnpm --filter @wisesama/intel build
pnpm --filter @dotsama/web type-check
pnpm --filter @dotsama/admin type-check
```

No secrets, generated Prisma output or production environment files should be committed.

The preserved crypto API is disabled in the Wisesama runtime by default. `pnpm dev:dotsama` and `pnpm dev:all` enable it explicitly; a separate Dotsama deployment needs `DOTSAMA_API_ENABLED=true`. See [Dotsama](./docs/DOTSAMA.md).
