# Repository-backed onboarding and management

Status: researched design brief implemented by the repository provider/service/routes, with setup in [REPOSITORY-SETUP.md](REPOSITORY-SETUP.md) and exact contracts in [repository-api-contract.md](repository-api-contract.md). GitHub and GitLab.com paths are implemented and exercised through synthetic provider tests and disposable PostgreSQL verification. External app registration and real private-repository/browser authorization remain deployment checks; no live connection is established by this document.

## Job and ownership

A small software team connects a repository, reviews exactly which dependency metadata is in scope, and gets an assessment that remains current as code and vulnerability intelligence change. A repository connection must continue to be manageable after onboarding.

Wisesama sign-in and repository authorization are separate. Users should not have to replace an email-based Wisesama account to connect a GitHub or GitLab identity. Projects belong to organizations with live owner/admin/member checks. Provider connections remain personal and bound to the original connector, who must remain an active member of the project organization. Never treat an installation ID or repository name as proof of tenant ownership.

## First-project flow

1. Choose GitHub or GitLab.com; retain manual inventory upload as another supported path.
2. Explain the actual provider permissions and authorize/install. Show organization approval pending as a real state.
3. Select provider account or organization and an accessible repository. Offer a clear missing-repository permission action, followed by refresh.
4. Select the tracked branch and supported inventory paths. Discover files using bounded tree traversal; show incomplete discovery instead of silently assuming there are no files.
5. Review parsed packages, import warnings, immutable commit SHA and assessment scope before creating the project.
6. Import the chosen snapshot and run the existing vulnerability assessment. Show source failures and unknowns. A connection success alone is not assessment success.
7. Continue into the response inbox and expose ongoing connection settings from the project.

Root-directory selection is useful for navigation, but must not imply unsupported service-level matching. The existing pnpm parser reads the shared lockfile without importer-aware dependency closure. Until that is implemented, label a shared-root-lock import as repository-wide. The same caution applies to transitive dependencies shared across multiple services.

## Provider design

| Area | GitHub | GitLab.com |
| --- | --- | --- |
| Connection | GitHub App installation plus verified GitHub App user authorization | OAuth authorization code with PKCE |
| Initial access | Contents read and Metadata read; selected repositories | `read_api`; Wisesama lets the user select which projects it processes |
| Inventory updates | Signed App push webhooks plus scheduled reconciliation | Scheduled polling, with an optional user-configured project webhook |
| Writes | No repository writes required | Do not request write-capable `api` merely to create hooks automatically |
| Credentials | Mint short-lived installation tokens server-side, narrowed to the relevant repository | Encrypt access/refresh tokens; rotate both atomically on refresh |

GitHub installation tokens expire after one hour and can be restricted to a subset of installed repositories. Use server-side signing and token minting, never expose the app key or provider token to the browser. [GitHub installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)

Treat GitHub's setup callback `installation_id` as untrusted. Bind the connection attempt to the Wisesama session with an expiring one-time state, authorize the GitHub user, then verify the installation against that user's accessible installations. Populate the picker from the intersection of user and installation repository access. A valid callback state does not by itself establish installation ownership. [Setup URL security](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url), [installation endpoints](https://docs.github.com/en/rest/apps/installations)

The proposed Contents read permission grants access to repository contents broadly, although Wisesama's implementation should retrieve only selected supported dependency metadata. Do not describe that grant as lockfile-only. GitHub's separate fixed-path Single file permission is a narrower possible alternative for a limited app, not a replacement for arbitrary monorepo discovery. [App permission configuration](https://docs.github.com/en/apps/sharing-github-apps/registering-a-github-app-using-url-parameters)

GitLab `read_api` is broader than the selected-project list in Wisesama: its token can read other resources accessible to the authorized GitLab user. State that distinction during connection and on the integration page. Automatic hook creation needs broader access and project roles, so polling is the initial continuity mechanism. Refresh must serialize token rotation and persist both replacement tokens together. [GitLab OAuth provider](https://docs.gitlab.com/integration/oauth_provider/), [OAuth API](https://docs.gitlab.com/api/oauth2/), [project hooks](https://docs.gitlab.com/api/project_webhooks/)

GitLab.com is the allowed OAuth/API origin for this launch. Self-managed instance discovery is outside the selected scope. Where optional GitLab hooks are configured, support the current documented signed webhook mechanism and replay protection; do not assume the legacy plaintext token is the only option. [GitLab webhook documentation](https://docs.gitlab.com/user/project/integrations/webhooks/)

## Continuing management

The project connection view should show provider/account/repository identity, tracked branch, selected inventory paths and scope, latest observed commit, last successfully imported commit, last inventory sync, last vulnerability assessment, and each failure independently. Actions cover sync now, branch/path changes with preview, reconnect or update access, pause/resume and disconnect.

The workspace integrations view manages provider access across projects. Changing one project's branch/path must not change other projects sharing the same connection. Disconnecting a project and revoking the underlying provider grant are different actions; explain which other projects are affected. Retain prior assessment and response history with its scope and timestamps.

Model authorization and inventory-sync states separately. Useful authorization states include awaiting owner approval, connected, expired/reconnect required, suspended, access removed and disconnected. Inventory sync can independently be idle, queued, syncing, current, behind, paused or failed. Assessment health and the user's response status remain separate again.

## Snapshot and refresh behavior

- Resolve the selected branch once and fetch every chosen file at that immutable commit. Persist repository ID, SHA, path, digest, parsed format, scope and timestamps. [GitHub contents](https://docs.github.com/en/rest/repos/contents), [GitLab repository files](https://docs.gitlab.com/api/repository_files/)
- Bound file size, discovery depth and aggregate package count. Handle pagination/truncated results explicitly; skip symlinks, submodules and generated dependency directories. Never execute repository code. [GitHub trees](https://docs.github.com/en/rest/git/trees), [GitLab repository trees](https://docs.gitlab.com/api/repositories/)
- Validate webhook signatures over raw bodies, deduplicate delivery IDs durably and enqueue work. Ignore irrelevant branches and reconcile duplicate, delayed or out-of-order deliveries against the provider's current branch tip. [GitHub webhook validation](https://docs.github.com/en/webhooks/using-webhooks/validating-webhook-deliveries), [operational guidance](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks)
- Refresh inventory when relevant code changes; reassess unchanged inventories when new intelligence arrives. Webhooks accelerate synchronization but do not replace scheduled reconciliation.
- On access loss or sync failure, retain the last successful snapshot and make its age visible. Do not present it as current coverage or clear prior exploitation evidence.
- A package disappearing from a repository snapshot is not proof of a deployed fix. Record inventory presence separately from the user's response and deployment evidence.

## Data and API consequences

Proposed records, with names still subject to implementation:

- `RepositoryConnection`: authorized Wisesama owner/workspace, provider identity, installation ID or encrypted credentials, expiry, access validation and authorization state.
- `ProjectRepositorySource`: project and stable provider repository ID, branch, chosen paths, inventory scope, observed/imported SHA, synchronization state/timestamps and error.
- `RepositoryWebhookDelivery`: provider plus unique delivery ID, processing/retry state and minimal routing metadata.
- A connection-attempt record: session/owner binding, one-time state, PKCE material where applicable, expiry and consumed status.

The signed security-response job refreshes a bounded set of connected repository sources before assessing saved packages, while independently permitting advisory-only reassessment of an unchanged imported snapshot. Provider setup and missing configuration must be observable availability states, never successful mock connections.

## Reference decisions

Use references for structure, preserving Wisesama's current design language:

- [Vercel project import](https://mobbin.com/flows/0d992538-325c-42ff-ae7f-66d1ef3dbba8): account/repository picker followed by project/root-directory configuration. Adapt the sequence, not deployment controls.
- [AWS repository and branch](https://mobbin.com/screens/53ae168c-f0dc-4365-872a-706e7f8f7e61): missing-repository permission recovery beside repository/branch selection.
- [Vercel connected repository settings](https://mobbin.com/flows/48558b2f-ca61-401e-a78d-9ddd30fcbc23): persistent connected identity and disconnect management.
- [Render provider connections](https://mobbin.com/screens/6362a411-6e89-4b95-878f-0c289d02b3ce): provider-account management beside the repository picker.

These selected references do not demonstrate revoked access, webhook failures, token expiry, assessment freshness or vulnerability remediation. Those are Wisesama-specific requirements. Inspected assets and evidence limits are retained in `.impeccable/references/repository-connections/research.json`.

## Acceptance evidence

Before this is presented as a working launch capability, verify real private-repository onboarding and owner approval, user/tenant isolation, a monorepo scope review, a relevant push updating the inventory, an unchanged commit gaining a new advisory, failed/revoked access retaining prior evidence, idempotent webhook handling, GitLab refresh-token rotation, reconnect/pause/disconnect behavior, and the existing evidence-required response workflow. Measure synchronization and assessment behavior before promising a refresh interval.
