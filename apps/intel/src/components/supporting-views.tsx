'use client';

import {
  Bell,
  Check,
  ChevronDown,
  ExternalLink,
  FileText,
  Info,
  Layers,
  Mail,
  Plus,
  RefreshCw,
  Rss,
} from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { intelApi } from '../lib/api';
import type {
  Briefings,
  Delivery,
  Finding,
  IntelAdvisory,
  NotificationSettings,
  Project,
  SourceStatus,
} from '../lib/models';
import './supporting-views.css';

const openStatuses = new Set(['open', 'investigating', 'mitigated']);

function dateTime(value: string | null | undefined): string {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Not available'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function message(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'The request could not be completed. Please try again.';
}

function safeUrl(value: string): string | undefined {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function sourceUrl(advisory: IntelAdvisory): string | undefined {
  const references = advisory.references
    .map((reference) => safeUrl(reference.url))
    .filter((url): url is string => Boolean(url));
  return (
    references.find((url) => url.startsWith('https://github.com/advisories/')) ?? references[0]
  );
}

function SourceHealth({ sources }: { sources: SourceStatus[] }) {
  if (!sources.length)
    return <p className="sv-footnote">Source checks have not been collected yet.</p>;
  const issues = sources.filter((source) => source.status !== 'healthy');
  return (
    <details className="sv-source-health">
      <summary>
        <span className={`sv-source-indicator ${issues.length ? 'sv-warning' : 'sv-success'}`} />
        {issues.length
          ? `${issues.length} source ${issues.length === 1 ? 'needs' : 'checks need'} attention`
          : 'All source checks available'}
        <ChevronDown size={14} aria-hidden="true" />
      </summary>
      <ul>
        {sources.map((source) => (
          <li key={`${source.name}-${source.checkedAt}`}>
            <div>
              <strong>{source.name}</strong>
              <span className={`sv-source-status sv-${source.status}`}>{source.status}</span>
            </div>
            <p>Checked {dateTime(source.checkedAt)}</p>
            {source.error ? <p>{source.error}</p> : null}
          </li>
        ))}
      </ul>
    </details>
  );
}

export function ProjectsView({
  projects,
  findings,
  onAdd,
  onView,
  onImport,
  onScan,
  canManage = true,
  organizationName,
}: {
  projects: Project[];
  findings: Finding[];
  onAdd: () => void;
  onView: (projectId: string) => void;
  onImport: (projectId: string) => void;
  onScan: (projectId: string) => Promise<void>;
  canManage?: boolean;
  organizationName?: string;
}) {
  const [scanning, setScanning] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function scan(project: Project) {
    if (scanning) return;
    setScanning(project.id);
    setError('');
    try {
      await onScan(project.id);
    } catch (cause) {
      setError(`${project.name}: ${message(cause)}`);
    } finally {
      setScanning(null);
    }
  }

  return (
    <section className="sv-view" aria-labelledby="sv-projects-title">
      <div className="sv-page-heading">
        <div>
          <h1 id="sv-projects-title">Projects</h1>
          <p>
            {organizationName ? `${organizationName} · ` : ''}Imported software and the findings
            that need a response.
          </p>
        </div>
        {projects.length && canManage ? (
          <button type="button" className="button primary" onClick={onAdd}>
            <Plus size={15} aria-hidden="true" />
            Add project
          </button>
        ) : null}
      </div>
      {error ? (
        <div className="notice sv-feedback" role="alert">
          {error}
        </div>
      ) : null}
      {!projects.length ? (
        <div className="sv-empty">
          <Layers size={26} aria-hidden="true" />
          <h2>{canManage ? 'Start with one project' : 'No projects in this organization yet'}</h2>
          <p>
            {canManage
              ? 'Import a lockfile or exact package inventory for a service your team maintains.'
              : 'An owner or admin can add a project. You can then review its findings and contribute responses.'}
          </p>
          {canManage ? (
            <button className="button primary" type="button" onClick={onAdd}>
              Add project
              <Plus size={15} aria-hidden="true" />
            </button>
          ) : (
            <Link className="text-link" href="/app/settings/organization">
              View organization members
            </Link>
          )}
        </div>
      ) : (
        <div className="sv-project-list">
          {projects.map((project) => {
            const open = findings.filter(
              (finding) => finding.projectId === project.id && openStatuses.has(finding.status),
            ).length;
            const busy = scanning === project.id || project.scanInProgress;
            return (
              <article key={project.id} className="sv-project">
                <div className="sv-project-main">
                  <div className="sv-project-name">
                    <Layers size={18} aria-hidden="true" />
                    <h2>
                      <Link href={`/app/projects/${encodeURIComponent(project.id)}/security`}>
                        {project.name}
                      </Link>
                    </h2>
                    <span className="sv-environment">{project.environment}</span>
                  </div>
                  <p>
                    {project.packages.length} package{' '}
                    {project.packages.length === 1 ? 'version' : 'versions'} · Imported{' '}
                    {dateTime(project.inventoryUpdatedAt)}
                  </p>
                  <p>
                    Last assessed:{' '}
                    {project.lastScannedAt ? dateTime(project.lastScannedAt) : 'Not assessed yet'}
                  </p>
                  {project.scanError ? (
                    <p className="sv-inline-error">
                      <Info size={14} aria-hidden="true" />
                      {project.scanError}
                    </p>
                  ) : null}
                  {project.warnings.length ? (
                    <details className="sv-import-warnings">
                      <summary>
                        {project.warnings.length} inventory{' '}
                        {project.warnings.length === 1 ? 'notice' : 'notices'}
                      </summary>
                      <ul>
                        {[...new Set(project.warnings)].map((warning) => (
                          <li key={warning}>{warning}</li>
                        ))}
                      </ul>
                    </details>
                  ) : null}
                  <SourceHealth sources={project.sources} />
                </div>
                <div className="sv-open-count">
                  <span>Needs response</span>
                  <strong>
                    {open} {open === 1 ? 'finding' : 'findings'}
                  </strong>
                </div>
                <div className="sv-project-actions">
                  <Link
                    className="button"
                    href={`/app/projects/${encodeURIComponent(project.id)}/security`}
                  >
                    Security baseline
                  </Link>
                  <button type="button" className="button" onClick={() => onView(project.id)}>
                    View findings
                  </button>
                  {canManage ? (
                    <button
                      type="button"
                      className="button"
                      onClick={() => onImport(project.id)}
                      disabled={Boolean(scanning) || project.scanInProgress}
                    >
                      Update inventory
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="button"
                    onClick={() => void scan(project)}
                    disabled={Boolean(scanning) || project.scanInProgress}
                  >
                    <RefreshCw
                      size={14}
                      className={busy ? 'sv-spinning' : undefined}
                      aria-hidden="true"
                    />
                    {busy ? 'Assessing…' : 'Assess inventory'}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
      <p className="sv-scope">
        <Info size={15} aria-hidden="true" />
        Package-version matches describe the imported inventory. They do not establish which
        versions are deployed or whether vulnerable code is reachable.
      </p>
    </section>
  );
}

const deliveryLabels: Record<string, string> = {
  sent: 'Sent to mail service',
  pending: 'Pending',
  processing: 'Processing',
  failed: 'Failed',
  unavailable: 'Delivery unavailable',
  skipped: 'Skipped',
};

export function NotificationsView({
  settings,
  deliveries,
  onToggle,
  onTest,
  onVerify,
}: {
  settings: NotificationSettings;
  deliveries: Delivery[];
  onToggle: (enabled: boolean) => Promise<void>;
  onTest: () => Promise<void>;
  onVerify: () => Promise<void>;
}) {
  const [busy, setBusy] = useState<'toggle' | 'test' | 'verify' | null>(null);
  const [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState('');
  async function run(
    action: NonNullable<typeof busy>,
    operation: () => Promise<void>,
    success: string,
  ) {
    if (busy) return;
    setBusy(action);
    setError('');
    setConfirmation('');
    try {
      await operation();
      setConfirmation(success);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(null);
    }
  }
  const canTest = settings.emailEnabled && settings.emailVerified && settings.deliveryAvailable;
  return (
    <section className="sv-view sv-settings" aria-labelledby="sv-notifications-title">
      <div className="sv-page-heading">
        <div>
          <h1 id="sv-notifications-title">Your notifications</h1>
          <p>
            These are personal account preferences, separate from organization roles and public feed
            subscriptions.
          </p>
        </div>
      </div>
      {error ? (
        <div className="notice sv-feedback" role="alert">
          {error}
        </div>
      ) : null}
      {confirmation ? (
        <p className="sv-confirmation" role="status">
          <Check size={15} aria-hidden="true" />
          {confirmation}
        </p>
      ) : null}
      <section className="sv-settings-group" aria-labelledby="sv-account-email">
        <h2 id="sv-account-email">Account email</h2>
        <p>
          Security alerts go to your verified account address. This does not subscribe other
          organization members.
        </p>
        <p>
          Project alerts currently go to the original project creator while they remain a member.
          Joining an organization does not subscribe you to its project alerts.
        </p>
        <div className="sv-email-address">
          <Mail size={18} aria-hidden="true" />
          <span>{settings.recipient}</span>
          <span className={settings.emailVerified ? 'sv-verified' : 'sv-unverified'}>
            {settings.emailVerified ? (
              <Check size={13} aria-hidden="true" />
            ) : (
              <Info size={13} aria-hidden="true" />
            )}
            {settings.emailVerified ? 'Verified' : 'Verification required'}
          </span>
        </div>
        {!settings.emailVerified ? (
          <div className="sv-verification">
            <p>Verify this address before enabling security alerts.</p>
            <button
              type="button"
              className="button"
              disabled={Boolean(busy)}
              onClick={() =>
                void run(
                  'verify',
                  onVerify,
                  'Verification email requested. Follow the link in your inbox, then refresh this page.',
                )
              }
            >
              {busy === 'verify' ? 'Requesting…' : 'Send verification email'}
            </button>
          </div>
        ) : null}
      </section>
      <section className="sv-settings-group" aria-labelledby="sv-email-alert-title">
        <div className="sv-settings-row">
          <div>
            <h2 id="sv-email-alert-title">Email security alerts</h2>
            <p>New inventory matches and meaningful changes to existing findings.</p>
          </div>
          <button
            type="button"
            className="sv-toggle"
            role="switch"
            aria-checked={settings.emailEnabled}
            aria-labelledby="sv-email-alert-title"
            disabled={Boolean(busy) || (!settings.emailVerified && !settings.emailEnabled)}
            onClick={() =>
              void run(
                'toggle',
                () => onToggle(!settings.emailEnabled),
                settings.emailEnabled ? 'Email alerts disabled.' : 'Email alerts enabled.',
              )
            }
          />
        </div>
        {settings.emailEnabled ? (
          <div className="sv-delivery-rule">
            <Bell size={18} aria-hidden="true" />
            <div>
              <strong>New matches and advisory changes</strong>
              <p>Relevant to your imported package versions</p>
            </div>
            <span>Email</span>
          </div>
        ) : null}
        {!settings.deliveryAvailable ? (
          <p className="sv-inline-warning">
            <Info size={15} aria-hidden="true" />
            Email alerts are temporarily unavailable. You can still save your preference.
          </p>
        ) : null}
        <div className="sv-settings-footer">
          <p id="sv-test-help">
            {!settings.emailVerified
              ? 'Verify your account email to send a test.'
              : !settings.emailEnabled
                ? 'Enable email alerts to send a test.'
                : !settings.deliveryAvailable
                  ? 'Test emails are temporarily unavailable.'
                  : 'Send a test to your account address. Allow one minute between tests.'}
          </p>
          <button
            type="button"
            className="button"
            disabled={Boolean(busy) || !canTest}
            aria-describedby="sv-test-help"
            onClick={() =>
              void run('test', onTest, 'Test requested. Check its delivery result below.')
            }
          >
            {busy === 'test' ? 'Requesting test…' : 'Send test email'}
          </button>
        </div>
      </section>
      <section className="sv-settings-group" aria-labelledby="sv-delivery-history">
        <h2 id="sv-delivery-history">Delivery history</h2>
        <p>If an email doesn’t arrive, check your spam folder.</p>
        {deliveries.length ? (
          <div className="sv-table-scroll">
            <table className="sv-history">
              <thead>
                <tr>
                  <th scope="col">Message</th>
                  <th scope="col">Result</th>
                  <th scope="col">Requested</th>
                </tr>
              </thead>
              <tbody>
                {deliveries.map((delivery) => (
                  <tr key={delivery.id}>
                    <td>
                      <strong>{delivery.subject}</strong>
                      <small>
                        Email · {delivery.attempts}{' '}
                        {delivery.attempts === 1 ? 'attempt' : 'attempts'}
                      </small>
                      {delivery.status === 'failed' ? (
                        <p className="sv-delivery-error">We couldn’t send this email.</p>
                      ) : null}
                    </td>
                    <td>
                      <span className={`sv-delivery-status sv-delivery-${delivery.status}`}>
                        {deliveryLabels[delivery.status] ?? delivery.status}
                      </span>
                      {delivery.status === 'sent' && delivery.sentAt ? (
                        <small>{dateTime(delivery.sentAt)}</small>
                      ) : delivery.nextAttemptAt && delivery.status !== 'skipped' ? (
                        <small>Retry due {dateTime(delivery.nextAttemptAt)}</small>
                      ) : null}
                    </td>
                    <td>
                      <time dateTime={delivery.createdAt}>{dateTime(delivery.createdAt)}</time>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="sv-history-empty">
            <Mail size={20} aria-hidden="true" />
            <p>No security emails requested yet. Your first test or alert will appear here.</p>
          </div>
        )}
      </section>
    </section>
  );
}

export function BriefingsView() {
  const [result, setResult] = useState<Briefings | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [severity, setSeverity] = useState('all');
  const [query, setQuery] = useState('');
  const [shownCount, setShownCount] = useState(15);
  const [ecosystem, setEcosystem] = useState('all');
  const [exploitation, setExploitation] = useState('all');
  const currentRequest = useRef<AbortController | null>(null);
  const refresh = useCallback(() => {
    currentRequest.current?.abort();
    const controller = new AbortController();
    currentRequest.current = controller;
    setLoading(true);
    setError('');
    intelApi
      .getBriefings({}, controller.signal)
      .then((response) => {
        if (!controller.signal.aborted) setResult(response);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(message(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
  }, []);
  useEffect(() => {
    refresh();
    return () => currentRequest.current?.abort();
  }, [refresh]);
  const search = query.trim().toLowerCase();
  const advisories =
    result?.advisories.filter(
      (advisory) =>
        (severity === 'all' || advisory.severity === severity) &&
        (ecosystem === 'all' || advisory.affected.some((item) => item.ecosystem === ecosystem)) &&
        (exploitation === 'all' || advisory.exploited) &&
        (!search ||
          [
            advisory.title,
            advisory.id,
            ...advisory.aliases,
            ...advisory.affected.map((item) => item.name),
          ].some((value) => value.toLowerCase().includes(search))),
    ) ?? [];

  const rssQuery = new URLSearchParams();
  if (query.trim()) rssQuery.set('q', query.trim());
  if (severity !== 'all') rssQuery.set('severity', severity);
  if (ecosystem !== 'all') rssQuery.set('ecosystem', ecosystem);
  if (exploitation !== 'all') rssQuery.set('exploited', 'true');
  const rssUrl = `/feed.xml${rssQuery.size ? `?${rssQuery}` : ''}`;
  return (
    <section className="sv-view" aria-labelledby="sv-briefings-title">
      <div className="sv-page-heading">
        <div>
          <h1 id="sv-briefings-title">Security updates, with the evidence.</h1>
          <p>
            Browse sourced vulnerability advisories. Follow the feed, or connect a project to assess
            your own inventory.
          </p>
        </div>
        <div className="sv-heading-actions">
          <a className="button ghost" href="#subscribe">
            <Mail />
            Email updates
          </a>
          <a className="button" href={rssUrl} target="_blank" rel="noopener noreferrer">
            <Rss size={15} aria-hidden="true" />
            Follow this view with RSS
          </a>
          <button className="button" type="button" disabled={loading} onClick={refresh}>
            <RefreshCw
              size={14}
              className={loading ? 'sv-spinning' : undefined}
              aria-hidden="true"
            />
            {loading ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>
      {error ? (
        <div className="notice sv-feedback" role="alert">
          <p>{error}</p>
          {result ? <p>Showing the last results loaded in this session.</p> : null}
          <button type="button" className="button" onClick={refresh} disabled={loading}>
            Try again
          </button>
        </div>
      ) : null}
      {result?.stale ? (
        <div className="notice sv-feedback" role="status">
          <p>
            Live refresh is unavailable. These are previously collected advisories; their current
            status may have changed.
          </p>
        </div>
      ) : null}
      {result ? (
        <div className="sv-feed-status">
          <SourceHealth sources={result.sources} />
          <p className="sv-footnote">
            {result.fetchedAt
              ? `Collected ${dateTime(result.fetchedAt)}`
              : 'Collection time unavailable'}
          </p>
        </div>
      ) : null}
      <div className="sv-briefing-filters">
        <label>
          <span className="sr-only">Search public advisories</span>
          <input
            className="input"
            type="search"
            placeholder="Search advisories or packages"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setShownCount(15);
            }}
          />
        </label>
        <label>
          <span className="sr-only">Advisory severity</span>
          <select
            className="select"
            value={severity}
            onChange={(event) => {
              setSeverity(event.target.value);
              setShownCount(15);
            }}
          >
            <option value="all">All severities</option>
            {['critical', 'high', 'medium', 'low', 'unknown'].map((value) => (
              <option key={value} value={value}>
                {value.charAt(0).toUpperCase() + value.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Package ecosystem</span>
          <select
            className="select"
            value={ecosystem}
            onChange={(event) => {
              setEcosystem(event.target.value);
              setShownCount(15);
            }}
          >
            <option value="all">All ecosystems</option>
            <option value="npm">JavaScript · npm</option>
            <option value="PyPI">Python · PyPI</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Exploitation evidence</span>
          <select
            className="select"
            value={exploitation}
            onChange={(event) => {
              setExploitation(event.target.value);
              setShownCount(15);
            }}
          >
            <option value="all">All exploitation evidence</option>
            <option value="known">Known exploited · CISA KEV</option>
          </select>
        </label>
      </div>
      {loading && !result ? (
        <div className="sv-loading" role="status">
          <RefreshCw size={19} className="sv-spinning" aria-hidden="true" />
          Loading public advisories…
        </div>
      ) : advisories.length ? (
        <div className="sv-briefing-list">
          {advisories.slice(0, shownCount).map((advisory) => {
            const url = sourceUrl(advisory);
            return (
              <article className="sv-briefing" key={advisory.id}>
                <div className="sv-briefing-date">
                  <time dateTime={advisory.publishedAt}>{dateTime(advisory.publishedAt)}</time>
                </div>
                <div className="sv-briefing-main">
                  <h2>{advisory.title}</h2>
                  <div className="sv-advisory-ids">
                    <code>{advisory.id}</code>
                    {advisory.aliases
                      .filter((alias) => alias !== advisory.id)
                      .slice(0, 3)
                      .map((alias) => (
                        <code key={alias}>{alias}</code>
                      ))}
                  </div>
                  <p className="sv-advisory-summary">
                    {advisory.summary
                      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
                      .replace(/^#{1,6}\s+/gm, '')
                      .replace(/`/g, '')
                      .replace(/\*\*/g, '')
                      .replace(/\s+/g, ' ')
                      .trim()}
                  </p>
                  <div className="sv-briefing-links">
                    <Link className="text-link" href={`/feed/${encodeURIComponent(advisory.id)}`}>
                      Read briefing
                    </Link>
                    {url ? (
                      <a className="text-link" href={url} target="_blank" rel="noopener noreferrer">
                        Source advisory
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    ) : (
                      <span className="sv-footnote">No source link provided</span>
                    )}
                    <span className="sv-footnote">Updated {dateTime(advisory.modifiedAt)}</span>
                  </div>
                </div>
                <div className="sv-advisory-signals">
                  <span className={`sv-severity sv-severity-${advisory.severity}`}>
                    {advisory.severity}
                  </span>
                  {advisory.cvss !== null ? (
                    <span className="sv-footnote">CVSS {advisory.cvss}</span>
                  ) : null}
                  <span className="sv-exploitation">
                    {advisory.exploitationStatus === 'known_exploited' || advisory.exploited
                      ? 'Known exploited · CISA KEV'
                      : advisory.exploitationStatus === 'not_in_kev'
                        ? 'Not listed in checked KEV data'
                        : 'Exploitation evidence unknown'}
                  </span>
                </div>
              </article>
            );
          })}
        </div>
      ) : !error || result ? (
        <div className="sv-empty">
          <FileText size={25} aria-hidden="true" />
          <h2>
            {result?.advisories.length
              ? 'No advisories match these filters'
              : 'No public advisories available'}
          </h2>
          <p>
            {result?.advisories.length
              ? 'Try another search or severity.'
              : 'Try refreshing the feed. Check source health for collection issues.'}
          </p>
          {query || severity !== 'all' || ecosystem !== 'all' || exploitation !== 'all' ? (
            <button
              type="button"
              className="button"
              onClick={() => {
                setQuery('');
                setSeverity('all');
                setEcosystem('all');
                setExploitation('all');
                setShownCount(15);
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
      {advisories.length > 0 && (
        <div className="sv-feed-pagination">
          <p>
            Showing {Math.min(shownCount, advisories.length)} of {advisories.length} matching
            updates
          </p>
          {shownCount < advisories.length && (
            <button type="button" className="button" onClick={() => setShownCount(shownCount + 15)}>
              Show 15 more updates
            </button>
          )}
        </div>
      )}
      <p className="sv-scope">
        <Info size={15} aria-hidden="true" />
        An advisory is not proof that your project is exposed. Match it against an exact inventory
        and assess the running service.
      </p>
    </section>
  );
}
