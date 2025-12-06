# Wisesama

> Polkadot Ecosystem Fraud Detection & Risk Assessment Platform

Wisesama provides real-time risk assessment for Polkadot/Kusama addresses, domains, Twitter handles, and emails. It aggregates data from the official polkadot-js/phishing repository, community reports, on-chain identity verification, and behavioral analysis to help users identify potential scams.

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
| **Frontend** | Next.js 15, React, Tailwind CSS |
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
│   ├── web/                    # Next.js frontend (public)
│   └── admin/                  # Next.js admin dashboard (protected)
├── packages/
│   ├── database/               # Prisma schema & client
│   ├── types/                  # Shared TypeScript types
│   └── config/                 # ESLint, TS base configs
└── docs/                       # Documentation
```

## Documentation

| Document | Description |
|----------|-------------|
| [API Architecture](./docs/API.md) | Full API documentation - endpoints, services, database schema |
| [Admin Dashboard](./docs/ADMIN-DASHBOARD.md) | Admin interface for whitelist management and report review |
| [ML & Risk Scoring](./docs/ML-RISK-SCORING.md) | Risk scoring algorithm, feature extraction, data sources |
| [Swagger UI](http://localhost:3001/docs) | Interactive API documentation (when running locally) |

## Quick Start

```bash
# Install dependencies
pnpm install

# Setup database
pnpm --filter @wisesama/database db:generate
pnpm --filter @wisesama/database db:push
pnpm --filter @wisesama/database db:seed

# Start development servers
pnpm dev
```

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

See [API Architecture](./docs/API.md#environment-variables) for the complete list of environment variables.

**Required:**
- `DATABASE_URL` - PostgreSQL connection string
- `UPSTASH_REDIS_REST_URL` - Redis URL
- `UPSTASH_REDIS_REST_TOKEN` - Redis token
- `JWT_SECRET` - JWT signing key

**Optional:**
- `SUBSCAN_API_KEY` - For ML feature extraction and identity timeline
- `VIRUSTOTAL_API_KEY` - For domain security scanning

## License

MIT
