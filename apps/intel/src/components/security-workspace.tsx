'use client';

import {
  Bell,
  ChevronRight,
  FileText,
  Inbox,
  Layers3,
  LogOut,
  Moon,
  Plug,
  RefreshCw,
  Sun,
  Users,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError, intelApi } from '../lib/api';
import { authClient, useSession } from '../lib/auth-client';
import type { FindingUpdate, Workspace } from '../lib/models';
import {
  canManageOrganization,
  type Organization,
  organizationApi,
  organizationSelectionKey,
} from '../lib/organization-api';
import { AccountAccess } from './account-access';
import { AdvisoryDetail } from './advisory-detail';
import { FindingDetail } from './finding-detail';
import { FindingsInbox } from './findings-inbox';
import { InventoryFlow } from './inventory-flow';
import {
  OrganizationCreation,
  OrganizationSettings,
  OrganizationSwitcher,
} from './organization-workspace';
import { ProjectSecurity } from './project-security';
import { RepositoryOnboarding, RepositorySettings } from './repository-flow';
import { ProjectResponseChooser, ResponsePlaybook } from './response-playbook';
import { BriefingsView, NotificationsView, ProjectsView } from './supporting-views';

function workspacePath(path: string) {
  if (path === '/app' || path === '/app/inbox') return '/';
  return path
    .replace(/^\/app/, '')
    .replace('/settings/notifications', '/notifications')
    .replace('/settings/integrations', '/integrations');
}

type User = { id: string; name?: string | null; email: string };
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'This request could not complete. Try again.';

function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const light = mounted && resolvedTheme === 'light';
  return (
    <button
      className="button ghost theme-toggle"
      type="button"
      aria-label={`Switch to ${light ? 'dark' : 'light'} mode`}
      onClick={() => setTheme(light ? 'dark' : 'light')}
    >
      {light ? <Moon /> : <Sun />}
      <span>{light ? 'Dark' : 'Light'} mode</span>
    </button>
  );
}

function Shell({
  children,
  user,
  openCount,
  refreshing,
  onRefresh,
  organizations = [],
  organization,
  onOrganizationChange,
}: {
  children: React.ReactNode;
  user?: User;
  openCount?: number;
  refreshing?: boolean;
  onRefresh?: () => void;
  organizations?: Organization[];
  organization?: Organization;
  onOrganizationChange?: (id: string) => void;
}) {
  const path = workspacePath(usePathname());
  const isFinding = path.startsWith('/findings/');
  const active =
    path.startsWith('/projects') || path.startsWith('/responses')
      ? 'projects'
      : path.startsWith('/briefings')
        ? 'briefings'
        : path.startsWith('/integrations')
          ? 'integrations'
          : path.startsWith('/settings/organization')
            ? 'organization'
            : path.startsWith('/notifications')
              ? 'notifications'
              : 'inbox';
  const title =
    active === 'inbox'
      ? isFinding
        ? 'Finding'
        : 'Response inbox'
      : active[0]?.toUpperCase() + active.slice(1);
  const nav = [
    { href: '/app/inbox', key: 'inbox', label: 'Response inbox', icon: Inbox },
    { href: '/app/projects', key: 'projects', label: 'Projects', icon: Layers3 },
    { href: '/feed', key: 'briefings', label: 'Public feed', icon: FileText },
    { href: '/app/settings/integrations', key: 'integrations', label: 'Connections', icon: Plug },
  ];
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div className="shell">
        <aside className="sidebar" aria-label="Main navigation">
          <Link href="/" className="brand" aria-label="Wisesama home">
            <Image className="logo-dark" src="/logo.svg" alt="Wisesama" width="160" height="29" />
            <Image
              className="logo-light"
              src="/logo-light.svg"
              alt="Wisesama"
              width="160"
              height="29"
            />
          </Link>
          {user && onOrganizationChange ? (
            <OrganizationSwitcher
              organizations={organizations}
              current={organization}
              onChange={onOrganizationChange}
              busy={Boolean(refreshing)}
            />
          ) : (
            <div className="workspace">
              <strong>Security response</strong>Vulnerability intelligence
            </div>
          )}
          <nav className="nav">
            {nav.map((item) => (
              <Link
                href={item.href}
                key={item.key}
                className={active === item.key ? 'active' : ''}
                aria-current={active === item.key ? 'page' : undefined}
              >
                <item.icon />
                {item.label}
                {item.key === 'inbox' && openCount !== undefined ? (
                  <span className="count">{openCount}</span>
                ) : null}
              </Link>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <nav className="nav">
              <Link
                href="/app/settings/organization"
                className={active === 'organization' ? 'active' : ''}
                aria-current={active === 'organization' ? 'page' : undefined}
              >
                <Users />
                Organization
              </Link>
              <Link
                href="/app/settings/notifications"
                className={active === 'notifications' ? 'active' : ''}
                aria-current={active === 'notifications' ? 'page' : undefined}
              >
                <Bell />
                Notifications
              </Link>
            </nav>
            {user ? (
              <div className="profile">
                <span className="avatar">
                  {(user.name || user.email).slice(0, 2).toUpperCase()}
                </span>
                <div className="profile-info">
                  <span>{user.name || 'Your account'}</span>
                  <small>{user.email}</small>
                </div>
                <button
                  className="icon-button"
                  type="button"
                  aria-label="Sign out"
                  onClick={() => void authClient.signOut()}
                >
                  <LogOut />
                </button>
              </div>
            ) : (
              <div className="profile">
                <Link className="text-link" href="/sign-in">
                  Sign in to your workspace
                </Link>
              </div>
            )}
          </div>
        </aside>
        <header className="topbar">
          <div className="breadcrumb">
            <Link href="/" aria-label="Wisesama home" className="mobile-brand">
              <Image src="/favicon.svg" width="23" height="23" alt="" />
            </Link>
            <span className="root-label">Workspace</span>
            <ChevronRight />
            <span className="current">{title}</span>
          </div>
          <div className="top-actions">
            {onRefresh ? (
              <button
                className="icon-button"
                type="button"
                disabled={refreshing}
                aria-label="Refresh workspace"
                onClick={onRefresh}
              >
                <RefreshCw className={refreshing ? 'is-spinning' : ''} />
              </button>
            ) : null}
            <ThemeToggle />
          </div>
        </header>
        <nav className="mobile-nav" aria-label="Mobile navigation">
          {nav.map((item) => (
            <Link href={item.href} key={item.key} className={active === item.key ? 'active' : ''}>
              {item.key === 'inbox' ? 'Inbox' : item.label}
            </Link>
          ))}
          <Link
            href="/app/settings/organization"
            className={active === 'organization' ? 'active' : ''}
          >
            Organization
          </Link>
          <Link
            href="/app/settings/notifications"
            className={active === 'notifications' ? 'active' : ''}
          >
            Notifications
          </Link>
          {user ? (
            <button
              className="mobile-signout"
              type="button"
              aria-label="Sign out"
              onClick={() => void authClient.signOut()}
            >
              <LogOut />
            </button>
          ) : null}
        </nav>
        {user && onOrganizationChange ? (
          <div className="org-mobile-switcher">
            <OrganizationSwitcher
              organizations={organizations}
              current={organization}
              onChange={onOrganizationChange}
              busy={Boolean(refreshing)}
            />
          </div>
        ) : null}
        <main id="main" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </>
  );
}

function AuthenticatedWorkspace({ user }: { user: User }) {
  const path = workspacePath(usePathname());
  const router = useRouter();
  const searchParams = useSearchParams();
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [organizationsLoaded, setOrganizationsLoaded] = useState(false);
  const selection = useRef('');
  const requestSequence = useRef(0);
  const organization = organizations.find((item) => item.id === organizationId);
  const canManage = canManageOrganization(organization?.role);

  const refresh = useCallback(
    async (signal?: AbortSignal) => {
      const sequence = ++requestSequence.current;
      setRefreshing(true);
      try {
        const directory = await organizationApi.list(signal);
        if (signal?.aborted || sequence !== requestSequence.current) return;
        let preferred = selection.current;
        if (!preferred) {
          try {
            preferred = localStorage.getItem(organizationSelectionKey(user.id)) || '';
          } catch {
            /* Optional preference. */
          }
        }
        const selected =
          directory.organizations.find((item) => item.id === preferred) ||
          directory.organizations.find((item) => item.id === directory.defaultOrganizationId) ||
          directory.organizations[0];
        if (selection.current !== (selected?.id || '')) setWorkspace(null);
        setOrganizations(directory.organizations);
        setOrganizationsLoaded(true);
        selection.current = selected?.id || '';
        setOrganizationId(selected?.id || '');
        if (!selected) {
          setWorkspace(null);
          setError('');
          return;
        }
        try {
          localStorage.setItem(organizationSelectionKey(user.id), selected.id);
        } catch {
          /* Live membership is authoritative. */
        }
        const data = await intelApi.getWorkspace(signal, selected.id);
        if (signal?.aborted || sequence !== requestSequence.current) return;
        setWorkspace(data);
        setError('');
        setExpired(false);
      } catch (cause) {
        if (signal?.aborted || sequence !== requestSequence.current) return;
        setError(message(cause));
        if (cause instanceof ApiError && cause.status === 401) setExpired(true);
        if (cause instanceof ApiError && [401, 403, 404].includes(cause.status)) {
          setWorkspace(null);
          setOrganizations([]);
          setOrganizationId('');
        }
        throw cause;
      } finally {
        if (!signal?.aborted && sequence === requestSequence.current) setRefreshing(false);
      }
    },
    [user.id],
  );

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal).catch(() => {});
    return () => controller.abort();
  }, [refresh]);
  useEffect(() => {
    const recheck = () => void refresh().catch(() => {});
    const accessDenied = () => {
      setWorkspace(null);
      setOrganizations([]);
      setOrganizationId('');
      setError('Your organization access changed. Checking current membership…');
      recheck();
    };
    window.addEventListener('focus', recheck);
    window.addEventListener('wisesama:membership-access-denied', accessDenied);
    return () => {
      window.removeEventListener('focus', recheck);
      window.removeEventListener('wisesama:membership-access-denied', accessDenied);
    };
  }, [refresh]);

  function changeOrganization(id: string, created?: Organization) {
    if (!created && !organizations.some((item) => item.id === id)) return;
    selection.current = id;
    setOrganizationId(id);
    if (created) setOrganizations((previous) => [...previous, created]);
    setWorkspace(null);
    setError('');
    if (path !== '/projects/new') router.push('/app/projects');
    void refresh().catch(() => {});
  }

  async function scan(id: string) {
    try {
      await intelApi.scanProject(id);
    } finally {
      await refresh().catch(() => {});
    }
  }
  async function completeImport(id: string) {
    await scan(id);
    router.push(`/app/projects/${encodeURIComponent(id)}/security`);
  }
  async function updateFinding(id: string, input: FindingUpdate) {
    const updated = await intelApi.updateFinding(id, input);
    setWorkspace((previous) =>
      previous
        ? {
            ...previous,
            findings: previous.findings.map((item) => (item.id === id ? updated : item)),
          }
        : previous,
    );
    await refresh();
  }
  async function updateEmail(enabled: boolean) {
    const settings = await intelApi.updateNotifications(enabled);
    setWorkspace((previous) =>
      previous ? { ...previous, notificationSettings: settings } : previous,
    );
  }
  async function testEmail() {
    const delivery = await intelApi.testNotification();
    setWorkspace((previous) =>
      previous ? { ...previous, deliveries: [delivery, ...previous.deliveries] } : previous,
    );
    if (delivery.status !== 'sent')
      throw new Error('The test email hasn’t been sent yet. Check delivery history for an update.');
  }
  async function verifyEmail() {
    const response = await authClient.sendVerificationEmail({
      email: user.email,
      callbackURL: `${window.location.origin}/app/settings/notifications`,
    });
    if (response.error)
      throw new Error('We couldn’t send the verification email. Try again in a moment.');
  }

  let content: React.ReactNode;
  if (path === '/briefings') content = <BriefingsView />;
  else if (path.startsWith('/briefings/'))
    content = <AdvisoryDetail id={path.slice('/briefings/'.length)} />;
  else if (expired)
    content = (
      <div className="empty-state">
        <h1>Sign in again to continue</h1>
        <p>Your session has ended. Your saved work is still in your account.</p>
        <button type="button" className="button primary" onClick={() => void authClient.signOut()}>
          Return to sign in
        </button>
      </div>
    );
  else if (path === '/settings/organization' && organization)
    content = (
      <OrganizationSettings
        key={organization.id}
        organization={organization}
        userId={user.id}
        onChanged={() => refresh()}
        onCreated={(created) => changeOrganization(created.id, created)}
      />
    );
  else if (organizationsLoaded && !organization && !error)
    content = (
      <OrganizationCreation onCreated={(created) => changeOrganization(created.id, created)} />
    );
  else if (!workspace)
    content = error ? (
      <div className="empty-state" role="alert">
        <h1>Your workspace could not load</h1>
        <p>{error}</p>
        <button
          className="button primary"
          type="button"
          onClick={() => void refresh().catch(() => {})}
        >
          Try again
        </button>
      </div>
    ) : (
      <div className="workspace-loading" role="status">
        <span className="spinner" />
        <h1>Loading your workspace</h1>
        <p>Collecting your projects and response history.</p>
      </div>
    );
  else if (path === '/integrations')
    content = (
      <RepositorySettings
        key={organization?.id}
        organizationId={organization?.id || ''}
        canManage={canManage}
        userId={user.id}
      />
    );
  else if (path === '/responses/new')
    content = (
      <ProjectResponseChooser
        playbookId={searchParams.get('playbook') || ''}
        projects={workspace.projects}
      />
    );
  else if (
    (path === '/projects/new' ||
      path === '/projects/new/manual' ||
      (path.startsWith('/projects/') && path.endsWith('/inventory'))) &&
    !canManage
  )
    content = (
      <div className="empty-state">
        <h1>Project settings need an owner or admin</h1>
        <p>
          Your member role can review projects and contribute findings, context and responses. Ask
          an owner or admin to add a project or update its inventory.
        </p>
        <Link className="button" href="/app/projects">
          View projects
        </Link>
        <Link className="text-link" href="/app/settings/organization">
          View organization members
        </Link>
      </div>
    );
  else if (path === '/projects/new' && organization)
    content = (
      <RepositoryOnboarding
        key={organization.id}
        organization={organization}
        onComplete={async (id) => {
          await refresh();
          router.push(`/app/projects/${encodeURIComponent(id)}/security`);
        }}
      />
    );
  else if (path === '/projects/new/manual' && organization)
    content = (
      <InventoryFlow
        key={organization.id}
        organization={organization}
        onComplete={completeImport}
        onCancel={() => router.push('/app/projects')}
      />
    );
  else if (path.startsWith('/projects/') && path.endsWith('/security')) {
    const project = workspace.projects.find((item) => item.id === path.split('/')[2]);
    content = project ? (
      <ProjectSecurity key={project.id} project={project} />
    ) : (
      <NotFound onBack={() => router.push('/app/projects')} />
    );
  } else if (path.startsWith('/projects/') && path.split('/')[3] === 'responses') {
    const project = workspace.projects.find((item) => item.id === path.split('/')[2]);
    content = project ? (
      <ResponsePlaybook
        key={`${project.id}-${path.split('/')[4]}`}
        project={project}
        playbookId={path.split('/')[4] || ''}
      />
    ) : (
      <NotFound onBack={() => router.push('/app/projects')} />
    );
  } else if (path.startsWith('/projects/') && path.endsWith('/inventory')) {
    const projectId = path.split('/')[2];
    const project = workspace.projects.find((item) => item.id === projectId);
    content = project ? (
      <InventoryFlow
        key={project.id}
        project={project}
        organization={organization}
        onComplete={completeImport}
        onCancel={() => router.push('/app/projects')}
      />
    ) : (
      <NotFound onBack={() => router.push('/app/projects')} />
    );
  } else if (path === '/projects')
    content = (
      <ProjectsView
        canManage={canManage}
        organizationName={organization?.name}
        projects={workspace.projects}
        findings={workspace.findings}
        onAdd={() => router.push('/app/projects/new')}
        onView={(id) => router.push(`/app/inbox?project=${encodeURIComponent(id)}`)}
        onImport={(id) => router.push(`/app/projects/${encodeURIComponent(id)}/inventory`)}
        onScan={scan}
      />
    );
  else if (path === '/notifications')
    content = (
      <NotificationsView
        settings={workspace.notificationSettings}
        deliveries={workspace.deliveries}
        onToggle={updateEmail}
        onTest={testEmail}
        onVerify={verifyEmail}
      />
    );
  else if (path.startsWith('/findings/')) {
    const finding = workspace.findings.find((item) => item.id === path.split('/')[2]);
    content = finding ? (
      <FindingDetail
        key={finding.id}
        finding={finding}
        canManage={canManage}
        project={workspace.projects.find((item) => item.id === finding.projectId)}
        onUpdate={updateFinding}
        onBack={() => router.push('/app/inbox')}
        onViewInventory={(id) => router.push(`/app/projects/${encodeURIComponent(id)}/inventory`)}
      />
    ) : (
      <NotFound onBack={() => router.push('/app/inbox')} />
    );
  } else if (path === '/')
    content = (
      <FindingsInbox
        canManage={canManage}
        key={searchParams.get('project') || 'all'}
        projects={workspace.projects}
        findings={workspace.findings}
        projectId={searchParams.get('project') || undefined}
        onAdd={() => router.push('/app/projects/new')}
      />
    );
  else content = <NotFound onBack={() => router.push('/app/inbox')} />;

  const openCount = workspace?.findings.filter(
    (finding) => !['resolved', 'not_affected'].includes(finding.status),
  ).length;
  const incompleteProjects =
    workspace?.projects.filter(
      (project) =>
        project.scanError ||
        !project.lastScannedAt ||
        project.sources.some((source) => source.status !== 'healthy'),
    ) ?? [];
  return (
    <Shell
      user={user}
      openCount={openCount}
      refreshing={refreshing}
      onRefresh={() => void refresh().catch(() => {})}
      organizations={organizations}
      organization={organization}
      onOrganizationChange={(id) => changeOrganization(id)}
    >
      {error && workspace && !path.startsWith('/briefings') ? (
        <p className="notice error" role="alert">
          {error} Previously loaded information is still shown.
        </p>
      ) : null}
      {path === '/' && incompleteProjects.length ? (
        <div className="notice" role="status">
          <div>
            <strong>Some project assessments need attention</strong>
            {incompleteProjects.map((project) => project.name).join(', ')}: an assessment is missing
            or a source could not complete its check. Existing findings remain visible.{' '}
            <Link href="/app/projects" className="text-link">
              Review coverage
            </Link>
          </div>
        </div>
      ) : null}
      {content}
    </Shell>
  );
}

function NotFound({ onBack }: { onBack: () => void }) {
  return (
    <div className="empty-state">
      <h1>This record is not available</h1>
      <p>
        It may belong to another organization or no longer be available. Check the organization
        selected above.
      </p>
      <button type="button" className="button" onClick={onBack}>
        Back to workspace
      </button>
    </div>
  );
}

export function SecurityWorkspace() {
  const { data: session, isPending, error, refetch } = useSession();
  const pathname = usePathname();
  const params = useSearchParams();
  const path = workspacePath(pathname);
  const query = params.toString();
  if (session?.user) return <AuthenticatedWorkspace key={session.user.id} user={session.user} />;
  if (path === '/briefings' || path.startsWith('/briefings/'))
    return (
      <Shell>
        {path === '/briefings' ? (
          <BriefingsView />
        ) : (
          <AdvisoryDetail id={path.slice('/briefings/'.length)} />
        )}
      </Shell>
    );
  return (
    <Shell>
      {isPending ? (
        <div className="workspace-loading" role="status">
          <span className="spinner" />
          <p>Checking your session…</p>
        </div>
      ) : error ? (
        <div className="empty-state" role="alert">
          <h1>Account service is unavailable</h1>
          <p>We could not check your session. Check your connection and try again.</p>
          <button className="button primary" type="button" onClick={() => void refetch()}>
            Try again
          </button>
          <Link href="/feed" className="text-link">
            Read public briefings
          </Link>
        </div>
      ) : (
        <AccountAccess
          githubReturnTo={query ? `${pathname}?${query}` : pathname}
          onAuthenticated={() => void refetch()}
        />
      )}
    </Shell>
  );
}
