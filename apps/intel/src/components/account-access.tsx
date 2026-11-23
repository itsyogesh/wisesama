'use client';

import { Github } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useEffect, useId, useState } from 'react';
import { authClient, githubAuthError, githubSignInOption } from '../lib/auth-client';
import './account-access.css';

interface AccountAccessProps {
  onAuthenticated?: () => void;
  initialMode?: 'sign-in' | 'register';
  githubReturnTo?: string;
  githubError?: string | null;
}

export function AccountAccess({
  onAuthenticated,
  initialMode = 'sign-in',
  githubReturnTo,
  githubError = null,
}: AccountAccessProps) {
  const id = useId();
  const [mode, setMode] = useState<'sign-in' | 'register'>(initialMode);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(() => githubAuthError(githubError));
  const [githubAvailable, setGithubAvailable] = useState(false);
  const [message, setMessage] = useState('');
  const [createdEmail, setCreatedEmail] = useState('');
  const githubDestination = githubReturnTo
    ? new URL(githubReturnTo, 'https://www.wisesama.com')
    : null;
  const connectingGithub =
    githubDestination?.pathname === '/app/projects/new' &&
    [null, 'github'].includes(githubDestination.searchParams.get('provider'));

  useEffect(() => {
    if (!githubReturnTo) return;
    const controller = new AbortController();
    void githubSignInOption(controller.signal)
      .then(({ github }) => setGithubAvailable(github))
      .catch(() => {});
    return () => controller.abort();
  }, [githubReturnTo]);

  async function continueWithGithub() {
    if (busy || !githubReturnTo || !githubAvailable) return;
    setBusy(true);
    setError('');
    setMessage('');
    const callback = new URL(githubReturnTo, window.location.origin);
    callback.searchParams.delete('error');
    const failed = new URL(mode === 'register' ? '/sign-up' : '/sign-in', window.location.origin);
    if (connectingGithub) {
      callback.searchParams.set('provider', 'github');
      callback.searchParams.set('connect', 'github');
    }
    failed.searchParams.set('next', callback.pathname + callback.search + callback.hash);
    try {
      const result = await authClient.signIn.social({
        provider: 'github',
        callbackURL: callback.href,
        errorCallbackURL: failed.href,
      });
      if (result.error)
        setError('We couldn’t sign you in with GitHub. Try again or use your email.');
    } catch {
      setError('We couldn’t open GitHub. Try again or use your email.');
    } finally {
      setBusy(false);
    }
  }

  function changeMode(next: 'sign-in' | 'register') {
    setMode(next);
    setError('');
    setMessage('');
    setPassword('');
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result =
        mode === 'register'
          ? await authClient.signUp.email({
              name: name.trim(),
              email: email.trim(),
              password,
            })
          : await authClient.signIn.email({ email: email.trim(), password });
      if (result.error) {
        const invalidCredentials = result.error.code === 'INVALID_EMAIL_OR_PASSWORD';
        setError(
          invalidCredentials
            ? 'That email and password didn’t match. Check your details and try again.'
            : mode === 'register'
              ? 'We couldn’t create your account. Check your details or try signing in.'
              : 'We couldn’t sign you in. Check your details and try again.',
        );
        return;
      }
      setPassword('');
      const session = await authClient.getSession();
      if (session.data?.session) {
        onAuthenticated?.();
      } else if (mode === 'register') {
        setCreatedEmail(email.trim());
        setMode('sign-in');
        setMessage('Your account is ready. Sign in to add your first project.');
      } else {
        setError('Your session could not be confirmed. Try signing in again.');
      }
    } catch {
      setError('Cannot reach Wisesama. Check your connection and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function sendVerification() {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const result = await authClient.sendVerificationEmail({
        email: createdEmail,
        callbackURL: `${window.location.origin}/app/settings/notifications`,
      });
      if (result.error) {
        setError('We couldn’t send the verification email. Try again in a moment.');
      } else {
        setMessage(
          'Verification email requested. Check your inbox before enabling security alerts.',
        );
      }
    } catch {
      setError('Cannot reach Wisesama. Please try requesting verification again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="account-access" aria-labelledby={`${id}-title`}>
      <div className="account-context">
        <h1 id={`${id}-title`}>Your security response desk</h1>
        <p>
          Connect your software inventory to vulnerability intelligence, then follow each finding
          through a response.
        </p>
        <ol className="account-path">
          <li>
            <strong>Import exact package versions</strong>
            <span>Start with a lockfile or pinned inventory for one service.</span>
          </li>
          <li>
            <strong>Review the evidence</strong>
            <span>Keep severity, known exploitation and your own exposure separate.</span>
          </li>
          <li>
            <strong>Record your response</strong>
            <span>Keep investigation notes and verification evidence with the finding.</span>
          </li>
        </ol>
        <p className="account-privacy">
          Projects and findings are shared only within their organization. Public briefings remain
          available without signing in.
        </p>
      </div>
      <div className="account-panel">
        <fieldset className="account-modes">
          <legend className="sr-only">Account access options</legend>
          <button
            type="button"
            aria-pressed={mode === 'sign-in'}
            disabled={busy}
            onClick={() => changeMode('sign-in')}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-pressed={mode === 'register'}
            disabled={busy}
            onClick={() => changeMode('register')}
          >
            Create account
          </button>
        </fieldset>
        <h2>{mode === 'sign-in' ? 'Welcome back' : 'Create your account'}</h2>
        <p>
          {mode === 'sign-in'
            ? 'Use your Wisesama account to continue.'
            : 'Add your first project after signing up.'}
        </p>
        {githubAvailable ? (
          <div className="account-social">
            <button type="button" className="button" onClick={continueWithGithub} disabled={busy}>
              <Github size={17} aria-hidden="true" />
              {connectingGithub ? 'Sign in and connect GitHub' : 'Continue with GitHub'}
            </button>
            {connectingGithub ? (
              <p>After signing in, you’ll choose which repositories Wisesama can read.</p>
            ) : null}
            {mode === 'register' && githubReturnTo ? (
              <p>
                Already have a Wisesama account?{' '}
                <Link href={`/sign-in?${new URLSearchParams({ next: githubReturnTo })}`}>
                  Sign in
                </Link>{' '}
                before adding another sign-in method.
              </p>
            ) : null}
            <div className="account-social-divider">or continue with email</div>
          </div>
        ) : null}
        <form onSubmit={submit} aria-busy={busy}>
          {mode === 'register' ? (
            <div className="account-field">
              <label htmlFor={`${id}-name`}>Name</label>
              <input
                id={`${id}-name`}
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                required
                maxLength={100}
                disabled={busy}
              />
            </div>
          ) : null}
          <div className="account-field">
            <label htmlFor={`${id}-email`}>Email address</label>
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              required
              maxLength={254}
              disabled={busy}
            />
          </div>
          <div className="account-field">
            <label htmlFor={`${id}-password`}>Password</label>
            <input
              id={`${id}-password`}
              type="password"
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={mode === 'register' ? 8 : undefined}
              maxLength={128}
              required
              disabled={busy}
              aria-describedby={mode === 'register' ? `${id}-password-help` : undefined}
            />
            {mode === 'register' ? (
              <small id={`${id}-password-help`}>Use at least 8 characters.</small>
            ) : null}
          </div>
          {error ? (
            <p className="account-error" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="account-message" role="status">
              {message}
            </p>
          ) : null}
          <button className="account-submit" type="submit" disabled={busy}>
            {busy ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
        {createdEmail ? (
          <div className="account-verification">
            <p>Verify your account email to receive security alerts.</p>
            <button type="button" onClick={sendVerification} disabled={busy}>
              Request verification email
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
