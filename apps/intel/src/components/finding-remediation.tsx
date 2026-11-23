'use client';

import {
  ArrowDownToLine,
  ArrowRight,
  Bot,
  CheckCircle2,
  Copy,
  GitPullRequest,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import { type FormEvent, useEffect, useRef, useState } from 'react';
import { type RemediationFields, type RemediationReport, remediationApi } from '../lib/remediation';
import { Choice, FormField, TextArea, TextInput } from './ui/form-controls';
import './finding-remediation.css';

const inventoryLabels: Record<RemediationReport['verification']['inventory'], string> = {
  not_checked: 'Awaiting recheck',
  stale: 'Recheck needed',
  clear: 'No matching version found',
  affected: 'Affected version still present',
  incomplete: 'Check incomplete',
};
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function date(value: string) {
  return new Date(value).toLocaleString();
}

export function FindingRemediation({
  findingId,
  canEdit,
}: {
  findingId: string;
  canEdit: boolean;
}) {
  const [report, setReport] = useState<RemediationReport | null>(null);
  const [draft, setDraft] = useState<RemediationFields | null>(null);
  const [handoff, setHandoff] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');
  const pending = useRef(false);
  const dirty = Boolean(report && draft && JSON.stringify(report.fields) !== JSON.stringify(draft));
  useEffect(() => {
    const controller = new AbortController();
    remediationApi
      .get(findingId, controller.signal)
      .then((value) => {
        setReport(value);
        setDraft(value.fields);
      })
      .catch((cause) => {
        if (!controller.signal.aborted)
          setError(cause instanceof Error ? cause.message : 'The fix record could not load.');
      });
    return () => controller.abort();
  }, [findingId]);
  async function run(name: string, action: () => Promise<void>) {
    if (pending.current) return;
    pending.current = true;
    setBusy(name);
    setError('');
    setFeedback('');
    try {
      await action();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'This action could not complete. Try again.',
      );
    } finally {
      pending.current = false;
      setBusy('');
    }
  }
  function adopt(value: RemediationReport) {
    setReport(value);
    setDraft(value.fields);
  }
  function change<K extends keyof RemediationFields>(field: K, value: RemediationFields[K]) {
    setDraft((current) => (current ? { ...current, [field]: value } : current));
  }
  function save(event: FormEvent) {
    event.preventDefault();
    if (!report || !draft) return;
    void run('save', async () => {
      adopt(await remediationApi.save(findingId, report.revision, draft));
      setFeedback(
        'Fix evidence saved. Recheck the repository when the change is available on the tracked branch.',
      );
    });
  }
  return (
    <section className="remediation" aria-labelledby="remediation-title" aria-busy={Boolean(busy)}>
      <header className="remediation-header">
        <div>
          <span className="eyebrow">Fix workflow</span>
          <h2 id="remediation-title">Take this finding through to a fix</h2>
          <p>
            Give your coding agent the context, review its change, and keep the evidence together.
          </p>
        </div>
        <Bot size={26} aria-hidden="true" />
      </header>
      {error ? (
        <div className="notice" role="alert">
          <p>{error}</p>
          <button
            className="text-link"
            type="button"
            disabled={Boolean(busy)}
            onClick={() =>
              void run('reload', async () => {
                const current = await remediationApi.get(findingId);
                setReport(current);
                setDraft((previous) => previous ?? current.fields);
                setFeedback('Latest record loaded. Your unsaved draft has been kept.');
              })
            }
          >
            Reload latest record
          </button>
        </div>
      ) : null}
      <p className="remediation-feedback" role="status">
        {busy ? (
          <>
            <LoaderCircle className="ws-spin" size={14} aria-hidden="true" />{' '}
            {busy === 'recheck' ? 'Syncing and checking the latest inventory…' : 'Working…'}
          </>
        ) : (
          feedback
        )}
      </p>
      {!report || !draft ? (
        <p>Loading fix record…</p>
      ) : (
        <>
          <ol className="remediation-steps">
            <li>
              <span>1</span> Prepare context
            </li>
            <li>
              <span>2</span> Review the change
            </li>
            <li>
              <span>3</span> Recheck &amp; record
            </li>
          </ol>
          <div className="remediation-handoff">
            <div>
              <h3>Start with your coding agent</h3>
              <p>
                Copy the instructions into Codex, Claude Code, or your preferred agent in this
                repository. Review proposed changes before merging.
              </p>
            </div>
            <button
              type="button"
              className="button primary"
              disabled={!canEdit || Boolean(busy)}
              onClick={() =>
                void run('handoff', async () => {
                  const value = await remediationApi.handoff(findingId);
                  setHandoff(value.prompt);
                  setReport(await remediationApi.get(findingId));
                  setFeedback('Handoff prepared. Copy or download it for your coding agent.');
                })
              }
            >
              Prepare agent handoff <ArrowRight size={15} aria-hidden="true" />
            </button>
          </div>
          {handoff ? (
            <div className="remediation-prompt">
              <label htmlFor={`handoff-${findingId}`}>Instructions for your agent</label>
              <textarea id={`handoff-${findingId}`} readOnly rows={8} value={handoff} />
              <div className="remediation-actions">
                <button
                  type="button"
                  className="button"
                  onClick={() =>
                    void run('copy', async () => {
                      await navigator.clipboard.writeText(handoff);
                      setFeedback('Agent instructions copied.');
                    })
                  }
                >
                  <Copy size={14} aria-hidden="true" /> Copy instructions
                </button>
                <button
                  type="button"
                  className="text-link"
                  onClick={() =>
                    download('wisesama-remediation-handoff.txt', handoff, 'text/plain')
                  }
                >
                  Download instructions
                </button>
              </div>
              <small>
                Includes this finding and repository details. Share it only with tools your team
                trusts.
              </small>
            </div>
          ) : null}
          <details className="remediation-editor">
            <summary>
              <GitPullRequest size={16} aria-hidden="true" /> Fix and deployment evidence{' '}
              <span>
                {report.fields.pullRequestUrl ? 'References saved' : 'Add references after review'}
              </span>
            </summary>
            <form onSubmit={save} className="remediation-form">
              <fieldset disabled={!canEdit || Boolean(busy)}>
                <legend>
                  <GitPullRequest size={16} aria-hidden="true" /> Review the fix
                </legend>
                <div className="remediation-fields">
                  <FormField
                    label="Pull request or merge request"
                    description="A link from this project’s connected repository."
                  >
                    {(attributes) => (
                      <TextInput
                        {...attributes}
                        type="url"
                        value={draft.pullRequestUrl}
                        maxLength={2000}
                        placeholder="https://github.com/your-team/repo/pull/123"
                        onChange={(event) => change('pullRequestUrl', event.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField
                    label="Fix commit"
                    description="Full commit SHA available on the tracked branch after merge."
                  >
                    {(attributes) => (
                      <TextInput
                        {...attributes}
                        value={draft.fixedCommit}
                        maxLength={64}
                        pattern="[a-fA-F0-9]{40}|[a-fA-F0-9]{64}"
                        placeholder="Full commit SHA"
                        onChange={(event) => change('fixedCommit', event.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField label="Test result">
                    {(attributes) => (
                      <Choice
                        {...attributes}
                        value={draft.testResult}
                        options={[
                          { value: 'not_run', label: 'Not run' },
                          { value: 'passed', label: 'Passed' },
                          { value: 'failed', label: 'Failed' },
                        ]}
                        onValueChange={(value) =>
                          change('testResult', value as RemediationFields['testResult'])
                        }
                      />
                    )}
                  </FormField>
                  <FormField
                    label="Test evidence"
                    description="Commands, results, and a CI run link. Results are reported by your team."
                  >
                    {(attributes) => (
                      <TextArea
                        {...attributes}
                        rows={3}
                        value={draft.testEvidence}
                        maxLength={4000}
                        onChange={(event) => change('testEvidence', event.target.value)}
                      />
                    )}
                  </FormField>
                </div>
              </fieldset>
              <fieldset disabled={!canEdit || Boolean(busy)}>
                <legend>
                  <CheckCircle2 size={16} aria-hidden="true" /> Record what shipped
                </legend>
                <p className="remediation-hint">
                  Add this after deployment. A passing test or merged change alone does not confirm
                  production is fixed.
                </p>
                <div className="remediation-fields">
                  <FormField label="Deployed commit">
                    {(attributes) => (
                      <TextInput
                        {...attributes}
                        value={draft.deployedCommit}
                        maxLength={64}
                        pattern="[a-fA-F0-9]{40}|[a-fA-F0-9]{64}"
                        placeholder="Full deployed commit SHA"
                        onChange={(event) => change('deployedCommit', event.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField
                    label="Deployment reference"
                    description="HTTPS link to your deployment or release."
                  >
                    {(attributes) => (
                      <TextInput
                        {...attributes}
                        type="url"
                        value={draft.deploymentUrl}
                        maxLength={2000}
                        onChange={(event) => change('deploymentUrl', event.target.value)}
                      />
                    )}
                  </FormField>
                  <FormField
                    label="Deployment evidence"
                    description="Which environment shipped, when, and what you checked."
                  >
                    {(attributes) => (
                      <TextArea
                        {...attributes}
                        rows={3}
                        value={draft.deploymentNote}
                        maxLength={4000}
                        onChange={(event) => change('deploymentNote', event.target.value)}
                      />
                    )}
                  </FormField>
                </div>
              </fieldset>
              <div className="remediation-actions">
                <button
                  className="button primary"
                  type="submit"
                  disabled={!canEdit || Boolean(busy) || !dirty}
                >
                  {busy === 'save' ? 'Saving…' : 'Save fix evidence'}
                </button>
                <span className="remediation-hint">
                  {dirty ? 'Unsaved changes' : `Saved revision ${report.revision}`}
                </span>
              </div>
            </form>
          </details>
          <div className="remediation-verification">
            <div>
              <span className="eyebrow">Repository recheck</span>
              <h3>{inventoryLabels[report.verification.inventory]}</h3>
              <p>
                {report.verification.inventory === 'clear'
                  ? 'This advisory no longer matches the checked inventory. Confirm the running version and deployment separately.'
                  : 'Check the latest tracked inventory against this advisory. Findings remain open until your team records a response.'}
              </p>
              {report.recheck ? (
                <small>
                  Checked {date(report.recheck.checkedAt)} ·{' '}
                  {report.recheck.commit?.slice(0, 12) || 'Uploaded inventory'}
                  {report.verification.fixedCommitAssessed ? ' · Matches fix commit' : ''}
                </small>
              ) : null}
            </div>
            <button
              type="button"
              className="button"
              disabled={!canEdit || Boolean(busy) || dirty}
              title={dirty ? 'Save your evidence before rechecking.' : undefined}
              onClick={() =>
                void run('recheck', async () => {
                  adopt(await remediationApi.recheck(findingId, report.revision));
                  setFeedback(
                    'Repository recheck recorded. Review the result and any warnings below.',
                  );
                })
              }
            >
              <RefreshCw size={14} aria-hidden="true" /> Recheck inventory
            </button>
          </div>
          {report.recheck?.warnings.length ? (
            <ul className="remediation-warnings">
              {[...new Set(report.recheck.warnings)].map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
          ) : null}
          <dl className="remediation-provenance">
            <div>
              <dt>Tests</dt>
              <dd>{report.fields.testResult.replace('_', ' ')} · team reported</dd>
            </div>
            <div>
              <dt>Deployment</dt>
              <dd>
                {report.verification.deployment.recorded
                  ? 'Evidence recorded'
                  : 'Awaiting evidence'}{' '}
                · team reported
              </dd>
            </div>
          </dl>
          <div className="remediation-actions remediation-export">
            <p>
              Export the finding, saved references, recheck result, and change history for review.
            </p>
            <button
              type="button"
              className="button"
              disabled={Boolean(busy) || dirty}
              onClick={() =>
                void run('export', async () => {
                  const value = await remediationApi.evidence(findingId);
                  download(
                    `wisesama-${findingId}-evidence.json`,
                    JSON.stringify(value, null, 2),
                    'application/json',
                  );
                  setFeedback('Evidence report downloaded.');
                })
              }
            >
              <ArrowDownToLine size={14} aria-hidden="true" /> Export evidence
            </button>
          </div>
          {report.history.length ? (
            <details className="remediation-history">
              <summary>Fix activity ({report.history.length})</summary>
              <ol>
                {report.history
                  .slice(-15)
                  .reverse()
                  .map((entry) => (
                    <li key={entry.id}>
                      <span>{entry.action}</span>
                      <time dateTime={entry.at}>{date(entry.at)}</time>
                    </li>
                  ))}
              </ol>
            </details>
          ) : null}
        </>
      )}
    </section>
  );
}
