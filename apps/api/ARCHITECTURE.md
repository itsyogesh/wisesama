# Wisesama API Architecture

> Polkadot Ecosystem Fraud Detection & Risk Assessment Platform

## Overview

Wisesama is a fraud detection API for the Polkadot ecosystem. It provides real-time risk assessment for addresses, domains, Twitter handles, and emails by aggregating data from the official polkadot-js/phishing repository, community reports, and on-chain identity data.

## Tech Stack

| Component | Technology |
|-----------|------------|
| Runtime | Node.js 20+ |
| Framework | Fastify 5.x |
| Database | PostgreSQL (Neon) |
| ORM | Prisma |
| Cache | Upstash Redis |
| Background Jobs | Upstash QStash |
| Email | Resend |
| Blockchain | Polkadot/Kusama RPC |
| Deployment | Vercel Serverless |
| Package Manager | pnpm (Monorepo with Turborepo) |

---

## Project Structure

```
wisesama/
├── apps/
│   ├── api/                    # This package - Fastify API server
│   │   ├── src/
│   │   │   ├── index.ts        # App entry point
│   │   │   ├── modules/        # Route handlers by domain
│   │   │   ├── services/       # Business logic
│   │   │   ├── middleware/     # Auth, rate limiting
│   │   │   ├── lib/            # Redis, external clients
│   │   │   └── utils/          # Helpers (normalization, detection)
│   │   └── scripts/            # CLI utilities
│   └── web/                    # Next.js frontend (separate)
│
├── packages/
│   ├── database/               # Prisma schema & client
│   │   └── prisma/
│   │       ├── schema.prisma   # Database models
│   │       └── seed.ts         # Seed data
│   ├── types/                  # Shared TypeScript types
│   └── config/                 # ESLint, TS base configs
```

---

## Core Concepts

### Entity Types

The system tracks four types of entities:

| Type | Example | Normalization |
|------|---------|---------------|
| `ADDRESS` | `155dDX3rWoNsY4aiJFbsu6wLB91c2J2Ws5BgMfJKyM1eGnkS` | Hex public key (`0x...`) |
| `DOMAIN` | `polkadot-airdrop.com` | Lowercase, strip protocol/www |
| `TWITTER` | `@polkadot` | Lowercase, strip `@` |
| `EMAIL` | `scam@example.com` | Lowercase |

### Address Normalization

Polkadot addresses use SS58 encoding with network-specific prefixes. The same public key can have different string representations:

```
Polkadot: 155dDX3rWoNsY4aiJFbsu6wLB91c2J2Ws5BgMfJKyM1eGnkS (prefix 0)
Kusama:   GewjW8fHP8KrBPe7KMveuUBU7JC8fHZExHwb2avu4CcqBwE  (prefix 2)
         ↓ Both normalize to ↓
Hex:      0xb477d42ac66fb36b2e5d1c53f8b1530de94c3cfe7a666ea5d6c72c467c53b429
```

This allows chain-agnostic fraud detection - a scammer flagged on Polkadot is automatically detected on Kusama.

### Risk Levels

| Level | Score | Description |
|-------|-------|-------------|
| `SAFE` | 0-20 | Verified safe (whitelisted) |
| `UNKNOWN` | - | No data available |
| `CAUTION` | 40-70 | Potential issues (look-alike, reports) |
| `FRAUD` | 80-100 | Confirmed malicious |

---

## API Modules

### Public Endpoints

#### Check Module (`/api/v1/check`)

The primary endpoint for risk assessment.

```
GET /check/:entity    - Check single entity
POST /check/batch     - Check multiple entities (max 50)
```

**Response Structure:**
```json
{
  "meta": { "requestId": "...", "timestamp": "...", "processingTimeMs": 123 },
  "data": {
    "entity": "example.com",
    "entityType": "DOMAIN",
    "assessment": {
      "riskLevel": "FRAUD",
      "riskScore": 95,
      "threatCategory": "PHISHING"
    },
    "blacklist": { "found": true, "source": "polkadot-js-phishing", "threatName": "..." },
    "whitelist": { "found": false },
    "identity": { "hasIdentity": false, "isVerified": false },
    "lookAlike": null,
    "stats": { "timesSearched": 42, "userReports": 3 }
  }
}
```

#### Report Module (`/api/v1/reports`)

Community fraud reporting.

```
POST /reports         - Submit new report
GET  /reports         - List verified reports (public)
```

#### Identity Module (`/api/v1/identity`)

On-chain identity lookup.

```
GET /identity/:address?chain=polkadot
```

Returns Polkadot Identity Pallet data (display name, judgements, social links).

### Protected Endpoints

#### Auth Module (`/api/v1/auth`)

```
POST /auth/register   - Create account
POST /auth/login      - Get JWT token
GET  /auth/me         - Current user profile (requires Bearer token)
```

#### API Keys (`/api/v1/api-keys`)

```
POST /api-keys        - Create key (max 5 per user)
GET  /api-keys        - List keys
DELETE /api-keys/:id  - Revoke key
```

### Admin Endpoints (requires `ADMIN` role)

#### Whitelist Management (`/api/v1/admin/whitelist`)

```
GET    /admin/whitelist           - List entries
POST   /admin/whitelist           - Create entry
PUT    /admin/whitelist/:id       - Update entry
DELETE /admin/whitelist/:id       - Delete entry
POST   /admin/whitelist/bulk      - Bulk import (max 100)
GET    /admin/whitelist/categories - Category stats
```

#### Report Review (`/api/v1/admin/reports`)

```
GET /admin/reports              - List all reports
GET /admin/reports/:id          - Report details
PUT /admin/reports/:id/verify   - Verify & optionally add to blacklist
PUT /admin/reports/:id/reject   - Reject with reason
GET /admin/reports/stats        - Statistics
```

#### Sync Management (`/api/v1/admin/sync`)

```
POST /admin/sync        - Trigger phishing sync
POST /admin/sync/now    - Sync immediately (blocking)
GET  /admin/sync/status - Sync status & counts
```

#### GitHub Contributions (`/api/v1/admin/contributions`)

```
GET  /admin/contributions           - List PRs
GET  /admin/contributions/:id       - PR details
POST /admin/contributions/:id/sync  - Refresh PR status
POST /admin/contributions/sync-all  - Refresh all open PRs
GET  /admin/contributions/stats     - Statistics
```

### Background Jobs (`/api/v1/jobs`)

QStash webhook endpoints for scheduled tasks.

```
POST /jobs/sync-phishing   - CRON webhook (QStash signature required)
GET  /jobs/sync-status     - Current sync status
```

---

## Services

### QueryService

**File:** `src/services/query.service.ts`

Core lookup logic:
1. Detect entity type from input
2. Check Redis cache (5-min TTL)
3. Query blacklist (Entity table)
4. Query whitelist (WhitelistedEntity table)
5. For addresses: Fetch on-chain identity
6. For Twitter: Check look-alike detection
7. Calculate risk assessment
8. Record search analytics
9. Cache and return result

### PhishingSyncService

**File:** `src/services/phishing-sync.service.ts`

Syncs from [polkadot-js/phishing](https://github.com/polkadot-js/phishing):

| Source | URL | Contains |
|--------|-----|----------|
| `address.json` | `polkadot.js.org/phishing/address.json` | Malicious addresses by threat |
| `all.json` | `polkadot.js.org/phishing/all.json` | Deny/allow lists for domains |

Runs on schedule via QStash CRON and can be triggered manually by admins.

### PolkadotService

**File:** `src/services/polkadot.service.ts`

Queries on-chain identity via RPC:
- Connects to Polkadot/Kusama WebSocket RPC
- Fetches Identity Pallet data
- Parses judgements from registrars
- Caches results in Redis (1-hour TTL)
- Stores in database for historical reference

### GitHubContributionService

**File:** `src/services/github-contribution.service.ts`

Automates upstream contributions:
1. Ensures fork of polkadot-js/phishing exists
2. Creates branch for contribution
3. Updates `address.json` or `all.json`
4. Creates PR to upstream repository
5. Tracks PR status (open/merged/closed)

### LevenshteinService

**File:** `src/services/levenshtein.service.ts`

Detects impersonation attacks by comparing Twitter handles against whitelisted accounts using string similarity (threshold: 70%).

### EmailService

**File:** `src/services/email.service.ts`

Transactional emails via Resend:
- Report confirmation to submitter
- Report verified/rejected notifications
- Admin alerts for new reports

---

## Database Schema

### Core Tables

```
Entity                  # Blacklist (malicious entities)
├── id, entityType, value, normalizedValue
├── chainId → Chain
├── riskLevel, riskScore, threatCategory
├── source, threatName
└── timesSearched, userReportCount

WhitelistedEntity       # Verified safe entities
├── id, entityType, value, normalizedValue
├── name, category, description
├── website, twitter, logoUrl
├── chainId → Chain
├── identityId → PolkadotIdentity
└── source, verifiedAt, verifiedBy

PolkadotIdentity        # On-chain identity cache
├── id, address, chainId → Chain
├── displayName, legalName, email, twitter, web
├── hasIdentity, isVerified
└── judgements (JSON)
```

### User & Auth

```
User
├── id, email, passwordHash, walletAddress
├── role (USER | ADMIN)
└── tier, remainingQuota

ApiKey
├── id, userId → User
├── keyHash (SHA256), keyPrefix
├── isActive, lastUsedAt
└── remainingQuota, rateLimitPerMin
```

### Reporting & Contributions

```
Report
├── id, userId → User, entityId → Entity
├── reportedValue, entityType, threatCategory
├── description, relatedUrl, evidenceUrls[]
├── reporterName, reporterEmail
├── status (pending | verified | rejected)
└── reviewedAt

CommunityContribution
├── id, reportId → Report
├── prNumber, prUrl, prStatus
├── entityType, entityValue, targetFile
└── submittedAt, mergedAt, errorMessage
```

### Analytics & Config

```
Search                  # Search analytics
├── searchTerm, normalizedTerm, entityType
├── entityId, userId, resultRisk
└── responseTimeMs, cacheHit, searchedAt

Chain                   # Supported chains
├── code (dot, ksm, astr...)
├── name, ss58Prefix
└── rpcEndpoint, explorerUrl

SyncState               # Sync tracking
├── sourceName (polkadot-js-phishing)
├── lastSyncAt, lastSyncHash
└── recordsProcessed, lastError
```

---

## Request Flow

### Entity Check Flow

```
Client Request
     │
     ▼
┌─────────────────┐
│  Rate Limiter   │  Upstash Redis (100 req/min)
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  QueryService   │
├─────────────────┤
│ 1. Detect type  │  entity-detector.ts
│ 2. Normalize    │  normalize.ts
│ 3. Check cache  │  Redis (5 min TTL)
│ 4. Query DB     │  Prisma
│ 5. Get identity │  PolkadotService (if ADDRESS)
│ 6. Check alike  │  LevenshteinService (if TWITTER)
│ 7. Calc risk    │
│ 8. Record stats │
│ 9. Cache result │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Response Hook   │  Add meta (requestId, timestamp, timing)
└────────┬────────┘
         │
         ▼
    JSON Response
```

### Report Verification Flow

```
Admin: PUT /admin/reports/:id/verify
              │
              ▼
┌──────────────────────────────────┐
│  1. Authenticate (JWT)           │
│  2. Check Admin role             │
│  3. Update report status         │
│  4. Create/Update Entity         │  (if addToBlacklist)
│  5. Create GitHub PR             │  (if contributeToUpstream)
│  6. Send email notification      │
└──────────────────────────────────┘
              │
              ▼
    Response with PR details
```

---

## Caching Strategy

| Cache Key Pattern | TTL | Purpose |
|-------------------|-----|---------|
| `entity:{TYPE}:{normalized}` | 5 min | Entity lookup results |
| `identity:{chain}:{address}` | 1 hour | On-chain identity |
| `whitelist:{TYPE}:{normalized}` | 5 min | Whitelist lookup |
| `sync:status` | - | Current sync state |

---

## Security

### Authentication

1. **JWT Tokens** - For user sessions
   - Secret: `JWT_SECRET` env var
   - Expiry: `JWT_EXPIRES_IN` (default 7d)

2. **API Keys** - For programmatic access
   - Format: `wsk_live_{random}`
   - Stored as SHA256 hash
   - Rate limited per key

### Authorization

- Public endpoints: No auth required
- User endpoints: Valid JWT or API key
- Admin endpoints: JWT with `role: ADMIN`

### Request Signing

- QStash webhooks verified via signature headers
- Uses `QSTASH_CURRENT_SIGNING_KEY` and `QSTASH_NEXT_SIGNING_KEY`

### Data Protection

- Passwords: bcrypt (12 rounds)
- API keys: SHA256 hash (only prefix stored)
- Sensitive data: Environment variables only

---

## Environment Variables

### Required

```bash
# Database
DATABASE_URL=postgresql://...

# Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# Auth
JWT_SECRET=your-secret-key
```

### Optional

```bash
# Server
PORT=3001
HOST=0.0.0.0
NODE_ENV=production
LOG_LEVEL=info
CORS_ORIGIN=https://wisesama.com

# JWT
JWT_EXPIRES_IN=7d

# Polkadot RPC
POLKADOT_RPC=wss://rpc.polkadot.io
KUSAMA_RPC=wss://kusama-rpc.polkadot.io

# QStash (for CRON jobs)
QSTASH_CURRENT_SIGNING_KEY=...
QSTASH_NEXT_SIGNING_KEY=...

# Email (Resend)
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=noreply@wisesama.com
ADMIN_ALERT_EMAIL=admin@wisesama.com
APP_URL=https://wisesama.com

# GitHub Integration
GITHUB_TOKEN=ghp_...
GITHUB_FORK_OWNER=your-github-username
```

---

## Development

### Setup

```bash
# Install dependencies
pnpm install

# Generate Prisma client
pnpm --filter @wisesama/database db:generate

# Push schema to database
pnpm --filter @wisesama/database db:push

# Seed initial data
pnpm --filter @wisesama/database db:seed

# Start dev server
pnpm --filter @wisesama/api dev
```

### Scripts

```bash
# Build
pnpm --filter @wisesama/api build

# Type check
pnpm --filter @wisesama/api type-check

# Run sync manually
npx tsx src/scripts/run-sync.ts
```

### Testing Endpoints

```bash
# Health check
curl http://localhost:3001/api/v1/health

# Check entity
curl http://localhost:3001/api/v1/check/polkadot.com

# Check known fraud address
curl http://localhost:3001/api/v1/check/155dDX3rWoNsY4aiJFbsu6wLB91c2J2Ws5BgMfJKyM1eGnkS
```

---

## Deployment

### Vercel

The API is designed for Vercel serverless deployment:

```bash
# Deploy to production
vercel --prod
```

### Environment Setup

1. Set all required environment variables in Vercel dashboard
2. Note: Use separate `DATABASE_URL` for production vs development

### Post-Deployment

1. Trigger initial phishing sync via admin endpoint
2. Verify health endpoint responds
3. Test entity lookup functionality

---

## Data Sources

### Primary: polkadot-js/phishing

- **Repository:** https://github.com/polkadot-js/phishing
- **Addresses:** ~280 known scam addresses
- **Domains:** ~53,000 malicious domains
- **Allow list:** ~30 verified safe domains
- **Sync frequency:** Configurable via QStash CRON

### Secondary: Community Reports

- User-submitted fraud reports
- Admin verification workflow
- Optional upstream contribution via PR

### Tertiary: On-Chain Identity

- Polkadot Identity Pallet data
- Registrar judgements (Web3 Foundation, etc.)
- Used to enhance trust assessment

---

## API Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 201 | Created |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (missing/invalid auth) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found |
| 409 | Conflict (duplicate entry) |
| 429 | Rate limited |
| 500 | Internal server error |

---

## Monitoring & Observability

### Logging

- Fastify logger with configurable levels
- Request/response logging
- Error stack traces in development

### Metrics

- `Search` table tracks all lookups
- Response times recorded
- Cache hit/miss tracking

### Health Checks

```
GET /api/v1/health
```

Returns status of:
- Database connectivity
- Redis connectivity

---

## Future Considerations

- [ ] WebSocket support for real-time alerts
- [ ] Multi-chain expansion (Astar, Moonbeam)
- [ ] Machine learning for pattern detection
- [ ] Browser extension integration
- [ ] Webhook notifications for watched addresses
