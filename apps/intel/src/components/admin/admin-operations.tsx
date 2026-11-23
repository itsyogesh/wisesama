'use client';

import { ArrowRight, ExternalLink, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  type AdminAudit,
  type AdminFailure,
  type AdminJob,
  type AdminJobDetail,
  type AdminJobKind,
  type AdminOverview,
  type AdminPage,
  type AdminSource,
  adminApi,
} from '../../lib/admin-api';
import {
  AuditTrail,
  BackLink,
  collectionPath,
  dateTime,
  detailHref,
  EmptyState,
  errorMessage,
  human,
  ListFilters,
  LoadState,
  MobileRowFacts,
  PageHeading,
  Pagination,
  ReasonForm,
  RecordFacts,
  Status,
  safeUrl,
  TableFrame,
  useAdminData,
} from './admin-common';

export const jobLabels: Record<AdminJobKind, string> = {
  source_refresh: 'Source health check',
  feed_refresh: 'Public feed refresh',
  repository_sync: 'Repository sync',
  project_assessment: 'Project assessment',
  private_delivery: 'Private email delivery',
  public_delivery: 'Public email delivery',
  feedback_reconcile: 'Mail feedback reconciliation',
};
const newJobHref = (failure: AdminFailure) =>
  `/admin/jobs/new?${new URLSearchParams({ kind: failure.kind, targetId: failure.targetId })}`;

export function FailuresTable({
  items,
  compact = false,
}: {
  items: AdminFailure[];
  compact?: boolean;
}) {
  return items.length ? (
    <TableFrame label="Existing failed work">
      <table className="am-table">
        <thead>
          <tr>
            <th>Failed work</th>
            <th>Issue</th>
            <th>Last failure</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.id}>
              <td>
                <strong>{item.label}</strong>
                <small>{jobLabels[item.kind]}</small>
                {item.ownerLabel ? <small>{item.ownerLabel}</small> : null}
                <MobileRowFacts
                  items={[
                    [
                      'Issue',
                      <p key="issue" className="am-error-copy">
                        {item.error}
                      </p>,
                    ],
                    ...(item.blockedReason
                      ? [['Retry restriction', item.blockedReason] as [string, string]]
                      : []),
                    ['Last failure', dateTime(item.failedAt)],
                    [
                      'Action',
                      item.retryable ? (
                        <Link key="action" className="am-text-link" href={newJobHref(item)}>
                          Review retry <ArrowRight />
                        </Link>
                      ) : (
                        'Retry unavailable'
                      ),
                    ],
                  ]}
                />
              </td>
              <td>
                <p className="am-error-copy">{item.error}</p>
                {item.blockedReason ? <small>{item.blockedReason}</small> : null}
              </td>
              <td>{dateTime(item.failedAt)}</td>
              <td>
                {item.retryable ? (
                  <Link className="am-text-link" href={newJobHref(item)}>
                    Review retry <ArrowRight />
                  </Link>
                ) : (
                  <span className="am-muted">Retry unavailable</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {compact ? null : (
        <p className="am-table-note">
          Up to 100 recent failed-work records. A queued retry rechecks current access, consent, and
          delivery state before acting.
        </p>
      )}
    </TableFrame>
  ) : (
    <EmptyState
      title="No failed work is recorded"
      description="Repository, assessment, delivery, and feedback failures appear here when persisted by the service."
    />
  );
}

export function AdminOverviewView() {
  const state = useAdminData<AdminOverview>('/overview');
  const failures = useAdminData<{ items: AdminFailure[]; limit: number }>('/failures');
  return (
    <>
      <PageHeading
        title="Operations overview"
        description="Find the work that needs attention, inspect the evidence, and record what you change."
      />
      <LoadState
        error={state.error}
        loading={state.loading}
        hasData={Boolean(state.data)}
        onRetry={() => void state.reload()}
      />
      {state.data ? (
        <>
          <div className="am-overview-links">
            <Link href="/admin/users">
              <strong>Users</strong>
              <span>
                {state.data.users.total} accounts · {state.data.users.suspended} suspended
              </span>
              <ArrowRight />
            </Link>
            <Link href="/admin/advisories">
              <strong>Advisories</strong>
              <span>
                {state.data.advisories.total} collected · {state.data.advisories.hidden} hidden
              </span>
              <ArrowRight />
            </Link>
            <Link href="/admin/subscriptions">
              <strong>Subscriptions</strong>
              <span>
                {state.data.subscriptions.active} active · {state.data.subscriptions.pending}{' '}
                pending confirmation
              </span>
              <ArrowRight />
            </Link>
          </div>
          <section className="am-section">
            <div className="am-section-title">
              <div>
                <h2>Failed work to review</h2>
                <p>Existing service failures, before an operator retry is queued.</p>
              </div>
              <Link className="am-text-link" href="/admin/jobs">
                All failed jobs <ArrowRight />
              </Link>
            </div>
            <LoadState
              error={failures.error}
              loading={failures.loading}
              hasData={Boolean(failures.data)}
              onRetry={() => void failures.reload()}
            />
            {failures.data ? (
              <FailuresTable items={failures.data.items.slice(0, 6)} compact />
            ) : null}
          </section>
          <AuditTrail events={state.data.recentAudit} title="Recent operator activity" />
        </>
      ) : null}
    </>
  );
}

export function SourcesList() {
  const state = useAdminData<{ items: AdminSource[]; checkedAt: string }>('/sources');
  return (
    <>
      <PageHeading
        title="Sources"
        description="Inspect collection health and control the fixed intelligence sources Wisesama uses."
      />
      <LoadState
        error={state.error}
        loading={state.loading}
        hasData={Boolean(state.data)}
        onRetry={() => void state.reload()}
      />
      {state.data ? (
        <>
          <TableFrame label="Intelligence source controls">
            <table className="am-table">
              <thead>
                <tr>
                  <th>Source</th>
                  <th>Collection</th>
                  <th>Health</th>
                  <th>Last successful check</th>
                  <th>Latest attempt</th>
                </tr>
              </thead>
              <tbody>
                {state.data.items.map((source) => (
                  <tr key={source.id}>
                    <td>
                      <Link className="am-record-link" href={`/admin/sources/${source.id}`}>
                        {source.name}
                        <ArrowRight />
                      </Link>
                      <small>{source.purpose}</small>
                      {source.lastError ? (
                        <small className="am-error-copy">{source.lastError}</small>
                      ) : null}
                      <MobileRowFacts
                        items={[
                          [
                            'Collection',
                            <Status key="collection" value={source.paused ? 'paused' : 'active'} />,
                          ],
                          ['Check state', <Status key="check" value={source.health} />],
                          ['Last successful check', dateTime(source.lastSuccessAt)],
                          ['Latest attempt', dateTime(source.lastAttemptAt)],
                        ]}
                      />
                    </td>
                    <td>
                      <Status value={source.paused ? 'paused' : 'active'} />
                    </td>
                    <td>
                      <Status value={source.health} />
                    </td>
                    <td>{dateTime(source.lastSuccessAt)}</td>
                    <td>{dateTime(source.lastAttemptAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </TableFrame>
          <p className="am-boundary">
            This is saved collection health, not a live availability guarantee. Opening the list
            does not contact upstream services. Pausing a source preserves existing evidence and
            makes coverage limits visible.
          </p>
        </>
      ) : null}
    </>
  );
}

export function SourceRecord({ id }: { id: string }) {
  const state = useAdminData<{ items: AdminSource[]; checkedAt: string }>('/sources');
  const audit = useAdminData<AdminPage<AdminAudit>>(
    `/audit?targetType=source&targetId=${encodeURIComponent(id)}&limit=20`,
  );
  const source = state.data?.items.find((item) => item.id === id);
  const [feedback, setFeedback] = useState('');
  const [queued, setQueued] = useState<AdminJob | null>(null);
  return (
    <>
      <BackLink section="sources" label="All sources" />
      <PageHeading
        title={source?.name || 'Source record'}
        description="Saved collection state, coverage impact, and audited source controls."
      />
      <LoadState
        error={state.error}
        loading={state.loading}
        hasData={Boolean(state.data)}
        onRetry={() => void state.reload()}
      />
      {state.data && !source ? (
        <EmptyState
          title="Source not found"
          description="Wisesama uses a fixed registry of supported intelligence sources."
        />
      ) : null}
      {source ? (
        <>
          <div className="am-record-top">
            <span className="am-state-dimension">
              Collection <Status value={source.paused ? 'paused' : 'active'} />
            </span>
            <span className="am-state-dimension">
              Check state <Status value={source.health} />
            </span>
          </div>
          {feedback ? (
            <p className="am-feedback" role="status">
              {feedback}
            </p>
          ) : null}
          <div className="am-record-layout">
            <div>
              <section className="am-section">
                <h2>Collection record</h2>
                <p className="am-body-copy">{source.purpose}</p>
                <RecordFacts
                  items={[
                    ['Source ID', source.id],
                    ['Collection state', source.paused ? 'Paused by operator' : 'Enabled'],
                    ['Check state', human(source.health)],
                    ['Last attempt', dateTime(source.lastAttemptAt)],
                    ['Last successful check', dateTime(source.lastSuccessAt)],
                    ['Control updated', dateTime(source.updatedAt)],
                    ['Latest error', source.lastError || 'No error recorded'],
                  ]}
                />
                {safeUrl(source.url) ? (
                  <a
                    className="am-text-link"
                    href={safeUrl(source.url)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Official source <ExternalLink />
                  </a>
                ) : null}
              </section>
              <section className="am-section">
                <h2>How pausing affects coverage</h2>
                <p>
                  Pausing stops new reads from this source, including warm-cache use. Previous
                  evidence is retained. A paused matching source can prevent an assessment; paused
                  enrichment leaves the corresponding signal unknown. Review the customer-visible
                  coverage state before relying on an earlier result.
                </p>
                <p className="am-help">
                  The source URL is fixed. This admin cannot add arbitrary network destinations.
                </p>
              </section>
              {queued ? (
                <div className="am-inline-result" role="status">
                  <span>
                    {jobLabels[queued.kind]} <Status value={queued.status} />
                  </span>
                  <Link className="am-text-link" href={`/admin/jobs/${queued.id}`}>
                    Inspect queued work <ArrowRight />
                  </Link>
                </div>
              ) : null}
            </div>
            <aside className="am-record-aside">
              <ReasonForm
                key={`source-${source.id}-${source.revision}`}
                title={source.paused ? 'Resume collection' : 'Pause collection'}
                description={
                  source.paused
                    ? 'Allow fresh reads from this source. Resuming does not itself run a check or establish fresh evidence.'
                    : 'Pause future reads from this source. Existing findings and prior affirmative evidence remain; their freshness and coverage limits must stay visible.'
                }
                submitLabel={source.paused ? 'Confirm resume' : 'Confirm pause'}
                effect={
                  source.paused ? 'resume reads from this source.' : 'pause reads from this source.'
                }
                danger={!source.paused}
                onReload={() => void state.reload()}
                onSubmit={async (reason) => {
                  await adminApi.source(source.id, {
                    paused: !source.paused,
                    expectedRevision: source.revision,
                    reason,
                  });
                  await state.reload();
                  await audit.reload();
                  setFeedback('Source control updated and recorded in audit history.');
                }}
              />
              {source.paused ? (
                <section className="am-section">
                  <h2>Health check unavailable</h2>
                  <p>Resume collection before queueing a new source check.</p>
                </section>
              ) : (
                <ReasonForm
                  title="Check source health"
                  description="Queue one bounded check against this source’s fixed upstream endpoint. Health stays unchanged until the job actually runs."
                  submitLabel="Queue health check"
                  effect="queue one source health check."
                  onReload={() => void state.reload()}
                  onSubmit={async (reason) => {
                    const result = await adminApi.queue({
                      kind: 'source_refresh',
                      targetId: source.id,
                      reason,
                    });
                    setQueued(result.job);
                    setFeedback(
                      result.deduplicated
                        ? 'An equivalent job is already queued or running. Inspect it below.'
                        : 'Health check queued. Inspect and run the job, or let the configured scheduler process it.',
                    );
                  }}
                />
              )}
            </aside>
          </div>
          <LoadState
            error={audit.error}
            loading={audit.loading}
            hasData={Boolean(audit.data)}
            onRetry={() => void audit.reload()}
          />
          {audit.data ? <AuditTrail events={audit.data.items} /> : null}
        </>
      ) : null}
    </>
  );
}

function JobKindFilter() {
  const params = useSearchParams();
  return (
    <select name="kind" aria-label="Job kind" defaultValue={params.get('kind') || ''}>
      <option value="">All job kinds</option>
      {Object.entries(jobLabels).map(([value, label]) => (
        <option key={value} value={value}>
          {label}
        </option>
      ))}
    </select>
  );
}
export function JobsList() {
  const params = useSearchParams();
  const state = useAdminData<AdminPage<AdminJob>>(collectionPath('/jobs', params));
  const failures = useAdminData<{ items: AdminFailure[]; limit: number }>('/failures');
  const q = (params.get('q') || '').toLowerCase();
  const selectedKind = params.get('kind');
  const filteredFailures = failures.data?.items.filter(
    (item) =>
      (!selectedKind || item.kind === selectedKind) &&
      (!q ||
        [item.label, item.targetId, item.error, item.ownerLabel || '']
          .join(' ')
          .toLowerCase()
          .includes(q)),
  );
  return (
    <>
      <PageHeading
        title="Failed jobs"
        description="Inspect failed work, queue a targeted retry, and follow its actual execution state."
      />
      <ListFilters
        statuses={[
          ['failed', 'Failed'],
          ['skipped', 'Skipped'],
          ['queued', 'Queued'],
          ['running', 'Running'],
          ['succeeded', 'Succeeded'],
        ]}
      >
        <JobKindFilter />
      </ListFilters>
      <section className="am-section">
        <div className="am-section-title">
          <div>
            <h2>Existing failed work</h2>
            <p>Repository, assessment, mail delivery, and feedback records eligible for review.</p>
          </div>
        </div>
        <LoadState
          error={failures.error}
          loading={failures.loading}
          hasData={Boolean(failures.data)}
          onRetry={() => void failures.reload()}
        />
        {filteredFailures ? <FailuresTable items={filteredFailures} /> : null}
      </section>
      <section className="am-section">
        <h2>Operator job history</h2>
        <p className="am-help">
          The status filter applies to operator jobs below. Existing failed work remains visible
          above until the service records recovery.
        </p>
        <LoadState
          error={state.error}
          loading={state.loading}
          hasData={Boolean(state.data)}
          onRetry={() => void state.reload()}
        />
        {state.data ? (
          state.data.items.length ? (
            <>
              <TableFrame label="Operator job history">
                <table className="am-table">
                  <thead>
                    <tr>
                      <th>Job</th>
                      <th>Status</th>
                      <th>Attempts</th>
                      <th>Last updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.data.items.map((job) => (
                      <tr key={job.id}>
                        <td>
                          <Link
                            className="am-record-link"
                            href={detailHref('jobs', job.id, params)}
                          >
                            {jobLabels[job.kind]}
                            <ArrowRight />
                          </Link>
                          <small>{job.targetId || 'Public intelligence'}</small>
                          {job.error ? <small className="am-error-copy">{job.error}</small> : null}
                          <MobileRowFacts
                            items={[
                              ['Status', <Status key="status" value={job.status} />],
                              ['Attempts', job.attempts],
                              ['Last updated', dateTime(job.updatedAt)],
                            ]}
                          />
                        </td>
                        <td>
                          <Status value={job.status} />
                        </td>
                        <td>{job.attempts}</td>
                        <td>{dateTime(job.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableFrame>
              <Pagination nextCursor={state.data.nextCursor} count={state.data.items.length} />
            </>
          ) : (
            <EmptyState
              title="No operator jobs match these filters"
              description="Queue a targeted retry from failed work above, or a health check from a source record."
            />
          )
        ) : null}
      </section>
    </>
  );
}

export function NewJob() {
  const params = useSearchParams();
  const kind = params.get('kind') as AdminJobKind | null;
  const targetId = params.get('targetId') || '';
  const failures = useAdminData<{ items: AdminFailure[]; limit: number }>('/failures');
  const failure = failures.data?.items.find(
    (item) => item.kind === kind && item.targetId === targetId,
  );
  const [queued, setQueued] = useState<AdminJob | null>(null);
  const [deduplicated, setDeduplicated] = useState(false);
  const feedRefresh = kind === 'feed_refresh' && !targetId;
  return (
    <>
      <BackLink section="jobs" label="Failed jobs" />
      <PageHeading
        title={feedRefresh ? 'Queue a public feed refresh' : 'Review a targeted retry'}
        description="Confirm the scope and reason before adding durable work to the operator queue."
      />
      {!feedRefresh ? (
        <LoadState
          error={failures.error}
          loading={failures.loading}
          hasData={Boolean(failures.data)}
          onRetry={() => void failures.reload()}
        />
      ) : null}
      {queued ? (
        <section className="am-section am-queued-result" role="status">
          <h2>{deduplicated ? 'Existing job found' : 'Job queued'}</h2>
          <p>
            {deduplicated
              ? 'Equivalent work is already queued or running. Inspect that job instead of starting a duplicate.'
              : 'The work is saved in the queue. It has not been recorded as successful.'}
          </p>
          <RecordFacts
            items={[
              ['Kind', jobLabels[queued.kind]],
              ['Target', queued.targetId || 'Public feed'],
              ['Current state', <Status key="status" value={queued.status} />],
            ]}
          />
          <Link className="button primary" href={`/admin/jobs/${queued.id}`}>
            Inspect job <ArrowRight />
          </Link>
        </section>
      ) : feedRefresh || failure ? (
        <div className="am-narrow-record">
          <section className="am-section">
            <h2>{feedRefresh ? 'Public advisory collection' : failure?.label}</h2>
            <RecordFacts
              items={[
                ['Work type', kind ? jobLabels[kind] : 'Unknown'],
                ['Target', targetId || 'Public advisory feed'],
                ...(!feedRefresh && failure
                  ? ([
                      ['Last failure', dateTime(failure.failedAt)],
                      ['Recorded error', failure.error],
                    ] as Array<[string, string]>)
                  : []),
              ]}
            />
            <p className="am-boundary">
              Execution rechecks current access and delivery consent. Sent mail is not resent,
              stopped subscriptions are not reactivated, and unavailable provider configuration
              remains a failure.
            </p>
          </section>
          {failure && !failure.retryable ? (
            <div className="am-error" role="alert">
              <p>{failure.blockedReason || 'This work is not currently eligible for retry.'}</p>
            </div>
          ) : (
            <ReasonForm
              title="Queue this work"
              description="The job is persisted first. You can inspect and run it afterward, or let the configured signed scheduler process it."
              submitLabel="Confirm and queue job"
              effect={`queue ${kind ? jobLabels[kind].toLowerCase() : 'this work'} for the target shown above.`}
              onReload={() => void failures.reload()}
              onSubmit={async (reason) => {
                if (!kind || !(kind in jobLabels)) throw new Error('Choose a supported job kind.');
                const result = await adminApi.queue({
                  kind,
                  ...(targetId ? { targetId } : {}),
                  reason,
                });
                setQueued(result.job);
                setDeduplicated(result.deduplicated);
              }}
            />
          )}
        </div>
      ) : failures.data ? (
        <EmptyState
          title="This work is no longer in the failed-work list"
          description="Return to failed jobs and review the latest record before queueing a retry."
        />
      ) : null}
    </>
  );
}

function RunJob({ job, onSaved }: { job: AdminJob; onSaved: (job: AdminJob) => void }) {
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function run() {
    if (!confirmed || busy) return;
    setBusy(true);
    setError('');
    try {
      onSaved((await adminApi.run(job.id)).job);
      setConfirmed(false);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="am-section am-action-section">
      <h2>Run queued work</h2>
      <p>
        Run this exact saved job now. It can contact the configured provider or attempt an eligible
        email delivery. Current access, source state, and consent checks still apply.
      </p>
      <label className="am-confirm">
        <input
          type="checkbox"
          checked={confirmed}
          disabled={busy}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <span>I reviewed the target and recorded reason and want to run this job now.</span>
      </label>
      <button
        className="button primary"
        type="button"
        disabled={!confirmed || busy}
        onClick={() => void run()}
      >
        {busy ? 'Running…' : 'Confirm and run job'}
      </button>
      {error ? (
        <p className="am-error" role="alert">
          {error} Reload the job to inspect its latest state.
        </p>
      ) : null}
    </section>
  );
}
export function JobRecord({ id }: { id: string }) {
  const state = useAdminData<AdminJobDetail>(`/jobs/${encodeURIComponent(id)}`);
  const value = state.data;
  const job = value?.job;
  const [feedback, setFeedback] = useState('');
  async function updateJob(updated: AdminJob) {
    state.setData((previous) => (previous ? { ...previous, job: updated } : previous));
    await state.reload();
    setFeedback(`Job state is ${human(updated.status)}. Review the recorded attempt below.`);
  }
  return (
    <>
      <BackLink section="jobs" label="All failed jobs" />
      <PageHeading
        title={job ? jobLabels[job.kind] : 'Job record'}
        description="The exact target, failure, recorded reason, and attempt history for this work."
      >
        <button className="button" type="button" onClick={() => void state.reload()}>
          <RefreshCw />
          Reload job
        </button>
      </PageHeading>
      <LoadState
        error={state.error}
        loading={state.loading}
        hasData={Boolean(value)}
        onRetry={() => void state.reload()}
      />
      {job && value ? (
        <>
          <div className="am-record-top">
            <Status value={job.status} />
            <code>{job.id}</code>
            <span>{job.attempts} attempts</span>
          </div>
          {feedback ? (
            <p className="am-feedback" role="status">
              {feedback}
            </p>
          ) : null}
          {job.error ? (
            <section className="am-job-error">
              <h2>Recorded failure</h2>
              <p>{job.error}</p>
            </section>
          ) : null}
          <div className="am-record-layout">
            <div>
              <section className="am-section">
                <h2>Job details</h2>
                <RecordFacts
                  items={[
                    ['Work type', jobLabels[job.kind]],
                    [
                      'Target ID',
                      job.targetId ? (
                        <code key="target">{job.targetId}</code>
                      ) : (
                        'Public intelligence'
                      ),
                    ],
                    ['Requested by', job.actorId || 'System'],
                    ['Created', dateTime(job.createdAt)],
                    ['Last updated', dateTime(job.updatedAt)],
                    ['Next eligible attempt', dateTime(job.nextAttemptAt)],
                    ['Started', dateTime(job.startedAt)],
                    ['Finished', dateTime(job.finishedAt)],
                    ['Operator reason', job.reason || 'No reason recorded'],
                  ]}
                />
              </section>
              <section className="am-section">
                <h2>Attempt history</h2>
                {value.attempts.length ? (
                  <TableFrame label="Exact job attempts">
                    <table className="am-table am-attempt-table">
                      <thead>
                        <tr>
                          <th>Attempt</th>
                          <th>Outcome</th>
                          <th>Started</th>
                          <th>Finished</th>
                        </tr>
                      </thead>
                      <tbody>
                        {value.attempts.map((attempt) => (
                          <tr key={`${attempt.attempt}-${attempt.startedAt}`}>
                            <td>
                              {attempt.attempt}
                              {attempt.error ? (
                                <small className="am-error-copy">{attempt.error}</small>
                              ) : null}
                              <MobileRowFacts
                                items={[
                                  ['Outcome', <Status key="outcome" value={attempt.status} />],
                                  ['Started', dateTime(attempt.startedAt)],
                                  ['Finished', dateTime(attempt.finishedAt)],
                                ]}
                              />
                            </td>
                            <td>
                              <Status value={attempt.status} />
                            </td>
                            <td>{dateTime(attempt.startedAt)}</td>
                            <td>{dateTime(attempt.finishedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableFrame>
                ) : (
                  <p className="am-muted">No execution attempt has been recorded.</p>
                )}
              </section>
            </div>
            <aside className="am-record-aside">
              {job.status === 'queued' ? (
                <RunJob
                  key={`${job.id}-${job.updatedAt}`}
                  job={job}
                  onSaved={(updated) => void updateJob(updated)}
                />
              ) : job.retryable && ['failed', 'skipped'].includes(job.status) ? (
                <ReasonForm
                  key={`${job.id}-${job.updatedAt}`}
                  title="Queue another attempt"
                  description="Retry this same job after reviewing its error and current target state. Queueing does not establish recovery or bypass access and consent checks."
                  submitLabel="Confirm retry"
                  effect="queue another attempt for this exact job."
                  onReload={() => void state.reload()}
                  onSubmit={async (reason) =>
                    updateJob(
                      (await adminApi.retry(job.id, { reason, expectedUpdatedAt: job.updatedAt }))
                        .job,
                    )
                  }
                />
              ) : (
                <section className="am-section">
                  <h2>
                    {job.status === 'running' ? 'Execution in progress' : 'No retry available'}
                  </h2>
                  <p>
                    {job.status === 'running'
                      ? 'Another worker owns this execution. Reload the job to inspect its outcome; a duplicate run is not offered.'
                      : 'This job’s current state does not permit an operator retry. Successful work is not replayed.'}
                  </p>
                </section>
              )}
            </aside>
          </div>
        </>
      ) : null}
    </>
  );
}
