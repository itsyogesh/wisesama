'use client';

import { Check, Mail } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { request } from '../lib/api';
import './public-subscription.css';

type Topic = 'all' | 'npm' | 'PyPI' | 'known_exploited';
const topics: Array<{ value: Topic; label: string }> = [
  { value: 'all', label: 'All supported advisories' },
  { value: 'npm', label: 'JavaScript · npm' },
  { value: 'PyPI', label: 'Python · PyPI' },
  { value: 'known_exploited', label: 'Known exploitation evidence' },
];
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'This request could not complete. Try again.';
const base = '/intel/subscriptions';

function TopicOptions({
  value,
  onChange,
  disabled = false,
}: {
  value: Topic[];
  onChange: (next: Topic[]) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="subscription-topics" disabled={disabled}>
      <legend>What would you like to follow?</legend>
      {topics.map((topic) => (
        <label key={topic.value}>
          <input
            type="checkbox"
            checked={value.includes(topic.value)}
            onChange={(event) => {
              const next = event.target.checked
                ? topic.value === 'all'
                  ? (['all'] as Topic[])
                  : [...value.filter((item) => item !== 'all'), topic.value]
                : value.filter((item) => item !== topic.value);
              onChange(next);
            }}
          />
          <span>{topic.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

export function PublicSubscription({ compact = false }: { compact?: boolean }) {
  const id = useId();
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<Topic[]>(['all']);
  const [capability, setCapability] = useState<'loading' | 'available' | 'unavailable'>('loading');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    request<{ emailAvailable: boolean }>(`${base}/capabilities`, { signal: controller.signal })
      .then((data) => setCapability(data.emailAvailable ? 'available' : 'unavailable'))
      .catch(() => {
        if (!controller.signal.aborted) setCapability('unavailable');
      });
    return () => controller.abort();
  }, []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || capability !== 'available' || !selected.length) return;
    setBusy(true);
    setError('');
    try {
      await request(`${base}/request`, {
        method: 'POST',
        body: { email: email.trim(), topics: selected },
      });
      setSent(true);
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section
      id="subscribe"
      className={`subscription-block ${compact ? 'compact' : ''}`}
      aria-labelledby={`${id}-title`}
    >
      <div className="subscription-intro">
        <Mail />
        <h2 id={`${id}-title`}>A quieter security briefing.</h2>
        <p>
          Get a daily digest of new advisories and meaningful changes. Free, with a verified email.
          No Wisesama account needed.
        </p>
        <p className="subscription-note">
          Daily at 09:00 UTC when there are updates. This is the public feed; it does not include
          private project matches.
        </p>
      </div>
      {sent ? (
        <div className="subscription-result" role="status">
          <Check />
          <h3>Check your email</h3>
          <p>
            If this address can receive updates, an email link is on its way. Open it to confirm
            your subscription or manage your existing preferences.
          </p>
          <button className="button ghost" type="button" onClick={() => setSent(false)}>
            Use another address
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="subscription-form">
          <label htmlFor={`${id}-email`}>Email address</label>
          <div className="subscription-email">
            <input
              id={`${id}-email`}
              type="email"
              autoComplete="email"
              placeholder="you@yourteam.com"
              required
              maxLength={254}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
            />
            <button
              type="submit"
              className="button primary"
              disabled={busy || capability !== 'available' || !selected.length}
            >
              {busy ? 'Requesting…' : 'Subscribe free'}
            </button>
          </div>
          <TopicOptions value={selected} onChange={setSelected} disabled={busy} />
          {capability !== 'available' && (
            <p className="notice" role="status">
              {capability === 'loading' ? (
                'Checking email availability…'
              ) : (
                <>
                  Email subscriptions are not configured in this environment. You can{' '}
                  <Link href="/feed.xml" className="text-link">
                    subscribe with RSS
                  </Link>
                  .
                </>
              )}
            </p>
          )}
          {error && (
            <p role="alert" className="notice error">
              {error}
            </p>
          )}
          <p className="subscription-note">
            Confirm before receiving updates. Unsubscribe from any edition.{' '}
            <Link href="/privacy">Privacy</Link> ·{' '}
            <Link href="/subscribe/manage">Manage an existing subscription</Link>
          </p>
        </form>
      )}
    </section>
  );
}

export function SubscriptionPage({ mode }: { mode: 'confirm' | 'manage' }) {
  const initialized = useRef(false);
  const [token, setToken] = useState('');
  const [unsubscribeOnly, setUnsubscribeOnly] = useState(false);
  const [ready, setReady] = useState(false);
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<Topic[]>(['all']);
  const [subscription, setSubscription] = useState<{ status: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [capability, setCapability] = useState<'loading' | 'available' | 'unavailable'>('loading');
  useEffect(() => {
    // React may replay mount effects in development. Read the secret once before stripping it.
    if (initialized.current) return;
    initialized.current = true;
    const query = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.slice(1));
    const unsubscribe = hash.get('unsubscribe') || query.get('unsubscribe');
    const value = unsubscribe || hash.get('token') || query.get('token') || '';
    setToken(value);
    setUnsubscribeOnly(Boolean(unsubscribe));
    setReady(true);
    if (value) window.history.replaceState(null, '', window.location.pathname);
  }, []);
  useEffect(() => {
    if (mode !== 'manage') return;
    const controller = new AbortController();
    request<{ emailAvailable: boolean }>(`${base}/capabilities`, { signal: controller.signal })
      .then((data) => setCapability(data.emailAvailable ? 'available' : 'unavailable'))
      .catch(() => {
        if (!controller.signal.aborted) setCapability('unavailable');
      });
    return () => controller.abort();
  }, [mode]);
  // GET never confirms or opts out. Reading preferences uses the protected token in a POST body.
  useEffect(() => {
    if (mode !== 'manage' || !token || unsubscribeOnly) return;
    let active = true;
    setBusy(true);
    request<{ status: string; topics: Topic[] }>(`${base}/manage/read`, {
      method: 'POST',
      body: { token },
    })
      .then((data) => {
        if (active) {
          setSubscription(data);
          setSelected(data.topics);
        }
      })
      .catch((cause) => {
        if (active) setError(errorText(cause));
      })
      .finally(() => {
        if (active) setBusy(false);
      });
    return () => {
      active = false;
    };
  }, [mode, token, unsubscribeOnly]);
  async function action(kind: 'confirm' | 'save' | 'unsubscribe' | 'request') {
    if (busy || (kind === 'request' && capability !== 'available')) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      if (kind === 'request') {
        await request(`${base}/manage/request`, { method: 'POST', body: { email: email.trim() } });
        setNotice('If this address has a subscription, a secure preferences link is on its way.');
      } else if (kind === 'save') {
        await request(`${base}/manage`, { method: 'PATCH', body: { token, topics: selected } });
        setNotice('Your preferences have been saved.');
      } else if (kind === 'unsubscribe') {
        await request(`${base}/unsubscribe`, { method: 'POST', body: { token } });
        setSubscription({ status: 'unsubscribed' });
        setUnsubscribeOnly(false);
        setToken('');
        setNotice('You are unsubscribed. No further public feed editions will be sent.');
      } else {
        await request(`${base}/confirm`, { method: 'POST', body: { token } });
        setNotice(
          'Your email is confirmed. You will receive daily updates when there are new items matching your topics.',
        );
        setToken('');
      }
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="subscription-page">
      <Link href="/feed" className="text-link">
        ← Back to the feed
      </Link>
      <h1>{mode === 'confirm' ? 'Confirm your subscription' : 'Your feed preferences'}</h1>
      <p>
        {mode === 'confirm'
          ? 'One more step before we send public security updates.'
          : 'Manage public feed email without creating an account.'}
      </p>
      {!ready ? (
        <p role="status">Loading your link…</p>
      ) : mode === 'confirm' ? (
        token ? (
          <div className="subscription-actions">
            <p>
              Confirm that you want to receive the daily Wisesama public digest. Visiting this page
              does not subscribe you.
            </p>
            <button
              type="button"
              className="button primary"
              disabled={busy}
              onClick={() => void action('confirm')}
            >
              {busy ? 'Confirming…' : 'Confirm subscription'}
            </button>
          </div>
        ) : !notice ? (
          <div className="notice">
            <p>This confirmation link is missing or has already been used in this browser.</p>
            <Link href="/feed" className="text-link">
              Request a new confirmation from the feed
            </Link>
          </div>
        ) : null
      ) : unsubscribeOnly && !subscription ? (
        <div className="subscription-actions">
          <p>
            Stop public feed email for this subscription. Opening this page does not change
            anything; choose Unsubscribe to confirm.
          </p>
          <button
            type="button"
            className="button danger"
            disabled={busy}
            onClick={() => void action('unsubscribe')}
          >
            {busy ? 'Unsubscribing…' : 'Unsubscribe from the feed'}
          </button>
        </div>
      ) : subscription ? (
        <div className="subscription-actions">
          <p>
            Subscription status: <strong>{subscription.status.replaceAll('_', ' ')}</strong>
          </p>
          {subscription.status === 'active' && (
            <>
              <TopicOptions value={selected} onChange={setSelected} disabled={busy} />
              <p>Daily at 09:00 UTC, when matching advisories change.</p>
              <div className="actions">
                <button
                  type="button"
                  className="button primary"
                  disabled={busy || !selected.length}
                  onClick={() => void action('save')}
                >
                  Save preferences
                </button>
                <button
                  type="button"
                  className="button danger"
                  disabled={busy}
                  onClick={() => void action('unsubscribe')}
                >
                  Unsubscribe from the feed
                </button>
              </div>
            </>
          )}
        </div>
      ) : token && busy ? (
        <p role="status">Loading preferences…</p>
      ) : (
        <form
          className="subscription-form"
          onSubmit={(event) => {
            event.preventDefault();
            void action('request');
          }}
        >
          <label htmlFor="manage-email">Email address</label>
          <input
            id="manage-email"
            type="email"
            autoComplete="email"
            required
            maxLength={254}
            disabled={busy}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
          <button
            type="submit"
            className="button primary"
            disabled={busy || capability !== 'available'}
          >
            {busy ? 'Requesting…' : 'Email me a preferences link'}
          </button>
          <p>
            For your privacy, we will show the same response whether or not an address is
            subscribed.
          </p>
          {capability !== 'available' && (
            <p className="notice" role="status">
              {capability === 'loading'
                ? 'Checking email availability…'
                : 'Email delivery is not configured in this environment.'}
            </p>
          )}
        </form>
      )}
      {notice && (
        <p className="notice success" role="status">
          {notice}
        </p>
      )}
      {error && (
        <div className="notice error" role="alert">
          <p>{error}</p>
          {token && (
            <Link
              href={mode === 'confirm' ? '/feed#subscribe' : '/subscribe/manage'}
              onClick={() => {
                setToken('');
                setUnsubscribeOnly(false);
                setSubscription(null);
                setNotice('');
                setError('');
              }}
              className="text-link"
            >
              {mode === 'confirm'
                ? 'Request a new confirmation link'
                : 'Request a fresh preferences link'}
            </Link>
          )}
        </div>
      )}
      <p className="subscription-note">
        These settings only control public feed email. Private project alerts are managed inside
        your workspace.
      </p>
    </div>
  );
}
