'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect } from 'react';
import { githubNeedsAccountLink, safeWorkspaceDestination, useSession } from '../lib/auth-client';
import { AccountAccess } from './account-access';
import { AdvisoryDetail } from './advisory-detail';
import { EmailSignIn } from './email-sign-in';
import { OrganizationInvitation } from './organization-workspace';
import { PublicShell, PublicSite } from './public-site';
import { PublicSubscription, SubscriptionPage } from './public-subscription';
import { BriefingsView } from './supporting-views';

function advisoryIdentifier(path: string) {
  const value = path.slice('/feed/'.length);
  try {
    return decodeURIComponent(value);
  } catch {
    // Let the existing advisory error state handle a malformed URL rather than crashing rendering.
    return value;
  }
}

function PublicAccount({ register }: { register: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const { data: session, refetch } = useSession();
  const next = safeWorkspaceDestination(params.get('next'));
  const githubError = params.get('error');
  const destination = githubNeedsAccountLink(githubError)
    ? `/app/settings/integrations?${new URLSearchParams({ next })}`
    : next;
  useEffect(() => {
    if (session?.user) router.replace(destination);
  }, [session?.user, destination, router]);
  return (
    <PublicShell>
      <div className="public-account">
        <AccountAccess
          initialMode={register && !githubNeedsAccountLink(githubError) ? 'register' : 'sign-in'}
          githubReturnTo={next}
          githubError={githubError}
          onAuthenticated={() => {
            void refetch();
            router.replace(destination);
          }}
        />
      </div>
    </PublicShell>
  );
}

export function ProductEntry({ path }: { path: string }) {
  if (path === '/invite')
    return (
      <PublicShell path={path}>
        <div id="invitation-account" tabIndex={-1}>
          <OrganizationInvitation />
        </div>
      </PublicShell>
    );
  if (path === '/sign-in/verify')
    return (
      <PublicShell path={path}>
        <EmailSignIn />
      </PublicShell>
    );
  if (path === '/sign-in' || path === '/sign-up')
    return <PublicAccount register={path === '/sign-up'} />;
  if (path === '/subscribe/confirm' || path === '/subscribe/manage')
    return (
      <PublicShell path={path}>
        <SubscriptionPage mode={path.endsWith('confirm') ? 'confirm' : 'manage'} />
      </PublicShell>
    );
  if (path === '/feed')
    return (
      <PublicShell path={path}>
        <div className="public-feed">
          <BriefingsView />
          <PublicSubscription />
        </div>
      </PublicShell>
    );
  if (path.startsWith('/feed/'))
    return (
      <PublicShell path={path}>
        <div className="public-feed advisory-public">
          <AdvisoryDetail id={advisoryIdentifier(path)} />
        </div>
      </PublicShell>
    );
  return <PublicSite path={path} />;
}
