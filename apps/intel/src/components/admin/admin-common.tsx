'use client';

import { ArrowLeft, ArrowRight, Search } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import {
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';
import type { AdminAudit, AdminDelivery } from '../../lib/admin-api';
import { adminApi } from '../../lib/admin-api';
import { ApiError } from '../../lib/api';

export const errorMessage = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'This operation could not complete. Try again.';
export const human = (value: string) => value.replaceAll('_', ' ');
export const dateTime = (value: string | null | undefined) =>
  !value
    ? 'Not recorded'
    : Number.isNaN(new Date(value).getTime())
      ? 'Time unavailable'
      : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(value),
        );
export function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function useAdminData<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState('');
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError('');
      setErrorStatus(null);
      try {
        const result = await adminApi.get<T>(path, signal);
        if (!signal?.aborted) setData(result);
        return result;
      } catch (cause) {
        if (!signal?.aborted) {
          if (cause instanceof ApiError && [401, 403].includes(cause.status)) setData(null);
          setError(errorMessage(cause));
          setErrorStatus(cause instanceof ApiError ? cause.status : 0);
        }
        return null;
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [path],
  );
  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);
  return { data, setData, error, errorStatus, loading, reload: load };
}

export function Status({ value }: { value: string }) {
  return (
    <span className={`am-status am-status-${value.replace(/[^a-z_]/g, '')}`}>{human(value)}</span>
  );
}
export function PageHeading({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <header className="am-page-heading">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children}
    </header>
  );
}
export function BackLink({ section, label }: { section: string; label: string }) {
  const params = useSearchParams();
  const preserved = new URLSearchParams();
  for (const key of ['q', 'status', 'visibility', 'kind', 'cursor']) {
    const value = params.get(key);
    if (value) preserved.set(key, value);
  }
  return (
    <Link className="am-back" href={`/admin/${section}${preserved.size ? `?${preserved}` : ''}`}>
      <ArrowLeft />
      {label}
    </Link>
  );
}
export function LoadState({
  error,
  loading,
  hasData,
  onRetry,
}: {
  error: string;
  loading: boolean;
  hasData: boolean;
  onRetry: () => void;
}) {
  return (
    <>
      {error ? (
        <div className="am-error" role="alert">
          <p>
            {error}
            {hasData ? ' Previously loaded information is still shown.' : ''}
          </p>
          <button className="button" type="button" onClick={onRetry}>
            Try again
          </button>
        </div>
      ) : null}
      {loading && !hasData ? (
        <div className="am-loading" role="status">
          <span className="spinner" />
          Loading admin records…
        </div>
      ) : null}
    </>
  );
}
export function EmptyState({ title, description }: { title: string; description: string }) {
  return (
    <div className="am-empty">
      <h2>{title}</h2>
      <p>{description}</p>
    </div>
  );
}
export function RecordFacts({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="am-facts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function ListFilters({
  statuses,
  statusLabel = 'Status',
  children,
}: {
  statuses?: Array<[string, string]>;
  statusLabel?: string;
  children?: ReactNode;
}) {
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const id = useId();
  function filter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const next = new URLSearchParams();
    for (const [key, value] of form.entries())
      if (typeof value === 'string' && value.trim()) next.set(key, value.trim());
    router.push(`${path}${next.size ? `?${next}` : ''}`);
  }
  return (
    <form className="am-filters" key={params.toString()} onSubmit={filter}>
      <div className="am-search">
        <label className="sr-only" htmlFor={`${id}-q`}>
          Search records
        </label>
        <Search />
        <input
          id={`${id}-q`}
          name="q"
          type="search"
          maxLength={150}
          defaultValue={params.get('q') || ''}
          placeholder="Search records…"
        />
      </div>
      {statuses ? (
        <div>
          <label className="sr-only" htmlFor={`${id}-status`}>
            {statusLabel}
          </label>
          <select id={`${id}-status`} name="status" defaultValue={params.get('status') || ''}>
            <option value="">
              All {statusLabel === 'Status' ? 'statuses' : statusLabel.toLowerCase()}
            </option>
            {statuses.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      ) : null}
      {children}
      <button className="button" type="submit">
        Apply filters
      </button>
      {params.size ? (
        <Link className="am-text-link" href={path}>
          Clear filters
        </Link>
      ) : null}
    </form>
  );
}
export function VisibilityFilter() {
  const params = useSearchParams();
  return (
    <select
      name="visibility"
      aria-label="Public visibility"
      defaultValue={params.get('visibility') || ''}
    >
      <option value="">All visibility</option>
      <option value="published">Published</option>
      <option value="hidden">Hidden</option>
    </select>
  );
}
export function Pagination({ nextCursor, count }: { nextCursor: string | null; count: number }) {
  const params = useSearchParams();
  const path = usePathname();
  const next = new URLSearchParams(params);
  next.set('cursor', nextCursor ?? '');
  const first = new URLSearchParams(params);
  first.delete('cursor');
  return (
    <div className="am-pagination">
      <span>{count} records on this page</span>
      <div>
        {params.get('cursor') ? (
          <Link className="button" href={`${path}${first.size ? `?${first}` : ''}`}>
            <ArrowLeft />
            First page
          </Link>
        ) : null}
        {nextCursor ? (
          <Link className="button" href={`${path}?${next}`}>
            Next page <ArrowRight />
          </Link>
        ) : (
          <span>End of results</span>
        )}
      </div>
    </div>
  );
}
export function collectionPath(base: string, params: URLSearchParams) {
  const next = new URLSearchParams(params);
  next.delete('view');
  next.set('limit', '20');
  return `${base}?${next}`;
}
export function detailHref(base: string, id: string, params: URLSearchParams) {
  return `/admin/${base}/${encodeURIComponent(id)}${params.size ? `?${params}` : ''}`;
}
export function TableFrame({ children, label }: { children: ReactNode; label: string }) {
  const scrollRef = useRef<HTMLElement>(null);
  const [overflow, setOverflow] = useState(false);
  const hintId = useId();
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const measure = () => setOverflow(element.scrollWidth > element.clientWidth + 1);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    const table = element.querySelector('table');
    if (table) observer?.observe(table);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, []);
  return (
    <div className="am-table-wrap">
      <section
        ref={scrollRef}
        className="am-table-frame"
        aria-label={label}
        aria-describedby={overflow ? hintId : undefined}
        tabIndex={overflow ? 0 : undefined}
      >
        {children}
      </section>
      {overflow ? (
        <p className="am-table-scroll-hint" id={hintId}>
          <ArrowLeft />
          <ArrowRight />
          <span>
            More columns are available. Scroll horizontally, or focus the table and use the arrow
            keys.
          </span>
        </p>
      ) : null}
    </div>
  );
}
export function MobileRowFacts({ items }: { items: Array<[string, ReactNode]> }) {
  return (
    <dl className="am-mobile-row-facts">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function AuditTrail({
  events,
  title = 'Audit history',
}: {
  events: AdminAudit[];
  title?: string;
}) {
  return (
    <section className="am-section">
      <h2>{title}</h2>
      {events.length ? (
        <ol className="am-audit">
          {events.map((event) => (
            <li key={event.id}>
              <div>
                <strong>{human(event.action)}</strong>
                <time dateTime={event.createdAt}>{dateTime(event.createdAt)}</time>
              </div>
              <p>{event.reason || 'No operator reason recorded.'}</p>
              <small>
                Actor {event.actorId || 'System'} · {event.targetType} · {event.targetId}
              </small>
            </li>
          ))}
        </ol>
      ) : (
        <p className="am-muted">No recorded operator changes.</p>
      )}
      {events.length ? (
        <p className="am-help">
          Recent recorded changes.{' '}
          <Link className="am-text-link" href="/admin/audit">
            Open the audit log
          </Link>{' '}
          to browse older records.
        </p>
      ) : null}
    </section>
  );
}
export function DeliveryTable({ deliveries }: { deliveries: AdminDelivery[] }) {
  return deliveries.length ? (
    <TableFrame label="Recent email delivery records">
      <table className="am-table">
        <thead>
          <tr>
            <th>Delivery</th>
            <th>Status</th>
            <th>Attempts</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {deliveries.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.subject}</strong>
                <small>{item.error || item.id}</small>
                <MobileRowFacts
                  items={[
                    ['Status', <Status key="status" value={item.status} />],
                    ['Attempts', item.attempts],
                    ['Created', dateTime(item.createdAt)],
                  ]}
                />
              </td>
              <td>
                <Status value={item.status} />
              </td>
              <td>{item.attempts}</td>
              <td>{dateTime(item.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableFrame>
  ) : (
    <p className="am-muted">No recent deliveries.</p>
  );
}

export function ReasonForm({
  title,
  description,
  submitLabel,
  effect,
  onSubmit,
  onReload,
  children,
  danger = false,
}: {
  title: string;
  description: string;
  submitLabel: string;
  effect: string;
  onSubmit: (reason: string) => Promise<void>;
  onReload: () => void;
  children?: ReactNode;
  danger?: boolean;
}) {
  const id = useId();
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [conflict, setConflict] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || !confirmed) return;
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await onSubmit(reason.trim());
      setReason('');
      setConfirmed(false);
      setSuccess('Action recorded.');
    } catch (cause) {
      setError(errorMessage(cause));
      if (cause instanceof ApiError && cause.status === 409) setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="am-section am-action-section">
      <h2>{title}</h2>
      <p>{description}</p>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          {children}
          <label htmlFor={`${id}-reason`}>Reason for this action</label>
          <textarea
            id={`${id}-reason`}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
              setSuccess('');
            }}
            minLength={20}
            maxLength={1000}
            rows={3}
            required
            placeholder="Explain the issue, intended outcome, and related support or incident reference."
          />
          <p className="am-help">
            20–1,000 characters. Keep secrets and sensitive evidence out of this record.
          </p>
          <label className="am-confirm">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              required
            />
            <span>I reviewed this record and confirm: {effect}</span>
          </label>
          <button
            className={`button ${danger ? 'am-danger-button' : 'primary'}`}
            type="submit"
            disabled={busy || !confirmed || reason.trim().length < 20 || conflict}
          >
            {busy ? 'Saving…' : submitLabel}
          </button>
        </fieldset>
      </form>
      {error ? (
        <div className="am-error" role="alert">
          <p>{error}</p>
          {conflict ? (
            <button className="button" type="button" onClick={onReload}>
              Discard draft and reload record
            </button>
          ) : null}
        </div>
      ) : null}
      {success ? (
        <p className="am-success" role="status">
          {success}
        </p>
      ) : null}
    </section>
  );
}
