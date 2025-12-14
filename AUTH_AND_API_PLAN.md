# Authentication & API Management Plan

## Current Status Analysis

### Backend (`apps/api`)
- **Authentication**: Fully implemented.
  - **Methods**: Email/Password (`/auth/login`, `/auth/register`) and API Key (`x-api-key` header).
  - **Middleware**: `authenticate` (JWT) and `requireAdmin` are ready and used in Admin routes.
  - **Gap**: Web3 Wallet authentication (Sign-In with Substrate) is planned (DB has `walletAddress`) but not yet implemented in routes.

### Frontend (`apps/web`)
- **UI**: Missing authentication interfaces.
  - **Navbar**: Static "Check Address" button only. No "Login" or "Sign Up" actions.
  - **Pages**: No `/login`, `/register`, or `/dashboard` pages exist.
  - **State**: No global Auth Provider to manage session/tokens.

### Database
- **Schema**: Ready. Supports `User` with `email`, `passwordHash`, `role` (ADMIN/USER), `tier`, and `ApiKey` relation.

---

## Implementation Plan

### Phase 1: Core Authentication (Email/Password)

1.  **Auth State Management**:
    - Create `useAuth` hook (using Zustand or Context) to manage `user` and `token`.
    - Persist token in `localStorage` or `httpOnly` cookies.

2.  **Auth Pages**:
    - **Login Page (`/login`)**: Email & Password form.
    - **Register Page (`/register`)**: Account creation form.
    - **Forgot Password**: (Optional for MVP, but good to note).

3.  **Navbar Update**:
    - Replace the static "Check Address" button logic.
    - **Guest State**: Show "Log In" / "Get API Key".
    - **Authenticated State**: Show User Dropdown (Avatar, Email) -> Links to Dashboard, Logout.

### Phase 2: User Dashboard & API Keys

1.  **Dashboard Layout (`/dashboard`)**:
    - Protected route (redirect to login if unauthenticated).
    - Sidebar navigation: Overview, API Keys, Usage, Settings.

2.  **API Key Management**:
    - **UI**: List existing keys, "Create New Key" button, Revoke/Delete actions.
    - **Integration**: Connect to existing `apps/api/src/modules/api-keys` endpoints.
    - **Usage Display**: Show `remainingQuota` and `tier`.

### Phase 3: Admin Integration

1.  **Admin Protection**:
    - Ensure Admin-only pages (if moved from `apps/admin` to `apps/web` or linked) check `user.role === 'ADMIN'`.

### Phase 4: Web3 Authentication (Future)

1.  **Wallet Connect**:
    - Integrate Polkadot.js extension or similar wallet adapter.
    - Implement `SIWS` (Sign In With Substrate) flow:
        1. Frontend requests nonce.
        2. User signs message.
        3. Backend verifies signature & issues JWT.

---

## Immediate Action Items (Next Steps)

1.  [ ] Create `apps/web/src/context/auth-context.tsx` (or store).
2.  [ ] Build `/login` and `/register` pages using the existing dark theme components.
3.  [ ] Update `SiteHeader` to be dynamic.
4.  [ ] Build a simple `/dashboard` to view/create API keys.
