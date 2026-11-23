# Organizations and projects

The confirmed launch audience is small software teams. The hierarchy is an organization with projects, and people belong to organizations as owners, admins or members. These are workspace roles; the V2 platform operator role is separate.

This extension keeps the approved Response desk composition, Satoshi, restrained purple/pink accents, and the existing dark and light tokens. It adds identity and permission context to the working screens rather than introducing another dashboard style. No new illustration is useful for these factual settings flows.

## Research inspected

Mobbin searches were made separately for organization creation, choosing an organization, inviting teammates with roles, accepting an invitation, and creating a project inside an organization. Returned images were opened and inspected. The following canonical references informed the implementation; product artwork and literal page layouts were not copied.

| Flow | Inspected reference | Useful pattern | Wisesama adaptation |
| --- | --- | --- | --- |
| Create an organization | [Devin: Creating an organization](https://mobbin.com/flows/8b57e259-51fc-47ad-accd-379495e4a5f4?tab=screens) | One name field and a clear creation action. | Inline creation in organization settings; no separate billing or setup wizard. A person with no memberships receives the same focused form directly. |
| Create and inspect organizations | [Clerk: Creating an organization](https://mobbin.com/flows/a835a1f6-0f6f-4c0c-9bde-8b063db0be11?tab=screens) | A distinguishable organization identity followed by member count and creation metadata. | The selected organization, personal status and current role remain visible. Logo upload and custom role sets are outside this release. |
| Choose an organization | [incident.io: organization selection](https://mobbin.com/screens/15e3f3cd-edfa-4e8a-97ba-c67e83a0a737), [Stripe: organization management](https://mobbin.com/screens/ee6c374a-f532-4bb8-af59-5aecf831863f) | Explicit organization names and a clear distinction between identity and the resources below it. | A native labeled selector in the sidebar and mobile workspace. The saved choice is validated against the current server membership list before loading private records. These are structural references; neither returned screen shows the exact in-session selector Wisesama needs. |
| Invite with a role | [Plane: Inviting teammates](https://mobbin.com/flows/9377b476-ab35-452b-8a06-751347a9c629?tab=screens), [GitBook: Inviting teammates](https://mobbin.com/flows/6e1b3cfe-56fb-4a45-b3bb-c4200347c659?tab=screens) | Email beside role, with an explanation of what the role permits. | One addressed invitation with member as the default, explanatory role text, and a newly generated share link. No email delivery is claimed. GitBook's larger paid role taxonomy is not adopted. |
| Accept an invitation | [Plane: Accepting an invitation](https://mobbin.com/flows/9b0dc7b8-d9e3-426e-a202-05988c7d97ed?tab=screens), [ElevenLabs: Accepting an invitation](https://mobbin.com/flows/a353bbc1-245e-4444-8830-eb904959933c?tab=screens) | Organization and role shown before an explicit Accept action. | A public invitation summary, inline sign-in, verification guidance and a separate acceptance action. Visiting the link never joins an organization. |
| Create a project in an organization | [Supabase: New project](https://mobbin.com/screens/66a86278-2c02-4d74-95de-b6d0ece2dfba), [GitLab: first project](https://mobbin.com/screens/3b1134b2-ca12-4518-bee7-483ccb144119) | Show the resource's destination before entering configuration. | Repository and manual onboarding show the selected organization and the sharing consequence above the steps. Changing organizations clears the old form and starts in that organization's Projects screen. Database passwords, regions and template selection from the references are irrelevant here. |

## Working flows

1. The sidebar/mobile organization selector loads a live membership directory. A local choice is a preference only, scoped by account ID. The API scopes workspace and repository source reads by `organizationId` and checks membership again on every private operation. Switching clears the previous private dataset before requesting the next one; late responses cannot replace a newer selection.
2. Organization settings show the selected organization and the current role, member identities and their permissions. Owners may rename the organization. Owners and admins may manage other members subject to server rules. Admins cannot manage owners or grant ownership. People cannot change or remove their own membership through manager controls; at least one owner remains.
3. Role changes, removal and revocation open an inline confirmation with the person, organization, resulting role or consequence, a 10–500 character reason and an explicit review checkbox. Server revision conflicts preserve the draft, require a reload, clear confirmation and require a new review. No optimistic access change is displayed.
4. Invitations are tied to an email and admin/member role. Only the freshly created response displays the share link, with expiry, copy and hide actions. The history list displays metadata, never reconstructs an older link. Expired/revoked/accepted records have no revoke action.
5. `/invite?token=…` reads the secret into component memory, then removes it from the address bar. It does not persist the token in local or session storage, add it to authentication/verification callbacks, or include it in links. The route must send `Referrer-Policy: no-referrer` and noindex metadata before render. Authentication happens inline. A verified, matching account must explicitly accept. The public read never discloses the invited email. A clean verification callback tells the person to return to the original invitation tab or reopen the original link.
6. Owners/admins create projects and update inventory or bounded repository sources. Members review inventories through project security, reassess and contribute finding responses, exposure context and playbooks. Repository connections remain personal. Only the original connector may change tracked branches and paths; other organization managers may operate the bounded source. Removing the connector ends future credential use for that organization.

## Empty, failure and responsive states

- A new or migrated personal organization is a real organization, with owner access and the existing projects. The API provides this backfill; the UI does not manufacture it.
- A person without any memberships can create a new organization or use a teammate's invitation.
- A member sees an empty project explanation and a link to organization members, without a forbidden Add action. Direct project-configuration URLs explain the owner/admin requirement.
- Refresh errors identify that existing loaded information remains visible. Private 403/404 responses clear the current private dataset and trigger live membership revalidation; signed-out state also clears it. Focus revalidates membership. The server remains authoritative while the tab is idle.
- Role descriptions, membership status, invitation status and expiry remain readable on mobile. Member rows become a vertical record. Forms and confirmations use native labeled inputs, selects, checkboxes, details and buttons. Theme colors come from the current design tokens.
- Personal notification preferences are explicitly personal. They do not enroll other members or alter public feed subscriptions. This release keeps the original project recipient behavior; organization roles do not imply team-wide alert routing.

## Verification and handoff

The UI owner performs scoped TypeScript and Biome checks. The parent performs final API/database integration, desktop/mobile/dark/light captures, a single combined detector pass and a fresh independent finish review after all changes are integrated. Do not treat research screenshots as screenshots of the built product.

Not included: organization deletion, project transfer, seat billing, SSO, self-managed GitLab, organization-wide notification routing or automatic invitation email delivery.
