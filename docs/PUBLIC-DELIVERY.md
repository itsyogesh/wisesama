# Public subscriptions and agent access

Implemented in the API; production mail/provider setup, scheduling and endpoint publishing remain deployment work. These services never read private project inventories and do not reuse account notification preferences.

## Public email lifecycle

API base: `/api/v1/intel/subscriptions`. JSON requests use `Content-Type: application/json`.

| Method and path | Input | Behavior |
| --- | --- | --- |
| `GET /capabilities` | None | `emailAvailable`, `cadence: "daily"`, `sendHourUtc: 9` |
| `POST /request` | `{email, topics?}` | Neutral `202` after requesting a consent or management email |
| `POST /confirm` | `{token}` | Explicit one-time consent; no GET can activate updates |
| `POST /manage/request` | `{email}` | Neutral `202`; send a protected management link if eligible |
| `POST /manage/read` | `{token}` | Read public subscription status/topics; never returns the email address |
| `PATCH /manage` | `{token, topics}` | Change topics for an active confirmed subscription |
| `POST /unsubscribe` | `{token}` | Accept an unexpired management token or an unsubscribe-only signature |
| `POST /one-click/:token` | URL-encoded `List-Unsubscribe=One-Click` | Mail-client one-click unsubscribe; ordinary GET returns `405` |
| `POST /webhooks/resend` | Original signed Resend body | Verify feedback and suppress bounced/complaining subscribers |

Topics are a nonempty array chosen from `all`, `npm`, `PyPI`, `known_exploited`. Multiple specific topics are ORed; `all` includes everything in the current public feed. Cadence is daily at 09:00 UTC when the scheduler runs; it is not an instant exploit-alert service. No edition is sent on days without matching material changes. The feed is a bounded selection, not an exhaustive vulnerability database.

Configuration required for public email availability:

- `PUBLIC_SUBSCRIPTION_SECRET`: at least 32 random characters, stable across deploys, used only for unsubscribe signatures. Keep secret. Rotation invalidates prior signed unsubscribe URLs; management email requests still work.
- `RESEND_API_KEY`, `RESEND_FROM_EMAIL`: use a verified sending domain.
- `INTEL_APP_URL`: public browser origin; `API_URL`: public API origin. Use HTTPS in production.
- `RESEND_WEBHOOK_SECRET`: signed-feedback secret, required for bounce/complaint processing. Subscribe the provider endpoint to `email.bounced` and `email.complained`. Receipt IDs are retained for both consent/management and digest mail so a forged address in a payload cannot suppress someone else.

All confirmation and management capabilities are generated from 32 random bytes and stored as hashes. Consent links expire after one hour and can be consumed once; management links expire after 30 days. Links put the capability in the browser fragment so the token is not sent in a page GET or Referer. The browser must retain it locally only for the requested flow. Requesting signup for an already active subscriber sends a management link; an anonymous request cannot silently replace their topics. A five-minute per-address claim limits resends. Suppressed addresses do not reactivate through the signup form.

`publicSubscriptionService.runDailyDigest(limit)` captures material public-feed changes and compiles bounded batches of confirmed subscribers due at or after 09:00 UTC. Call it from the authenticated/signed scheduler job every few minutes, allowing batches to drain. There is no schedule created by this implementation. The next compilation time is advanced in the same transaction that creates the deterministic subscriber/day delivery. A provider idempotency key makes a retried edition the same send. Retries use a byte-stable body; preference management first emails a fresh protected link from the management page. Each edition contains an account-free visible unsubscribe action plus RFC 8058 headers. Signature-only unsubscribe tokens cannot read an address, read preferences or subscribe someone.

An unchanged collection time, source modification timestamp or EPSS fluctuation does not create an edition. Title, summary, affected ranges/fixes, source references, severity and affirmative known-exploitation changes do. Multiple changes for one advisory within an edition collapse to its latest version. An edition includes up to 30 matching entries, points to the public feed when there are more, and explains that public news is not a project/deployment assessment. Each job reads at most 1,000 events per due subscriber. Delivery status `sent` means provider acceptance; it does not prove inbox placement or readership. Failed/unavailable messages retry up to five claims with bounded exponential delay. Unsubscribing or suppression skips queued messages; an external provider call already in progress cannot be recalled.

Do not log capability URLs or request bodies. The one-click route uses silent Fastify logging. Configure any outer access proxy to redact `/subscriptions/one-click/*`. Expired token records are removed after a one-day grace period. Public subscribers, event history and delivery receipts persist until an operator applies a documented retention policy; no automatic full account-free data-deletion promise is published by this code.

Signed bounce/complaint feedback is durably recorded as pending before looking up its provider message ID. A provider can send feedback before its send response or local receipt has been recorded; acknowledgement does not discard that event. Receipt persistence, successful digest sends and scheduled jobs attempt reconciliation. An atomic transaction suppresses the matched subscriber and marks feedback processed; unmatched IDs remain pending with retry backoff and a `pendingFeedback` count in job results. Monitor that count and the ledger `lastError`. If a provider accepted a message but its HTTP response/receipt was lost, an operator must recover the provider ID-to-send association before suppression can be attributed safely. Never treat a still-pending event as processed or infer ownership from an arbitrary address field. The migration labels pre-existing acknowledgement-only ledger rows `legacy`; those rows lack the provider message IDs needed to reconstruct pending feedback.

Reference: [RFC 8058 one-click unsubscribe](https://www.rfc-editor.org/rfc/rfc8058), [Resend raw-body signature verification](https://resend.com/docs/webhooks/verify-webhooks-requests).

## Public MCP endpoint

`POST /api/v1/mcp` implements a small read-only Streamable HTTP server, using JSON responses. It exposes only:

- `search_advisories`: `{q?, severity?, exploited?: boolean, ecosystem?: "npm" | "PyPI", limit?: 1..50}`; default limit 20. Returns source health, collection freshness, bounded results and scope.
- `get_advisory`: `{id: "CVE-…" | "GHSA-…" | other supported advisory identifier}`; returns one public source record or a recoverable tool error.

No provider token is needed or accepted as an authorization requirement. This endpoint cannot access private projects, close findings, execute commands or write changes. It has no private scope. Read-only annotations describe the tools; the server enforces the boundary by having no write tools or private-service path. Advisory content remains untrusted source data and must not be interpreted as agent instructions. Package matching and known-exploitation evidence do not establish deployed exposure or reachability.

The supported protocol versions are `2026-07-28` and legacy `2025-11-25`. Both require `Accept: application/json, text/event-stream`. Browser requests with an Origin must match the configured Wisesama origin; local development also permits its loopback app origins. Non-browser clients may omit Origin. GET and DELETE return `405`, and the server does not mint sessions, open standalone SSE streams, or provide legacy HTTP+SSE endpoints.

### Modern 2026-07-28 request

Every request contains protocol metadata and matching headers. The `Mcp-Name` header is also required for `tools/call`. The server implements `server/discover`, `tools/list`, `tools/call` and `ping`. Modern results carry `resultType: "complete"` and server identity metadata. This command works against the local verification API once its route is registered:

```sh
curl http://localhost:3001/api/v1/mcp \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json, text/event-stream' \
  -H 'MCP-Protocol-Version: 2026-07-28' \
  -H 'Mcp-Method: tools/call' \
  -H 'Mcp-Name: search_advisories' \
  --data '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"search_advisories","arguments":{"ecosystem":"npm","limit":5},"_meta":{"io.modelcontextprotocol/protocolVersion":"2026-07-28","io.modelcontextprotocol/clientCapabilities":{},"io.modelcontextprotocol/clientInfo":{"name":"wisesama-example","version":"1"}}}}'
```

Missing metadata, mismatched mirrored headers and unsupported protocol versions are rejected before a tool calls its source. The endpoint bounds requests to 64 KiB. It does not trust a client name or prior connection as authorization.

### Legacy 2025-11-25 compatibility

Clients implementing that published revision can first `initialize`, then send `notifications/initialized`, then list or call tools. No server session is allocated; subsequent requests carry `MCP-Protocol-Version: 2025-11-25`.

```json
{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"wisesama-example","version":"1"}}}
```

```json
{"jsonrpc":"2.0","method":"notifications/initialized"}
```

```json
{"jsonrpc":"2.0","id":2,"method":"tools/list"}
```

The tests exercise these HTTP/JSON-RPC contracts with Fastify injection, including modern metadata, legacy initialization, Origin checks, header mismatch, public-only tools and source failures. No named desktop agent client has yet been independently verified; do not publish a claim that all MCP clients are supported. Replace the local endpoint with the actual published HTTPS API origin only after deployment verification.

Official sources checked on 2026-11-04: [current transport](https://modelcontextprotocol.io/specification/2026-07-28/basic/transports/streamable-http), [current discovery](https://modelcontextprotocol.io/specification/2026-07-28/server/discover), [tools](https://modelcontextprotocol.io/specification/2026-07-28/server/tools), [legacy transport](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports), [legacy lifecycle](https://modelcontextprotocol.io/specification/2025-11-25/basic/lifecycle).
