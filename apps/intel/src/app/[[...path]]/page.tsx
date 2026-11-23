import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { AdminWorkspace } from '../../components/admin/admin-workspace';
import { ProductEntry } from '../../components/product-entry';
import { SecurityWorkspace } from '../../components/security-workspace';

type Props = {
  params: Promise<{ path?: string[] }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
const titles: Record<string, string> = {
  '/': 'Vulnerability intelligence for your software',
  '/product': 'From advisory to response',
  '/feed': 'Public vulnerability feed',
  '/agents': 'Security intelligence for agents',
  '/skills': 'Free open-source CI audit skill',
  '/guides': 'Practical security response guides',
  '/playbooks': 'Security incident response playbooks',
  '/playbooks/malicious-dependency': 'Respond to a malicious dependency',
  '/playbooks/cursor-extension-oct-2026': 'Review the October Cursor extension incident',
  '/docs': 'Developer documentation',
  '/pricing': 'Plans and launch access',
  '/integrations/github': 'GitHub integration',
  '/integrations/gitlab': 'GitLab.com integration',
  '/security': 'Security and data handling',
  '/privacy': 'Privacy',
  '/terms': 'Preview terms',
  '/sign-in': 'Sign in',
  '/sign-up': 'Create your account',
  '/invite': 'Organization invitation',
};
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { path: segments = [] } = await params;
  const path = `/${segments.join('/')}`;
  return {
    title: `${titles[path] || (path === '/admin' || path.startsWith('/admin/') ? 'Platform administration' : path.startsWith('/app') ? 'Response workspace' : 'Security response')} · Wisesama`,
    referrer: 'no-referrer',
    robots:
      path === '/invite' ||
      path === '/admin' ||
      path.startsWith('/admin/') ||
      path.startsWith('/app')
        ? { index: false, follow: false }
        : undefined,
    alternates: { types: { 'application/rss+xml': '/feed.xml' } },
  };
}
export default async function WorkspacePage({ params, searchParams }: Props) {
  const { path: segments = [] } = await params;
  const path = `/${segments.join('/')}`;
  const query = await searchParams;
  const suffix = new URLSearchParams(
    Object.entries(query).flatMap(([key, value]) =>
      Array.isArray(value)
        ? value.map((item) => [key, item])
        : value === undefined
          ? []
          : [[key, value]],
    ),
  ).toString();
  const withQuery = (target: string) => `${target}${suffix ? `?${suffix}` : ''}`;
  if (path === '/briefings' || path.startsWith('/briefings/'))
    redirect(withQuery(path.replace('/briefings', '/feed')));
  if (path === '/projects' || path.startsWith('/projects/') || path.startsWith('/findings/'))
    redirect(withQuery(`/app${path}`));
  if (path === '/notifications') redirect(withQuery('/app/settings/notifications'));
  if (path === '/app') redirect(withQuery('/app/inbox'));
  return (
    <Suspense fallback={<main className="standalone-message">Loading Wisesama…</main>}>
      {path === '/admin' || path.startsWith('/admin/') ? (
        <AdminWorkspace />
      ) : path.startsWith('/app/') ? (
        <SecurityWorkspace />
      ) : (
        <ProductEntry path={path} />
      )}
    </Suspense>
  );
}
