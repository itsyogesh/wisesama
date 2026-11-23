# Wisesama v2 operator sources and failed work

Implemented under `/api/v1/intel/admin`, separate from Dotsama's crypto administrator routes. These records and controls are private to a live, unsuspended `User.intelAdmin` account. Existing `User.role=ADMIN` is insufficient. Core administrator middleware supplies the uncached session/database permission check; mutations require JSON and an approved Wisesama app Origin.

## Source controls

`GET /sources` returns `{items,checkedAt}`. Items have `id`, `name`, `purpose`, `url`, `paused`, `revision`, `health`, `lastAttemptAt`, `lastSuccessAt`, `lastError`, and `updatedAt`. Missing rows display the default enabled/unknown state without probing an upstream. The registry is fixed to `osv`, `github`, `kev`, and `epss`. GitHub covers both reviewed and malware advisory feeds. There is no arbitrary URL, credential, or custom source editor.

`PATCH /sources/:id` accepts `{paused,expectedRevision,reason}`. A reason must contain 20–1000 trimmed characters. The service rechecks the actor inside its transaction, claims the current revision, and appends `source.pause` or `source.resume` to `IntelAdminAudit` with targetType `source`. Concurrent changes return 409. No audit event is appended for a rejected revision.

The production intelligence provider checks source policy before both outbound requests and warm-cache reuse. Paused OSV causes assessment to fail and retain previous findings. Paused CISA KEV or EPSS leaves enrichment unavailable/unknown; existing affirmative exploitation evidence remains protected by the workspace merger. Paused GitHub makes live public refresh unavailable, so the workspace uses its explicitly stale persisted records. Pausing stops future source reads; it does not cancel a request already in flight.

Health is derived from an actual bounded network attempt plus semantic response validation. A cache hit does not advance attempt/success timestamps. Result writes bind to the latest recorded attempt and do not overwrite a paused source. `lastSuccessAt` is the actual successful attempt's timestamp, not the time an operator opened the screen. Responses are limited to 12MB, requests time out after 15 seconds, and redirects are rejected. Errors are bounded and safe; raw provider responses and customer package lists are not stored in source controls.

To check a source, enqueue `source_refresh` with the source ID and a reason. The probe bypasses the payload cache and validates the expected response shape. OSV exercises querybatch using the fixed public documentation sample `PyPI/jinja2@2.4.1`, never a customer's inventory. GitHub checks one reviewed and one malware response; CISA validates its catalogue identifiers; EPSS requests the fixed public CVE-2021-44228 sample and validates the probability. A probe is an API health observation, not a vulnerability assessment or availability guarantee. [OSV querybatch documentation](https://google.github.io/osv.dev/post-v1-querybatch/) specifies the request/response shape.

## Durable jobs

`IntelAdminJob` records durable intent, current state, attempts, safe error, actor/reason, target, and timing. `IntelAdminJobAttempt` retains the outcome of each run. Supported explicit jobs:

| Kind | Target | Operation |
| --- | --- | --- |
| `source_refresh` | Fixed source ID | Run the source's bounded probe. |
| `feed_refresh` | Omitted | Refresh public advisories and require a complete nonstale source result. |
| `repository_sync` | Repository source ID | Sync the owner's selected immutable inventory and continuing baseline; a remaining baseline failure is a failed/partial outcome. |
| `project_assessment` | Project ID | Assess the exact saved package inventory. |
| `private_delivery` | Private delivery ID | Retry that failed/unavailable record through the existing consent/idempotency processor. |
| `public_delivery` | Public digest delivery ID | Retry that failed/unavailable record through the existing confirmed-subscription processor. |
| `feedback_reconcile` | Signed feedback event ID | Reconcile that pending event with its send receipt; missing receipt remains failed/pending. |

`POST /jobs` accepts `{kind,targetId?,reason}` and returns `{job,deduplicated}`. It queues intent; HTTP 200 does not mean the work ran. A unique active kind/target key prevents duplicate queued/running work. Enqueue and its audit event share a transaction, and the actor is rechecked in that transaction.

`POST /jobs/:id/run` accepts `{}` and runs one queued, due job. A lease/attempt claim and attempt record are written atomically. Both the requesting administrator and the job's original actor must still have access. Only the winning claim invokes the operation. Execution failures return a job with `status:'failed'` and a safe error; the frontend must inspect the returned job state rather than treating HTTP 200 as success.

`POST /jobs/:id/retry` accepts `{reason,expectedUpdatedAt}`. It supports failed jobs of the listed kinds, within ten attempts. It revalidates the target and actor, claims the expected update timestamp, returns the job to queued, and audits the change. It preserves old attempt records. A conflicting active target or changed revision returns409. Scheduled-stage summaries are not directly retryable; operators recover their exact failed targets or enqueue an explicit supported source/feed action.

`GET /jobs` accepts optional `status`, `kind`, `q`, `cursor`, and `limit` (1–50, default25), returning `{items,nextCursor}` in stable descending-ID order. `GET /jobs/:id` returns `{job,attempts}`. Job DTOs expose neither lease tokens nor raw work payloads. The job fields are `id,kind,targetId,actorId,reason,status,attempts,error,createdAt,updatedAt,nextAttemptAt,startedAt,finishedAt,retryable`; attempts expose `attempt,status,error,startedAt,finishedAt`.

The existing signed `/jobs/security-response` endpoint runs a bounded three queued operator jobs and records repository, assessment, and public digest scheduler stages. Stage summaries detect actual nested failed/unavailable statuses and explicit public mail failure counters. Consent/editorial skips do not masquerade as failed mail. Unhandled stage failures are retained while later stages can still run. The production schedule is not activated by this implementation.

Expired ten-minute worker leases are marked failed with an explicit warning that the target may have completed. They are never automatically replayed. Target state must be inspected before an explicit retry. A missing/revoked queued actor prevents privileged execution, marks the queued intent failed, releases its active target key, and records `job.blocked`. An authorized operator can then review the target and explicitly retry with a new reason; a revoked intent cannot remain stuck blocking that target indefinitely.

## Existing failed work and safe recovery

`GET /failures` returns `{items,limit:100}`, bounded to the latest 20 records per category: repository sync/configuration baseline errors, project assessment errors, private mail failures, public digest failures, and pending feedback with a recorded error. Each item has `id,kind,targetId,label,ownerLabel,error,failedAt,retryable,blockedReason`. Owner labels are identifiers, not credentials. This is a bounded recovery index; durable administrator run history is separately paginated.

Every retry checks current target existence and permissions. Suspended/missing owners, paused/disconnected repositories, paused sources, or inactive/unconfirmed email preferences block recovery until the appropriate owner/configuration change occurs. A mail retry never changes consent, confirms an address, reactivates a suppressed subscriber, resends a sent record, or retries a record with a provider message ID. The processor still rechecks preferences immediately before attempting delivery.

Manual mail recovery also respects [Resend's 24-hour idempotency retention](https://resend.com/docs/dashboard/emails/idempotency-keys). Older ambiguous transport failures are blocked using a conservative 20-hour creation cutoff. Known never-sent unavailable records or explicit HTTP4xx rejection may remain eligible. An exhausted delivery attempt counter may be reset only for an eligible exact record, with an audited previous count and unchanged provider event/idempotency key. The job rechecks eligibility after rereading the record and uses a conditional update so it cannot seize another worker's active claim. No arbitrary recipient, body, provider message ID, or idempotency-key override is accepted.

The user/advisory/subscription management contract and operator bootstrap are documented separately in `ADMIN-API-CONTRACT.md`. The new schema is additive; apply it only through the existing migration baseline/release process. Tests use synthetic providers/mail transports and isolated records, with no production scheduler, grants, or sends.
