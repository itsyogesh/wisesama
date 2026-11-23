# Dotsama (working name)

> The original Polkadot/Kusama fraud detection product, preserved under the Dotsama working name.

The public UI is in `apps/dotsama-web`, its admin console is in `apps/dotsama-admin`, and crypto route handlers, services and helpers are grouped in `apps/api/src/dotsama`. Authentication, API keys, the API host, database and shared types remain shared infrastructure. Existing crypto API paths and database records are preserved. The Wisesama API excludes crypto routes and their provider initialization by default. `pnpm dev:dotsama` and `pnpm dev:all` explicitly set `DOTSAMA_API_ENABLED=true`; a dedicated Dotsama deployment must set that variable at runtime.

The name is provisional. Historical URLs, bot handles, cached assets and deployment bindings have not been moved to a new domain. Deploying these renamed app folders requires updating their deployment project root directories. The vulnerability-response product remains Wisesama in `apps/intel`.

Dotsama provides real-time risk assessment for Polkadot/Kusama addresses, domains, Twitter handles, and emails. It aggregates data from the official polkadot-js/phishing repository, community reports, on-chain identity verification, and behavioral analysis to help users identify potential scams.

## Features

- **Multi-entity Risk Assessment** - Check addresses, domains, Twitter handles, and emails
- **On-chain Identity Verification** - Lookup Polkadot Identity Pallet data with verification status
- **Identity Timeline** - See when identities were created and first verified (with Relay → People Chain migration detection)
- **ML-based Risk Scoring** - Behavioral analysis using 21 on-chain features
- **VirusTotal Integration** - Domain scanning with 80+ antivirus engines
- **Look-alike Detection** - Identify impersonation attempts on Twitter handles
- **Reverse Lookup** - Find on-chain identities by Twitter handle or website
- **Community Reports** - User-submitted fraud reports with admin verification
- **Upstream Contributions** - Automatic PR creation to polkadot-js/phishing

## Tech Stack

| Component | Technology |
|-----------|------------|
| **API** | Fastify 5.x, Node.js 20+ |
| **Frontend** | Next.js 16, React, Tailwind CSS |
| **Database** | PostgreSQL (Neon), Prisma ORM |
| **Cache** | Upstash Redis |
| **Blockchain** | Polkadot/Kusama RPC, Subscan API |
| **Deployment** | Vercel Serverless |
| **Package Manager** | pnpm (Monorepo with Turborepo) |

## Project Structure

```
wisesama/
├── apps/
│   ├── api/                    # Fastify API server
│   ├── dotsama-web/            # Next.js frontend (public)
│   └── dotsama-admin/          # Next.js admin dashboard (protected)
├── packages/
│   ├── database/               # Prisma schema & client
│   ├── types/                  # Shared TypeScript types
│   └── config/                 # ESLint, TS base configs
└── docs/                       # Documentation
```

## Documentation

| Document | Description |
|----------|-------------|
| [API Architecture](./API.md) | Full API documentation - endpoints, services, database schema |
| [Admin Dashboard](./ADMIN-DASHBOARD.md) | Admin interface for whitelist management and report review |
| [ML & Risk Scoring](./ML-RISK-SCORING.md) | Risk scoring algorithm, feature extraction, data sources |
| [Swagger UI](http://localhost:3001/docs) | Interactive API documentation (when running locally) |

## Quick Start

```bash
# Install dependencies
pnpm install

# Generate the existing database client
pnpm --filter @wisesama/database db:generate

# Start development servers
pnpm dev:dotsama
```

Database records are preserved in the shared schema. Follow the documented migration baseline for an existing database; do not use a schema push or seed to move production data.

## API Usage

```bash
# Check an address
curl http://localhost:3001/api/v1/check/155dDX3rWoNsY4aiJFbsu6wLB91c2J2Ws5BgMfJKyM1eGnkS

# Check a domain
curl http://localhost:3001/api/v1/check/polkadot.network

# Check a Twitter handle
curl http://localhost:3001/api/v1/check/@polkadot
```

## Environment Variables

See [API Architecture](./API.md#environment-variables) for the complete list of environment variables.

**Required for a Dotsama API deployment:**

- `DOTSAMA_API_ENABLED=true` - Explicitly register the preserved crypto routes

**Shared infrastructure:**

- `DATABASE_URL` - PostgreSQL connection string
- `UPSTASH_REDIS_REST_URL` - Redis URL
- `UPSTASH_REDIS_REST_TOKEN` - Redis token
- `BETTER_AUTH_SECRET` - Better Auth session signing secret

**Optional:**

- `SUBSCAN_API_KEY` - For ML feature extraction and identity timeline
- `VIRUSTOTAL_API_KEY` - For domain security scanning

## License

MIT
