'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { API_BASE } from '../lib/api';
import { safeWorkspaceDestination } from '../lib/auth-client';

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
    <section className="pub-wrap pub-trust" style={{ maxWidth: 560, paddingBlock: 80 }}>
      <h1>
        {!ready
          ? 'Checking your sign-in link…'
          : verification
            ? 'Continue to Wisesama'
            : 'Request a new sign-in link'}
      </h1>
      <p>
        {verification
          ? 'This one-time link signs you in. If this is your first visit, continuing creates your Wisesama account.'
          : ready
            ? 'This page needs the complete link from your email. Links expire after 10 minutes and can be used once.'
            : ''}
      </p>
      {verification ? (
        <>
          <p>
            By continuing, you agree to the <Link href="/terms">service terms</Link> and acknowledge
            the <Link href="/privacy">privacy notice</Link>.
          </p>
          <a className="pub-button" href={verification} rel="noreferrer">
            Continue to Wisesama
          </a>
        </>
      ) : ready ? (
        <Link className="pub-button" href="/sign-in">
          Request a new link
        </Link>
      ) : null}
    </section>
  );
}
