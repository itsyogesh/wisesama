# ML & Risk Scoring Architecture

> Comprehensive documentation of Wisesama's fraud detection and risk assessment system

## Overview

Wisesama uses a **multi-layered risk assessment system** that combines:

1. **Deterministic Rules** - Blacklist/whitelist lookups with instant verdicts
2. **Heuristic Scoring** - Rule-based ML analysis of on-chain behavior patterns
3. **External Intelligence** - VirusTotal domain scanning, community reports
4. **Identity Verification** - On-chain identity and registrar judgements

The system is designed to be **explainable** - every risk score comes with the specific factors that influenced it.

---

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              CHECK REQUEST FLOW                                  │
└─────────────────────────────────────────────────────────────────────────────────┘

    Input: "155dDX3rWoNsY4aiJFbsu6wLB91c2J2Ws5BgMfJKyM1eGnkS"
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  1. ENTITY DETECTION & NORMALIZATION                                            │
│     ├── Detect type: ADDRESS (SS58 format detected)                             │
│     ├── Detect chain: Polkadot (prefix 0)                                       │
│     └── Normalize: 0xb477d42ac66fb36b2e5d1c53f8b1530de94c3cfe7a666ea5d6c72c... │
└─────────────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  2. CACHE CHECK (Redis, 5-min TTL)                                              │
│     └── Key: entity:ADDRESS:0xb477d42ac66fb36b2e5d1c53...                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                            │
              ┌─────────────┴─────────────┐
              │     CACHE MISS            │
              ▼                           ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  3. PARALLEL DATA FETCHING                                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                 │
│  │   DATABASE      │  │  POLKADOT RPC   │  │   SUBSCAN API   │                 │
│  │   LOOKUPS       │  │                 │  │                 │                 │
│  ├─────────────────┤  ├─────────────────┤  ├─────────────────┤                 │
│  │ • Blacklist     │  │ • Identity      │  │ • Account info  │                 │
│  │ • Whitelist     │  │ • Judgements    │  │ • Transfers     │                 │
│  │ • Look-alike    │  │ • Social links  │  │ • Balance       │                 │
│  └────────┬────────┘  └────────┬────────┘  └────────┬────────┘                 │
│           │                    │                    │                          │
│           ▼                    ▼                    ▼                          │
│  ┌─────────────────────────────────────────────────────────────────┐           │
│  │                    AGGREGATED DATA                               │           │
│  └─────────────────────────────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  4. ML FEATURE EXTRACTION (SubscanService)                                      │
│     └── Extract 21 behavioral features from on-chain data                       │
└─────────────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  5. RISK SCORING (MLService)                                                    │
│     ├── Apply weighted heuristic rules                                          │
│     ├── Calculate confidence score                                              │
│     └── Generate recommendation                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│  6. FINAL RISK CALCULATION (QueryService)                                       │
│     └── Combine all signals with priority hierarchy                             │
└─────────────────────────────────────────────────────────────────────────────────┘
                            │
                            ▼
                    RESPONSE + CACHE
```

---

## Data Sources

### 1. Polkadot-JS Phishing List (Primary Blacklist)

**Source:** https://github.com/polkadot-js/phishing

| Endpoint | Data |
|----------|------|
| `polkadot.js.org/phishing/address.json` | Malicious addresses (~280) |
| `polkadot.js.org/phishing/all.json` | Malicious domains (~53,000) + Allow list (~30) |

**Service:** `PhishingSyncService`

**Processing:**
- Addresses normalized to hex public keys (chain-agnostic)
- Threat categories assigned: PHISHING, SCAM, RUG_PULL, IMPERSONATION, FAKE_AIRDROP
- Synced via QStash CRON or manual trigger

**Impact:** Instant FRAUD verdict (riskScore: 95)

### 2. Subscan API (On-Chain Data)

**Service:** `SubscanService`

**Endpoints Used:**
```
POST https://polkadot.api.subscan.io/api/v2/scan/search
POST https://polkadot.api.subscan.io/api/v2/scan/transfers
```

**Data Retrieved:**

| Data Point | Source | Usage |
|------------|--------|-------|
| Account balance | `/scan/search` | Activity indicator |
| Nonce (tx count) | `/scan/search` | Transaction volume |
| Identity flag | `/scan/search` | Quick identity check |
| Display name | `/scan/search` | Identity validation |
| Recent transfers | `/scan/transfers` | Behavioral analysis |

**Timeout:** 10 seconds

### 3. Polkadot RPC (Identity Verification)

**Service:** `PolkadotService`

**RPC Endpoints:**
- Polkadot: `wss://rpc.polkadot.io`
- Kusama: `wss://kusama-rpc.polkadot.io`

**Data Retrieved:**
- Identity fields (display, legal, email, twitter, web, riot)
- Registrar judgements
- Verification status

**Caching:** Redis, 1-hour TTL

**Impact:** Verified identity = LOW_RISK (riskScore: 20)

### 4. VirusTotal (Domain Scanning)

**Service:** `VirusTotalService`

**API:** `https://www.virustotal.com/api/v3/domains/{domain}`

**Data Retrieved:**
- Analysis stats from 80+ AV engines
- Malicious/suspicious/clean counts
- Top detections with engine names

**Verdict Logic:**
| Verdict | Condition |
|---------|-----------|
| `malicious` | >= 3 malicious OR >= 5 total detections |
| `suspicious` | 1-4 detections |
| `clean` | 0 detections |
| `unknown` | Not in VT database |

**Timeout:** 15 seconds

### 5. Community Reports

**Source:** User submissions via `/api/v1/reports`

**Impact:** >= 3 verified reports = CAUTION (riskScore: 60)

### 6. Whitelist

**Source:** Admin-managed verified entities

**Categories:** exchange, wallet, validator, governance, infrastructure, foundation

**Impact:** Instant SAFE verdict (riskScore: 5)

---

## ML Feature Extraction

The system extracts **21 behavioral features** from on-chain data:

### Account Metadata Features

| Feature | Type | Description |
|---------|------|-------------|
| `accountAgeHours` | number | Hours since first transaction |
| `hasIdentity` | boolean | Has on-chain identity registered |

### Transaction Pattern Features

| Feature | Type | Description |
|---------|------|-------------|
| `totalTransactions` | number | Total transaction count |
| `avgTransactionsPerDay` | number | Average daily tx frequency |
| `uniqueCounterparties` | number | Unique addresses interacted with |
| `inboundOutboundRatio` | number | Ratio of received/sent transactions |

### Value Pattern Features

| Feature | Type | Description |
|---------|------|-------------|
| `avgTransactionValue` | number | Average transaction amount |
| `maxTransactionValue` | number | Maximum transaction amount |
| `totalVolumeUsd` | number | Total volume in USD (requires price feed) |

### Timing Pattern Features

| Feature | Type | Description |
|---------|------|-------------|
| `avgTimeBetweenTx` | number | Average seconds between transactions |
| `hasRegularPattern` | boolean | Detects bot-like timing (CV < 0.3) |
| `isActiveNow` | boolean | Activity in last 7 days |

### Risk Indicator Features

| Feature | Type | Description |
|---------|------|-------------|
| `knownFraudInteractions` | number | Transactions with known fraud addresses |
| `exchangeInteractions` | number | Transactions with exchanges |
| `dustTransactions` | number | Very small transactions (< 0.001) |

### Feature Computation

```typescript
// Regular Pattern Detection (Bot Behavior)
const timeDiffs = transfers.map((t, i) => t.timestamp - transfers[i+1].timestamp);
const mean = avg(timeDiffs);
const stdDev = sqrt(avg(timeDiffs.map(d => (d - mean)²)));
const coefficientOfVariation = stdDev / mean;
const hasRegularPattern = coefficientOfVariation < 0.3; // Low variance = bot

// Counterparty Diversity
const counterparties = new Set([...froms, ...tos]);
const diversityRatio = counterparties.size / totalTransactions;

// Dust Detection
const dustCount = transfers.filter(t => parseFloat(t.amount) < 0.001).length;
const dustRatio = dustCount / totalTransactions;
```

---

## Risk Scoring Algorithm

### Scoring Philosophy

The ML service uses a **weighted heuristic scoring** approach:

```
Base Score: 50 (neutral)
     │
     ├── Risk factors increase score toward 100
     │
     └── Trust factors decrease score toward 0

Final Score = clamp(baseScore + Σ(factor.score × factor.importance), 0, 100)
```

### Risk Factors

| Factor | Score | Importance | Condition |
|--------|-------|-----------|-----------|
| **Account Age** |
| New account (< 24h) | +30 | 0.90 | `accountAgeHours < 24` |
| Recent account (< 1 week) | +15 | 0.70 | `24 ≤ hours < 168` |
| Account < 1 month | +5 | 0.40 | `168 ≤ hours < 720` |
| Established (> 1 year) | -15 | 0.80 | `hours > 8760` |
| Account > 6 months | -8 | 0.60 | `4380 < hours ≤ 8760` |
| **Identity** |
| Has on-chain identity | -20 | 0.95 | `hasIdentity = true` |
| No on-chain identity | +10 | 0.50 | `hasIdentity = false` |
| **Transaction Volume** |
| Minimal transactions (< 3) | +15 | 0.60 | `txCount < 3` |
| Active (> 100 transactions) | -10 | 0.70 | `txCount > 100` |
| Moderate activity (20-100) | -5 | 0.50 | `20 < txCount ≤ 100` |
| **Behavioral Patterns** |
| Low counterparty diversity | +25 | 0.85 | `ratio < 0.1 & txCount > 10` |
| High counterparty diversity | -10 | 0.70 | `ratio > 0.5` |
| Regular timing (bot) | +20 | 0.80 | `hasRegularPattern = true` |
| High tx frequency (> 50/day) | +15 | 0.70 | `avgTxPerDay > 50` |
| **Dust Transactions** |
| High dust ratio (> 50%) | +20 | 0.75 | `dustRatio > 0.5 & txCount > 5` |
| Some dust transactions | +8 | 0.40 | `dustRatio > 0.2` |
| **Fund Flow** |
| High inbound ratio (> 10:1) | +15 | 0.60 | `inboundOutbound > 10` |
| High outbound ratio (< 0.1:1) | +20 | 0.70 | `inboundOutbound < 0.1` |
| **External Signals** |
| Known fraud interactions | +35 | 0.95 | `fraudInteractions > 0` |
| Exchange interactions | -8 | 0.50 | `exchangeInteractions > 0` |
| **Activity** |
| Recently active + established | -5 | 0.40 | `age > 720h & active in 7d` |

### Effective Impact Calculation

```
Effective Impact = Score × Importance

Example: "New account" factor
  Score: +30, Importance: 0.90
  Effective Impact: +27 points toward risk
```

### Recommendation Thresholds

| Score Range | Recommendation | Description |
|-------------|----------------|-------------|
| 0-29 | `safe` | Low risk, likely legitimate |
| 30-69 | `review` | Moderate risk, manual review recommended |
| 70-100 | `high_risk` | High risk, likely fraudulent |

---

## Confidence Calculation

Confidence reflects data completeness:

```typescript
const importantFields = [
  'accountAgeHours',
  'hasIdentity',
  'totalTransactions',
  'uniqueCounterparties',
  'hasRegularPattern',
  'dustTransactions'
];

const completeness = availableFields / importantFields.length;
const txBoost = Math.min(0.2, totalTransactions / 500);

confidence = (completeness × 0.8) + txBoost + 0.1;
// Range: 0.1 (no data) to 1.0 (complete data + high tx count)
```

---

## Risk Priority Hierarchy

When calculating the final risk assessment, signals are evaluated in priority order:

```
┌─────────────────────────────────────────────────────────────────┐
│  PRIORITY 1: WHITELIST                                          │
│  └── If whitelisted → SAFE (score: 5)                          │
├─────────────────────────────────────────────────────────────────┤
│  PRIORITY 2: BLACKLIST                                          │
│  └── If in polkadot-js-phishing → FRAUD (score: 95)            │
├─────────────────────────────────────────────────────────────────┤
│  PRIORITY 3: LOOK-ALIKE DETECTION                               │
│  └── If similarity > 0.7 to trusted handle → CAUTION (score: 70)│
├─────────────────────────────────────────────────────────────────┤
│  PRIORITY 4: COMMUNITY REPORTS                                  │
│  └── If reports >= 3 → CAUTION (score: 60)                     │
├─────────────────────────────────────────────────────────────────┤
│  PRIORITY 5: VERIFIED IDENTITY                                  │
│  └── If isVerified → LOW_RISK (score: 20)                      │
├─────────────────────────────────────────────────────────────────┤
│  PRIORITY 6: HAS IDENTITY                                       │
│  └── If hasIdentity → UNKNOWN (score: 40)                      │
├─────────────────────────────────────────────────────────────────┤
│  PRIORITY 7: DEFAULT                                            │
│  └── UNKNOWN (score: null, use ML score if available)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Response Structure

### ML Analysis Response

```json
{
  "mlAnalysis": {
    "available": true,
    "riskScore": 72,
    "confidence": 0.85,
    "recommendation": "high_risk",
    "topFeatures": [
      {
        "name": "newAccount",
        "description": "Account is less than 24 hours old",
        "score": 30,
        "importance": 0.9
      },
      {
        "name": "lowCounterpartyDiversity",
        "description": "Low diversity in transaction counterparties",
        "score": 25,
        "importance": 0.85
      },
      {
        "name": "regularPattern",
        "description": "Transactions show regular timing (potential bot)",
        "score": 20,
        "importance": 0.8
      }
    ],
    "features": {
      "accountAgeHours": 12,
      "hasIdentity": false,
      "totalTransactions": 45,
      "uniqueCounterparties": 3,
      "avgTransactionsPerDay": 90,
      "hasRegularPattern": true,
      "dustTransactions": 12,
      "inboundOutboundRatio": 0.05
    }
  }
}
```

### Transaction Summary Response

```json
{
  "transactionSummary": {
    "totalReceived": "1234.5678",
    "totalSent": "1200.0000",
    "balance": "34.5678",
    "lastActivityAt": "2025-01-15T10:30:00Z"
  }
}
```

### VirusTotal Response (Domains)

```json
{
  "virusTotal": {
    "scanned": true,
    "verdict": "malicious",
    "stats": {
      "malicious": 5,
      "suspicious": 2,
      "undetected": 70,
      "harmless": 3
    },
    "lastAnalysisDate": "2025-01-14",
    "topDetections": [
      { "engine": "CLEAN MX", "result": "phishing" },
      { "engine": "Kaspersky", "result": "malware" }
    ]
  }
}
```

---

## Services Reference

| Service | File | Purpose |
|---------|------|---------|
| `MLService` | `services/ml.service.ts` | Risk scoring algorithm |
| `SubscanService` | `services/subscan.service.ts` | On-chain data extraction |
| `PolkadotService` | `services/polkadot.service.ts` | Identity verification via RPC |
| `VirusTotalService` | `services/virustotal.service.ts` | Domain security scanning |
| `PhishingSyncService` | `services/phishing-sync.service.ts` | Blacklist synchronization |
| `LevenshteinService` | `services/levenshtein.service.ts` | Impersonation detection |
| `QueryService` | `services/query.service.ts` | Orchestrates all lookups |

---

## Environment Variables

### Required for ML Features

```bash
# Subscan API (required for ML analysis)
SUBSCAN_API_KEY=your-subscan-api-key

# VirusTotal (optional, for domain scanning)
VIRUSTOTAL_API_KEY=your-vt-api-key

# Polkadot RPC (for identity verification)
POLKADOT_RPC=wss://rpc.polkadot.io
KUSAMA_RPC=wss://kusama-rpc.polkadot.io
```

---

## Limitations & Future Improvements

### Current Limitations

| Limitation | Impact | Potential Solution |
|------------|--------|-------------------|
| `knownFraudInteractions` always 0 | Cannot detect fraud associations | Cross-reference with blacklist during feature extraction |
| `exchangeInteractions` always 0 | Cannot verify exchange transactions | Maintain exchange address list |
| `totalVolumeUsd` always 0 | No USD value analysis | Integrate price feed (CoinGecko) |
| Limited to 100 transfers | Incomplete history | Paginated fetching for deep analysis |
| Rule-based, not ML | Limited pattern detection | Train actual ML model on fraud data |

### Planned Improvements

- [ ] Graph analysis for transaction clustering
- [ ] Temporal pattern detection (time-of-day analysis)
- [ ] Cross-chain fraud correlation
- [ ] Real ML model trained on labeled fraud dataset
- [ ] USD value-based risk factors
- [ ] Exchange address whitelist integration

---

## Testing Risk Scenarios

```bash
# Known fraud address (should return FRAUD)
curl http://localhost:3001/api/v1/check/155dDX3rWoNsY4aiJFbsu6wLB91c2J2Ws5BgMfJKyM1eGnkS

# Verified identity address (should return LOW_RISK)
curl http://localhost:3001/api/v1/check/13UVJyLnbVp77Z2t6r2dFKqddAo3cATaBG6YMuEsWbbmFivP

# Malicious domain (should return FRAUD via blacklist + VT)
curl http://localhost:3001/api/v1/check/polkadot-airdrop.xyz

# Clean domain (should return SAFE via whitelist)
curl http://localhost:3001/api/v1/check/polkadot.network
```
