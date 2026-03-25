# Wisesama x Opentribe Integration Spec

**Date:** March 2026
**From:** Yogesh ([@itsyogesh](https://github.com/itsyogesh))
**Status:** Draft / For Discussion

---

## Overview

This document proposes how Wisesama and Opentribe can integrate to bring on-chain identity verification and fraud detection to Opentribe's organization and user profiles. Both projects are W3F grant recipients building complementary infrastructure for the Polkadot ecosystem.

Wisesama provides identity data, fraud detection, and (planned) automated identity registration. Opentribe tracks organizations, contributors, and grant recipients. Together, we can give Polkadot organizations and developers verified, on-chain identities without the current manual registrar process.

---

## 1. What Wisesama Has Today

### 1.1 On-Chain Identity Database

Wisesama maintains a synced copy of all on-chain identities from Polkadot and Kusama People Chains:

| Chain | Identities | Sub-identities |
|-------|-----------|----------------|
| Polkadot People Chain | 2,929 | 933 |
| Kusama People Chain | 4,567 | 1,933 |
| **Total** | **7,496** | **2,866** |

Of these, approximately 114 are organization-like identities (foundations, DAOs, protocols, networks, labs).

**Sync mechanism:** A daily cron job queries `identity.identityOf.entries()` on each People Chain, upserts records into a PostgreSQL database, and marks stale identities (those removed on-chain via `clearIdentity`) as cleared. Individual lookups that miss the daily sync fall back to live RPC queries against the People Chain and are cached in Redis for 1 hour.

### 1.2 Identity Fields

Each synced identity record contains these fields:

| Field | Source | Notes |
|-------|--------|-------|
| `displayName` | `info.display` | Primary display name |
| `legalName` | `info.legal` | Legal/registered name |
| `email` | `info.email` | Contact email |
| `twitter` | `info.twitter` | Normalized: lowercase, no `@` prefix |
| `web` | `info.web` | Normalized: lowercase, no protocol/www |
| `riot` | `info.riot` | Riot/Element legacy handle |
| `github` | `info.additional` | From key-value pairs (`github` or `gh` key) |
| `discord` | `info.additional` | From key-value pairs |
| `matrix` | `info.additional` | From key-value pairs (`matrix` or `element` key) |
| `additionalFields` | `info.additional` | All additional key-value pairs as JSON |
| `judgements` | `registration.judgements` | Array of `{ registrarId, judgement }` |
| `isVerified` | Derived | `true` if any judgement is `Reasonable` or `KnownGood` |

**Sample synced identity record:**

```json
{
  "address": "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu8CAkXe43PZ",
  "source": "POLKADOT_PEOPLE",
  "displayName": "Parity Technologies",
  "legalName": "Parity Technologies Ltd",
  "email": "admin@parity.io",
  "twitter": "paboritytech",
  "web": "parity.io",
  "riot": null,
  "github": "AnyFetch",
  "discord": null,
  "matrix": null,
  "additionalFields": {
    "github": "AnyFetch"
  },
  "hasIdentity": true,
  "isVerified": true,
  "judgements": [
    { "registrarId": 1, "judgement": "Reasonable" }
  ],
  "lastSyncedAt": "2026-03-25T06:00:00.000Z"
}
```

### 1.3 Fraud Detection Database

- **Blacklist:** Synced from [`polkadot-js/phishing`](https://github.com/nickvdyck/polkadot-js-phishing) repository. Includes malicious addresses (from `address.json`) and phishing domains (from `all.json`). Currently tracks thousands of known-bad entities.
- **Whitelist:** ~75 curated entities (exchanges, validators, treasury addresses, known projects). Categories include `exchange`, `validator`, `treasury`, `project`, `verified`.
- **Threat categories:** `PHISHING`, `SCAM`, `RUG_PULL`, `IMPERSONATION`, `FAKE_AIRDROP`, `RANSOMWARE`, `MIXER`, `OFAC_SANCTIONED`, `OTHER`.
- **Look-alike detection:** Levenshtein distance comparison against known Twitter handles to catch impersonation attempts.
- **ML risk scoring:** Feature extraction from on-chain transaction history (via Subscan), fed into a risk model that returns a score, confidence level, and recommendation (`safe` / `review` / `high_risk`).

### 1.4 Current API Endpoints

**Base URL:** `https://api.wisesama.com/api/v1`

All responses are wrapped in a standard envelope:

```json
{
  "meta": {
    "requestId": "550e8400-e29b-41d4-a716-446655440000",
    "timestamp": "2026-03-25T12:00:00.000Z",
    "processingTimeMs": 142
  },
  "data": { ... }
}
```

Rate limiting headers are included on all responses: `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.

---

#### `GET /api/v1/check/:entity`

Risk assessment and identity data for an address, domain, or Twitter handle.

**Parameters:**
- `:entity` — A Polkadot/Kusama address, domain name, or Twitter handle

**Response:**

```json
{
  "entity": "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu8CAkXe43PZ",
  "entityType": "ADDRESS",
  "chain": "polkadot",
  "assessment": {
    "riskLevel": "LOW_RISK",
    "riskScore": 15,
    "threatCategory": null
  },
  "blacklist": {
    "found": false,
    "source": null,
    "threatName": null
  },
  "whitelist": {
    "found": true,
    "name": "Parity Technologies",
    "category": "project"
  },
  "identity": {
    "hasIdentity": true,
    "isVerified": true,
    "displayName": "Parity Technologies",
    "twitter": "paritytech",
    "web": "parity.io",
    "riot": null,
    "github": "AnyFetch",
    "discord": null,
    "matrix": null,
    "judgements": [
      { "registrarId": 1, "judgement": "Reasonable" }
    ],
    "timeline": {
      "identitySetAt": "2023-06-15T10:30:00.000Z",
      "firstVerifiedAt": "2023-06-16T14:00:00.000Z",
      "isMigrated": true,
      "source": "people_chain"
    }
  },
  "lookAlike": null,
  "mlAnalysis": {
    "available": true,
    "riskScore": 12,
    "confidence": 0.87,
    "recommendation": "safe",
    "topFeatures": [
      { "name": "has_identity", "importance": 0.35, "value": 1, "score": 0.1 },
      { "name": "is_verified", "importance": 0.30, "value": 1, "score": 0.05 }
    ]
  },
  "transactionSummary": {
    "totalTransactions": 1523,
    "totalReceived": "145000.5 DOT",
    "totalSent": "143200.3 DOT",
    "currentBalance": "1800.2 DOT",
    "lastActivityAt": "2026-03-24T18:45:00.000Z"
  },
  "virusTotal": null,
  "links": {
    "blockExplorer": "https://polkadot.subscan.io/account/15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu8CAkXe43PZ"
  },
  "linkedIdentities": null,
  "stats": {
    "timesSearched": 47,
    "userReports": 0,
    "lastSearched": "2026-03-25T11:30:00.000Z"
  }
}
```

**Risk level logic (in order of precedence):**
1. Whitelisted -> `SAFE` (score 5)
2. Blacklisted (polkadot-js/phishing) -> `FRAUD` (score 95)
3. Look-alike with >70% similarity -> `CAUTION` (score 70)
4. 3+ user reports -> `CAUTION` (score 60)
5. Verified on-chain identity -> `LOW_RISK` (score 15-20, lower if social links present)
6. Has identity but unverified -> `UNKNOWN` (score 35-40)
7. No data -> `UNKNOWN` (score null)

---

#### `POST /api/v1/check/batch`

Batch risk assessment for up to 50 entities at once.

**Request body:**

```json
{
  "entities": [
    "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu8CAkXe43PZ",
    "polkadot.network",
    "@polabortkadot"
  ]
}
```

**Response:**

```json
{
  "results": [
    {
      "entity": "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu8CAkXe43PZ",
      "success": true,
      "data": { /* same shape as single check response */ }
    },
    {
      "entity": "polkadot.network",
      "success": true,
      "data": { ... }
    },
    {
      "entity": "@polabortkadot",
      "success": false,
      "error": "Failed to check entity"
    }
  ],
  "totalProcessed": 3,
  "totalFailed": 1
}
```

---

#### `GET /api/v1/identity/:address`

Full identity lookup for a specific address. Lighter weight than `/check` -- returns only identity data, no fraud analysis.

**Parameters:**
- `:address` — Polkadot or Kusama address
- `?chain=polkadot` (optional, defaults to `polkadot`; also accepts `kusama`)

**Response:**

```json
{
  "address": "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu8CAkXe43PZ",
  "chain": "polkadot",
  "hasIdentity": true,
  "isVerified": true,
  "identity": {
    "displayName": "Parity Technologies",
    "legalName": "Parity Technologies Ltd",
    "email": "admin@parity.io",
    "twitter": "paritytech",
    "web": "parity.io",
    "riot": null,
    "github": "AnyFetch",
    "discord": null,
    "matrix": null
  },
  "judgements": [
    { "registrarId": 1, "judgement": "Reasonable" }
  ]
}
```

---

#### `GET /api/v1/identity/github/:username`

Reverse lookup: given a GitHub username, find all on-chain addresses that have that GitHub set in their identity.

**Parameters:**
- `:username` — GitHub username (case-insensitive)

**Response:**

```json
{
  "found": true,
  "count": 1,
  "identities": [
    {
      "address": "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu8CAkXe43PZ",
      "chain": "polkadot",
      "displayName": "Parity Technologies",
      "isVerified": true,
      "source": "POLKADOT_PEOPLE",
      "matchedField": "github",
      "judgements": [
        { "registrarId": 1, "judgement": "Reasonable" }
      ]
    }
  ],
  "hasMore": false
}
```

This endpoint is particularly relevant for Opentribe's use case -- it lets you go from a GitHub profile to verified on-chain addresses.

---

## 2. What We Can Add

### 2.1 Wisesama as Automated Registrar

Wisesama plans to register as an automated identity registrar on the Polkadot People Chain. Today, there are 7 active registrars, 4 of which offer free judgements. The process for getting a registrar judgement currently requires:

1. User sets on-chain identity (calls `identity.setIdentity`)
2. User requests judgement from a registrar (calls `identity.requestJudgement`)
3. Registrar manually reviews and provides judgement (often takes days)

As an automated registrar, Wisesama would:

- Verify identity fields programmatically (domain ownership, social account ownership, GitHub control)
- Issue `Reasonable` or `KnownGood` judgements within minutes, not days
- Provide a web UI and API for the verification process
- Charge zero or minimal fees (registrar fee is configurable on-chain, separate from the identity deposit)

**What this means for Opentribe:** Organizations and users on Opentribe could get verified on-chain identities through a streamlined, automated process. The "Verified" badge on Opentribe would be backed by an on-chain registrar judgement -- not just a self-reported claim.

### 2.2 Organization Identity Verification

For Opentribe organizations (projects, teams, DAOs):

1. **Domain verification** — DNS TXT record: the org adds a TXT record like `wisesama-verify=<challenge>` to their domain. Wisesama checks DNS resolution.
2. **Twitter verification** — The org posts a tweet or adds a specific string to their bio from their claimed Twitter account. Wisesama verifies via Twitter API.
3. **GitHub verification** — The org adds a file to a specific repo, or we verify admin access to the claimed GitHub org.
4. **On-chain identity** — Wisesama calls `identity.setIdentity` (or the org does) with verified fields, then Wisesama (as registrar) issues a `Reasonable` judgement.

### 2.3 User Profile Identity Verification

For Opentribe users (individual developers, contributors):

1. **GitHub verification** — User signs a message with their wallet, we verify they control the GitHub account (OAuth flow or gist-based challenge).
2. **Twitter verification** — Similar challenge-response.
3. **Wallet verification** — User signs a message proving wallet ownership (standard wallet extension flow).
4. **On-chain identity** — Link their wallet address to their verified GitHub/Twitter via on-chain identity, then Wisesama provides registrar judgement.

### 2.4 Sub-Identity Support

Polkadot's identity pallet supports sub-identities, which map well to the org-member relationship:

- An organization sets its identity (e.g., "Web3 Foundation")
- Team members are added as sub-identities (e.g., "Web3 Foundation / Alice")
- Sub-identities inherit the parent's verification status

This could map directly to Opentribe's organization -> team member relationships. If an org is verified on Wisesama, its team members could automatically get sub-identities on-chain.

---

## 3. Integration Proposal

### 3.1 Organization Verification Flow

```
Opentribe Org Profile          Wisesama                    People Chain
       |                          |                             |
       |  1. "Verify on Wisesama" |                             |
       |  (redirect with org data)|                             |
       |------------------------->|                             |
       |                          |  2. Start verification      |
       |                          |     - Check domain DNS TXT  |
       |                          |     - Check Twitter post    |
       |                          |     - Check GitHub org      |
       |                          |                             |
       |                          |  3. setIdentity (if needed) |
       |                          |---------------------------->|
       |                          |                             |
       |                          |  4. provideJudgement        |
       |                          |     (Reasonable/KnownGood)  |
       |                          |---------------------------->|
       |                          |                             |
       |  5. Callback/webhook     |                             |
       |  { verified: true,       |                             |
       |    judgement, txHash }    |                             |
       |<-------------------------|                             |
       |                          |                             |
       |  6. Show verified badge  |                             |
       |                          |                             |
```

**Step-by-step:**

1. Opentribe org profile has a "Verify on Wisesama" button. Clicking it redirects to Wisesama with the org's data (wallet address, domain, twitter, github org, display name).
2. Wisesama runs automated checks against the claimed fields.
3. If the org doesn't have an on-chain identity yet, Wisesama can help them set one (requires wallet signature from the org) or just verify an existing one.
4. Wisesama (as registrar) issues a judgement on-chain.
5. Wisesama calls back to Opentribe's webhook with the verification result.
6. Opentribe shows the verified badge.

### 3.2 User Profile Verification Flow

```
Opentribe User Profile         Wisesama                    People Chain
       |                          |                             |
       |  1. "Verify Identity"    |                             |
       |  (redirect w/ wallet +   |                             |
       |   GitHub handle)         |                             |
       |------------------------->|                             |
       |                          |  2. Wallet signature check  |
       |                          |  3. GitHub challenge-response|
       |                          |                             |
       |                          |  4. setIdentity             |
       |                          |     (display, github, etc.) |
       |                          |---------------------------->|
       |                          |                             |
       |                          |  5. provideJudgement        |
       |                          |---------------------------->|
       |                          |                             |
       |  6. Callback             |                             |
       |  { verified: true,       |                             |
       |    address, github }     |                             |
       |<-------------------------|                             |
       |                          |                             |
```

### 3.3 API Integration Points

We would expose the following integration-specific endpoints for Opentribe:

#### Initiate Verification (new endpoint)

```
POST /api/v1/verify/initiate
```

```json
{
  "type": "organization",
  "callbackUrl": "https://opentribe.com/api/webhooks/wisesama",
  "entity": {
    "walletAddress": "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu8CAkXe43PZ",
    "displayName": "Acala Foundation",
    "domain": "acala.network",
    "twitter": "AcalaNetwork",
    "githubOrg": "AcalaNetwork"
  }
}
```

**Response:**

```json
{
  "verificationId": "ver_abc123",
  "status": "pending",
  "steps": [
    { "field": "domain", "status": "pending", "instruction": "Add DNS TXT record: wisesama-verify=ver_abc123" },
    { "field": "twitter", "status": "pending", "instruction": "Tweet from @AcalaNetwork containing: wisesama-verify-ver_abc123" },
    { "field": "github", "status": "pending", "instruction": "Add wisesama-verify.txt to AcalaNetwork/.github repo" }
  ],
  "redirectUrl": "https://wisesama.com/verify/ver_abc123"
}
```

#### Check Verification Status (new endpoint)

```
GET /api/v1/verify/:verificationId/status
```

```json
{
  "verificationId": "ver_abc123",
  "status": "in_progress",
  "steps": [
    { "field": "domain", "status": "verified", "verifiedAt": "2026-03-25T12:30:00.000Z" },
    { "field": "twitter", "status": "verified", "verifiedAt": "2026-03-25T12:35:00.000Z" },
    { "field": "github", "status": "pending" }
  ],
  "onChain": {
    "identitySet": false,
    "judgementProvided": false,
    "txHash": null
  }
}
```

#### Webhook Callback (to Opentribe)

When verification completes, Wisesama POSTs to the callback URL:

```json
{
  "event": "verification.completed",
  "verificationId": "ver_abc123",
  "walletAddress": "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu8CAkXe43PZ",
  "status": "verified",
  "chain": "polkadot",
  "fields": {
    "domain": { "verified": true, "value": "acala.network" },
    "twitter": { "verified": true, "value": "AcalaNetwork" },
    "github": { "verified": true, "value": "AcalaNetwork" }
  },
  "onChain": {
    "identitySet": true,
    "judgement": "Reasonable",
    "registrarId": 5,
    "txHash": "0xabc123..."
  },
  "timestamp": "2026-03-25T13:00:00.000Z"
}
```

#### Batch Verification Status (new endpoint)

For Opentribe to check multiple addresses at once:

```
POST /api/v1/verify/batch/status
```

```json
{
  "addresses": [
    "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu8CAkXe43PZ",
    "1qnJN7FViy3HZaxZK9tGAA71zxHSBeUweirKqCaox4t8GT7"
  ]
}
```

```json
{
  "results": [
    {
      "address": "15oF4uVJwmo4TdGW7VfQxNLavjCXviqWrztPu8CAkXe43PZ",
      "hasIdentity": true,
      "isVerified": true,
      "displayName": "Acala Foundation",
      "verifiedBy": "wisesama",
      "judgement": "Reasonable"
    },
    {
      "address": "1qnJN7FViy3HZaxZK9tGAA71zxHSBeUweirKqCaox4t8GT7",
      "hasIdentity": false,
      "isVerified": false,
      "displayName": null,
      "verifiedBy": null,
      "judgement": null
    }
  ]
}
```

### 3.4 UX Options: Redirect vs. Embedded Widget

**Option A: Redirect Flow (recommended for v1)**
- Opentribe redirects to `wisesama.com/verify?address=...&callback=...`
- User completes verification steps on Wisesama
- Wisesama redirects back to Opentribe with result
- Lower integration effort, Wisesama handles all UX

**Option B: Embedded Widget (future)**
- Wisesama provides an iframe or web component: `<wisesama-verify address="..." />`
- Verification happens inline on Opentribe
- Higher integration effort, better UX
- Requires CORS and postMessage coordination

**Option C: API-Only (headless)**
- Opentribe builds its own verification UI
- Calls Wisesama API endpoints to initiate, check steps, finalize
- Maximum flexibility, maximum integration effort

---

## 4. Questions for the Opentribe Team

We want to design this integration around your existing data model and user experience. Here are the things we need to understand:

### Organization Data

1. **What verification do orgs have today?** Is everything self-reported, or do you verify anything (domain ownership, GitHub org membership, etc.)?
2. **What fields does an Opentribe org profile store?** We're assuming: name, domain, twitter, wallet address, GitHub org -- what else?
3. **How are wallet addresses stored?** On-chain reference, or just a text field in your database? Can an org have multiple addresses?
4. **Do you track treasury/multisig addresses for orgs?** Some Polkadot orgs manage funds via multisigs -- would those need verification too?

### User Data

5. **Do users link Polkadot wallets today?** If so, how -- via wallet extension (e.g., Polkadot.js, Talisman, SubWallet)?
6. **How are GitHub handles stored?** OAuth-verified or self-reported?

### Integration Preferences

7. **Would you prefer redirect flow or embedded widget?** (We recommend redirect for v1, widget as a later enhancement.)
8. **What data would you want back after verification?** Just a boolean `verified` / `not verified`? Or the full identity with all fields?
9. **Do you want real-time status updates** (webhooks) **or is polling acceptable?**

### Pilot

10. **Are there specific orgs you'd want us to verify first?** We could start with 5-10 W3F grant recipients that are on both platforms as a proof of concept.
11. **What's your release timeline?** This helps us prioritize registrar setup vs. API-only integration.

---

## 5. Technical Details

### 5.1 On-Chain Identity Costs

| Item | Cost | Notes |
|------|------|-------|
| Identity deposit | ~0.21 DOT (~$1) | Refundable when identity is cleared |
| Sub-identity deposit | ~0.053 DOT | Refundable |
| Registrar judgement fee | Configurable (0 - n DOT) | Wisesama plans to set this at 0 or near-0 |

The identity deposit on People Chain is roughly 100x lower than it was on the relay chain (dropped from ~20 DOT to ~0.21 DOT), making identity accessible to far more users and organizations.

### 5.2 Registrar Judgement Types

| Judgement | Meaning |
|-----------|---------|
| `Unknown` | Default, no judgement yet |
| `FeePaid` | Fee paid, awaiting review |
| `Reasonable` | Fields appear reasonable/correct (standard pass) |
| `KnownGood` | Strong verification, all fields confirmed (highest tier) |
| `OutOfDate` | Identity was once verified but is now stale |
| `LowQuality` | Fields set but minimal/low effort |
| `Erroneous` | Fields contain incorrect information |

Wisesama would primarily issue `Reasonable` (automated checks pass) and `KnownGood` (all fields verified including domain and social accounts).

### 5.3 People Chain RPC Endpoints

| Chain | Endpoint |
|-------|----------|
| Polkadot People Chain | `wss://polkadot-people-rpc.polkadot.io` |
| Kusama People Chain | `wss://kusama-people-rpc.polkadot.io` |

These are the canonical RPC endpoints. Wisesama also uses Subscan HTTP APIs as a faster/more reliable data source for serverless deployments, falling back to WebSocket RPC when needed.

### 5.4 Data Freshness

| Layer | TTL | Purpose |
|-------|-----|---------|
| Daily cron sync | 24 hours | Bulk sync of all identities from People Chain |
| Redis cache (identity) | 1 hour | Individual identity lookups |
| Redis cache (entity check) | 5 minutes | Full risk assessment responses |
| Redis cache (reverse lookup) | 30 minutes | GitHub/Twitter/domain -> address lookups |
| Live RPC fallback | Real-time | When DB data is stale or missing |

For the integration, verification status changes would be pushed via webhook immediately upon on-chain confirmation, so Opentribe would not need to rely on cache timing.

### 5.5 Authentication

Current API authentication options:

- **API Key** — Sent via `x-api-key` header. We would provision a dedicated key for Opentribe with appropriate rate limits.
- **Bearer token** — JWT-based, for user-authenticated requests.
- **Webhook signing** — Callbacks would be signed with a shared secret (HMAC-SHA256) so Opentribe can verify they came from Wisesama.

### 5.6 Rate Limits

Default rate limits are per API key or per IP. For a dedicated integration, we would set limits appropriate to Opentribe's usage patterns. Current defaults:

- 60 requests/minute for authenticated requests
- 10,000 requests/day per API key (configurable)

---

## 6. What We've Observed in the Identity Data

Some findings from our identity database that are relevant to how we scope this integration.

### 6.1 Chain Distribution

| Metric | Polkadot | Kusama |
|--------|----------|--------|
| Total identities | 2,929 | 4,567 |
| Sub-identities | 933 | 1,933 |
| Org-like identities | ~50 | ~64 |

Kusama has significantly more identities despite being the "canary network." Many developers and teams set identity on Kusama first (lower stakes, same process). Some have identity on both chains.

### 6.2 Field Usage

Most identities are sparse. From our data:

- `displayName` is set on nearly all identities (it's the primary field)
- `email` is set on a moderate number
- `twitter` and `web` are set on a subset, more common among projects/orgs
- `github` is in `info.additional`, not a first-class field -- it's significantly underused. We see it on a small fraction of identities.
- `discord` and `matrix` are similarly underused additional fields

**This is a key opportunity.** Many Polkadot developers have GitHub profiles but haven't linked them on-chain because `github` is an additional field (not part of the core identity struct). Our GitHub reverse lookup (`/api/v1/identity/github/:username`) currently matches against the identities that do have it set, but coverage is low.

If Opentribe users set identity through Wisesama, we'd ensure `github` is always included, which would improve the ecosystem's identity graph significantly.

### 6.3 Registrar Landscape

| ID | Registrar | Fee | Notes |
|----|-----------|-----|-------|
| 0 | Registrar #0 | Free | Active |
| 1 | Registrar #1 | Free | Active, most judgements |
| 2 | Registrar #2 | Free | Active |
| 3 | Registrar #3 | Free | Active |
| 4 | Registrar #4 | 0 DOT | Less active |
| 5 | (Open) | - | Wisesama target slot |
| 6 | Registrar #6 | Varies | Less active |

Current registrars are mostly manual -- verification takes days. Wisesama would be the first fully automated registrar, issuing judgements in minutes based on programmatic checks.

### 6.4 Organization-Like Identities

We've identified approximately 114 identities across both chains that appear to be organizations (foundations, DAOs, protocols, networks, labs) based on display name patterns and field completeness. These include:

- Protocol foundations (e.g., various Substrate-based chain foundations)
- DAOs and governance bodies
- Development labs and teams
- Infrastructure providers (validators, RPCs)

Many of these likely overlap with Opentribe's organization directory. Cross-referencing the two datasets would be a useful starting point.

---

## 7. Opentribe Responses & Updated Scope

### 7.1 Answers to Section 4 Questions

| # | Question | Answer |
|---|----------|--------|
| Q1 | Current org verification | Self-reported only. `isVerified` field exists but is always false except for platform-managed orgs. No domain/GitHub/wallet verification. |
| Q2 | Org fields | name, slug, logo, legalName, headline, description, industry[], twitter, github, linkedin, location, websiteUrl, email, isVerified, orgType (COMPANY/DAO/FOUNDATION/CURATOR_GROUP), managedByPlatform |
| Q3 | Wallet addresses | Orgs don't have wallet fields today. Ecosystem profiles have `walletAddresses: String[]` (SS58). No on-chain reference on orgs. |
| Q4 | Treasury/multisig | Not tracked. Some imported grants have `onChainRef` pointing to Subsquare proposals (grant, not org). |
| Q5 | User wallets | Better Auth supports SIWS (Substrate wallet signing). Plugin integrated but flow not live in production yet. 0 users have connected wallets. |
| Q6 | GitHub handles | OAuth-verified via Better Auth. `Account.providerId = "github"` with stable numeric user ID. |
| Q7 | Redirect vs widget | Redirect for v1. |
| Q8 | Data back | Full identity with all fields. Store: verified status, judgement type, registrar ID, tx hash, verified fields, Wisesama verification ID. |
| Q9 | Webhooks vs polling | Webhooks preferred. Opentribe already has API routes for callbacks. |
| Q10 | Pilot orgs | Web3 Foundation (already imported, managedByPlatform). Plus Kusama bounty curators (PoP, ZK, Art) if they have wallets. |
| Q11 | Timeline | Deploying imported data to dev this week. |

### 7.2 Implications for Integration Design

**Org wallet field needs to be added on Opentribe side.** Currently orgs don't have wallet addresses — Opentribe will add a wallet field to the Organization schema. This is a prerequisite for the verification flow.

**SIWS not yet live.** Wallet connection via Substrate wallet signing is integrated but not in production. The user verification flow depends on this being live. For v1, we can start with org verification (admin-initiated) while user wallet connection ships.

**GitHub is OAuth-verified.** Opentribe's GitHub handles are already verified via OAuth — stronger than self-reported. We can trust these and skip re-verification on the Wisesama side, instead using them for cross-referencing with on-chain `info.additional` data.

### 7.3 Branding & Attribution

All verification badges on Opentribe will display "Verified by Wisesama" with the Wisesama logo. This is not a white-label integration — Wisesama is credited as the verification provider, which builds brand recognition across the ecosystem.

### 7.4 Additional Requests from Opentribe

**1. GitHub Reverse Lookup Coverage**

Current coverage is low because `info.additional` is underused. Actions taken:
- Expanded key matching to include `github`, `gh`, `git`, `github.com` (case-insensitive)
- `GET /api/v1/identity/github/:username` returns matches with `matchedField: 'github'`
- Future: As Wisesama registrar processes more identities, GitHub coverage will grow organically

**2. Block Explorer URL Fix**

Fixed. The `/check` endpoint now returns SS58-formatted addresses in `links.blockExplorer` instead of hex public keys:
```
Before: https://polkadot.subscan.io/account/0xf6a27c9d...
After:  https://polkadot.subscan.io/account/16aP3oTaD7oQ6qm...
```

**3. Organization Classification Endpoint**

Proposed new endpoint:
```
GET /api/v1/identity/organizations?chain=polkadot&limit=50&page=1
```
Returns identities classified as organizations based on display name patterns (foundation, DAO, protocol, network, labs, treasury), field completeness, and sub-identity count. Useful for cross-referencing with Opentribe's org directory.

### 7.5 Production State Clarification

The identity sync was deployed and backfilled on March 25, 2026. The spec reflects the current production state:
- 7,496 identities synced and served from `api.wisesama.com`
- DB-first lookup: `/check` and `/identity` endpoints check the synced database before falling back to RPC
- Verified working: `GET /api/v1/check/15iA7kQMvuMwaCnbYj6TMwrMnErepL6Giu6Jo3H1JrN6hWzS` returns `hasIdentity: true, displayName: "PRIME", isVerified: true`

The earlier testing that showed 0/69 identities was done before the sync was deployed. The sync is now live and serving data.

---

## 8. Suggested Next Steps

1. **Opentribe adds wallet field to Organization schema** -- prerequisite for org verification flow.
2. **Cross-reference datasets** -- match Opentribe's imported org list against Wisesama's 114 org-like identities and 7,496 total identities.
3. **Pilot with W3F + bounty curators** -- verify Web3 Foundation org + Kusama bounty curators (PoP, ZK, Art) as first batch.
4. **Wisesama submits registrar proposal** on OpenGov (draft ready, General Admin track, 0 DOT fee).
5. **Build verification redirect flow (v1)** + webhook callback for Opentribe.
6. **Ship SIWS wallet connection on Opentribe** -- enables user-level identity verification.
7. **Add organization classification endpoint** on Wisesama API for Opentribe cross-referencing.

---

## Appendix: Existing API Documentation

Full API documentation with interactive explorer is available at:

**https://api.wisesama.com/docs**

This is an auto-generated Swagger/OpenAPI UI covering all public endpoints, request/response schemas, and error codes.

---

*This document is a starting point for discussion. All API shapes and flows described in Sections 2-3 are proposals -- the final design should reflect both teams' needs and constraints.*
