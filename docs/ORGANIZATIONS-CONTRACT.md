# Organizations and projects

Wisesama v2 uses **Organization → SecurityProject → inventory, findings, responses and repository checks**. A user may belong to several organizations. Organization selection is a client preference; every API operation checks current membership in the database. Changing a browser selector, request body, stored preference or organization identifier never grants access.

The original Dotsama product and its `User.role` are separate. Organization roles do not grant operator/admin-console access. Membership administration requires a Wisesama browser session; API keys cannot administer organizations.

## Roles

| Capability | Owner | Admin | Member |
| --- | --- | --- | --- |
| Read organization projects, findings, responses and member directory | Yes | Yes | Yes |
| Record findings, response progress and project context | Yes | Yes | Yes |
| Recheck or assess an existing project using its bounded saved resources | Yes | Yes | Yes |
| Create/configure projects, replace inventory and configure repository sources | Yes | Yes | No |
| Create/revoke invitations and manage non-owner memberships | Yes | Yes | No |
| Grant an owner role or modify another owner | Yes | No | No |
| Rename the organization | Yes | No | No |
| View invitation email addresses and organization audit | Yes | Yes | No |

Invitations grant `member` or `admin`; an owner promotes an existing member to `owner` separately. The manager endpoints cannot change or remove the actor's own membership. Another owner must make those changes. At least one active owner must remain. There is no organization delete endpoint or automatic join based on an email domain.

Private provider connections remain personal. Organization membership never grants a list of another user's GitHub/GitLab credentials or arbitrary repositories. Saved repository operations also require the original connector to remain an active, unsuspended organization member. Removing a member prevents future private project access and use of that member's credentials for organization operations. `SecurityProject.userId` remains the original creator/alert recipient; it is not an authorization predicate.

Removing a member also pauses that user's saved repository sources within this organization, marks their state `access_removed` and clears sync/baseline leases in the membership transaction. Saved inventory and baseline evidence are retained. Sources in other organizations and the user's personal provider connection are unaffected. Changing a role does not pause sources; bounded scheduled checks may continue for an active member connector.

For this launch, tracked branch/path changes require both owner/admin access and the original connector identity. Other owners/admins can manually sync, pause, resume or detach the existing bounded source; replacing its repository requires their own personal connection. Provider selection endpoints never reuse another member's connection.

Scheduled package assessments and private alerts retain the original project creator as their principal and recipient. Removing or suspending that person stops their scheduled assessments and prevents new or queued private alerts from being sent; operator retries report the missing organization access explicitly. Remaining members can manually reassess the project and keep contributing to its retained findings and response history. A due assessment whose original creator has lost access is reported as `access_removed` and deferred for 24 hours without provider calls or changes to findings/last assessment evidence, so invalid targets do not monopolize every scheduled batch. This release does not automatically transfer assessment ownership or alert routing. Bounded repository jobs use `syncForJob(sourceId)` as the saved, still-active connector; manual source sync requires owner/admin.

## API

Routes below use `/api/v1/intel`. All private responses have `Cache-Control: no-store`. All writes require an exact approved `Origin` from `INTEL_APP_URL` and `Content-Type: application/json`; localhost origins are accepted only outside production. Unknown input properties are rejected. IDs, revisions, emails, roles and lengths are validated at the edge. The invitation read is public and non-consuming; acceptance requires a session.

| Method and route | Body | Result |
| --- | --- | --- |
| `GET /organizations` | — | `{ organizations, defaultOrganizationId }` |
| `POST /organizations` | `{ name }` | `201 { organization }` |
| `GET /organizations/:id` | — | `{ organization, currentMembershipId, canManage, members, invitations, audit }` |
| `PATCH /organizations/:id` | `{ name, expectedRevision }` | `{ organization }`, owner only |
| `POST /organizations/:id/invitations` | `{ email, role: "admin" \| "member" }` | `201 { invitation, inviteUrl, delivery: "share_link" }` |
| `POST /organizations/:id/invitations/:invitationId/revoke` | `{ expectedRevision, reason? }` | `{ revoked: true }` |
| `PATCH /organizations/:id/members/:memberId` | `{ role, expectedRevision, reason? }` | `{ organization }` |
| `DELETE /organizations/:id/members/:memberId` | JSON `{ expectedRevision, reason? }` | `{ organization }` |
| `GET /organization-invitations/:token` | — | `{ invitation: { organizationName, role, expiresAt, status } }` |
| `POST /organization-invitations/:token/accept` | `{}` | `{ organization }` |

`GET /workspace?organizationId=...` and `GET /repositories/sources?organizationId=...` restrict results to the selected accessible organization. Omitting that optional filter returns only projects in the caller’s current organizations. Both manual `POST /projects` and repository `POST /repositories/projects` require `organizationId`; there is no implicit personal fallback. Returned project records include `organizationId`, and source records include `connectorUserId` for the original connector identity. Personal notification preferences and provider connections stay scoped to the signed-in account.

Names are trimmed, 2–80 characters. Optional reasons, when supplied, are trimmed and 10–500 characters. Revisions are nonnegative integers. An account may own up to 20 organizations and an organization may have up to 500 members.

`OrganizationDto`:

```ts
{
  id: string;
  name: string;
  personal: boolean;
  role: 'owner' | 'admin' | 'member';
  revision: number;
  memberCount: number;
  projectCount: number;
  createdAt: string; // ISO 8601
  updatedAt: string;
}
```

`MemberDto`: `{ id, userId, name: string | null, email, role, revision, joinedAt, suspended }`. `id` is the membership ID used in member routes, not the user's ID.

`InvitationDto` for authorized managers: `{ id, email, role, status, revision, expiresAt, createdAt }`. Status is `pending`, `accepted`, `revoked` or derived `expired`. Public previews deliberately omit the invitee email, member directory and organization ID. A link whose creator no longer has invitation authority previews as revoked.

Detail returns at most 500 members, 100 latest invitations and 100 latest audit events. Ordinary members receive empty invitation and audit arrays. Audit events contain safe actor/target identifiers, action, optional reason, role metadata and timestamp, never credentials or raw tokens.

`defaultOrganizationId` normally identifies the user's personal organization. If its membership was removed by another owner, listing does not rejoin the user; the first remaining organization is used, or `null` if none remain. The UI can create a new organization in the empty state.

## Invitation lifecycle

1. An active owner/admin creates a link for a normalized email address. The link is returned once to that inviter for manual sharing. **No outbound invitation email is sent.** A pending invitation for that email must be revoked before replacing it.
2. The service stores only a SHA-256 digest of 32 cryptographically random bytes. The link expires after seven days. Creating a replacement rotates the token, so an older link cannot be accepted.
3. A public GET can preview the organization name, role and state. It never changes membership or consumes the token.
4. Acceptance uses the signed-in user's live account email and `emailVerified` state, not fields in the client. The email must match exactly after case normalization. An unverified account or a different email gets an actionable `403`.
5. The inviter must still be an active, unsuspended owner/admin at acceptance. Expiry, revocation, an already-used token, a missing inviter or an inviter who lost authority produces a conflict and no membership.
6. Acceptance uses a serializable transaction, organization revision write and invitation status/revision CAS. The invite consumption, membership and organization audit commit together. The token cannot silently upgrade an existing member.

Invitation pages and API responses use `Referrer-Policy: no-referrer`. HTTP logging must mask the token path and invite query before launch. Raw invitation URLs must not be put in analytics, error reports, storage, audit records or operator logs. Copying the freshly returned link is the intended sharing mechanism.

## Access helpers and concurrency

`organization-access.ts` exports:

- `organizationScope(userId, action = 'read', organizationId?)` → Prisma `OrganizationWhereInput`.
- `projectScope(userId, action = 'read', organizationId?)` → Prisma `SecurityProjectWhereInput` using `organization.members.some`.
- `requireOrganizationAccess(db, userId, organizationId, action = 'read')` → `{ organization, role, membershipId, membershipRevision }`.
- `requireProjectAccess(db, userId, projectId, action = 'read')` → the project with persisted `organizationId`.
- `isActiveOrganizationMember(db, userId, organizationId)` → live boolean for original connector authority.
- `ensurePersonalOrganization(db, userId)` → personal `OrganizationDto`, creating the organization and owner atomically if absent.

`db` accepts `PrismaClient | Prisma.TransactionClient`. Actions are `read`, `contribute` and `manage`; `manage` requires owner/admin. Predicates always join current user suspension state. An inaccessible organization/project returns `404`; a current member without the needed role gets `403`. Service methods must scope resource identifiers before reading private data or contacting providers.

Organization mutations recheck current actor membership inside a serializable transaction. Each membership/invitation mutation also updates the organization revision as a shared serialization point. Role changes, removal and revocation compare the target's `expectedRevision`. Rename compares the organization's revision. Stale changes and PostgreSQL serialization/unique conflicts return `409`, so the UI refreshes before retrying. Audit records are committed inside the same transaction and use the dedicated `OrganizationAudit` table, not the operator audit table.

Errors use `{ error: string }`: `400` invalid input, `401` session required/API-key use, `403` role/email/origin restrictions, `404` inaccessible resource, `409` stale/lifecycle conflict, `415` non-JSON write, `503` invitation links not configured. Unexpected errors return a generic `500` without database details.

## Migration and rollout

`20261105020000_organizations` is additive. It creates `Organization`, `OrganizationMember`, `OrganizationInvitation` and `OrganizationAudit`; grants no operator privileges; and adds `SecurityProject.organizationId`.

It also adds nullable `SecurityPlaybookEvent.actorId` for attribution of new shared response actions. Existing history remains unattributed; deleting an actor clears the relation without deleting response history.

The SQL creates one organization and owner for **every existing user**, using a deterministic `personal-` + MD5 identifier solely as a non-secret stable ID. It backfills every project from its original `userId`, then makes the foreign key required. It does not place unrelated users or their projects together. Runtime first visits use the same deterministic identifier and unique `personalForUserId` with atomic nested owner creation and bounded retries for concurrent first visits.

Apply this migration only after earlier Wisesama v2 migrations and before starting the new project-create code, which must persist the selected organization ID. Generate the Prisma client locally; do not commit generated output. Production migration and provider setup remain separate launch actions.

The existing original-creator `User → SecurityProject` cascade remains unchanged. There is no end-user deletion endpoint; a later account deletion feature must define retention for shared organization projects before deleting users.

## Verification

Focused service and HTTP tests cover organization/project IDOR, member contribution versus configuration, live original-connector membership checks, manager-only invitation/audit visibility, atomic first-visit creation conflicts, stale member revisions, self changes, owner-only ownership changes, last active owner, serialization conflicts, digest-only invitation storage, non-consuming preview, expired/revoked/replayed tokens, matching verified emails, removed/demoted/suspended inviters, acceptance CAS, organization-scoped revocation, session-only management, exact-origin JSON writes and generic errors.

The focused tests use a mocked Prisma boundary; local database workflow verification additionally exercises migration backfill and real transaction behavior before launch.


### Source recovery limits

This release does not transfer an existing repository source to another member's personal connection. Restore the original connector's verified membership and explicitly resume the source, or disconnect it and maintain the retained inventory manually while configuring a new repository project. Existing source evidence, findings and response records are retained. Organization project transfer and connection reassignment require a separate reviewed workflow.
