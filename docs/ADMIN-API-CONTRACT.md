# Wisesama v2 admin API

Base: `/api/v1/intel/admin`. This is distinct from Dotsama `/admin/*` endpoints. The frontend is a dedicated `/admin` experience in `apps/intel`.

Every route requires a noncached Better Auth session, an unexpired matching database session, a live `User.intelAdmin=true`, and no v2 suspension. Dotsama's `role=ADMIN` does not grant access. Every write additionally requires JSON and an `Origin` exactly matching the configured `INTEL_APP_URL`; non-production allows `http://localhost:3003` and `http://127.0.0.1:3003`. No account privilege grants, impersonation, hard deletion, forced confirmation or reactivation exist in this UI. Use the operator bootstrap process for privilege changes.

Responses use the existing root `{data,meta}` wrapper. Errors are `{error:string}`: 401 for missing/revoked session, 403 for missing v2 permission/invalid Origin, 404 unknown target, 409 stale revision or prohibited action, 400 invalid fields. Every private read/write response is no-store. The service independently rechecks the actor inside mutation transactions.

## Lists and timestamps

Core list query: `q?` (max150), `cursor?` (opaque), `limit?` (default20,max50). Stable ordering is timestamp DESC then ID DESC; `createdAt` except advisory `fetchedAt`. Each list returns `{items:[],nextCursor:string|null}`. Search and filter changes reset the cursor. Timestamps are ISO strings; absent timestamps are null. Arrays within detail views are bounded; they are recent diagnostic records, not complete exports.

## Session and overview

- `GET /session`: `{user:{id,email,name:null},access:'intel_admin'}`. No role/security flags are accepted from a client.
- `GET /overview`: `{users:{total,suspended},advisories:{total,hidden},subscriptions:{active,pending,suppressed,unsubscribed},recentAudit:AdminAudit[]}`. These counts describe shared account identities with v2-only controls, stored advisories, and public subscriptions.

## Users

- `GET /users?q=&status=active|suspended&cursor=&limit=` -> list of `AdminUser`.
- `GET /users/:id` -> `{user:AdminUser,projects:ProjectSummary[],deliveries:DeliverySummary[],audit:AdminAudit[]}`.
- `PATCH /users/:id/access` body `{suspended:boolean,expectedRevision:number,reason:string}` -> updated detail. Self changes and all `intelAdmin` target changes return 409. Suspension affects Wisesama v2 access/background work; Dotsama access and shared identity records remain intact.

`AdminUser`: `{id,email,name,emailVerified,intelAdmin,status:'active'|'suspended',suspendedAt:string|null,suspensionReason:string,revision:number,createdAt,updatedAt,projectCount:number,connectionCount:number}`.

`ProjectSummary`: `{id,name,environment,lastScannedAt:string|null,scanError:string|null}`. No package inventories, repository credentials, provider identities, auth accounts, session tokens or private response text are included. Recent private delivery metadata excludes message bodies and provider IDs.

## Advisories

- `GET /advisories?q=&visibility=published|hidden&cursor=&limit=` -> list of `AdminAdvisory`.
- `GET /advisories/:id` -> `{advisory:AdminAdvisory,audit:AdminAudit[]}`.
- `PATCH /advisories/:id/review` body `{expectedRevision:number,visibility:'published'|'hidden',guidance:string,note:string,reason:string}` -> updated detail.

`AdminAdvisory`: `{id,aliases:string[],data:IntelAdvisory,fetchedAt,review:{visibility:'published'|'hidden',guidance:string,note:string,revision:number,reviewedAt:string|null}}`. No review row means published, empty guidance/note, revision 0, reviewedAt null. Source facts remain read-only; `guidance` is explicitly Wisesama editorial context. `note` is internal. Visibility governs public output; private matches/evidence remain retained. Search matches IDs, aliases and case-insensitive titles. Guidance/note max4000 characters each. Mutations never edit the official affected ranges, severity, exploitation evidence or package matches.

## Subscriptions

- `GET /subscriptions?q=&status=pending|active|unsubscribed|suppressed&cursor=&limit=` -> list of `AdminSubscriber`.
- `GET /subscriptions/:id` -> `{subscriber:AdminSubscriber,deliveries:DeliverySummary[],feedback:FeedbackSummary[],audit:AdminAudit[]}`.
- `PATCH /subscriptions/:id/status` body `{status:'unsubscribed'|'suppressed',expectedRevision:number,reason:string}` -> updated detail.

`AdminSubscriber`: `{id,email,status,topics:string[],confirmedAt:string|null,nextDigestAt:string|null,createdAt,updatedAt,revision:number}`. Operator controls only stop mail; they never create consent or confirm, reactivate, or unsuppress an address. Suppressed→unsubscribed is rejected. Status mutation invalidates outstanding consent/management tokens and the stable unsubscribe version, stops unsent pending/failed/unavailable deliveries, and records audit metadata without email tokens or delivery bodies.

`DeliverySummary`: `{id,subject,status,error:string|null,attempts:number,createdAt,sentAt:string|null}`. `FeedbackSummary`: `{id,type,status,attempts:number,processedAt:string|null,lastError:string|null}`. Feedback is bounded to latest25 associated with the subscriber's latest100 receipt references. URLs/credential-like error values are redacted.

## Audit

`GET /audit?targetType=&targetId=&cursor=&limit=` -> `{items:AdminAudit[],nextCursor}`. Audit rows are append-only through the API. `AdminAudit`: `{id,actorId:string|null,action,targetType,targetId,reason,metadata,createdAt}`. No UI delete/edit operation exists. Every admin mutation requires a trimmed reason of 10–1000 characters and writes the audit row in the same transaction as its revision-checked change. Record evidence references rather than credentials, personal data, raw logs or secrets in reasons/notes. Action metadata contains bounded facts (status, visibility, revision, scope); it does not duplicate advisory guidance, delivery bodies or private account records.

## Ops

Source controls and job contracts are owned by the ops module and documented below or in its companion contract. The same v2 guard, JSON/Origin enforcement, no-store responses and audit model apply.
