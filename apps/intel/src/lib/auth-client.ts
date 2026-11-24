import { magicLinkClient } from 'better-auth/client/plugins';
import { createAuthClient } from 'better-auth/react';
import { API_BASE, request } from './api';

export const authClient = createAuthClient({
  baseURL: API_BASE,
  plugins: [magicLinkClient()],
  basePath: '/api/auth',
  fetchOptions: { credentials: 'include' },
});

export const { useSession, signIn, signUp, signOut } = authClient;

export function githubSignInOption(signal?: AbortSignal) {
  return request<{ github: boolean; emailLink: boolean }>('/auth-options', { signal });
}

export function safeWorkspaceDestination(value: string | null) {
  if (!value || !/^\/app(?:\/|$)/.test(value) || /[\\\r\n\t]/.test(value)) return '/app/inbox';
  const origin = 'https://www.wisesama.com';
  const url = new URL(value, origin);
  return url.origin === origin && /^\/app(?:\/|$)/.test(url.pathname)
    ? `${url.pathname}${url.search}${url.hash}`
    : '/app/inbox';
}

export function githubAuthError(code: string | null, linking = false) {
  if (!code) return '';
  if (code === 'INVALID_TOKEN' || code === 'EXPIRED_TOKEN')
    return 'That sign-in link has expired or has already been used. Request a new email link.';
  if (githubNeedsAccountLink(code))
    return 'Use an email sign-in link for your Wisesama account, then add GitHub in Connections. Use a different email to start a separate account.';
  if (code === 'account_already_linked_to_different_user')
    return 'This GitHub account already signs in to another Wisesama account. Choose a different GitHub account, or sign in to the account it’s linked to.';
  if (code === 'state_mismatch' || code === 'please_restart_the_process')
    return 'Your GitHub sign-in expired. Start again to continue.';
  return linking
    ? 'We couldn’t add GitHub sign-in. Check your GitHub account and try again.'
    : 'We couldn’t sign you in with GitHub. Try again or use your email.';
}

export function githubNeedsAccountLink(code: string | null) {
  return code === 'account_not_linked' || code === 'account not linked';
}
