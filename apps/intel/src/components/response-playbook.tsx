'use client';

import { ArrowLeft, ArrowRight, ExternalLink, LoaderCircle, Save } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useId, useState } from 'react';
import { ApiError } from '../lib/api';
import type { Project } from '../lib/models';
import {
  type Playbook,
  type PlaybookAnswer,
  type PlaybookStatus,
  playbookApi,
  type SavedResponse,
} from '../lib/playbook-api';
import './response-playbook.css';

const labels: Record<PlaybookStatus, string> = {
  investigating: 'Investigating',
  contained: 'Contained',
  recovering: 'Recovering',
  closed: 'Closed · team attested',
  not_affected: 'Not affected · team attested',
};
const errorText = (error: unknown) =>
  error instanceof Error ? error.message : 'This response could not load. Try again.';
const time = (value: string) =>
  new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
const responseHref = (projectId: string, id: string) =>
  `/app/projects/${encodeURIComponent(projectId)}/responses/${encodeURIComponent(id)}`;

export function PlaybookPicker({ projectId }: { projectId: string }) {
  const [playbooks, setPlaybooks] = useState<Playbook[] | null>(null);
  const [responses, setResponses] = useState<SavedResponse[]>([]);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the explicit reload counter retries a failed request.
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    void Promise.all([
      playbookApi.list(controller.signal),
      playbookApi.responses(projectId, controller.signal),
    ])
      .then(([templates, saved]) => {
        setPlaybooks(templates.playbooks);
        setResponses(saved.responses);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorText(cause));
      });
    return () => controller.abort();
  }, [projectId, reload]);
  return (
    <section className="rp-picker" aria-labelledby="response-playbooks-heading">
      <div className="rp-section-heading">
        <div>
          <h2 id="response-playbooks-heading">Response playbooks</h2>
          <p>
            Review applicability, follow the response, and keep your evidence with this project.
          </p>
        </div>
        <Link className="text-link" href="/playbooks">
          Read all playbooks <ArrowRight size={15} />
        </Link>
      </div>
      {error ? (
        <div role="alert" className="rp-error">
          <p>{error}</p>
          <button
            className="button secondary"
            type="button"
            onClick={() => setReload((value) => value + 1)}
          >
            Try loading again
          </button>
        </div>
      ) : !playbooks ? (
        <p role="status">Loading response playbooks…</p>
      ) : (
        <div className="rp-picker-list">
          {playbooks.map((playbook) => {
            const saved = responses.find((item) => item.playbookId === playbook.id);
            return (
              <Link key={playbook.id} href={responseHref(projectId, playbook.id)}>
                <div>
                  <h3>{playbook.title}</h3>
                  <p>{playbook.description}</p>
                </div>
                <span>
                  {saved ? labels[saved.status] : 'Start review'}
                  <ArrowRight size={16} />
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}

export function ProjectResponseChooser({
  playbookId,
  projects,
}: {
  playbookId: string;
  projects: Project[];
}) {
  const [selected, setSelected] = useState(projects.length === 1 ? (projects[0]?.id ?? '') : '');
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    setError('');
    setPlaybook(null);
    void playbookApi
      .template(playbookId, controller.signal)
      .then((value) => setPlaybook(value.playbook))
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorText(cause));
      });
    return () => controller.abort();
  }, [playbookId]);
  return (
    <div className="rp-chooser">
      <Link className="text-link" href="/playbooks">
        <ArrowLeft size={16} /> All playbooks
      </Link>
      <h1>Choose the project for this response</h1>
      {error ? (
        <p role="alert">{error}</p>
      ) : !playbook ? (
        <p role="status">Loading playbook…</p>
      ) : (
        <>
          <h2>{playbook.title}</h2>
          <p>
            A response record belongs to one project. For a developer-device incident, choose the
            project whose access or builds you are reviewing.
          </p>
          {projects.length ? (
            <>
              <label htmlFor="response-project">Project</label>
              <select
                id="response-project"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
              >
                <option value="">Choose a project</option>
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name} · {project.environment}
                  </option>
                ))}
              </select>
              {selected ? (
                <Link className="button primary" href={responseHref(selected, playbookId)}>
                  Continue to response <ArrowRight size={16} />
                </Link>
              ) : (
                <p>Choose a project to continue.</p>
              )}
            </>
          ) : (
            <>
              <p>
                Add a project before saving a response. You can read every playbook without an
                account.
              </p>
              <Link className="button primary" href="/app/projects/new">
                Add your first project <ArrowRight size={16} />
              </Link>
            </>
          )}
        </>
      )}
    </div>
  );
}

export function ResponsePlaybook({
  project,
  playbookId,
}: {
  project: Project;
  playbookId: string;
}) {
  const [playbook, setPlaybook] = useState<Playbook | null>(null);
  const [response, setResponse] = useState<SavedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [reload, setReload] = useState(0);
  const [answers, setAnswers] = useState<Record<string, PlaybookAnswer>>({});
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [status, setStatus] = useState<PlaybookStatus>('investigating');
  const [note, setNote] = useState('');
  const [evidence, setEvidence] = useState('');
  const id = useId();
  const dirty = Boolean(
    response &&
      (JSON.stringify(answers) !== JSON.stringify(response.answers) ||
        JSON.stringify(checks) !== JSON.stringify(response.checks) ||
        status !== response.status ||
        note !== response.note ||
        evidence !== response.evidence),
  );
  const apply = useCallback((saved: SavedResponse) => {
    setResponse(saved);
    setAnswers(saved.answers);
    setChecks(saved.checks);
    setStatus(saved.status);
    setNote(saved.note);
    setEvidence(saved.evidence);
  }, []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: the explicit reload counter discards a stale draft and fetches saved progress.
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setConflict(false);
    void playbookApi
      .get(project.id, playbookId, controller.signal)
      .then((value) => {
        setPlaybook(value.playbook);
        if (value.response) apply(value.response);
        else setResponse(null);
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(errorText(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [project.id, playbookId, reload, apply]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  async function start() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      apply((await playbookApi.start(project.id, playbookId)).response);
      setFeedback('Response started. Review applicability below.');
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setBusy(false);
    }
  }
  async function save(event: FormEvent) {
    event.preventDefault();
    if (!response || busy) return;
    setBusy(true);
    setError('');
    setFeedback('');
    try {
      apply(
        (
          await playbookApi.update(project.id, playbookId, {
            expectedRevision: response.revision,
            answers,
            checks,
            status,
            note,
            evidence,
          })
        ).response,
      );
      setFeedback('Response saved. Your team’s record is up to date.');
    } catch (cause) {
      setError(errorText(cause));
      if (cause instanceof ApiError && cause.status === 409) setConflict(true);
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <div className="rp-loading" role="status">
        <LoaderCircle className="is-spinning" />
        Loading response…
      </div>
    );
  if (!playbook)
    return (
      <div className="rp-error" role="alert">
        <h1>The playbook could not load</h1>
        <p>{error}</p>
        <button
          className="button secondary"
          type="button"
          onClick={() => setReload((value) => value + 1)}
        >
          Try again
        </button>
      </div>
    );
  const values = playbook.questions.map((question) => answers[question.id] ?? 'unknown');
  const applicability = values.includes('no')
    ? 'One applicability condition is not met, based on your answers.'
    : values.every((value) => value === 'yes')
      ? 'Potentially affected, based on your answers. Continue the response.'
      : 'Applicability needs review. Unknown answers remain open questions.';
  const tasks = playbook.phases.flatMap((phase) => phase.tasks);
  const complete = tasks.filter((task) => checks[task.id]).length;
  return (
    <div className="rp-page">
      <Link
        className="text-link rp-back"
        href={`/app/projects/${encodeURIComponent(project.id)}/security`}
      >
        <ArrowLeft size={16} /> {project.name} · Project security
      </Link>
      <header className="rp-header">
        <h1>{playbook.title}</h1>
        <p>{playbook.description}</p>
        <div className="rp-meta">
          <span>
            {project.name} · {project.environment}
          </span>
          <span>Guidance updated {playbook.updatedAt}</span>
          <span>Guidance version {playbook.version}</span>
          {response ? (
            <span>Saved {time(response.updatedAt)}</span>
          ) : (
            <span>Response not started</span>
          )}
        </div>
      </header>
      <div className="rp-layout">
        <div>
          <div className="rp-scope">
            <strong>Scope of this review</strong>
            <p>{playbook.scope}</p>
            <p>
              Task completion and closure are team attestations. Wisesama does not scan devices or
              confirm recovery.
            </p>
          </div>
          {!response ? (
            <section className="rp-start">
              <h2>Start a response for {project.name}</h2>
              <p>
                Save your answers, recovery tasks, and evidence in a private project record.
                Starting the record does not mark this project as affected.
              </p>
              <button
                className="button primary"
                type="button"
                disabled={busy}
                onClick={() => void start()}
              >
                {busy ? 'Starting…' : 'Start this response'}
                <ArrowRight size={16} />
              </button>
              <Link className="text-link" href={`/playbooks/${playbook.id}`}>
                Read the playbook first
              </Link>
            </section>
          ) : (
            <form onSubmit={(event) => void save(event)}>
              {response.templateVersion !== playbook.version ? (
                <p className="rp-error">
                  This record was last saved with guidance {response.templateVersion}. Current
                  guidance is {playbook.version}. Review the current questions and tasks before
                  updating the response.
                </p>
              ) : null}
              <section className="rp-section">
                <h2>Review applicability</h2>
                <p>
                  Use historical evidence. A current package or extension version does not establish
                  what ran during the incident.
                </p>
                {playbook.questions.map((question) => (
                  <div className="rp-question" key={question.id}>
                    <label htmlFor={`${id}-${question.id}`}>{question.label}</label>
                    <p id={`${id}-${question.id}-help`}>{question.help}</p>
                    <select
                      id={`${id}-${question.id}`}
                      value={answers[question.id] ?? 'unknown'}
                      aria-describedby={`${id}-${question.id}-help`}
                      disabled={busy}
                      onChange={(event) => {
                        setAnswers({
                          ...answers,
                          [question.id]: event.target.value as PlaybookAnswer,
                        });
                        setFeedback('');
                      }}
                    >
                      <option value="unknown">Unknown · needs review</option>
                      <option value="yes">Yes · evidence reviewed</option>
                      <option value="no">No · evidence reviewed</option>
                    </select>
                  </div>
                ))}
                <p className="rp-applicability">{applicability}</p>
              </section>
              <section className="rp-section">
                <div className="rp-section-heading">
                  <h2>Response tasks</h2>
                  <span>
                    {complete} of {tasks.length} recorded complete
                  </span>
                </div>
                {playbook.phases.map((phase) => (
                  <section className="rp-phase" key={phase.id}>
                    <h3>{phase.title}</h3>
                    <p>{phase.description}</p>
                    {phase.tasks.map((task) => (
                      <div
                        className={`rp-task${checks[task.id] ? ' rp-task-complete' : ''}`}
                        key={task.id}
                      >
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(checks[task.id])}
                            disabled={busy}
                            onChange={(event) => {
                              setChecks({ ...checks, [task.id]: event.target.checked });
                              setFeedback('');
                            }}
                          />
                          <span>{task.title}</span>
                        </label>
                        <p>{task.detail}</p>
                        <small>Record: {task.evidenceHint}</small>
                      </div>
                    ))}
                  </section>
                ))}
              </section>
              <section className="rp-section rp-record">
                <h2>Save the response</h2>
                <p>
                  Keep sensitive evidence in your approved system. Add references here; never paste
                  secrets, personal data, or raw logs.
                </p>
                <label htmlFor={`${id}-status`}>Response status</label>
                <select
                  id={`${id}-status`}
                  value={status}
                  disabled={busy}
                  onChange={(event) => {
                    setStatus(event.target.value as PlaybookStatus);
                    setFeedback('');
                  }}
                >
                  {Object.entries(labels).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <label htmlFor={`${id}-note`}>Response summary</label>
                <textarea
                  id={`${id}-note`}
                  value={note}
                  maxLength={4000}
                  rows={4}
                  disabled={busy}
                  onChange={(event) => {
                    setNote(event.target.value);
                    setFeedback('');
                  }}
                  placeholder="What did you establish, change, or leave for further review?"
                />
                <label htmlFor={`${id}-evidence`}>Evidence references</label>
                <textarea
                  id={`${id}-evidence`}
                  value={evidence}
                  maxLength={4000}
                  rows={3}
                  disabled={busy}
                  onChange={(event) => {
                    setEvidence(event.target.value);
                    setFeedback('');
                  }}
                  placeholder="Investigation or change record, owner, review window, and verification reference."
                />
                <p className="rp-help">
                  Closing requires all tasks recorded complete, a summary, and evidence. “Not
                  affected” requires an applicability condition recorded as No with a supporting
                  summary and evidence. Each text field needs at least 20 characters for either
                  outcome.
                </p>
                <div className="rp-save-row">
                  <button
                    className="button primary"
                    type="submit"
                    disabled={busy || !dirty || conflict}
                  >
                    <Save size={16} />
                    {busy ? 'Saving…' : 'Save response'}
                  </button>
                  <span>{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
                </div>
              </section>
            </form>
          )}
          {error ? (
            <div className="rp-error" role="alert">
              <p>{error}</p>
              {conflict ? (
                <button
                  type="button"
                  className="button secondary"
                  onClick={() => setReload((value) => value + 1)}
                >
                  Discard draft and load saved response
                </button>
              ) : null}
            </div>
          ) : null}
          <p className="rp-feedback" role="status">
            {feedback}
          </p>
        </div>
        <aside className="rp-aside">
          <section>
            <h2>Authoritative guidance</h2>
            {playbook.sources.map((source) => (
              <a key={source.url} href={source.url} target="_blank" rel="noreferrer">
                {source.title}
                <ExternalLink size={14} />
              </a>
            ))}
            <p>Review the latest source before acting.</p>
          </section>
          <section>
            <h2>Response history</h2>
            {response ? (
              <>
                <span className="rp-status">{labels[response.status]}</span>
                <p>
                  Latest {response.events.length} saved{' '}
                  {response.events.length === 1 ? 'event' : 'events'}. Times use your device’s local
                  timezone.
                </p>
                <ol className="rp-history">
                  {response.events.map((event) => (
                    <li key={event.id}>
                      <strong>{labels[event.status]}</strong>
                      <time dateTime={event.createdAt}>{time(event.createdAt)}</time>
                      <p>{event.note || 'Progress saved.'}</p>
                      <details>
                        <summary>Evidence and recorded state</summary>
                        <p>{event.evidence || 'No evidence reference recorded.'}</p>
                        <p>
                          <strong>Applicability answers</strong>
                        </p>
                        <ul>
                          {playbook.questions.map((question) => (
                            <li key={question.id}>
                              {question.label} {event.answers[question.id] ?? 'unknown'}
                            </li>
                          ))}
                        </ul>
                        <p>
                          <strong>Recorded tasks</strong>
                        </p>
                        <ul>
                          {tasks.map((task) => (
                            <li key={task.id}>
                              {task.title}:{' '}
                              {event.checks[task.id]
                                ? 'Recorded complete'
                                : 'Not recorded complete'}
                            </li>
                          ))}
                        </ul>
                      </details>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p>Your response history appears after you start the record.</p>
            )}
          </section>
          <section>
            <h2>Assessment boundaries</h2>
            {playbook.limitations.map((limit) => (
              <p key={limit}>{limit}</p>
            ))}
          </section>
        </aside>
      </div>
    </div>
  );
}
