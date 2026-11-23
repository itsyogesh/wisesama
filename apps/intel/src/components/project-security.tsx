'use client';

import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  CircleHelp,
  ExternalLink,
  FileCheck2,
  GitBranch,
  Info,
  RefreshCw,
  TriangleAlert,
} from 'lucide-react';
import Link from 'next/link';
import { type ReactNode, useCallback, useEffect, useId, useState } from 'react';
import type { Project } from '../lib/models';
import {
  type BaselineCheck,
  type CiDependency,
  type CiDependencyReport,
  type ContextAnswer,
  type ProjectContextInput,
  type ProjectSecurity as ProjectSecurityData,
  securityApi,
} from '../lib/security-api';
import { PlaybookPicker } from './response-playbook';
import './project-security.css';

const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'This request could not complete. Please try again.';
function dateTime(value: string | null) {
  if (!value) return 'Not checked yet';
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Time unavailable'
    : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
function safeUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}
const stateLabels = { observed: 'Observed', attention: 'Needs attention', unknown: 'Unknown' };

function CheckRow({ check, children }: { check: BaselineCheck; children?: ReactNode }) {
  const Icon =
    check.state === 'observed'
      ? FileCheck2
      : check.state === 'attention'
        ? TriangleAlert
        : CircleHelp;
  const documentation = safeUrl(check.documentationUrl);
  return (
    <details className="ps-check" open={check.id === 'ci_dependencies'}>
      <summary>
        <Icon className={`ps-state-icon ps-${check.state}`} aria-hidden="true" />
        <span className="ps-check-description">
          <strong>{check.title}</strong>
          <span>{check.summary}</span>
        </span>
        <span className={`ps-check-state ps-${check.state}`}>{stateLabels[check.state]}</span>
        <ChevronDown className="ps-disclosure" aria-hidden="true" />
      </summary>
      <div className="ps-check-body">
        {children ||
          (check.evidence.length ? (
            <div className="ps-evidence">
              <h4>Repository evidence</h4>
              <dl>
                {check.evidence.map((item) => (
                  <div key={`${item.path}-${item.detail}`}>
                    <dt>
                      <code>{item.path}</code>
                    </dt>
                    <dd>{item.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ) : (
            <p>No supporting configuration was established in the files checked.</p>
          ))}
        {!children && check.recommendation ? (
          <div className="ps-recommendation">
            <h4>Next step</h4>
            <p>{check.recommendation}</p>
          </div>
        ) : null}
        {documentation ? (
          <a className="text-link" href={documentation} target="_blank" rel="noopener noreferrer">
            Read the tool documentation <ExternalLink aria-hidden="true" />
          </a>
        ) : null}
      </div>
    </details>
  );
}

const dependencyKinds: Record<CiDependency['kind'], string> = {
  action: 'GitHub action',
  reusable_workflow: 'Reusable workflow',
  container: 'Container image',
  gitlab_include: 'GitLab include',
  local_action: 'Local action',
};
const dependencyStates: Record<CiDependency['state'], string> = {
  pinned: 'Pinned reference',
  locked: 'Lock entry observed',
  mutable: 'Mutable reference',
  local: 'Local reference',
  unknown: 'Unknown',
};

function sourceLocation(
  repository: ProjectSecurityData['repository'],
  commit: string | null,
  item: CiDependency,
) {
  if (!repository || !commit || !/^[a-f0-9]{40,64}$/.test(commit)) return undefined;
  const repoParts = repository.repositoryName.split('/');
  const pathParts = item.path.split('/');
  if (
    repoParts.length < 2 ||
    (repository.provider === 'github' && repoParts.length !== 2) ||
    repoParts.some((part) => !/^[A-Za-z0-9_.-]+$/.test(part) || ['.', '..'].includes(part)) ||
    pathParts.some((part) => !part || ['.', '..'].includes(part)) ||
    !Number.isSafeInteger(item.line) ||
    item.line < 1
  )
    return undefined;
  const repo = repoParts.map(encodeURIComponent).join('/');
  const path = pathParts.map(encodeURIComponent).join('/');
  return repository.provider === 'github'
    ? `https://github.com/${repo}/blob/${commit}/${path}#L${item.line}`
    : `https://gitlab.com/${repo}/-/blob/${commit}/${path}#L${item.line}`;
}

function CiDependencies({
  report,
  repository,
  commit,
}: {
  report: CiDependencyReport;
  repository: ProjectSecurityData['repository'];
  commit: string | null;
}) {
  const id = useId();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<CiDependency['state'] | 'all'>('all');
  const search = query.trim().toLocaleLowerCase();
  const items = report.items.filter(
    (item) =>
      (filter === 'all' || item.state === filter) &&
      (!search ||
        [item.name, item.reference || '', item.path, dependencyKinds[item.kind]]
          .join(' ')
          .toLocaleLowerCase()
          .includes(search)),
  );
  const filtered = Boolean(search || filter !== 'all');
  return (
    <section className="ps-ci" aria-labelledby={`${id}-title`}>
      <div className="ps-ci-heading">
        <h3 id={`${id}-title`}>Workflow dependencies</h3>
        <p>
          {report.items.length} {report.items.length === 1 ? 'reference' : 'references'} in{' '}
          {report.filesChecked.length}{' '}
          {report.filesChecked.length === 1 ? 'checked file' : 'checked files'}
          {report.incomplete ? ' · Partial snapshot' : ''}
        </p>
      </div>
      <p className="ps-ci-boundary">
        These are references found in the checked configuration. A pinned reference or lock entry
        does not establish that the dependency is trustworthy or that a workflow ran.
      </p>
      {report.issues.length ? (
        <details className="ps-ci-coverage" open={report.incomplete}>
          <summary>
            {report.issues.length}{' '}
            {report.issues.length === 1
              ? 'collection issue to review'
              : 'collection issues to review'}
            <ChevronDown aria-hidden="true" />
          </summary>
          <ul>
            {report.issues.map((issue) => (
              <li key={`${issue.path}-${issue.line}-${issue.detail}`}>
                <code>
                  {issue.path}
                  {issue.line ? `:${issue.line}` : ''}
                </code>
                <p>{issue.detail}</p>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
      {report.items.length ? (
        <>
          <fieldset className="ps-ci-filters" aria-label="Filter workflow dependencies">
            <div className="ps-ci-filter-field">
              <label htmlFor={`${id}-search`}>Find a dependency</label>
              <input
                id={`${id}-search`}
                type="search"
                placeholder="Action, image, reference, or file"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <div className="ps-ci-filter-field">
              <label htmlFor={`${id}-state`}>Reference state</label>
              <select
                id={`${id}-state`}
                value={filter}
                onChange={(event) => setFilter(event.target.value as typeof filter)}
              >
                <option value="all">All reference states</option>
                <option value="mutable">Mutable reference</option>
                <option value="unknown">Unknown</option>
                <option value="pinned">Pinned reference</option>
                <option value="locked">Lock entry observed</option>
                <option value="local">Local reference</option>
              </select>
            </div>
          </fieldset>
          <p className="ps-ci-result-count" role="status">
            {filtered
              ? `${items.length} of ${report.items.length} references shown from this snapshot`
              : 'Select a reference to inspect its evidence and next step.'}
          </p>
          {items.length ? (
            <ul className="ps-ci-list">
              {items.map((item) => {
                const source = sourceLocation(repository, commit, item);
                return (
                  <li key={item.id}>
                    <details className="ps-ci-dependency">
                      <summary>
                        <span className="ps-ci-identity">
                          <strong>{item.name}</strong>
                          <span>{dependencyKinds[item.kind]}</span>
                          <code>
                            {item.path}:{item.line}
                          </code>
                        </span>
                        <span className={`ps-ci-state ps-ci-${item.state}`}>
                          {dependencyStates[item.state]}
                        </span>
                        <ChevronDown className="ps-disclosure" aria-hidden="true" />
                      </summary>
                      <div className="ps-ci-detail">
                        <dl>
                          <div>
                            <dt>Reference</dt>
                            <dd>
                              {item.reference ? <code>{item.reference}</code> : 'Not recorded'}
                            </dd>
                          </div>
                          <div>
                            <dt>What was observed</dt>
                            <dd>{item.detail}</dd>
                          </div>
                          <div>
                            <dt>Next step</dt>
                            <dd>{item.recommendation}</dd>
                          </div>
                        </dl>
                        {source ? (
                          <a
                            className="text-link"
                            href={source}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Open file at the checked commit <ExternalLink aria-hidden="true" />
                          </a>
                        ) : (
                          <p className="ps-ci-boundary">
                            Use the file and line above at the read commit recorded in this
                            snapshot.
                          </p>
                        )}
                      </div>
                    </details>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="ps-ci-empty">
              <h4>No dependencies match these filters</h4>
              <p>Try a different action, image, reference, or file name.</p>
              <button
                className="button"
                type="button"
                onClick={() => {
                  setQuery('');
                  setFilter('all');
                }}
              >
                Clear dependency filters
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="ps-ci-empty">
          <h4>No supported dependency references found</h4>
          <p>
            Review the files and collection limits below. This does not establish that CI has no
            dependencies or that it is safe.
          </p>
        </div>
      )}
      <details className="ps-ci-coverage">
        <summary>
          Files and collection limits <ChevronDown aria-hidden="true" />
        </summary>
        {report.filesChecked.length ? (
          <ul className="ps-ci-files">
            {report.filesChecked.map((path) => (
              <li key={path}>
                <code>{path}</code>
              </li>
            ))}
          </ul>
        ) : (
          <p>No supported CI configuration file was read.</p>
        )}
        {report.limitations.length ? (
          <ul>
            {report.limitations.map((limitation) => (
              <li key={limitation}>{limitation}</li>
            ))}
          </ul>
        ) : null}
      </details>
    </section>
  );
}

function ContextForm({
  data,
  onSaved,
}: {
  data: ProjectSecurityData;
  onSaved: (result: ProjectSecurityData) => void;
}) {
  const [input, setInput] = useState<ProjectContextInput>({
    internetFacing: data.context.internetFacing,
    sensitiveData: data.context.sensitiveData,
    hosting: data.context.hosting,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const changed =
    input.internetFacing !== data.context.internetFacing ||
    input.sensitiveData !== data.context.sensitiveData ||
    input.hosting.trim() !== data.context.hosting;

  function update<K extends keyof ProjectContextInput>(key: K, value: ProjectContextInput[K]) {
    setInput((previous) => ({ ...previous, [key]: value }));
    setSaved(false);
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const result = await securityApi.saveContext(data.project.id, {
        ...input,
        hosting: input.hosting.trim(),
      });
      onSaved(result);
      setInput({
        internetFacing: result.context.internetFacing,
        sensitiveData: result.context.sensitiveData,
        hosting: result.context.hosting,
      });
      setSaved(true);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="ps-context" aria-labelledby="ps-context-title">
      <h2 id="ps-context-title">Project context</h2>
      <p>Record what your team knows about this environment.</p>
      <form onSubmit={(event) => void save(event)}>
        <fieldset disabled={saving}>
          <div className="ps-context-field">
            <label htmlFor="ps-internet">Accessible from the internet?</label>
            <p id="ps-internet-help">
              Include public APIs and services reachable before signing in.
            </p>
            <select
              id="ps-internet"
              aria-describedby="ps-internet-help"
              value={input.internetFacing}
              onChange={(event) => update('internetFacing', event.target.value as ContextAnswer)}
            >
              <option value="unknown">Not sure yet</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="ps-context-field">
            <label htmlFor="ps-sensitive">Handles sensitive data?</label>
            <p id="ps-sensitive-help">
              For example, credentials, personal data, or payment details.
            </p>
            <select
              id="ps-sensitive"
              aria-describedby="ps-sensitive-help"
              value={input.sensitiveData}
              onChange={(event) => update('sensitiveData', event.target.value as ContextAnswer)}
            >
              <option value="unknown">Not sure yet</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
          <div className="ps-context-field">
            <label htmlFor="ps-hosting">
              Hosting or deployment platform <span>Optional</span>
            </label>
            <p id="ps-hosting-help">
              A provider or environment name. Keep secrets and private URLs out.
            </p>
            <input
              id="ps-hosting"
              type="text"
              maxLength={120}
              value={input.hosting}
              placeholder="e.g. Vercel, AWS, self-hosted"
              aria-describedby="ps-hosting-help"
              onChange={(event) => update('hosting', event.target.value)}
            />
          </div>
          <button className="button primary" type="submit" disabled={saving || !changed}>
            {saving ? 'Saving context…' : 'Save context'}
          </button>
        </fieldset>
        {error ? (
          <p className="ps-form-error" role="alert">
            {error} Your entries are still here.
          </p>
        ) : null}
        {saved ? (
          <p className="ps-saved" role="status">
            Project context saved.
          </p>
        ) : null}
      </form>
      <div className="ps-context-provenance">
        <Info aria-hidden="true" />
        <p>
          Self-reported
          {data.context.updatedAt
            ? ` · Updated ${dateTime(data.context.updatedAt)}`
            : ' · Not recorded yet'}
          . Wisesama has not verified deployment exposure. These answers do not dismiss findings.
        </p>
      </div>
    </section>
  );
}

export function ProjectSecurity({ project }: { project: Project }) {
  const [data, setData] = useState<ProjectSecurityData | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState('');
  const [checked, setChecked] = useState(false);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const result = await securityApi.get(project.id, signal);
        if (!signal?.aborted) {
          setData(result);
          setError('');
        }
      } catch (cause) {
        if (!signal?.aborted) setError(message(cause));
      }
    },
    [project.id],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function check() {
    if (checking) return;
    setChecking(true);
    setCheckError('');
    setChecked(false);
    try {
      const result = await securityApi.check(project.id);
      setData((previous) => (previous ? { ...result, context: previous.context } : result));
      setChecked(true);
    } catch (cause) {
      setCheckError(message(cause));
      await load();
    } finally {
      setChecking(false);
    }
  }
  const repository = data?.repository;
  const canCheck = Boolean(
    repository &&
      !repository.paused &&
      repository.status !== 'disconnected' &&
      repository.importedCommit,
  );
  const baseline = data?.baseline;
  const selectionChanged = Boolean(
    repository &&
      baseline &&
      JSON.stringify([...repository.paths].sort()) !==
        JSON.stringify([...(baseline.inventoryPaths ?? [])].sort()),
  );
  return (
    <section className="project-security" aria-labelledby="ps-title">
      <Link href="/app/projects" className="text-link ps-back">
        <ArrowLeft aria-hidden="true" />
        All projects
      </Link>
      <div className="ps-heading">
        <div>
          <h1 id="ps-title">{project.name}</h1>
          <p className="ps-heading-description">
            <span className="ps-environment">{project.environment}</span>Repository configuration
            and team context
          </p>
        </div>
        <Link className="button" href={`/app/inbox?project=${encodeURIComponent(project.id)}`}>
          View findings <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <nav className="ps-project-nav" aria-label="Project navigation">
        <Link href={`/app/projects/${encodeURIComponent(project.id)}/security`} aria-current="page">
          Security baseline
        </Link>
        <Link href={`/app/projects/${encodeURIComponent(project.id)}/inventory`}>Inventory</Link>
        <Link href="/app/settings/integrations">Repository connection</Link>
      </nav>
      {error ? (
        <div className="notice error" role="alert">
          <div>
            {error}
            {data ? ' Previously loaded evidence is still shown.' : ''}
          </div>
          <button type="button" className="button ps-retry" onClick={() => void load()}>
            Try again
          </button>
        </div>
      ) : null}
      {!data && !error ? (
        <div className="workspace-loading" role="status">
          <span className="spinner" />
          <h2>Loading security baseline</h2>
          <p>Reading saved repository evidence and project context.</p>
        </div>
      ) : null}
      {data && baseline ? (
        <>
          <div className="ps-layout">
            <section className="ps-baseline" aria-labelledby="ps-baseline-title">
              <div className="ps-section-heading">
                <div>
                  <h2 id="ps-baseline-title">Repository baseline</h2>
                  <p>Configuration checks, with the evidence and next step behind each.</p>
                </div>
                <button
                  className="button"
                  type="button"
                  disabled={checking || !canCheck}
                  onClick={() => void check()}
                >
                  <RefreshCw className={checking ? 'is-spinning' : undefined} aria-hidden="true" />
                  {checking ? 'Checking…' : 'Recheck'}
                </button>
              </div>
              {repository ? (
                <div className="ps-snapshot">
                  <p className="ps-repository">
                    <GitBranch aria-hidden="true" />
                    <strong>{repository.repositoryName}</strong>
                    <span>{repository.branch}</span>
                  </p>
                  <p className="ps-source-state">
                    {repository.paused ? 'Updates paused' : repository.status.replaceAll('_', ' ')}{' '}
                    · Recheck reads the imported commit
                  </p>
                  <dl>
                    <div>
                      <dt>Configuration read</dt>
                      <dd>{dateTime(baseline.checkedAt)}</dd>
                    </div>
                    <div>
                      <dt>Read commit</dt>
                      <dd>
                        {baseline.commit ? <code>{baseline.commit}</code> : 'Not checked yet'}
                      </dd>
                    </div>
                    <div>
                      <dt>Latest attempt</dt>
                      <dd>{dateTime(baseline.attemptedAt)}</dd>
                    </div>
                    <div>
                      <dt>Checked inventory paths</dt>
                      <dd>
                        {baseline.inventoryPaths?.length
                          ? baseline.inventoryPaths.map((path) => (
                              <code className="ps-path" key={path}>
                                {path}
                              </code>
                            ))
                          : 'No path provenance recorded'}
                      </dd>
                    </div>
                    {selectionChanged ? (
                      <div>
                        <dt>Current selected paths</dt>
                        <dd>
                          {repository.paths.map((path) => (
                            <code className="ps-path" key={path}>
                              {path}
                            </code>
                          ))}
                        </dd>
                      </div>
                    ) : null}
                    {repository.importedCommit && repository.importedCommit !== baseline.commit ? (
                      <div>
                        <dt>Inventory commit</dt>
                        <dd>
                          <code>{repository.importedCommit}</code>
                        </dd>
                      </div>
                    ) : null}
                    {repository.observedCommit &&
                    repository.observedCommit !== repository.importedCommit ? (
                      <div>
                        <dt>Latest observed</dt>
                        <dd>
                          <code>{repository.observedCommit}</code>
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>
              ) : null}
              {checkError ? (
                <p className="notice error" role="alert">
                  {checkError}
                </p>
              ) : null}
              {checked && !baseline.error ? (
                <p className="ps-check-feedback" role="status">
                  Repository configuration read. Review the evidence and remaining unknowns below.
                </p>
              ) : null}
              {baseline.error ? (
                <p className="notice error" role="status">
                  {baseline.error}
                  {baseline.checks.length
                    ? ' The previous successful snapshot is retained below.'
                    : ''}
                </p>
              ) : null}
              {baseline.status === 'stale' ? (
                <p className="notice">
                  Previous snapshot shown. The source, commit, or selected inventory paths changed,
                  or the latest check did not complete. Recheck after the source is available and
                  synced.
                </p>
              ) : null}
              {repository?.paused || repository?.status === 'disconnected' ? (
                <p className="notice">
                  Repository updates are{' '}
                  {repository.status === 'disconnected' ? 'disconnected' : 'paused'}.{' '}
                  <Link className="text-link" href="/app/settings/integrations">
                    Manage the connection
                  </Link>{' '}
                  to collect fresh evidence.
                </p>
              ) : null}
              {repository?.observedCommit &&
              repository.observedCommit !== repository.importedCommit ? (
                <p className="notice">
                  A newer repository commit has been observed. Sync the inventory in{' '}
                  <Link className="text-link" href="/app/settings/integrations">
                    Connections
                  </Link>{' '}
                  before relying on this snapshot.
                </p>
              ) : null}
              {baseline.checks.length ? (
                <div className="ps-checks">
                  {baseline.checks.map((item) => (
                    <CheckRow key={item.id} check={item}>
                      {item.id === 'ci_dependencies' && baseline.ciDependencies?.version === 1 ? (
                        <CiDependencies
                          key={baseline.commit}
                          report={baseline.ciDependencies}
                          repository={repository ?? null}
                          commit={baseline.commit}
                        />
                      ) : undefined}
                    </CheckRow>
                  ))}
                </div>
              ) : (
                <div className="ps-empty">
                  <FileCheck2 aria-hidden="true" />
                  <h3>
                    {baseline.status === 'unsupported'
                      ? 'A repository is needed for these checks'
                      : 'No configuration snapshot yet'}
                  </h3>
                  <p>
                    {baseline.status === 'unsupported'
                      ? 'Uploaded package inventories can be matched to advisories, but cannot establish lockfile policy, CI commands, or dependency cooldown settings.'
                      : 'Use Recheck to read supported configuration from the imported repository commit. A failed read stays unknown.'}
                  </p>
                  {baseline.status === 'unsupported' ? (
                    <Link href="/app/projects/new" className="text-link">
                      Connect a repository project <ArrowRight aria-hidden="true" />
                    </Link>
                  ) : null}
                </div>
              )}
              {repository && baseline.checks.length && baseline.ciDependencies?.version !== 1 ? (
                <div className="ps-ci-legacy">
                  <h3>CI dependency evidence needs a recheck</h3>
                  <p>
                    Recheck this saved snapshot to collect action, workflow, include, and container
                    references from the imported commit.
                  </p>
                  <button
                    className="button"
                    type="button"
                    disabled={checking || !canCheck}
                    onClick={() => void check()}
                  >
                    {checking ? 'Checking…' : 'Collect CI dependency evidence'}
                  </button>
                </div>
              ) : null}
              <div className="ps-scope-note">
                <Info aria-hidden="true" />
                <p>
                  Observed means configuration was found. Wisesama does not run repository code or
                  verify that CI, deployment, or these controls were enforced.
                </p>
              </div>
              {baseline.limitations.length ? (
                <details className="ps-limitations">
                  <summary>
                    What these checks cover <ChevronDown aria-hidden="true" />
                  </summary>
                  <ul>
                    {baseline.limitations.map((limitation) => (
                      <li key={limitation}>{limitation}</li>
                    ))}
                  </ul>
                </details>
              ) : null}
            </section>
            <ContextForm
              data={data}
              onSaved={(result) =>
                setData((previous) =>
                  previous ? { ...previous, context: result.context } : result,
                )
              }
            />
          </div>
          <PlaybookPicker projectId={project.id} />
        </>
      ) : null}
    </section>
  );
}
