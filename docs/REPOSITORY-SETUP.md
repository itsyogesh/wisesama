# Repository provider setup

The backend implements repository authorization, selected-file previews, immutable-commit imports, assessment, continuing sync, pause/configuration and disconnect. GitHub installation scope controls which repos can appear in the picker. Each confirmed import creates one project. External provider registration and a successful real private-repository authorization remain deployment checks.

## Server configuration

```dotenv
# Origins, not arbitrary user-provided provider URLs.
INTEL_APP_URL=https://wisesama.com
REPOSITORY_API_URL=https://api.wisesama.com
# 32 random bytes, standard base64 encoded. Retain securely; loss requires reconnecting.
REPOSITORY_TOKEN_ENCRYPTION_KEY=

# Dedicated Wisesama GitHub App, separate from Better Auth sign-in OAuth settings.
GITHUB_APP_ID=
GITHUB_APP_SLUG=
GITHUB_APP_CLIENT_ID=
GITHUB_APP_CLIENT_SECRET=
# PEM private key; actual newlines or escaped \n accepted.
GITHUB_APP_PRIVATE_KEY=
GITHUB_APP_WEBHOOK_SECRET=

# GitLab.com confidential OAuth application.
GITLAB_CLIENT_ID=
GITLAB_CLIENT_SECRET=
```

Keep these values in server-side secret storage. None use `NEXT_PUBLIC_`. Credentials are encrypted with AES-256-GCM, authenticated to the Wisesama owner and provider. Rotation of the storage key requires a deliberate re-encryption or reconnection procedure; replacing it silently makes saved connections unreadable. Do not reuse the account session/JWT secret as this key.

## GitHub sign-in

Create a GitHub OAuth App under the operator's account or organization with homepage
`https://www.wisesama.com` and callback `https://api.wisesama.com/api/auth/callback/github`.
Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` on the API and redeploy. Sign-in requests
`read:user` and `user:email`. People with an existing Wisesama account sign in with email first,
then add GitHub in Connections. Linking requires a verified GitHub email that matches the
Wisesama account. Repository selection happens through the GitHub App after sign-in.

## GitHub App

Register a GitHub App owned by the operator, installable on the accounts the release intends to support. Configure:

- **Callback URL:** `https://api.wisesama.com/api/v1/intel/repositories/callback/github`
- **Setup URL:** the same URL. Setup and authorization are separate stages in this implementation.
- Leave **Request user authorization (OAuth) during installation** disabled; Wisesama explicitly starts user authorization after retaining installation context. Enable expiring user access tokens.
- **Webhook URL:** `https://api.wisesama.com/api/v1/intel/repositories/webhooks/github`, active, with the secret stored as `GITHUB_APP_WEBHOOK_SECRET`.
- Repository permissions: **Contents: read-only**, **Metadata: read-only**. No repository write permission, checks, pull requests or deployments are required.
- Subscribe to **Push**. Installation and installation-repository lifecycle events are handled as well.
- Generate an App private key and retain the client secret server-side.
- GitHub offers all repositories or selected repositories. Use a selected-repository grant for the pilot. The Contents permission grants read access within that installation. Wisesama reads the selected repository's dependency files and supported CI configuration after the user picks a repository.

The first callback stores the untrusted installation ID inside the existing expiring owner-bound attempt, then starts App user authorization with PKCE S256 and `offline_access` for expiring tokens. The final callback consumes the attempt, exchanges its code with the retained verifier and verifies that the authorized GitHub identity can access that installation. Onboarding returns to the picker with the verified connection selected. The picker displays the installation account and grant reported by GitHub. It uses `/user/installations/{installation_id}/repositories`, showing the intersection of user and installation access in pages of up to 100, with a 1,000-repository limit. Every import and sync repeats access validation before minting a short-lived installation token narrowed to that repository. The automatic `github_app_authorization` revocation event erases the affected user credentials and pauses their linked sources immediately.

Enable cookies on the API origin. Current Better Auth settings use secure SameSite=None cookies in production, and Lax on loopback development; a provider callback is a top-level GET to that same API origin. CORS must include the actual Intel app origin with credentials. Avoid mixing `localhost` and `127.0.0.1` in browser/API URLs. Production callback success must be checked in a real browser; a mocked session test does not prove cookie deployment settings.

Installation settings can require organization-owner approval. If GitHub does not provide an accessible installation, Wisesama does not create a connection. The interface can direct the user to complete provider approval and restart connection. A supplied installation ID is never accepted as approval evidence.

## GitLab.com

Create a confidential OAuth application at GitLab.com with:

- Redirect URI `https://api.wisesama.com/api/v1/intel/repositories/callback/gitlab`.
- **read_api** scope. No `api` write scope. PKCE S256 is added by Wisesama.
- Application ID and client secret stored in `GITLAB_CLIENT_ID` and `GITLAB_CLIENT_SECRET`.

This grant can read resources available to the authorized GitLab user; selecting projects in Wisesama narrows what Wisesama processes, not the provider's grant. Only GitLab.com endpoints are used. Self-managed GitLab is unsupported.

Inventory continuity uses scheduled polling. OAuth refresh is serialized using a persisted connection lock and replaces both tokens in one database update. If the provider rotated a token but the replacement could not be durably stored, reconnect rather than pretending the old refresh token remains valid. No project hook is created automatically because that would require a broader write-capable scope.

An operator-managed optional GitLab signed webhook receiver also exists at `/api/v1/intel/repositories/webhooks/gitlab`, using `GITLAB_WEBHOOK_SIGNING_SECRET` in Standard Webhooks `whsec_...` format. It verifies the exact body, ID and timestamp with a five-minute replay window, and deduplicates durably. Do not expose this shared operator secret to end users or describe automatic GitLab hooks as available. Polling is the supported default.

## Scheduling and failure behavior

The signed `/api/v1/jobs/security-response` scheduler must run bounded `repositoryService.runScheduledSyncs(3)` before ordinary advisory assessments. Each successful sync schedules its next eligibility 15 minutes later. Actual freshness depends on scheduler frequency, queue size and provider availability; no instant-refresh or 15-minute SLA is implied. Webhooks make matching sources eligible earlier, and scheduled polling recovers missed hooks.

For a fresh database, `pnpm --filter @wisesama/database exec prisma migrate deploy` applies the original schema and the additive v2 migrations in order. Point `DATABASE_URL` at the intended database before running it. For an existing database, compare its schema and migration history to the original baseline and reconcile any previously applied migrations before upgrading. Owner/project/connection foreign keys and explicit owner and organization checks govern repository access.

Changing inventory resolves the branch once and reads all chosen files at that immutable commit. Regular git-tree modes are checked before Contents/File APIs because those APIs may dereference symlinks. Supported names are package-lock.json, npm-shrinkwrap.json, pnpm-lock.yaml, exact-version package.json and wisesama-inventory.json. Import limits: ten paths, 2 MB each, 4 MB aggregate, 2,000 packages. Bounded/truncated discovery is visible. pnpm shared locks remain repository-wide scope.

Failed or revoked access retains the last good inventory, SHA and response history. Detaching a source pauses it; disconnecting a provider erases stored credentials and detaches all its sources. Neither action closes findings. Provider installation/revocation is separately available in GitHub/GitLab settings.

## Required deployment proof

Use a real consenting test repository to verify installation plus user authorization, organization approval, missing selected-repository recovery, exact committed inventory, a changed push and scheduled refresh, an unchanged commit with new intelligence, GitLab rotating access tokens, revoked membership, pause/resume, branch/path changes and disconnect. Verify API callback cookies under the actual HTTPS origins. The local test suite checks protocol/ownership invariants without contacting providers; the disposable repository smoke script checks persistence and assessment with explicitly synthetic providers.

## Droidsize pilot

1. Deploy a reviewed v2 revision to separate staging projects for `apps/intel` and `apps/api`. Use stable HTTPS hosts on the same site, for example `staging.wisesama.com` and `api-staging.wisesama.com`. Set the web build's `NEXT_PUBLIC_API_URL` to the staging API. Point `BETTER_AUTH_URL` and `REPOSITORY_API_URL` at that API and `INTEL_APP_URL` at the staging web app.
2. Use staging PostgreSQL and Redis. Apply the migrations to staging and set separate Better Auth and repository encryption secrets. Set `BETTER_AUTH_CROSS_SUBDOMAIN_COOKIES=false` and `BETTER_AUTH_COOKIE_PREFIX=wisesama-staging` on the API so the browser uses a separate session on the staging API host.
3. Register a dedicated GitHub App installable on Droidsize. Use the staging API host for the callback, setup and webhook URLs described above. Store the App credentials and signing secret in staging. Confirm that the installer can approve the grant for the chosen repo.
4. In a Droidsize Wisesama workspace, use **Add project → Connect GitHub**. Grant **Only select repositories** to one approved repo, such as `evakayogi-web`. Confirm the browser returns to the picker, the grant is shown, and the committed lockfile preview matches the selected branch and commit. Confirm inventory persistence and the advisory assessment. The assessment sends package names and versions to OSV.
5. Configure and verify a signed QStash job against the staging API. Check a push and scheduled refresh, then verify that removing access pauses the source and preserves the previous inventory. Exercise all-repository access on a consenting test installation to confirm the picker expands while import stays a one-repository action.

Primary references checked for this build: [GitHub setup callback security](https://docs.github.com/en/apps/creating-github-apps/registering-a-github-app/about-the-setup-url), [installation tokens](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app), [GitLab OAuth/PKCE and rotation](https://docs.gitlab.com/api/oauth2/), [GitLab signed webhooks](https://docs.gitlab.com/user/project/integrations/webhooks/).

## Email sign-in and GitHub account recovery

The account screen also offers a one-time email sign-in link through the configured workspace email provider (Brevo when configured). Existing and fresh accounts prove email ownership before receiving a session. This does not weaken GitHub account-linking checks: joining a GitHub identity with a different email still requires explicit linking from a signed-in Wisesama session.

Links expire after ten minutes and store only a hash in verification storage. The emailed URL opens `/sign-in/verify` with its bearer parameters in the fragment, which is removed from browser history on load. Loading that page does not consume the token. The recipient must choose Continue, review the terms for a new account, and then redeem it through Better Auth. That final action creates a verified account or signs in an existing account. Tokens are consumed atomically; expiry and replay are rejected.

Send and redemption callbacks are restricted to trusted application origins. The email request endpoint also uses a distributed IP limit, in addition to Better Auth's plugin limits. Failures do not claim delivery or create a session. As documented by Better Auth, proving the email of an existing unverified account revokes any credentials and sessions established before email ownership was proven; the account's project data remains. Fresh-account onboarding with a different address leaves the old account untouched.

`verify-email-link.ts` verifies the actual Prisma-backed flow and concurrent redemption in the exact disposable loopback database used by the other verification scripts. It intercepts all email transport, blocks real outbound delivery, and removes its synthetic user afterwards. The plugin uses the existing verification/user/session schema and needs no migration or new credentials.
