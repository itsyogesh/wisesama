# Security review and remediation — 5 November 2026

The scoped standard audit using the official Cloudflare security-audit skill is complete. Cloudflare did not conduct or endorse this review. Its immutable pre-fix source, coverage ledger, structured findings and three reports are retained outside the checkout at `/private/tmp/wisesama-security-audit/run-1`.

The original audit covered 248 units: 203 covered, 38 linked to candidates, four blocked by deployment facts and three out of scope. Fourteen distinct claims received independent validation; eleven remained needs-validation and three were rejected. None met the demonstrated-result bar for a confirmed vulnerability. Needs-validation records have no severity. No compatible prior audit ledger existed. Native Node was unavailable in the audit's approved isolated runner, and effective ingress, provider grants and browser deployment behavior were not assumed.

These original records remain historical. Later development regressions do not silently promote their verdicts. The user authorized source fixes, so all eleven surviving paths were repaired or removed from the default launch surface, alongside useful reliability changes.

| Source path or concern | Applied control | Verification |
| --- | --- | --- |
| Shared usage mail and retained public mail | Escape dynamic HTML text/attributes; encode link IDs. Usage alerts require verified recipient ownership. | Template regressions and verified/unverified usage cases. |
| Ambient session mutations | Shared exact trusted-Origin and JSON requirement; production origins exclude HTTP/loopback. | HTTP guard cases, actual missing-origin rejection; preserved key deletion caller updated to JSON. |
| Request status privacy | Detailed status requires a live verified account and matches its current stored email. Public duplicates omit another request ID. | Signed-out, unverified, unrelated, stale-email and owner cases. |
| Retired whitelist trust | Active predicate at fresh read and cache reuse; refresh derived labels after provider work. | Retired, cached, renamed, reactivated, provider-delay and failed-revalidation cases. |
| Session revocation | Disable cookie caching and explicitly bypass it in shared authentication. | Actual sign-out, stored-row deletion and rejection of the originally issued cookie. |
| Scheduler configuration | Both signing slots required before lazy verification; either configured slot activates the gate, including Twitter. | Partial-pair and verification-failure cases; no authorization-token construction. |
| Legacy mention checkpoint | Durable bounded descending window; preserve unprocessed suffixes; ownership-fenced progress and release. | Twelve polling cases plus the six real Redis Lua scripts. Provider history limits and possible duplicate in-flight inserts remain explicit. |
| YAML composition | Disable pairwise key uniqueness scanning; bounded per-map Set validation of resolved string keys before extraction/conversion. | Inventory, CI, baseline and bundled checker cases. This does not establish a bound on every parser CPU path. |
| Browser framing | Intel document routes send `frame-ancestors 'none'` and `X-Frame-Options: DENY`. | Source review and actual local served headers. Effective production ingress remains a deployment check. |
| Public subscription request privacy | Configured request failures retain the same neutral response; keep cooldown and invalidate failed links when possible. | Thirty-six HTTP privacy cases. This is status/body consistency, not a constant-time claim. |
| Queued digest consent and request-mail suppression | Final row-lock eligibility check and synchronous transport start; await provider response outside the transaction; fence delivery outcomes and preserve independent receipts. | Twenty interleaving cases and actual PostgreSQL opt-out/suppression tests. Already-started provider calls cannot be recalled. |
| Default launch surface and diagnostics | Dotsama routes load only with `DOTSAMA_API_ENABLED=true`; hash limiter key identifiers and centrally redact capability paths. | Independent source review, production bundles and redaction tests. The retained product remains in the repository. |

Three fresh focused reviewers checked a sanitized immutable remediated snapshot. They found a legacy key-deletion compatibility gap, next-only Twitter key handling and request-mail suppression timing. Those were fixed and independently rechecked. A native download check additionally found a CLI no-op through aliased parent directories; canonical entrypoint handling and a regression fixed it. All three final source-review dispositions are pass, with execution/deployment limits recorded.

The final reviewed runtime snapshot is `source-remediated-2`, 524 files, SHA-256 `f9e838b6ad06cff59a635b6dbbc07de72d51f093953a0b2a290861075063ef18`. Only documentation and captured walkthrough evidence were added afterward. The free unpublished MIT checker is version 0.1.2; exact archive facts and development check results are in `CI-ORG-VERIFICATION.md`.

Before a live launch, register and configure the real GitHub/GitLab integrations, apply the organization migration to the intended database, and inspect effective production origin/proxy/frame headers and scheduler configuration. Those external steps were not performed here. This review does not certify production, deep legacy chain algorithms, or the complete transitive dependency tree.
