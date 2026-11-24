'use client';

import { ArrowRight, Clock3, Link2Off, LoaderCircle, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import { safeWorkspaceDestination } from '../lib/auth-client';
import './email-sign-in.css';

export function EmailSignIn() {
  const [verification, setVerification] = useState('');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    const token = params.get('token');
    window.history.replaceState(null, '', window.location.pathname);
    if (token && /^[a-zA-Z0-9]{32,128}$/.test(token)) {
      const callback = params.get('callbackURL');
      let destination = '/app/inbox';
      if (callback) {
        try {
          const url = new URL(callback, window.location.origin);
          if (url.origin === window.location.origin)
            destination = safeWorkspaceDestination(url.pathname + url.search + url.hash);
        } catch {
          /* Fall back to the inbox. */
        }
      }
      const url = new URL('/api/auth/magic-link/verify', API_BASE);
      url.searchParams.set('token', token);
      url.searchParams.set('callbackURL', new URL(destination, window.location.origin).href);
      url.searchParams.set('errorCallbackURL', new URL('/sign-in', window.location.origin).href);
      setVerification(url.href);
    }
    setReady(true);
  }, []);
  return (
    <section className="email-signin-card" aria-labelledby="email-signin-title" aria-busy={!ready}>
      <div className="email-signin-icon" aria-hidden="true">
        {!ready ? (
          <LoaderCircle className="email-signin-spin" />
        ) : verification ? (
          <ShieldCheck />
        ) : (
          <Link2Off />
        )}
      </div>
      <p className="email-signin-eyebrow">Secure sign-in</p>
      <h1 id="email-signin-title">
        {!ready
          ? 'Checking your link…'
          : verification
            ? 'Continue to Wisesama'
            : 'Let’s get you a new link'}
      </h1>
      <p className="email-signin-description">
        {verification
          ? 'Use your email link to open your workspace. If you’re new, we’ll create your account when you continue.'
          : ready
            ? 'Open the complete link from your email, or request another one to continue.'
            : 'Your sign-in options will be ready in a moment.'}
      </p>
      {ready ? (
        <p className="email-signin-expiry">
          <Clock3 size={14} aria-hidden="true" /> One use · Expires 10 minutes after request
        </p>
      ) : null}
      {verification ? (
        <>
          <a className="email-signin-primary" href={verification} rel="noreferrer">
            Continue to Wisesama <ArrowRight size={16} aria-hidden="true" />
          </a>
          <p className="email-signin-terms">
            By continuing, you agree to the <Link href="/terms">service terms</Link> and acknowledge
            the <Link href="/privacy">privacy notice</Link>.
          </p>
          <Link className="email-signin-secondary" href="/sign-in">
            Use another email
          </Link>
        </>
      ) : ready ? (
        <Link className="email-signin-primary" href="/sign-in">
          Request a new link <ArrowRight size={16} aria-hidden="true" />
        </Link>
      ) : (
        <p className="email-signin-loading" role="status">
          Preparing secure sign-in…
        </p>
      )}
    </section>
  );
}
