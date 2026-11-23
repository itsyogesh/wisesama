'use client';

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Circle,
  Clock3,
  ExternalLink,
  FileCheck2,
  Info,
  LoaderCircle,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useId, useRef, useState } from 'react';
import type { Finding, FindingStatus, FindingUpdate, Project } from '../lib/models';

import { FindingRemediation } from './finding-remediation';

interface FindingDetailProps {
  finding: Finding;
  project?: Project;
  canManage?: boolean;
  onUpdate: (id: string, input: FindingUpdate) => Promise<void>;
  onBack: () => void;
  onViewInventory: (projectId: string) => void;
}

const labels: Record<FindingStatus, string> = {
  open: 'Open',
  investigating: 'Investigating',
  mitigated: 'Mitigated',
  resolved: 'Resolved',
  not_affected: 'Not affected',
};

function timestamp(value: string | null | undefined) {
  if (!value || !Number.isFinite(new Date(value).getTime())) return 'Not available';
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function safeReference(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

function Status({ value }: { value: FindingStatus }) {
  const Icon =
    value === 'resolved' || value === 'not_affected'
      ? CheckCircle2
      : value === 'investigating'
        ? Clock3
        : value === 'mitigated'
          ? ShieldCheck
          : Circle;
  return (
    <span className={`fd-status fd-status-${value}`}>
      <Icon aria-hidden="true" size={15} />
      {labels[value]}
    </span>
  );
}

/** A new record gets its own response draft; refreshing a record preserves work in progress. */
export function FindingDetail(props: FindingDetailProps) {
  return <FindingRecord key={props.finding.id} {...props} />;
}

function FindingRecord({
  finding,
  project,
  canManage = true,
  onUpdate,
  onBack,
  onViewInventory,
}: FindingDetailProps) {
  const { advisory } = finding;
  const formId = useId();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [targetStatus, setTargetStatus] = useState<FindingStatus>(
    finding.status === 'open' ? 'investigating' : finding.status,
  );
  const [note, setNote] = useState(finding.note);
  const [evidence, setEvidence] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const closed = finding.status === 'resolved' || finding.status === 'not_affected';
  const evidenceRequired = targetStatus === 'resolved' || targetStatus === 'not_affected';
  const kevStatus =
    advisory.exploitationStatus ?? (advisory.exploited ? 'known_exploited' : 'unknown');
  const kevSource = project?.sources.find((source) => source.name === 'CISA KEV');
  const epssSource = project?.sources.find((source) => source.name === 'FIRST EPSS');
  const references = [...new Set(advisory.references.map((reference) => reference.url))]
    .map(safeReference)
    .filter((url): url is URL => url !== null);
  const aliases = [...new Set([advisory.id, ...advisory.aliases])];
  const ghsaId = aliases.find((id) => /^GHSA-[a-z0-9]{4}-[a-z0-9]{4}-[a-z0-9]{4}$/i.test(id));
  const primaryReferences: Array<{ label: string; url: string }> = [];
  if (advisory.source === 'OSV' && advisory.id.trim()) {
    primaryReferences.push({
      label: 'OSV record',
      url: `https://osv.dev/vulnerability/${encodeURIComponent(advisory.id)}`,
    });
  }
  if (ghsaId) {
    primaryReferences.push({
      label: 'GitHub advisory',
      url: `https://github.com/advisories/${encodeURIComponent(ghsaId)}`,
    });
  }
  if (!primaryReferences.length && references[0]) {
    primaryReferences.push({ label: 'Source advisory', url: references[0].href });
  }
  const primaryUrls = new Set(primaryReferences.map((reference) => reference.url));
  const additionalReferences = references.filter((url) => !primaryUrls.has(url.href));

  async function persist(input: FindingUpdate) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      await onUpdate(finding.id, input);
      setEditing(false);
      setEvidence('');
      setFeedback(
        input.status === 'resolved' || input.status === 'not_affected'
          ? 'Response recorded with your evidence. Deployment has not been independently verified.'
          : `Response updated to ${labels[input.status].toLowerCase()}.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Your response could not be saved. Try again.',
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (evidenceRequired && evidence.trim().length < 10) {
      setError(
        'Describe the deployed fix or why this service is not affected in at least 10 characters.',
      );
      return;
    }
    void persist({ status: targetStatus, note: note.trim(), evidence: evidence.trim() });
  }

  function beginResponse() {
    setTargetStatus(
      closed ? finding.status : finding.status === 'open' ? 'investigating' : finding.status,
    );
    setEditing(true);
    setError('');
    setFeedback('');
  }

  return (
    <div className="fd-page">
      <div className="fd-topline">
        <button type="button" className="text-link fd-back" onClick={onBack} disabled={busy}>
          <ArrowLeft size={14} aria-hidden="true" /> Back to response inbox
        </button>
        <span className="fd-record-id" title={finding.id}>
          {advisory.id}
        </span>
      </div>
      <div className="fd-layout">
        <article className="fd-main">
          <h1 className="fd-title">{advisory.title}</h1>
          <p className="fd-intro">
            This advisory matches{' '}
            <code>
              {finding.packageName}@{finding.installedVersion}
            </code>{' '}
            in the imported inventory for {finding.projectName}. Confirm the running version and
            whether the affected functionality is in use.
          </p>

          <p className="fd-context-links">
            <Link href={`/app/projects/${encodeURIComponent(finding.projectId)}/security`}>
              Review project context and repository checks
            </Link>
            <Link href="/playbooks">Investigating a supply-chain incident? Read the playbooks</Link>
          </p>

          <div className="fd-statusbar">
            <Status value={finding.status} />
            <div className="fd-status-actions">
              {!editing && !closed ? (
                <button
                  type="button"
                  className="button fd-secondary-action"
                  onClick={beginResponse}
                  disabled={busy}
                >
                  Record response
                </button>
              ) : null}
              {!editing && finding.status === 'open' ? (
                <button
                  type="button"
                  className="button primary"
                  disabled={busy}
                  onClick={() => void persist({ status: 'investigating' })}
                >
                  {busy ? <LoaderCircle className="fd-spin" size={15} aria-hidden="true" /> : null}
                  {busy ? 'Saving…' : 'Start investigation'}
                  {!busy ? <ArrowRight size={15} aria-hidden="true" /> : null}
                </button>
              ) : null}
              {!editing && closed ? (
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => void persist({ status: 'open' })}
                >
                  {busy ? <LoaderCircle className="fd-spin" size={15} aria-hidden="true" /> : null}
                  {busy ? 'Reopening…' : 'Reopen finding'}
                </button>
              ) : null}
            </div>
          </div>

          {error ? (
            <p className="notice fd-error" role="alert">
              <AlertCircle size={17} aria-hidden="true" />
              {error}
            </p>
          ) : null}
          <div className="fd-feedback" role="status" aria-live="polite">
            {feedback}
          </div>

          {editing ? (
            <form className="fd-response-form" onSubmit={submit} aria-label="Record response">
              <h2>Record your response</h2>
              <p>Keep the decision and its supporting evidence with this finding.</p>
              <div className="fd-field">
                <label htmlFor={`${formId}-status`}>Response status</label>
                <select
                  id={`${formId}-status`}
                  className="select"
                  value={targetStatus}
                  disabled={busy}
                  onChange={(event) => setTargetStatus(event.target.value as FindingStatus)}
                >
                  {Object.entries(labels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="fd-field">
                <label htmlFor={`${formId}-note`}>
                  Response note <span>Optional</span>
                </label>
                <textarea
                  id={`${formId}-note`}
                  className="textarea"
                  maxLength={4000}
                  rows={3}
                  value={note}
                  disabled={busy}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="What did you assess or change?"
                />
              </div>
              <div className="fd-field">
                <label htmlFor={`${formId}-evidence`}>
                  Verification evidence <span>{evidenceRequired ? 'Required' : 'Optional'}</span>
                </label>
                <textarea
                  id={`${formId}-evidence`}
                  className="textarea"
                  maxLength={4000}
                  minLength={evidenceRequired ? 10 : undefined}
                  required={evidenceRequired}
                  rows={4}
                  value={evidence}
                  disabled={busy}
                  aria-describedby={`${formId}-evidence-help`}
                  onChange={(event) => setEvidence(event.target.value)}
                  placeholder="Record the deployed version, build reference and how you checked it, or explain why the service is not affected."
                />
                <p id={`${formId}-evidence-help`} className="fd-field-help">
                  {evidenceRequired ? 'At least 10 characters. ' : ''}Resolved and not-affected
                  responses record your team’s attestation. Wisesama does not independently verify a
                  deployed fix.
                </p>
              </div>
              <div className="fd-form-footer">
                <button
                  type="button"
                  className="button"
                  disabled={busy}
                  onClick={() => {
                    setEditing(false);
                    setError('');
                  }}
                >
                  Cancel
                </button>
                <button type="submit" className="button primary" disabled={busy}>
                  {busy ? (
                    <LoaderCircle className="fd-spin" size={15} aria-hidden="true" />
                  ) : (
                    <FileCheck2 size={15} aria-hidden="true" />
                  )}
                  {busy ? 'Saving response…' : 'Save response'}
                </button>
              </div>
            </form>
          ) : null}

          {project?.scanError ? (
            <div className="notice fd-scan-warning">
              <AlertCircle size={17} aria-hidden="true" />
              <div>
                <strong>The latest assessment needs attention</strong>
                <p>{project.scanError} Existing findings remain available.</p>
              </div>
            </div>
          ) : null}

          <FindingRemediation findingId={finding.id} canEdit={canManage} />

          <section className="fd-section" aria-labelledby={`${formId}-match`}>
            <div className="fd-section-heading">
              <h2 id={`${formId}-match`}>Why this matches</h2>
              {canManage ? (
                <button
                  type="button"
                  className="text-link"
                  onClick={() => onViewInventory(finding.projectId)}
                >
                  View inventory <ArrowRight size={13} aria-hidden="true" />
                </button>
              ) : (
                <Link
                  className="text-link"
                  href={`/app/projects/${encodeURIComponent(finding.projectId)}/security`}
                >
                  View security baseline <ArrowRight size={13} aria-hidden="true" />
                </Link>
              )}
            </div>
            <dl className="fd-evidence-table">
              <div>
                <dt>Imported package</dt>
                <dd>
                  <code>
                    {finding.packageName}@{finding.installedVersion}
                  </code>
                </dd>
              </div>
              <div>
                <dt>Ecosystem</dt>
                <dd>{finding.ecosystem}</dd>
              </div>
              <div>
                <dt>Advisory identifiers</dt>
                <dd className="fd-identifiers">
                  {aliases.map((id) => (
                    <code key={id}>{id}</code>
                  ))}
                </dd>
              </div>
              <div>
                <dt>Reported fixed version</dt>
                <dd>
                  {finding.fixedVersion ? (
                    <code>{finding.fixedVersion}</code>
                  ) : (
                    'No fixed version supplied'
                  )}
                </dd>
              </div>
              {project ? (
                <div>
                  <dt>Inventory updated</dt>
                  <dd>
                    <time dateTime={project.inventoryUpdatedAt}>
                      {timestamp(project.inventoryUpdatedAt)}
                    </time>
                  </dd>
                </div>
              ) : null}
              <div>
                <dt>Last matched</dt>
                <dd>
                  <time dateTime={finding.lastSeenAt}>{timestamp(finding.lastSeenAt)}</time>
                </dd>
              </div>
            </dl>
            <p className="fd-scope">
              <Info size={14} aria-hidden="true" />
              <span>
                A package-version match does not prove deployment exposure. The reported fixed
                version is source guidance, not a claim that it is the latest supported release.
              </span>
            </p>
          </section>
        </article>

        <aside className="fd-properties" aria-label="Finding properties">
          <h2>Finding details</h2>
          <dl className="fd-property-group">
            <div>
              <dt>Project</dt>
              <dd>{finding.projectName}</dd>
            </div>
            {project ? (
              <div>
                <dt>Environment</dt>
                <dd className="fd-capitalize">{project.environment}</dd>
              </div>
            ) : null}
            <div>
              <dt>Response</dt>
              <dd>
                <Status value={finding.status} />
                {closed ? (
                  <p className="fd-attestation">
                    User attested. Deployment not independently verified.
                  </p>
                ) : null}
              </dd>
            </div>
          </dl>
          <dl className="fd-property-group">
            <div>
              <dt>Technical severity</dt>
              <dd>
                <span className={`fd-severity fd-severity-${advisory.severity}`}>
                  <span aria-hidden="true" />
                  {advisory.severity}
                </span>
                {advisory.cvss !== null ? (
                  <p className="fd-property-help">CVSS {advisory.cvss.toFixed(1)}</p>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Known exploitation</dt>
              <dd>
                <span
                  className={`fd-exploitation ${kevStatus === 'known_exploited' ? 'fd-danger' : ''}`}
                >
                  {kevStatus === 'known_exploited'
                    ? 'Listed in CISA KEV'
                    : kevStatus === 'not_in_kev'
                      ? 'Not in the checked KEV catalogue'
                      : 'Unknown'}
                </span>
                <p className="fd-property-help">
                  {kevStatus === 'known_exploited'
                    ? 'Evidence of exploitation in the wild; it does not establish an attack on your service.'
                    : kevStatus === 'not_in_kev'
                      ? 'Absence from KEV does not prove exploitation is absent.'
                      : 'Known-exploitation evidence was not available for this advisory.'}
                </p>
                {advisory.exploitationCheckedAt ? (
                  <p className="fd-property-help">
                    Checked{' '}
                    <time dateTime={advisory.exploitationCheckedAt}>
                      {timestamp(advisory.exploitationCheckedAt)}
                    </time>
                  </p>
                ) : null}
                {kevSource && kevSource.status !== 'healthy' ? (
                  <p className="fd-property-warning">
                    Latest CISA refresh {kevSource.status}. Previously collected evidence is
                    retained.
                  </p>
                ) : null}
              </dd>
            </div>
            <div>
              <dt>Exploitation forecast</dt>
              <dd>
                {advisory.epss !== null
                  ? `${(advisory.epss * 100).toFixed(2)}% EPSS`
                  : epssSource?.status === 'unavailable'
                    ? 'Unavailable'
                    : 'No EPSS score supplied'}
                <p className="fd-property-help">
                  A forecast, separate from severity and observed exploitation.
                </p>
                {epssSource?.checkedAt ? (
                  <p className="fd-property-help">
                    Checked{' '}
                    <time dateTime={epssSource.checkedAt}>{timestamp(epssSource.checkedAt)}</time>
                  </p>
                ) : null}
              </dd>
            </div>
          </dl>
          <div className="fd-property-group fd-coverage">
            <h3>Assessment scope</h3>
            <p>
              Imported {finding.ecosystem} package versions. Runtime, container images and code
              reachability are not assessed.
            </p>
          </div>
          {project?.sources.length ? (
            <div className="fd-property-group fd-sources">
              <h3>Assessment sources</h3>
              <ul>
                {project.sources.map((source) => (
                  <li key={source.name}>
                    <div>
                      <strong>{source.name}</strong>
                      <span className={`fd-source-status fd-source-${source.status}`}>
                        {source.status}
                      </span>
                    </div>
                    <time dateTime={source.checkedAt}>{timestamp(source.checkedAt)}</time>
                    {source.error ? <p>{source.error}</p> : null}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </aside>
        <div className="fd-followup">
          <section className="fd-section" aria-labelledby={`${formId}-response`}>
            <div className="fd-section-heading">
              <h2 id={`${formId}-response`}>Suggested response</h2>
            </div>
            <ol className="fd-response-steps">
              <li>
                <span className="fd-step-mark">1</span>
                <div>
                  <strong>Confirm the deployed package</strong>
                  <p>Check the running service and how the affected functionality is used.</p>
                </div>
              </li>
              <li>
                <span className="fd-step-mark">2</span>
                <div>
                  <strong>Follow the vendor’s current guidance</strong>
                  <p>
                    Review the source advisory, update or mitigate as appropriate, then rebuild,
                    test and redeploy.
                  </p>
                </div>
              </li>
              <li>
                <span className="fd-step-mark">3</span>
                <div>
                  <strong>Record the outcome and verification</strong>
                  <p>Keep a build reference or deployment check with the response.</p>
                </div>
              </li>
            </ol>
          </section>

          <section className="fd-section" aria-labelledby={`${formId}-source`}>
            <div className="fd-section-heading">
              <h2 id={`${formId}-source`}>Source advisory</h2>
              <span className="fd-source-name">{advisory.source}</span>
            </div>
            <div className="fd-source-dates">
              <span>
                Published{' '}
                <time dateTime={advisory.publishedAt}>{timestamp(advisory.publishedAt)}</time>
              </span>
              <span>
                Updated <time dateTime={advisory.modifiedAt}>{timestamp(advisory.modifiedAt)}</time>
              </span>
            </div>
            {advisory.summary ? (
              <details className="fd-advisory-details">
                <summary>Read advisory details</summary>
                <div className="fd-advisory-copy">{advisory.summary}</div>
              </details>
            ) : (
              <p className="fd-field-help">This source did not supply an advisory summary.</p>
            )}
            {primaryReferences.length ? (
              <ul className="fd-source-links fd-primary-sources">
                {primaryReferences.map((reference) => (
                  <li key={reference.url}>
                    <a
                      href={reference.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-link"
                      title={reference.url}
                    >
                      {reference.label}
                      <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="fd-field-help">No source links were supplied with this advisory.</p>
            )}
            {additionalReferences.length ? (
              <details className="fd-advisory-details fd-reference-details">
                <summary>Additional source references ({additionalReferences.length})</summary>
                <ul className="fd-source-links">
                  {additionalReferences.map((url) => (
                    <li key={url.href}>
                      <a
                        href={url.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-link"
                        title={url.href}
                      >
                        {url.hostname}
                        {url.pathname}
                        {url.search}
                        {url.hash}
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </section>

          <section className="fd-section" aria-labelledby={`${formId}-activity`}>
            <div className="fd-section-heading">
              <h2 id={`${formId}-activity`}>Activity</h2>
              <span className="fd-source-name">Response history</span>
            </div>
            <ol className="fd-history">
              {finding.events.map((event) => (
                <li key={event.id}>
                  <span className="fd-history-mark">
                    <Check size={11} aria-hidden="true" />
                  </span>
                  <div className="fd-history-body">
                    <strong>Response recorded: {labels[event.status]}</strong>
                    {event.note ? <p>{event.note}</p> : null}
                    {event.evidence ? (
                      <div className="fd-history-evidence">
                        <span>Recorded evidence</span>
                        <p>{event.evidence}</p>
                      </div>
                    ) : null}
                    {event.status === 'resolved' || event.status === 'not_affected' ? (
                      <span className="fd-attestation">
                        User attested · deployment not independently verified
                      </span>
                    ) : null}
                    <time dateTime={event.createdAt}>{timestamp(event.createdAt)}</time>
                  </div>
                </li>
              ))}
              <li>
                <span className="fd-history-mark fd-history-import">
                  <Circle size={11} aria-hidden="true" />
                </span>
                <div className="fd-history-body">
                  <strong>Wisesama matched the imported package version</strong>
                  <time dateTime={finding.firstSeenAt}>{timestamp(finding.firstSeenAt)}</time>
                </div>
              </li>
            </ol>
          </section>
        </div>
      </div>
    </div>
  );
}
