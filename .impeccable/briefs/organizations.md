# Organizations extension

Target: `apps/intel/src/components/organization-workspace.tsx` and its integration with the existing workspace, project onboarding, inventories, connections and finding views. Private route: `/app/settings/organization`. Public acceptance route: `/invite`.

Mode: Operate. Small software teams choose a real organization, manage teammates and create projects with an explicit destination. The existing Response desk, Satoshi, purple/pink identity, dark and light tokens remain fixed. This is a scoped extension of the selected design world; the user confirmed organizations and owner/admin/member roles in this build.

Composition: organization selector in existing navigation; clear organization identity and current role; member records with permission explanations; invitation form and metadata history; an inline protected-access confirmation; secondary organization creation. The invitation page shows organization, role and expiry before inline authentication and explicit acceptance. Native labeled controls and details keep the visual density of the current response workspace.

Research: inspected returned Mobbin images for Devin and Clerk organization creation; incident.io and Stripe organization identity/selection; Plane and GitBook invitations; Plane and ElevenLabs invitation acceptance; Supabase and GitLab organization/project destination. Canonical references, accepted patterns and rejected extras are in `docs/ORGANIZATIONS-DESIGN.md`.

Quality bar: selected organization scopes live server reads; no stale private records across switches or access loss; role management is distinct from platform operator access. Show invitation expiry and share-link delivery truthfully, retain revision-conflict drafts, require confirmation for access changes, hide owner/admin actions from members and original-connector changes from other managers. Secrets stay out of persisted selection, auth URLs, links and referrers. Personal notifications stay personal. Every record remains readable on mobile and in both themes.

Verification handoff: child runs scoped TypeScript and style checks. Parent owns final integrated browser captures, one combined detector pass, independent finish review and design documentation. No child browser or detector pass is claimed.
