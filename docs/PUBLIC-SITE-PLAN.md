# Proposed public site and product entry points

Status: implemented in the local build, with deployment gates below. Public pages, provider flows, verified subscriptions and read-only public MCP exist in code and have local verification evidence. External provider authorization, real email delivery, production scheduling, legal/operator details and domain cutover have not been completed. This document retains the original product rationale; setup instructions and exact contracts in REPOSITORY-SETUP.md, repository-api-contract.md and PUBLIC-DELIVERY.md take precedence over proposed details below.

V2 platform administration is also implemented locally at `/admin`, with independent operator access, user suspension, advisory curation, fixed source controls, stop-only subscription management, durable job recovery and audit history. See [admin setup](./ADMIN-SETUP.md) and [verification](./ADMIN-VERIFICATION.md). It is excluded from public indexing and navigation; production grants and schedules remain deployment work.

## Confirmed direction

- Serve small software teams, retaining Wisesama's dark purple/pink identity and a corresponding light theme.
- GitHub is a launch requirement for project onboarding and continuing inventory management. Include GitLab.com; self-managed GitLab is outside the first launch.
- Let people subscribe to public feed updates through a verified email address without creating an account.
- Keep public feed subscriptions distinct from private project alerts. Following security news must not grant access to a repository or project.

The recommended product promise is **understand which sourced advisories match your software, then keep the response and its evidence together**. The free feed earns discovery; repository-aware response is the reason to connect a project. Avoid a generic “all cybersecurity news” positioning.

## Current implementation boundary

`apps/intel` currently has account access, manual inventory review, live exact npm/PyPI matching, source-health evidence, a response inbox, finding history, public briefings and RSS entry pages. Projects are owned by one user. The local build does not establish a production refresh schedule or real email delivery.

Repository connections, public email subscriptions and public read-only MCP are implemented in the local build. Workspace membership/roles, paid billing and private agent scopes are not implemented. Public-site copy and pricing must not describe these as available before their release gates pass. Connecting a repository does not prove that its packages are deployed; a response closure remains a user attestation.

## Route map

Use public pages on the main origin and a distinct `/app` area for authenticated work. This route separation is implemented in apps/intel; it does not perform a domain cutover.

| Surface | Proposed route | Primary task |
| --- | --- | --- |
| Homepage | `/` | Understand the product and start a repository assessment |
| Product | `/product` | See how inventory, evidence, alerts and response join together |
| Feed | `/feed` | Read and filter sourced updates; subscribe by email or RSS |
| Advisory | `/feed/:id` | Read dates, affected software, evidence, changes and source guidance |
| Public subscription | `/subscribe/confirm`, `/subscribe/manage` | Confirm an address; change topics or unsubscribe without an account |
| GitHub integration | `/integrations/github` | Understand permissions, setup, synchronization and disconnect behavior |
| GitLab integration | `/integrations/gitlab` | Understand the GitLab.com support and its actual synchronization method |
| Guides | `/guides`, `/guides/:slug` | Complete a practical security-response task |
| Agents | `/agents` | Understand supported agent access and its data/permission boundaries |
| Developer reference | `/docs`, `/docs/api`, `/docs/rss`, `/docs/mcp` | Use tested interfaces; install only capabilities that are actually live |
| Pricing | `/pricing` | Compare confirmed entitlements; publish amounts after the billing decision |
| Trust and legal | `/security`, `/privacy`, `/terms` | Understand real data handling, permissions and published terms |
| Authentication | `/sign-in`, `/sign-up` | Access a private workspace; preserve the intended destination |
| Workspace | `/app/inbox`, `/app/projects`, `/app/projects/new` | Assess and manage projects |
| Project and finding | `/app/projects/:id`, `/app/findings/:id` | See connection freshness, inventory and the recorded response |
| Workspace settings | `/app/settings/integrations`, `/app/settings/notifications` | Manage provider access, sync and private alert delivery |

Preserve existing links: redirect current `/briefings` and `/briefings/:id` to their canonical feed equivalents; retain the existing public API RSS URL and add a convenient `/feed.xml` alias. Redirect existing private `/projects`, `/findings/:id` and `/notifications` bookmarks to the app routes. Do not move the old crypto app or its domain as a side effect of this route plan.

Recommended public header: **Product · Feed · Guides · Agents · Pricing**, with **Sign in** and **Connect a repository**. Put dedicated integration pages under Product and in the footer. Inside the app, keep the response inbox and projects central; use Feed for the same public intelligence surface rather than creating a second competing news destination.

## Homepage narrative

1. Lead with the repository-aware job and one concrete product screenshot. Primary action: connect a repository. Secondary action: browse the free feed. Label any screenshot's synthetic project data.
2. Explain the complete sequence: choose a repository and inventory → assess exact versions → inspect severity and exploitation evidence separately → record the response and verification evidence.
3. Demonstrate a single sourced finding: installed package, advisory, source timestamps, evidence/unknowns and the next assessment step. Do not invent a customer incident, detection rate, response-time claim or protection guarantee.
4. Explain continuing coverage: inventory revision/commit, last successful synchronization, advisory refresh, significant changes and visible failures. Describe only the provider behavior that has been implemented and measured.
5. Show GitHub and GitLab.com as integrations with explicit permissions and supported files. State that dependency matching does not establish deployment or reachability.
6. Offer a small, dated selection of public feed entries and verified email subscription. Keep this useful independently of account creation.
7. Show agents/API/RSS as separate ways to consume the same evidence. Display availability honestly; there is no install button or executable MCP example until the endpoint works.
8. Finish with the repository action, a concise scope FAQ, and data-handling links.

Use current Wisesama typography and assets. The operational interface supplies the product proof; a new stock cybersecurity visual language is unnecessary.

## Feed and public email subscription

The feed needs a clear distinction between advisory severity, evidence of exploitation and editorial priority. A “critical” label must not silently mean all three. Initially filter by search, severity, exploitation evidence and ecosystem, with visible source and collection status. Add filtered RSS links only once the server applies the same filters as the page.

Advisory pages should distinguish published, source-updated and last-checked times; these do not establish the date an attack began. Use a stable advisory identity and change history. Deduplicate aliases and repeated refreshes. A new collection timestamp alone should not create a new email-worthy event.

Proposed subscription lifecycle:

1. Choose email and topics/cadence on the public feed. Explain what will be sent and link the privacy policy.
2. Return a neutral “check your email” result without disclosing whether an address is already subscribed.
3. Open an expiring, single-use confirmation link, then confirm with an explicit action. An ordinary GET from an email scanner must not activate the subscription. No updates are sent before confirmation.
4. Show the active preferences and a browser-readable example edition. Cadence and urgency rules must be explicit and match the actual scheduler.
5. Deliver meaningful new advisories or material changes according to those preferences, with deterministic deduplication and recorded provider results.
6. Include account-free preference management and unsubscribe in every edition. Use protected management links; implement mail-client one-click unsubscribe separately rather than letting a scanner's ordinary GET unsubscribe someone.
7. Handle expired confirmation, resend throttling, delivery failure, bounce, complaint and unsubscribe states. Suppress future sends after opt-out.

Do not reuse the private account-notification flag as the public subscriber record. A subscriber may later create an account, but public preferences and private project alerts remain separate choices. Store confirmation/management token hashes, avoid exposing email addresses in URLs, and never log token values.

## Guides and reference

Launch with task-specific guides rather than a large generic blog:

- **Connect and maintain:** connect GitHub, connect GitLab.com, choose inventory files in a monorepo, recover lost repository access or failed synchronization.
- **Understand an assessment:** supported inventories and ecosystems; severity versus CVSS/KEV/EPSS; inventory matches versus deployed exposure; source freshness and outages.
- **Respond:** investigate a finding, follow vendor guidance, record mitigation or verification evidence, resolve and reopen, understand what closure means.
- **Consume updates:** email preferences and unsubscribe, RSS, the public API, and agent/MCP setup only when available.

Keep conceptual guides under `/guides`; keep exact configuration, authentication, API shapes and troubleshooting under `/docs`. Cross-link them, with one canonical explanation for each concept. A feed item is the changing security record; a guide is the stable explanation of how to use it.

## Agents and MCP

The `/agents` page should explain two access levels: public intelligence and authorized private project evidence. Suggested public read tools are `search_advisories` and `get_advisory`. A later private scope can support `list_projects`, `list_findings`, `get_finding` and `get_inventory_status` after account/workspace authorization is implemented. These names are proposed contracts, not existing tools.

Keep the first MCP release read-only and enforce that behavior server-side; tool annotations are hints, not authorization. Do not automatically close findings, write patches, create pull requests or run advisory-provided commands. Tool output should carry source URLs, relevant timestamps, unknowns and scope limits. Treat upstream advisory text as data, not agent instructions.

The installation page must list tested clients/protocol versions, the actual endpoint, access scopes, token storage guidance, revoke/disconnect instructions and working examples. Do not pass a GitHub/GitLab provider token to the agent as Wisesama authentication. The official MCP authorization guidance requires tokens intended for the MCP resource and disallows unvalidated token passthrough; implementation should pin a supported protocol/SDK version before publishing copyable setup. See the [MCP authorization specification](https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization) and [maintainer security considerations](https://modelcontextprotocol.io/docs/2026-07-28/tutorials/security/security_best_practices).

Until an actual server exists, the Agents page may describe the proposed capability and link to the working API/RSS documentation, clearly marking MCP as planned. A documentation page alone is not an MCP integration.

## Free and paid boundaries to decide

Keep public advisory evidence, the public feed, RSS and a useful verified-email subscription free. Include repository connection and a complete first-project assessment in the free activation path; a must-have integration should not become a dead-end demo.

Paid value can come from broader project coverage, higher assessed-package or refresh limits, richer routing and delivery controls, longer audit history, workspace collaboration and authorized private-agent access. The free repository workflow should remain usable for ongoing assessment within clearly stated limits; it should not become an unexplained stale one-off scan. These are proposed product boundaries, not entitlements to publish yet. Prices, project limits, cadence, retention and team seats need explicit decisions and cost validation. The current user-owned schema does not support a “shared team workspace” claim.

## Release order and gates

| Order | Deliverable | Required proof before its public promise |
| --- | --- | --- |
| 1 | GitHub-backed project workflow and GitLab.com flow | Selected-repository access, exact commit/inventory provenance, successful refresh, changed inventory handling, failures/revocation/disconnect; no claim of deployed verification |
| 2 | Public/app route separation and truthful product/integration pages | Existing bookmarks and RSS entry links still work; account redirects preserve intent; no private data appears in public pages |
| 3 | Free feed subscriptions | Confirmation, actual scheduled edition, deduplication, preference change, unsubscribe and failure suppression verified against the real provider |
| 4 | Homepage, initial guides and trust pages | Every CTA leads to a complete working path; supported features and data-handling statements match the build |
| 5 | MCP implementation and agent setup reference | Actual read tools, scoped authorization, client compatibility and revoke flow tested; no provider-token passthrough |
| 6 | Paid expansion | Workspace/entitlement model, limits, billing and cancellation behavior agreed and implemented before purchase controls appear |

Phases may be developed in parallel; describe each capability as available after its release evidence is in place. Provider registration, a real email test, billing setup and the domain cutover remain deployment work, rather than completed outcomes of this brief.

## Inspected public-site reference direction

[GitHub security hero](https://mobbin.com/sites/sections/e13b3db1-e2f8-454a-ad67-dc3516dbcd45) places a security outcome beside product-interface evidence. Borrow product proof as the focal material, with Wisesama's self-service repository action rather than its sales-demo actions; do not copy floating panels or its visual styling. [1Password Developer](https://mobbin.com/sites/sections/9e2a1671-1d4d-4b23-bf11-476ae27af70d) provides a concrete developer entry and nearby quickstart, useful for structuring the Agents/Guides entry. Neither reference establishes Wisesama's supported integrations, clients or security guarantees.

The email implementation should follow the sender/receiver separation in [RFC 8058](https://www.rfc-editor.org/rfc/rfc8058): account-free visible preference management and a separate mail-client one-click unsubscribe mechanism. This is an implementation requirement, not a claim that delivery infrastructure is already verified.
