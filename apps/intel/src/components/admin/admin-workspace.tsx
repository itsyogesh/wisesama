'use client';

import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  LogOut,
  Moon,
  Radio,
  ShieldCheck,
  Sun,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { type FormEvent, type ReactNode, useEffect, useId, useState } from 'react';
import type { AdminAudit, AdminPage, AdminSession } from '../../lib/admin-api';
import { ADMIN_ACCESS_LOST_EVENT } from '../../lib/admin-api';
import { authClient, useSession } from '../../lib/auth-client';
import {
  AuditTrail,
  collectionPath,
  EmptyState,
  errorMessage,
  LoadState,
  PageHeading,
  Pagination,
  useAdminData,
} from './admin-common';
import {
  AdminOverviewView,
  JobRecord,
  JobsList,
  NewJob,
  SourceRecord,
  SourcesList,
} from './admin-operations';
import {
  AdvisoriesList,
  AdvisoryRecord,
  SubscriberRecord,
  SubscribersList,
  UserRecord,
  UsersList,
} from './admin-records';
import './admin-workspace.css';

const navigation = [
  { key: '', href: '/admin', label: 'Overview', icon: Activity },
  { key: 'users', href: '/admin/users', label: 'Users', icon: Users },
  { key: 'advisories', href: '/admin/advisories', label: 'Advisories', icon: BookOpen },
  { key: 'sources', href: '/admin/sources', label: 'Sources', icon: Radio },
  {
    key: 'subscriptions',
    href: '/admin/subscriptions',
    label: 'Subscriptions',
    icon: ClipboardList,
  },
  { key: 'jobs', href: '/admin/jobs', label: 'Failed jobs', icon: BriefcaseBusiness },
];
function ThemeControl() {
  const { resolvedTheme, setTheme } = useTheme();
  const [ready, setReady] = useState(false);
  useEffect(() => setReady(true), []);
  const light = ready && resolvedTheme === 'light';
  return (
    <button
      className="am-icon-button"
      type="button"
      aria-label={`Switch to ${light ? 'dark' : 'light'} mode`}
      onClick={() => setTheme(light ? 'dark' : 'light')}
    >
      {light ? <Moon /> : <Sun />}
    </button>
  );
}
function Brand() {
  return (
    <Link className="am-brand" href="/admin" aria-label="Wisesama admin home">
      <Image className="logo-dark" src="/logo.svg" width={156} height={29} alt="Wisesama" />
      <Image className="logo-light" src="/logo-light.svg" width={156} height={29} alt="Wisesama" />
    </Link>
  );
}

function AdminSignIn({ onAuthenticated }: { onAuthenticated: () => void }) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        setError(result.error.message || 'Sign-in failed. Check your details and try again.');
        return;
      }
      setPassword('');
      onAuthenticated();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="am-access">
      <div className="am-access-top">
        <Brand />
        <ThemeControl />
      </div>
      <main className="am-signin">
        <div className="am-signin-intro">
          <ShieldCheck />
          <h1>Wisesama administration</h1>
          <p>Manage the intelligence, accounts, and delivery operations behind Wisesama.</p>
          <p className="am-boundary">
            Use an existing account with V2 administrator access. Creating a customer account or
            holding a Dotsama admin role does not grant access here.
          </p>
          <Link className="am-text-link" href="/app/inbox">
            <ArrowLeft />
            Return to the customer workspace
          </Link>
        </div>
        <section className="am-signin-form">
          <h2>Operator sign in</h2>
          <p>Sign in with an account that can manage Wisesama.</p>
          <form onSubmit={(event) => void submit(event)}>
            <fieldset disabled={busy}>
              <label htmlFor={`${id}-email`}>Email address</label>
              <input
                id={`${id}-email`}
                type="email"
                autoComplete="username"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
              <label htmlFor={`${id}-password`}>Password</label>
              <input
                id={`${id}-password`}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
              <button className="button primary" type="submit">
                {busy ? 'Signing in…' : 'Sign in to admin'}
                <ArrowRight />
              </button>
            </fieldset>
          </form>
          {error ? (
            <p className="am-error" role="alert">
              {error}
            </p>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function AdminShell({ session, children }: { session: AdminSession; children: ReactNode }) {
  const pathname = usePathname();
  const section = pathname.split('/')[2] || '';
  const active = navigation.find((item) => item.key === section);
  const title = section === 'audit' ? 'Audit log' : active?.label || 'Administration';
  return (
    <div className="am-shell">
      <a href="#admin-main" className="skip-link">
        Skip to admin content
      </a>
      <aside className="am-sidebar" aria-label="Admin navigation">
        <Brand />
        <div className="am-workspace-label">
          <ShieldCheck />
          <div>
            <strong>Platform administration</strong>
            <span>Wisesama v2</span>
          </div>
        </div>
        <nav>
          {navigation.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={section === item.key ? 'page' : undefined}
            >
              <item.icon />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="am-sidebar-bottom">
          <nav>
            <Link href="/admin/audit" aria-current={section === 'audit' ? 'page' : undefined}>
              <ClipboardList />
              Audit log
            </Link>
            <Link href="/app/inbox">
              <ArrowLeft />
              Customer workspace
            </Link>
          </nav>
          <div className="am-operator">
            <div>
              <strong>{session.user.name || 'Administrator'}</strong>
              <span>{session.user.email}</span>
            </div>
            <button
              className="am-icon-button"
              type="button"
              aria-label="Sign out"
              onClick={() => void authClient.signOut()}
            >
              <LogOut />
            </button>
          </div>
        </div>
      </aside>
      <header className="am-topbar">
        <div>
          <Image className="am-mobile-mark" src="/favicon.svg" width={24} height={24} alt="" />
          <span>Administration</span>
          <ChevronRight />
          <strong>{title}</strong>
        </div>
        <div>
          <Link href="/docs" className="am-doc-link">
            <CircleHelp />
            Help
          </Link>
          <ThemeControl />
          <button
            className="am-icon-button am-mobile-signout"
            type="button"
            aria-label="Sign out"
            onClick={() => void authClient.signOut()}
          >
            <LogOut />
          </button>
        </div>
      </header>
      <nav className="am-mobile-nav" aria-label="Mobile admin navigation">
        {navigation.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            aria-current={section === item.key ? 'page' : undefined}
          >
            {item.label}
          </Link>
        ))}
        <Link href="/admin/audit">Audit log</Link>
      </nav>
      <main className="am-content" id="admin-main" tabIndex={-1}>
        {children}
      </main>
    </div>
  );
}

function AuditPage() {
  const params = useSearchParams();
  const state = useAdminData<AdminPage<AdminAudit>>(collectionPath('/audit', params));
  return (
    <>
      <PageHeading
        title="Audit log"
        description="Recorded operator changes, with the actor, target, reason, and time."
      />
      <LoadState
        error={state.error}
        loading={state.loading}
        hasData={Boolean(state.data)}
        onRetry={() => void state.reload()}
      />
      {state.data ? (
        <>
          <AuditTrail events={state.data.items} title="Latest operator changes" />
          <Pagination nextCursor={state.data.nextCursor} count={state.data.items.length} />
        </>
      ) : null}
    </>
  );
}
function decodeSegment(value: string | undefined) {
  try {
    return value ? decodeURIComponent(value) : '';
  } catch {
    return '';
  }
}
function AdminRoutes({ session }: { session: AdminSession }) {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);
  const section = segments[1] || '';
  const id = decodeSegment(segments[2]);
  if (segments.length > 3)
    return (
      <EmptyState
        title="Admin page not found"
        description="Choose a section from the administration navigation."
      />
    );
  if (!section) return <AdminOverviewView />;
  if (section === 'users')
    return id ? <UserRecord key={id} id={id} actorId={session.user.id} /> : <UsersList />;
  if (section === 'advisories')
    return id ? <AdvisoryRecord key={id} id={id} /> : <AdvisoriesList />;
  if (section === 'subscriptions')
    return id ? <SubscriberRecord key={id} id={id} /> : <SubscribersList />;
  if (section === 'sources') return id ? <SourceRecord key={id} id={id} /> : <SourcesList />;
  if (section === 'jobs')
    return id === 'new' ? <NewJob /> : id ? <JobRecord key={id} id={id} /> : <JobsList />;
  if (section === 'audit' && !id) return <AuditPage />;
  return (
    <EmptyState
      title="Admin page not found"
      description="Choose a section from the administration navigation."
    />
  );
}
function OperatorGate() {
  const state = useAdminData<AdminSession>('/session');
  const { setData } = state;
  useEffect(() => {
    const clearAccess = () => setData(null);
    window.addEventListener(ADMIN_ACCESS_LOST_EVENT, clearAccess);
    return () => window.removeEventListener(ADMIN_ACCESS_LOST_EVENT, clearAccess);
  }, [setData]);
  if (!state.data)
    return (
      <div className="am-access">
        <div className="am-access-top">
          <Brand />
          <ThemeControl />
        </div>
        <main className="am-gate-message">
          {state.loading ? (
            <div className="am-loading" role="status">
              <span className="spinner" />
              Checking administrator access…
            </div>
          ) : (
            <>
              <ShieldCheck />
              <h1>
                {state.error && state.errorStatus !== 401 && state.errorStatus !== 403
                  ? 'Administrator access could not be checked'
                  : 'Administrator access required'}
              </h1>
              <p>{state.error || 'This account does not have Wisesama v2 administrator access.'}</p>
              <p>
                V2 operator access is managed separately from customer accounts and Dotsama roles.
              </p>
              <div className="am-gate-actions">
                <button className="button" type="button" onClick={() => void state.reload()}>
                  Check access again
                </button>
                <button className="button" type="button" onClick={() => void authClient.signOut()}>
                  Sign in with another account
                </button>
                <Link className="am-text-link" href="/app/inbox">
                  Return to workspace <ArrowRight />
                </Link>
              </div>
            </>
          )}
        </main>
      </div>
    );
  return (
    <AdminShell session={state.data}>
      <AdminRoutes session={state.data} />
    </AdminShell>
  );
}
export function AdminWorkspace() {
  const { data: session, isPending, refetch } = useSession();
  if (isPending)
    return (
      <main className="am-loading am-access-loading" role="status">
        <span className="spinner" />
        Checking your session…
      </main>
    );
  return session?.user ? (
    <OperatorGate key={session.user.id} />
  ) : (
    <AdminSignIn
      onAuthenticated={() => {
        void refetch();
      }}
    />
  );
}
