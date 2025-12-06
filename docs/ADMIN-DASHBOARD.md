# Wisesama Admin Dashboard

> Internal administration interface for managing whitelists, reviewing reports, and monitoring platform activity.

## Overview

The Admin Dashboard is a protected Next.js application that provides administrators with tools to:

- Manage whitelisted entities (addresses, domains, Twitter handles)
- Review and verify community fraud reports
- Process whitelist requests from users
- Monitor GitHub contribution PRs
- View platform activity logs

**Production URL:** `https://admin.wisesama.com`
**Local Development:** `http://localhost:3002`

---

## Authentication

### Access Control

- Only users with `ADMIN` role can access the dashboard
- Unauthenticated users are automatically redirected to `/login`
- Authentication uses JWT tokens stored in `localStorage`
- Tokens are validated against the API on each page load

### Login Flow

1. User navigates to `admin.wisesama.com`
2. `AuthGuard` component checks for valid JWT in `localStorage`
3. If no token or invalid token → redirect to `/login`
4. User enters admin credentials (email/password)
5. API validates credentials and returns JWT + user info
6. Token stored in `localStorage`, user redirected to dashboard

### Creating Admin Users

Admin users are created via the database seed or manually:

```bash
# Via seed (development)
pnpm --filter @wisesama/database db:seed

# Manual creation requires direct database access
# Set role = 'ADMIN' on the User record
```

---

## Tech Stack

| Component | Technology |
|-----------|------------|
| Framework | Next.js 15 (App Router) |
| Styling | Tailwind CSS |
| State Management | React Query (TanStack Query) |
| HTTP Client | Axios |
| Icons | Lucide React |
| Authentication | JWT (localStorage) |

---

## Project Structure

```
apps/admin/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout with providers
│   │   ├── providers.tsx           # React Query provider
│   │   ├── globals.css             # Tailwind + custom styles
│   │   ├── login/
│   │   │   └── page.tsx            # Login page
│   │   └── (dashboard)/
│   │       ├── layout.tsx          # Dashboard layout with sidebar
│   │       ├── page.tsx            # Dashboard home (stats)
│   │       ├── whitelist/
│   │       │   ├── page.tsx        # Whitelist management
│   │       │   ├── new/page.tsx    # Add new entity
│   │       │   └── [id]/page.tsx   # Edit entity
│   │       ├── requests/
│   │       │   ├── page.tsx        # Whitelist requests
│   │       │   └── [id]/page.tsx   # Request details
│   │       ├── reports/
│   │       │   └── page.tsx        # Fraud reports
│   │       ├── contributions/
│   │       │   └── page.tsx        # GitHub PRs
│   │       └── activity/
│   │           └── page.tsx        # Activity logs
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx         # Navigation sidebar
│   │   │   ├── header.tsx          # Page headers
│   │   │   └── auth-guard.tsx      # Authentication wrapper
│   │   └── ui/
│   │       ├── button.tsx          # Button component
│   │       ├── data-table.tsx      # Reusable data table
│   │       └── ...                 # Other UI components
│   ├── hooks/
│   │   └── use-auth.tsx            # Authentication hook
│   └── lib/
│       ├── api.ts                  # API client & endpoints
│       └── utils.ts                # Utility functions
├── public/
│   ├── logo.svg                    # Wisesama logo
│   └── favicon.svg                 # Favicon
└── tailwind.config.ts              # Tailwind configuration
```

---

## Pages

### Dashboard (`/`)

Overview statistics:
- Total whitelisted entities
- Pending reports count
- Open whitelist requests
- Recent activity

### Whitelist Management (`/whitelist`)

CRUD operations for whitelisted entities:
- View all entities with pagination
- Search by name, value, type
- Filter by entity type (ADDRESS, DOMAIN, TWITTER)
- Add new entities
- Edit existing entries
- Delete entries

**Entity Fields:**
- `entityType` - ADDRESS, DOMAIN, or TWITTER
- `value` - The actual entity value
- `name` - Display name
- `category` - wallet, exchange, infrastructure, project, treasury, other
- `chainId` - Optional chain association (for addresses)
- `description` - Optional description
- `website` - Optional website URL
- `twitter` - Optional Twitter handle

### Whitelist Requests (`/requests`)

Review user submissions for whitelist:
- View pending requests
- Approve (creates whitelist entry)
- Reject with reason
- Status tabs: Pending, Under Review, Approved, Rejected

### Reports (`/reports`)

Review community fraud reports:
- View all reports
- Verify reports (adds to blacklist, optional GitHub PR)
- Reject with reason
- Status filtering

### Contributions (`/contributions`)

Track GitHub PRs to polkadot-js/phishing:
- View all PRs created by the platform
- Sync PR status from GitHub
- Filter by status: Open, Merged, Closed

### Activity Log (`/activity`)

Audit trail of admin actions:
- Whitelist additions/removals
- Report verifications
- Request approvals
- Timestamped entries

---

## API Integration

The admin dashboard connects to the Wisesama API for all operations.

### Configuration

```typescript
// lib/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

### Authentication Headers

All requests include the JWT token:
```typescript
Authorization: Bearer <token>
```

### Admin Endpoints Used

| Endpoint | Description |
|----------|-------------|
| `POST /api/v1/auth/admin/login` | Admin login |
| `GET /api/v1/auth/admin/validate` | Validate JWT |
| `GET /api/v1/admin/whitelist` | List whitelist entries |
| `POST /api/v1/admin/whitelist` | Create entry |
| `PUT /api/v1/admin/whitelist/:id` | Update entry |
| `DELETE /api/v1/admin/whitelist/:id` | Delete entry |
| `GET /api/v1/admin/whitelist-requests` | List requests |
| `PUT /api/v1/admin/whitelist-requests/:id/status` | Update request |
| `GET /api/v1/admin/reports` | List reports |
| `PUT /api/v1/admin/reports/:id/status` | Update report |
| `GET /api/v1/admin/contributions` | List GitHub PRs |
| `GET /api/v1/admin/activity` | Activity logs |
| `GET /api/v1/admin/stats` | Dashboard stats |

---

## Environment Variables

### Required

```bash
# API URL
NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Production

```bash
NEXT_PUBLIC_API_URL=https://api.wisesama.com
```

---

## Development

### Setup

```bash
# Install dependencies (from monorepo root)
pnpm install

# Start admin dashboard
pnpm --filter @wisesama/admin dev

# Or start all apps
pnpm dev
```

### Local URLs

- Admin Dashboard: `http://localhost:3002`
- API: `http://localhost:3001`
- Web App: `http://localhost:3000`

### Default Admin Credentials

```
Email: admin@wisesama.com
Password: admin123
```

> **Note:** Change these credentials in production!

---

## Deployment

### Vercel

The admin dashboard is deployed separately from the main web app:

```bash
# Deploy to Vercel
cd apps/admin
vercel --prod
```

### Domain Configuration

- Production: `admin.wisesama.com`
- Ensure CORS is configured on the API to allow this origin

### Environment Setup

In Vercel dashboard, set:
- `NEXT_PUBLIC_API_URL` = `https://api.wisesama.com`

---

## Security Considerations

1. **Authentication Required** - All routes except `/login` require valid JWT
2. **Role Verification** - API validates `ADMIN` role on all admin endpoints
3. **Token Expiry** - JWTs expire after configured duration (default 7 days)
4. **HTTPS Only** - Production must use HTTPS
5. **CORS Restricted** - API only accepts requests from allowed origins

---

## Theming

The admin dashboard uses the Wisesama brand colors:

```css
/* Tailwind CSS custom colors */
--wisesama-bg: #0a0a0f
--wisesama-purple: #8b5cf6
--wisesama-purple-light: #a78bfa
--wisesama-pink: #ec4899
--sidebar: #111118
--sidebar-border: #1e1e2e
```

Components use the glass-card effect with subtle gradients matching the main web app aesthetic.
