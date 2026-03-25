# Proposal: Wisesama as Automated Identity Registrar on Polkadot People Chain

**Author:** Yogesh Kumar ([@itsyogesh](https://github.com/itsyogesh))
**Date:** March 2026
**Status:** Draft / Pre-Discussion
**Track:** General Admin (OpenGov)
**Requested DOT:** 0 (no treasury spend)

---

## Summary

Wisesama proposes to become the next registrar on Polkadot People Chain, offering **free, automated identity verification** with a built-in fraud detection layer.

- **What:** Register Wisesama as a new registrar on People Chain via `identity.addRegistrar`
- **Why:** The ecosystem needs more active registrars. W3F Registrar #0 shut down in April 2024. Registrar #2 stopped accepting requests in January 2026. Manual verification by remaining registrars takes days or weeks. Identity adoption remains low despite the deposit dropping ~100x after migration to People Chain.
- **How:** Programmatic verification of social accounts (Twitter/X, GitHub, domain via DNS, email) combined with cross-referencing against phishing databases and behavioral risk scoring before issuing judgements
- **Fee:** 0 DOT (free verification, consistent with multiple existing registrars)
- **Who:** Built by Yogesh Kumar, W3F grant recipient, builder of [Relaycode](https://relaycode.org) and contributor to [Opentribe](https://opentribe.xyz)

---

## Motivation

### The registrar landscape is shrinking

Polkadot's identity system depends on registrars to verify that the information users put on-chain is accurate. The current state of registrars on People Chain is concerning:

| Registrar | Operator | Fee | Status |
|-----------|----------|-----|--------|
| #0 | W3F | Prohibitive | **Shut down** April 2024. Fee set to maximum to prevent new requests. |
| #1 | Chevdor | 20 DOT | Active, but manual verification and high fee discourages adoption |
| #2 | (Unknown) | - | **Stopped accepting** new requests January 2026 |
| #3 | Polkassembly | 0.5 DOT | Active |
| #4 | PolkaIdentity | 0.5 DOT | Active |
| #5 | ECH0.RE (dotid.app) | 0 DOT | Active |

Web3 Foundation explicitly stated their shutdown was motivated by a commitment to decentralization -- they wanted the community to step up and run registrar services rather than relying on a foundation-operated one ([source](https://medium.com/web3foundation/web3-foundation-will-shut-down-the-w3f-registrar-registrar-0-on-both-polkadot-and-kusama-1d03c5c258a0)). Wisesama aims to answer that call.

### Identity adoption is extremely low

Despite identity deposits dropping approximately 100x after migration from the Relay Chain to People Chain (from ~20 DOT to ~0.20 DOT), adoption has not followed. Wisesama currently tracks **7,496 identities** across Polkadot and Kusama People Chains (2,929 on Polkadot, 4,567 on Kusama). For a network with hundreds of thousands of active addresses, this is a fraction of what it could be.

The barriers are not financial anymore -- they are about **tooling and turnaround time**. Users need:
1. A clear, user-friendly way to set their identity (not Polkadot-JS Apps)
2. Fast verification -- minutes, not days
3. Confidence that their registrar is reliable and will not shut down

### Fraud detection is missing from the registrar layer

Current registrars verify that you own a Twitter account or a domain. They do not check whether the identity you are claiming is associated with known scam operations, phishing domains, or addresses flagged in community databases. Wisesama adds this layer -- cross-referencing identities against the polkadot-js/phishing database, VirusTotal scans, and behavioral risk scoring before issuing a judgement.

---

## What Wisesama Offers as Registrar

### Automated social verification

- **Twitter/X:** Verify handle ownership via bio content check or signed message
- **GitHub:** Verify account ownership via gist creation or repository file
- **Domain:** Verify ownership via DNS TXT record (e.g., `wisesama-verify=<challenge>`)
- **Email:** Verify ownership via confirmation link with signed token
- **Matrix/Element:** Verify via DM-based challenge-response

### Fraud detection cross-reference

Before issuing a positive judgement, Wisesama runs the identity through its existing analysis pipeline:

- **Blacklist lookup:** Check the address against the [polkadot-js/phishing](https://github.com/polkadot-js/phishing) database (addresses and domains)
- **VirusTotal scan:** If the identity includes a web domain, scan it against 70+ antivirus engines
- **Look-alike detection:** Check display names and handles against known ecosystem entities using Levenshtein distance to detect impersonation attempts (e.g., `@polkadoot` pretending to be `@polkadot`)
- **ML risk scoring:** Run the address through Wisesama's behavioral risk engine, which evaluates 21+ features including account age, transaction patterns, counterparty diversity, dust transaction ratio, and interactions with known fraud addresses
- **Community reports:** Check against user-submitted fraud reports in Wisesama's database

This is a capability no other registrar currently offers. A registrar that not only verifies "you own this Twitter account" but also checks "this Twitter account is not associated with known scam operations" is a meaningful improvement for the ecosystem.

### Fast turnaround

Automated verification completes in minutes, not days. The entire flow -- from requesting judgement to receiving it on-chain -- targets sub-5-minute completion for straightforward cases.

### Free judgements

0 DOT fee. Identity verification should not be a cost barrier. This is consistent with ECH0.RE (Registrar #5), which also charges 0 DOT.

### Identity management UI

Wisesama is building a user-friendly web interface at [wisesama.com](https://wisesama.com) for:
- Setting on-chain identity (replacing the Polkadot-JS Apps workflow)
- Requesting judgement from any registrar
- Viewing verification status and history
- Managing sub-identities

### Open source

The entire Wisesama codebase is public at [github.com/itsyogesh/wisesama](https://github.com/itsyogesh/wisesama). The registrar verification engine, fraud detection pipeline, and identity sync service are all open for community audit.

---

## About the Team

### Yogesh Kumar ([@itsyogesh](https://github.com/itsyogesh))

Full-stack Polkadot developer and W3F grant recipient. Active in the Polkadot ecosystem since 2023.

**Projects:**

- **[Wisesama](https://wisesama.com)** -- Polkadot fraud detection and identity platform. Live at api.wisesama.com, serving identity data for 7,496 synced identities across both People Chains. Runs 6 parallel analysis engines: ML risk scoring, identity verification, look-alike detection, blacklist/whitelist lookup, VirusTotal scanning, and transaction graph analysis.

- **[Relaycode](https://relaycode.org)** ([GitHub](https://github.com/itsyogesh/relaycode)) -- Type-aware extrinsic builder for Polkadot. A dual-pane interface that lets developers construct extrinsics with human-readable forms on one side and live SCALE-encoded hex on the other. Built on Dedot with runtime type introspection. Discussed on the [Polkadot Forum](https://forum.polkadot.network/t/relaycode-type-aware-extrinsic-builder-for-polkadot/17226).

- **Opentribe integration** -- Collaborating with the Opentribe team on an integration spec ([docs/opentribe-integration-spec.md](https://github.com/itsyogesh/wisesama/blob/main/docs/opentribe-integration-spec.md)) to bring on-chain identity verification and fraud detection to Opentribe's organization and contributor profiles. Both projects are W3F grant recipients building complementary infrastructure.

All projects are open source.

---

## Technical Architecture

### Current infrastructure (live)

Wisesama's backend is already operational and handles the data layer needed for registrar operations:

```
wisesama.com (Next.js web app)
    |
api.wisesama.com (Fastify API)
    |
    +-- Identity Sync Service
    |     - Queries identity.identityOf.entries() on People Chains
    |     - Upserts 7,496 identities into PostgreSQL
    |     - Daily cron via QStash
    |     - Handles Polkadot + Kusama People Chains
    |
    +-- Phishing Sync Service
    |     - Syncs polkadot-js/phishing address.json + all.json
    |     - Normalizes addresses to hex public keys for cross-chain matching
    |     - Categorizes threats: PHISHING, SCAM, FAKE_AIRDROP, RUG_PULL, IMPERSONATION
    |
    +-- Query Service (6 parallel engines)
    |     - Blacklist/whitelist lookup
    |     - On-chain identity + judgement check
    |     - Look-alike detection (Levenshtein)
    |     - ML behavioral risk scoring
    |     - VirusTotal domain scanning
    |     - Transaction graph analysis (via Subscan)
    |
    +-- Reverse Lookup Service
    |     - Find on-chain addresses by Twitter handle, domain, or GitHub username
    |
    +-- GitHub Contribution Service
    |     - Auto-creates PRs to polkadot-js/phishing when reports are verified
    |
    +-- Admin Dashboard
          - Report triage, whitelist management, identity browsing
          - Contribution tracking for upstream phishing list
```

### Registrar-specific additions (to be built)

```
Registrar Engine (new)
    |
    +-- Judgement Request Watcher
    |     - Subscribe to identity.judgementRequested events on People Chain
    |     - Queue verification tasks for incoming requests
    |
    +-- Verification Pipeline
    |     - Twitter: bio/pinned tweet challenge verification
    |     - GitHub: gist/repo file challenge verification
    |     - Domain: DNS TXT record check
    |     - Email: signed confirmation link
    |     - Matrix: DM challenge-response
    |
    +-- Fraud Check Gate
    |     - Run all existing Wisesama analysis engines
    |     - Block judgement if address/domain is flagged
    |     - Flag for manual review if risk score > threshold
    |
    +-- Judgement Submitter
          - Construct and sign identity.provideJudgement extrinsic
          - Submit via People Chain RPC
          - Record judgement in database with full audit trail
```

### On-chain interaction

The registrar account will:
1. Listen for `identity.JudgementRequested` events targeting our registrar index
2. Fetch the identity fields from `identity.identityOf(account)`
3. Run the verification pipeline + fraud check
4. Submit `identity.provideJudgement(regIndex, target, judgement)` via a signed extrinsic

---

## Judgement Policy

### Judgement types

| Judgement | Criteria | Automation |
|-----------|----------|------------|
| **Reasonable** | At least 2 of the following confirmed: (1) display name matches social profiles, (2) domain ownership verified via DNS TXT record, (3) Twitter/X handle verified, (4) GitHub profile verified, (5) email verified | Fully automated |
| **KnownGood** | All verifiable fields confirmed + manual review for high-profile entities (validators, council members, organizations) | Semi-automated + manual |
| **Erroneous** | Identity is found in phishing databases, associated with known scam operations, or contains provably false claims | Automated with manual confirmation |
| **LowQuality** | Identity fields are present but cannot be verified (e.g., unresolvable domain, protected Twitter account, no verifiable fields) | Automated |

### Revocation policy

- If a previously verified identity is later found in the polkadot-js/phishing database or flagged via Wisesama's community reporting system, the judgement will be updated to **Erroneous**
- Daily re-checks of verified identities against updated phishing lists
- Community can report identities through Wisesama's reporting interface, triggering manual review

### Transparency

- All judgement decisions will be logged with full reasoning in Wisesama's database
- A public dashboard will show verification statistics, average turnaround time, and recent judgements
- Judgement criteria and thresholds will be documented and open for community feedback

---

## Requested Registrar Parameters

| Parameter | Value |
|-----------|-------|
| **Account** | TBD -- Wisesama's dedicated Polkadot People Chain address (to be published before referendum) |
| **Fee** | 0 DOT |
| **Fields** | All standard fields: display, legal, web, riot/matrix, email, twitter. Additional fields (github, discord) parsed from `info.additional` |

### OpenGov details

- **Track:** General Admin -- this is the required origin for `identity.addRegistrar` calls, consistent with previous registrar proposals (Polkassembly Ref #23, PolkaIdentity Ref #1192)
- **Extrinsic:** `identity.addRegistrar(account)` on People Chain, executed via XCM from the Relay Chain's General Admin origin
- **Submission deposit:** ~42 DOT (refundable)
- **Decision deposit:** Origin-dependent (General Admin track)

---

## Prior Art: Previous Registrar Proposals

This proposal follows a well-established governance path. The following registrar proposals have been submitted and approved through Polkadot's governance system:

| Proposal | Registrar | Track | Status | Reference |
|----------|-----------|-------|--------|-----------|
| Polkassembly Registrar | Registrar #3 | General Admin | **Approved** (Ref #23) | [polkadot.polkassembly.io/referenda/23](https://polkadot.polkassembly.io/referenda/23) |
| PolkaIdentity Registrar | Registrar #4 | General Admin | **Approved** (Ref #1192) | [polkadot.polkassembly.io/referenda/1192](https://polkadot.polkassembly.io/referenda/1192) |
| ECH0.RE Registrar | Registrar #5 | General Admin | **Approved** (Ref #1803) | [polkadot.subsquare.io/referenda/1803](https://polkadot.subsquare.io/referenda/1803) |
| PolkaIdentity (Kusama) | Registrar #6 | General Admin | **Approved** (Ref #418) | [kusama.polkassembly.io/referenda/418](https://kusama.polkassembly.io/referenda/418) |
| Polkaregistry | - | Discussion | Draft only | [polkadot.polkassembly.io/post/362](https://polkadot.polkassembly.io/post/362) |

### Lessons from previous proposals

- **W3F Registrar #0:** Operated from genesis until April 2024. Provided automated verification via a challenger bot ([github.com/w3f/polkadot-registrar-challenger](https://github.com/w3f/polkadot-registrar-challenger)) and watcher ([github.com/w3f/polkadot-registrar-watcher](https://github.com/w3f/polkadot-registrar-watcher)). Shut down to promote decentralization. Wisesama's approach is inspired by W3F's automated design but adds fraud detection.

- **PolkaIdentity (Ref #1192):** Successfully argued that automated verification reduces turnaround from days to minutes. Wisesama shares this philosophy and extends it with fraud detection capabilities.

- **Polkaregistry (Discussion #362):** Proposed using Estonia's eID program for real-world identity verification. Interesting approach but limited to jurisdictions with compatible eID programs. Wisesama focuses on social account verification, which is accessible globally.

- **ECH0.RE (dotid.app):** Demonstrates community appetite for free, accessible registrar services. Approved with 0 DOT fee.

---

## Roadmap

| Phase | Milestone | Target |
|-------|-----------|--------|
| **Phase 1** | Community discussion and feedback on this proposal | Q2 2026 |
| **Phase 2** | Submit OpenGov referendum for registrar approval | Q2 2026 |
| **Phase 3** | Deploy automated verification engine (Twitter, GitHub, domain, email) | Q2-Q3 2026 |
| **Phase 4** | Launch public identity management UI on wisesama.com | Q3 2026 |
| **Phase 5** | Organization verification flow (multisig/DAO accounts) | Q3 2026 |
| **Phase 6** | Opentribe integration -- ecosystem-wide identity verification for organizations and contributors | Q4 2026 |
| **Phase 7** | Kusama People Chain registrar (separate proposal) | Q4 2026 |

---

## Sustainability

Wisesama does not request treasury funding for registrar operations. The service is funded by:

1. **W3F grant** -- covers initial development
2. **Planned premium services** -- enterprise API access, priority verification for organizations, bulk verification for parachain teams
3. **Ecosystem partnerships** -- integration with Opentribe and other ecosystem platforms

Free verification for individual users will remain free indefinitely. The registrar service itself will not be gated behind any paid tier.

---

## FAQ

**Q: Why should the community trust a new registrar?**
A: Wisesama is fully open source, built by a W3F grant recipient with a track record in the Polkadot ecosystem (Relaycode, Opentribe collaboration). The fraud detection layer actually makes Wisesama a _more_ thorough registrar than existing options. All judgement decisions are logged with full reasoning and available for community audit.

**Q: What happens if Wisesama stops operating?**
A: The registrar can be removed via another General Admin referendum, exactly as W3F Registrar #0 was handled. Existing judgements remain on-chain. Because the code is open source, the community can fork and operate the service independently.

**Q: How is this different from existing registrars?**
A: Three key differences: (1) fraud detection before judgement -- no other registrar cross-references against phishing databases and runs behavioral risk scoring, (2) fully automated end-to-end pipeline with no manual bottleneck, (3) companion identity management UI that replaces the Polkadot-JS Apps workflow.

**Q: Will Wisesama provide judgements for Kusama too?**
A: Kusama registrar approval requires a separate governance proposal on Kusama. This is planned for Phase 7 (Q4 2026) after the Polkadot registrar is operational and proven.

**Q: What is the expected verification throughput?**
A: The automated pipeline can handle hundreds of verification requests per day. There is no manual bottleneck for standard verifications. Complex cases (organization accounts, disputed identities) are queued for manual review.

---

## References

- Wisesama: [wisesama.com](https://wisesama.com) | [GitHub](https://github.com/itsyogesh/wisesama)
- Wisesama API: [api.wisesama.com](https://api.wisesama.com)
- Relaycode: [relaycode.org](https://relaycode.org) | [GitHub](https://github.com/itsyogesh/relaycode)
- Relaycode Forum Post: [forum.polkadot.network/t/relaycode-type-aware-extrinsic-builder-for-polkadot/17226](https://forum.polkadot.network/t/relaycode-type-aware-extrinsic-builder-for-polkadot/17226)
- W3F Grants Program: [grants.web3.foundation](https://grants.web3.foundation/) | [GitHub](https://github.com/w3f/Grants-Program)
- W3F Registrar Shutdown Announcement: [medium.com/web3foundation](https://medium.com/web3foundation/web3-foundation-will-shut-down-the-w3f-registrar-registrar-0-on-both-polkadot-and-kusama-1d03c5c258a0)
- W3F Registrar Challenger (open source): [github.com/w3f/polkadot-registrar-challenger](https://github.com/w3f/polkadot-registrar-challenger)
- W3F Registrar Watcher (open source): [github.com/w3f/polkadot-registrar-watcher](https://github.com/w3f/polkadot-registrar-watcher)
- polkadot-js/phishing database: [github.com/polkadot-js/phishing](https://github.com/polkadot-js/phishing)
- Polkadot People Chain docs: [docs.polkadot.com/polkadot-protocol/architecture/system-chains/people/](https://docs.polkadot.com/polkadot-protocol/architecture/system-chains/people/)
- Polkadot Identity Wiki: [wiki.polkadot.com/learn/learn-identity/](https://wiki.polkadot.com/learn/learn-identity/)
- OpenGov Origins & Tracks: [wiki.polkadot.network/docs/learn-polkadot-opengov-origins](https://wiki.polkadot.network/docs/learn-polkadot-opengov-origins)
- PolkaIdentity: [polkaidentity.com](https://www.polkaidentity.com/) | [Forum](https://forum.polkadot.network/t/polkaidentity-a-friendly-on-chain-identity-service/9702)
- Polkassembly Registrar Ref #23: [polkadot.polkassembly.io/referenda/23](https://polkadot.polkassembly.io/referenda/23)
- PolkaIdentity Registrar Ref #1192: [polkadot.polkassembly.io/referenda/1192](https://polkadot.polkassembly.io/referenda/1192)
- ECH0.RE Registrar Ref #1803: [polkadot.subsquare.io/referenda/1803](https://polkadot.subsquare.io/referenda/1803)
- Polkaregistry Discussion: [polkadot.polkassembly.io/post/362](https://polkadot.polkassembly.io/post/362)
- PolkaIdentity Discussion: [polkadot.polkassembly.io/post/2394](https://polkadot.polkassembly.io/post/2394)

---

*This proposal is a draft for community discussion. Feedback is welcome before formal referendum submission. Please comment here or reach out to [@itsyogesh](https://github.com/itsyogesh).*
