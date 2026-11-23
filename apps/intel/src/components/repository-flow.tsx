'use client';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ExternalLink,
  FileText,
  GitBranch,
  Github,
  Link2,
  RefreshCw,
  Search,
  Unplug,
} from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  authClient,
  githubAuthError,
  githubSignInOption,
  safeWorkspaceDestination,
} from '../lib/auth-client';
import type { Environment } from '../lib/models';
import type { Organization } from '../lib/organization-api';
import {
  type Connection,
  type Provider,
  type ProviderState,
  type Repository,
  type RepositoryPage,
  type RepositorySource,
  repositoryApi,
  type Snapshot,
} from '../lib/repository-api';
import { CheckControl, Choice, FormField, SuggestedInput, TextInput } from './ui/form-controls';
import './repository-flow.css';
const label = (provider: Provider) => (provider === 'github' ? 'GitHub' : 'GitLab.com');
const grantLabel = (selection: Connection['repositorySelection']) =>
  selection === 'all'
    ? 'All repositories'
    : selection === 'selected'
      ? 'Selected repositories'
      : '';
const message = (error: unknown) =>
  error instanceof Error ? error.message : 'This action could not complete. Try again.';
const date = (value: string | null) => (value ? new Date(value).toLocaleString() : 'Not yet');
function ProviderMark({ provider }: { provider: Provider }) {
  return provider === 'github' ? <Github /> : <GitBranch />;
}

function GithubSignInSettings() {
  const params = useSearchParams();
  const next = params.get('next');
  const destination = next ? safeWorkspaceDestination(next) : null;
  const [linked, setLinked] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    void githubSignInOption(controller.signal)
      .then(async ({ github }) => {
        if (!github || controller.signal.aborted) return;
        const { data } = await authClient.listAccounts({
          fetchOptions: { signal: controller.signal },
        });
        if (data && !controller.signal.aborted)
          setLinked(data.some((account) => account.providerId === 'github'));
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  async function addGithubSignIn() {
    setBusy(true);
    setError('');
    const url = new URL('/app/settings/integrations', window.location.origin);
    if (destination) url.searchParams.set('next', destination);
    const success = new URL(url);
    success.searchParams.set('github', 'linked');
    try {
      const result = await authClient.linkSocial({
        provider: 'github',
        callbackURL: success.href,
        errorCallbackURL: url.href,
      });
      if (result.error) setError('We couldn’t add GitHub sign-in. Try again.');
    } catch {
      setError('We couldn’t open GitHub. Try again.');
    } finally {
      setBusy(false);
    }
  }

  if (linked === null) return null;
  const feedback = error || githubAuthError(params.get('error'), true);
  return (
    <section className="repo-section" aria-labelledby="github-sign-in-heading">
      <div className="repo-section-heading">
        <h2 id="github-sign-in-heading">GitHub sign-in</h2>
        {!linked && (
          <button type="button" className="button" onClick={addGithubSignIn} disabled={busy}>
            <Github aria-hidden="true" /> {busy ? 'Opening GitHub…' : 'Add GitHub sign-in'}
          </button>
        )}
      </div>
      <p role={linked && params.get('github') === 'linked' ? 'status' : undefined}>
        {linked
          ? 'GitHub sign-in is connected to this Wisesama account.'
          : 'Add a GitHub account with a verified email. You can use a different address from your Wisesama account.'}
      </p>
      {linked && destination && (
        <Link href={destination} className="text-link">
          Continue to your workspace <ArrowRight />
        </Link>
      )}
      {feedback && (
        <p className="notice error" role="alert">
          {feedback}
        </p>
      )}
    </section>
  );
}

function ProviderConnect({
  providers,
  onConnected,
  busy,
}: {
  providers: ProviderState[];
  onConnected: (provider: Provider) => void;
  busy?: boolean;
}) {
  return (
    <div className="provider-options">
      {providers.map((provider) => (
        <div className="provider-option" key={provider.provider}>
          <ProviderMark provider={provider.provider} />
          <div>
            <h3>{label(provider.provider)}</h3>
            <p>
              {provider.provider === 'github'
                ? 'Choose which repositories Wisesama can read.'
                : 'Choose which projects Wisesama should check.'}
            </p>
            {!provider.available && (
              <p className="connection-unavailable">
                {label(provider.provider)} connections are currently unavailable.
              </p>
            )}
          </div>
          <button
            type="button"
            className="button"
            disabled={!provider.available || busy}
            onClick={() => onConnected(provider.provider)}
          >
            Connect {label(provider.provider)} <ArrowRight />
          </button>
        </div>
      ))}
    </div>
  );
}
function useConnections() {
  const [data, setData] = useState<{
    providers: ProviderState[];
    connections: Connection[];
  } | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setData(await repositoryApi.connections());
      setError('');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  return { data, error, loading, refresh };
}
async function connect(provider: Provider, destination?: 'project') {
  const result = await repositoryApi.start(provider, destination);
  const url = new URL(result.authorizationUrl);
  if (url.protocol !== 'https:' || !['github.com', 'gitlab.com'].includes(url.hostname))
    throw new Error('Couldn’t open the connection. Try connecting again.');
  window.location.assign(url.href);
}
export function RepositoryOnboarding({
  onComplete,
  organization,
}: {
  onComplete: (id: string) => Promise<void>;
  organization: Organization;
}) {
  const { data, error: loadError, loading, refresh } = useConnections();
  const params = useSearchParams();
  const connectionResult = params.get('connection');
  const resumeId = params.get('connectionId');
  const preferredProvider = params.get('provider');
  const resumeGithub = params.get('connect') === 'github' && preferredProvider === 'github';
  const resumedGithub = useRef(false);
  const [openingGithub, setOpeningGithub] = useState(false);
  const [chosenConnectionId, setChosenConnectionId] = useState('');
  const [listing, setListing] = useState<
    (RepositoryPage & { connectionId: string; version: number }) | null
  >(null);
  const [sources, setSources] = useState<RepositorySource[]>([]);
  const [sourceError, setSourceError] = useState(false);
  const [listVersion, setListVersion] = useState(0);
  const [search, setSearch] = useState('');
  const [repository, setRepository] = useState<Repository | null>(null);
  const [branch, setBranch] = useState('');
  const [branches, setBranches] = useState<string[]>([]);
  const [paths, setPaths] = useState<string[]>([]);
  const [availablePaths, setAvailablePaths] = useState<string[]>([]);
  const [customPath, setCustomPath] = useState('');
  const [name, setName] = useState('');
  const [environment, setEnvironment] = useState<Environment>('production');
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [warning, setWarning] = useState('');
  const inventoryFieldId = useId();
  const [step, setStep] = useState<'repository' | 'inventory' | 'review'>('repository');
  const [createdId, setCreatedId] = useState('');
  const connections = data?.connections.filter((item) => item.status === 'connected') ?? [];
  const selectedConnection =
    connections.find((item) => item.id === chosenConnectionId) ??
    connections.find((item) => item.id === resumeId) ??
    connections.find((item) => item.provider === preferredProvider) ??
    connections[0];
  const connectionId = selectedConnection?.id ?? '';
  const activeListing =
    listing?.connectionId === connectionId && listing.version === listVersion ? listing : null;
  const visibleRepos = (activeListing?.repositories ?? []).filter((repo) =>
    repo.fullName.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const projectsByRepository = new Map(
    sources
      .filter((source) => source.status !== 'disconnected')
      .map((source) => [`${source.provider}/${source.repositoryId}`, source.projectId]),
  );
  useEffect(() => {
    if (!resumeGithub || !data || resumedGithub.current) return;
    resumedGithub.current = true;
    const url = new URL(window.location.href);
    url.searchParams.delete('connect');
    // Returning with the browser's Back button should show the picker without starting again.
    window.history.replaceState(null, '', url);
    if (
      connectionResult ||
      data.connections.some((item) => item.provider === 'github' && item.status === 'connected') ||
      !data.providers.some((item) => item.provider === 'github' && item.available)
    )
      return;
    setOpeningGithub(true);
    void connect('github', 'project').catch((cause) => {
      setError(message(cause));
      setOpeningGithub(false);
    });
  }, [resumeGithub, data, connectionResult]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Refresh access also reloads existing project links.
  useEffect(() => {
    const controller = new AbortController();
    setSourceError(false);
    void repositoryApi.sources(organization.id, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setSources(result.sources);
      },
      () => {
        if (!controller.signal.aborted) setSourceError(true);
      },
    );
    return () => controller.abort();
  }, [organization.id, listVersion]);
  useEffect(() => {
    if (!connectionId) {
      setListing(null);
      setBusy(false);
      return;
    }
    const controller = new AbortController();
    setBusy(true);
    setListing(null);
    repositoryApi
      .repositories(connectionId, 1, controller.signal)
      .then((result) => {
        if (!controller.signal.aborted)
          setListing({ ...result, connectionId, version: listVersion });
      })
      .catch((cause) => {
        if (!controller.signal.aborted) setError(message(cause));
      })
      .finally(() => {
        if (!controller.signal.aborted) setBusy(false);
      });
    return () => controller.abort();
  }, [connectionId, listVersion]);
  async function loadMore() {
    if (!activeListing?.nextPage || busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await repositoryApi.repositories(connectionId, activeListing.nextPage);
      const repositories = new Map(activeListing.repositories.map((repo) => [repo.id, repo]));
      for (const repo of result.repositories) repositories.set(repo.id, repo);
      setListing({
        ...result,
        connectionId,
        version: listVersion,
        repositories: [...repositories.values()],
      });
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function choose(repo: Repository) {
    setBusy(true);
    setError('');
    setWarning('');
    try {
      const result = await repositoryApi.branches(connectionId, repo.id);
      setBranches(result.branches.map((item) => item.name));
      setRepository(repo);
      setBranch(repo.defaultBranch);
      setName(repo.name);
      setPaths([]);
      setAvailablePaths([]);
      setSnapshot(null);
      setStep('inventory');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function discover() {
    if (!repository) return;
    setBusy(true);
    setError('');
    setWarning('');
    try {
      const result = await repositoryApi.discover(connectionId, repository.id, branch);
      setAvailablePaths(result.paths.map((item) => item.path));
      setPaths([]);
      if (result.warnings.length) setWarning(result.warnings.join(' '));
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function preview() {
    if (!repository) return;
    setBusy(true);
    setError('');
    setWarning('');
    try {
      setSnapshot(
        await repositoryApi.preview(connectionId, { repositoryId: repository.id, branch, paths }),
      );
      setStep('review');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  async function create() {
    if (!repository) return;
    setBusy(true);
    setError('');
    setWarning('');
    try {
      let id = createdId;
      if (!id) {
        const result = await repositoryApi.create({
          organizationId: organization.id,
          connectionId,
          expectedCommit: snapshot?.commit,
          repositoryId: repository.id,
          branch,
          paths,
          name: name.trim(),
          environment,
        });
        id = result.project.id;
        setCreatedId(id);
      }
      await onComplete(id);
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="repo-onboarding">
      <div className="page-heading">
        <div>
          <h1>Connect a project</h1>
          <p>Start with a repository. Keep its inventory and assessment in sync.</p>
        </div>
        <Link href="/app/projects" className="button ghost">
          Cancel
        </Link>
      </div>
      <div className="org-project-destination">
        <Building2 size={17} aria-hidden="true" />
        <div>
          <p>
            Creating in <strong>{organization.name}</strong>
          </p>
          <small>
            Your connection stays with your account. Members of this organization can see the
            project and its findings.
          </small>
        </div>
      </div>
      <ol className="repo-steps" aria-label="Project setup progress">
        {['Repository', 'Inventory', 'Review'].map((item, index) => (
          <li
            key={item}
            aria-current={
              index === ['repository', 'inventory', 'review'].indexOf(step) ? 'step' : undefined
            }
          >
            <span>{index + 1}</span>
            {item}
          </li>
        ))}
      </ol>
      {loadError && (
        <div className="notice error" role="alert">
          <p>{loadError}</p>
          <button type="button" className="button" onClick={() => void refresh()}>
            Try again
          </button>
        </div>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {warning ? (
        <p className="notice" role="status">
          {warning}
        </p>
      ) : null}
      {step === 'repository' ? (
        <>
          <section className="repo-section">
            {connectionResult === 'connected' && selectedConnection?.id === resumeId ? (
              <p className="notice" role="status">
                {label(selectedConnection.provider)} connected. Select a repository to import.
              </p>
            ) : null}
            {connectionResult === 'requested' ? (
              <p className="notice" role="status">
                GitHub access requested. After an organization owner approves it, connect again.
              </p>
            ) : null}
            {connectionResult === 'denied' || connectionResult === 'failed' ? (
              <p className="notice error" role="alert">
                Couldn’t connect your repository account. Check access in GitHub or GitLab, then
                connect again.
              </p>
            ) : null}
            <div className="repo-section-heading">
              <h2>Your git accounts</h2>
              <Link href="/app/settings/integrations" className="text-link">
                Manage connections
              </Link>
            </div>
            {openingGithub ? (
              <p role="status">Opening GitHub to choose repository access…</p>
            ) : loading && !data ? (
              <p role="status">Loading connections…</p>
            ) : (
              data && (
                <>
                  <ProviderConnect
                    providers={data.providers}
                    busy={busy}
                    onConnected={(provider) => {
                      setBusy(true);
                      setError('');
                      setWarning('');
                      void connect(provider, 'project').catch((cause) => {
                        setError(message(cause));
                        setBusy(false);
                      });
                    }}
                  />
                  {connections.length > 0 && (
                    <>
                      <div className="repo-picker-controls">
                        <FormField label="Connected account">
                          {(field) => (
                            <Choice
                              {...field}
                              value={connectionId}
                              loading={busy}
                              disabled={busy}
                              onValueChange={(value) => {
                                setError('');
                                setWarning('');
                                setChosenConnectionId(value);
                                setSearch('');
                              }}
                              options={connections.map((item) => ({
                                value: item.id,
                                label: `${label(item.provider)} · ${(item.id === connectionId && activeListing?.installationAccountName) || item.installationAccountName || item.accountName}`,
                                description:
                                  grantLabel(
                                    item.id === connectionId &&
                                      activeListing?.repositorySelection !== undefined
                                      ? activeListing.repositorySelection
                                      : item.repositorySelection,
                                  ) || undefined,
                              }))}
                              icon={
                                selectedConnection ? (
                                  <ProviderMark provider={selectedConnection.provider} />
                                ) : undefined
                              }
                            />
                          )}
                        </FormField>
                        <FormField className="repo-search" label="Find a repository">
                          {(field) => (
                            <TextInput
                              {...field}
                              type="search"
                              icon={<Search />}
                              placeholder="Search accessible repositories"
                              value={search}
                              onChange={(event) => setSearch(event.target.value)}
                            />
                          )}
                        </FormField>
                      </div>
                      {activeListing?.repositorySelection ? (
                        <p className="notice">
                          GitHub grant: {grantLabel(activeListing.repositorySelection)}. This list
                          shows repositories your GitHub account can access. Wisesama imports the
                          repository you confirm.
                        </p>
                      ) : null}
                      {sourceError ? (
                        <p className="notice">
                          Existing project links could not load. Refresh access to try again.
                        </p>
                      ) : null}
                      {busy && !activeListing ? (
                        <p className="repo-wait" role="status">
                          Checking repository access…
                        </p>
                      ) : (
                        <div className="repository-list">
                          {visibleRepos.map((repo) => {
                            const existingProject = projectsByRepository.get(
                              `${selectedConnection?.provider}/${repo.id}`,
                            );
                            return (
                              <div key={repo.id} className="repository-row">
                                <div>
                                  <strong>{repo.fullName}</strong>
                                  <small>
                                    <GitBranch />
                                    {repo.defaultBranch}
                                  </small>
                                  {existingProject ? (
                                    <Link
                                      className="text-link"
                                      href={`/app/projects/${encodeURIComponent(existingProject)}/security`}
                                    >
                                      View imported project
                                    </Link>
                                  ) : null}
                                </div>
                                <button
                                  type="button"
                                  className="button"
                                  disabled={busy}
                                  onClick={() => void choose(repo)}
                                >
                                  {existingProject ? 'Import again' : 'Select'} <ArrowRight />
                                </button>
                              </div>
                            );
                          })}
                          {activeListing && !visibleRepos.length && (
                            <p className="repo-wait">
                              {activeListing.nextPage
                                ? 'No matches in the loaded repositories. Load more to continue searching.'
                                : 'No matching repositories. Check your search and the GitHub or GitLab grant.'}
                            </p>
                          )}
                        </div>
                      )}
                      {activeListing?.nextPage ? (
                        <button
                          className="button"
                          type="button"
                          disabled={busy}
                          onClick={() => void loadMore()}
                        >
                          {busy ? 'Loading repositories…' : 'Load more repositories'}
                        </button>
                      ) : null}
                      {activeListing?.incomplete && (
                        <p className="notice">
                          Showing up to 1,000 repositories. Review your access if the repository you
                          need is outside this list.
                        </p>
                      )}
                      <button
                        type="button"
                        className="button ghost"
                        disabled={busy}
                        onClick={() => {
                          setError('');
                          void refresh().then(() => setListVersion((version) => version + 1));
                        }}
                      >
                        <RefreshCw />
                        Refresh access
                      </button>
                    </>
                  )}
                  {!connections.length && data.connections.length > 0 ? (
                    <p className="notice">Reconnect GitHub or GitLab to browse repositories.</p>
                  ) : null}
                </>
              )
            )}
          </section>
          <div className="manual-entry">
            <FileText />
            <div>
              <h2>Have a lockfile already?</h2>
              <p>
                Upload an inventory without granting repository access. You can continue with manual
                updates.
              </p>
            </div>
            <Link href="/app/projects/new/manual" className="button">
              Upload a file
            </Link>
          </div>
        </>
      ) : null}
      {step === 'inventory' && repository && (
        <section className="repo-section">
          <button type="button" className="button ghost" onClick={() => setStep('repository')}>
            <ArrowLeft />
            Change repository
          </button>
          <div className="selected-repository">
            <ProviderMark provider={selectedConnection?.provider || 'github'} />
            <div>
              <strong>{repository.fullName}</strong>
              <small>{selectedConnection?.accountName}</small>
            </div>
          </div>
          <div className="repo-fields">
            <FormField label="Project name" required>
              {(field) => (
                <TextInput
                  {...field}
                  required
                  maxLength={100}
                  value={name}
                  disabled={busy}
                  onChange={(event) => setName(event.target.value)}
                />
              )}
            </FormField>
            <FormField label="Environment">
              {(field) => (
                <Choice
                  {...field}
                  value={environment}
                  disabled={busy}
                  onValueChange={(value) => setEnvironment(value as Environment)}
                  options={[
                    { value: 'production', label: 'Production' },
                    { value: 'staging', label: 'Staging' },
                    { value: 'development', label: 'Development' },
                  ]}
                />
              )}
            </FormField>
            <FormField
              label="Tracked branch"
              description="Choose a suggested branch or enter an exact name."
            >
              {(field) => (
                <SuggestedInput
                  {...field}
                  icon={<GitBranch />}
                  value={branch}
                  disabled={busy}
                  suggestions={branches}
                  onValueChange={(value) => {
                    setBranch(value);
                    setPaths([]);
                    setAvailablePaths([]);
                  }}
                />
              )}
            </FormField>
            <button
              type="button"
              className="button"
              disabled={busy || !branch.trim()}
              onClick={() => void discover()}
            >
              {busy ? 'Reading…' : 'Find inventory files'}
            </button>
          </div>
          <div className="inventory-selection">
            <h2>Inventory files</h2>
            <p>
              Read-only package metadata. Files are read from the same immutable commit; code is
              never executed.
            </p>
            {availablePaths.map((path) => (
              <label
                key={path}
                htmlFor={`${inventoryFieldId}-${path}`}
                data-selected={paths.includes(path) || undefined}
              >
                <CheckControl
                  id={`${inventoryFieldId}-${path}`}
                  checked={paths.includes(path)}
                  disabled={busy}
                  onCheckedChange={(checked) =>
                    setPaths(checked ? [...paths, path] : paths.filter((item) => item !== path))
                  }
                />
                <FileText />
                <code>{path}</code>
              </label>
            ))}
            {paths
              .filter((path) => !availablePaths.includes(path))
              .map((path) => (
                <label key={path} htmlFor={`${inventoryFieldId}-${path}`} data-selected>
                  <CheckControl
                    id={`${inventoryFieldId}-${path}`}
                    checked
                    disabled={busy}
                    onCheckedChange={() => setPaths(paths.filter((item) => item !== path))}
                  />
                  <code>{path}</code>
                </label>
              ))}
            <div className="custom-inventory">
              <FormField label="Or enter an exact file path">
                {(field) => (
                  <div className="custom-inventory-entry">
                    <TextInput
                      {...field}
                      icon={<FileText />}
                      placeholder="services/api/package-lock.json"
                      value={customPath}
                      disabled={busy}
                      onChange={(event) => setCustomPath(event.target.value)}
                    />
                    <button
                      type="button"
                      className="button"
                      disabled={
                        busy ||
                        !customPath.trim() ||
                        paths.includes(customPath.trim()) ||
                        paths.length >= 10
                      }
                      onClick={() => {
                        setPaths([...paths, customPath.trim()]);
                        setCustomPath('');
                      }}
                    >
                      Add file
                    </button>
                  </div>
                )}
              </FormField>
            </div>
          </div>
          <p className="notice">
            Shared lockfiles can describe packages across the repository. This assessment uses the
            selected files as repository inventory; it does not prove service ownership, deployment,
            or reachability.
          </p>
          <button
            type="button"
            className="button primary"
            disabled={busy || !paths.length || !name.trim() || !branch.trim()}
            onClick={() => void preview()}
          >
            {busy ? 'Reading inventory…' : 'Review inventory'}
            <ArrowRight />
          </button>
        </section>
      )}
      {step === 'review' && snapshot && (
        <section className="repo-section">
          <button
            type="button"
            className="button ghost"
            disabled={busy || !!createdId}
            onClick={() => setStep('inventory')}
          >
            <ArrowLeft />
            Edit inventory selection
          </button>
          <h2>Ready to assess {name}</h2>
          <dl className="repo-summary">
            <div>
              <dt>Repository</dt>
              <dd>{snapshot.repository.fullName}</dd>
            </div>
            <div>
              <dt>Branch</dt>
              <dd>{branch}</dd>
            </div>
            <div>
              <dt>Read commit</dt>
              <dd>
                <code>{snapshot.commit}</code>
              </dd>
            </div>
            <div>
              <dt>Assessment scope</dt>
              <dd>Repository inventory · {snapshot.packages.length} exact package versions</dd>
            </div>
          </dl>
          <div className="package-preview">
            <div className="package-preview-head">
              <span>Package</span>
              <span>Version</span>
              <span>Ecosystem</span>
            </div>
            {snapshot.packages.slice(0, 30).map((pkg) => (
              <div key={`${pkg.ecosystem}/${pkg.name}/${pkg.version}`}>
                <code>{pkg.name}</code>
                <code>{pkg.version}</code>
                <span>{pkg.ecosystem}</span>
              </div>
            ))}
          </div>
          {snapshot.packages.length > 30 && (
            <p>
              Showing 30 of {snapshot.packages.length} packages. All parsed packages will be
              assessed.
            </p>
          )}
          {snapshot.warnings.map((warning) => (
            <p className="notice" key={warning}>
              {warning}
            </p>
          ))}
          <p>
            We check the branch again before creating your project. If its commit changed, review
            the new inventory before continuing. No dependency update or patch is applied.
          </p>
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() => void create()}
          >
            {busy
              ? 'Importing and assessing…'
              : createdId
                ? 'Open saved project'
                : 'Create project and assess'}
            <ArrowRight />
          </button>
        </section>
      )}
    </div>
  );
}

function SourceRow({
  source,
  onChange,
  canManage,
  userId,
}: {
  source: RepositorySource;
  onChange: () => Promise<void>;
  canManage: boolean;
  userId: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [branch, setBranch] = useState(source.branch);
  const [paths, setPaths] = useState(source.paths.join('\n'));
  const [confirm, setConfirm] = useState(false);
  async function action(kind: 'sync' | 'pause' | 'detach' | 'save') {
    setBusy(true);
    setError('');
    try {
      if (kind === 'sync') await repositoryApi.sync(source.id);
      if (kind === 'pause') await repositoryApi.update(source.id, { paused: !source.paused });
      if (kind === 'detach') await repositoryApi.detach(source.id);
      if (kind === 'save') {
        await repositoryApi.update(source.id, {
          branch: branch.trim(),
          paths: paths
            .split('\n')
            .map((path) => path.trim())
            .filter(Boolean),
        });
        setEditing(false);
      }
      await onChange();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <article className="repository-source">
      <div className="source-heading">
        <div>
          <h3>
            <ProviderMark provider={source.provider} />
            {source.repositoryName}
          </h3>
          <p>
            <GitBranch />
            {source.branch} · {source.paused ? 'Paused' : source.status.replaceAll('_', ' ')}
          </p>
        </div>
        <Link
          href={`/app/projects/${encodeURIComponent(source.projectId)}/security`}
          className="button ghost"
        >
          Security baseline <ArrowRight />
        </Link>
      </div>
      <dl className="repo-summary">
        <div>
          <dt>Last successful sync</dt>
          <dd>{date(source.lastSyncedAt)}</dd>
        </div>
        <div>
          <dt>Last attempted sync</dt>
          <dd>{date(source.lastAttemptAt)}</dd>
        </div>
        <div>
          <dt>Imported commit</dt>
          <dd>
            <code>{source.importedCommit || 'No successful import'}</code>
          </dd>
        </div>
        <div>
          <dt>Latest observed commit</dt>
          <dd>
            <code>{source.observedCommit || 'Not observed yet'}</code>
          </dd>
        </div>
        <div>
          <dt>Last vulnerability assessment</dt>
          <dd>{date(source.lastAssessedAt ?? null)}</dd>
        </div>
        <div>
          <dt>Inventory scope</dt>
          <dd>Repository inventory</dd>
        </div>
        <div>
          <dt>Files</dt>
          <dd>
            {source.paths.map((path) => (
              <code className="source-path" key={path}>
                {path}
              </code>
            ))}
          </dd>
        </div>
      </dl>
      {source.error && (
        <p className="notice error">
          Couldn’t sync this repository. Check the connection and branch, then try again. Your
          previous inventory and findings are still available.
        </p>
      )}
      {source.assessmentError && (
        <p className="notice error">
          The latest dependency check couldn’t finish. You can still review your previous findings.
        </p>
      )}
      {source.observedCommit && source.observedCommit !== source.importedCommit && (
        <p className="notice">
          The latest observed revision differs from the imported inventory. Refresh before relying
          on current repository coverage.
        </p>
      )}
      {error && (
        <p className="notice error" role="alert">
          {error}
        </p>
      )}
      {editing && canManage && source.connectorUserId === userId && (
        <div className="source-edit">
          <label>
            Tracked branch
            <input value={branch} onChange={(event) => setBranch(event.target.value)} />
          </label>
          <label>
            Inventory paths, one per line
            <textarea value={paths} onChange={(event) => setPaths(event.target.value)} rows={4} />
          </label>
          <p>
            Changing the source schedules a new import. Existing findings keep their response
            history.
          </p>
          <div className="actions">
            <button
              type="button"
              className="button primary"
              disabled={busy || !branch.trim() || !paths.trim()}
              onClick={() => void action('save')}
            >
              Save source
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      {canManage ? (
        <div className="source-actions">
          <button
            type="button"
            className="button"
            disabled={busy || source.paused}
            onClick={() => void action('sync')}
          >
            <RefreshCw />
            {busy ? 'Working…' : 'Sync now'}
          </button>
          <button
            type="button"
            className="button ghost"
            disabled={busy}
            onClick={() => void action('pause')}
          >
            {source.paused ? 'Resume sync' : 'Pause sync'}
          </button>
          {source.connectorUserId === userId ? (
            <button
              type="button"
              className="button ghost"
              disabled={busy}
              onClick={() => setEditing(!editing)}
            >
              Edit source
            </button>
          ) : null}
          <button
            type="button"
            className="button ghost"
            disabled={busy}
            onClick={() => setConfirm(!confirm)}
          >
            Detach source
          </button>
        </div>
      ) : (
        <p className="field-help">An owner or admin can manage repository synchronization.</p>
      )}
      {canManage && source.connectorUserId !== userId ? (
        <p className="field-help">
          Branch and path changes require the person who connected this repository.
        </p>
      ) : null}
      {confirm && canManage && (
        <div className="notice">
          <p>
            Detach this repository source? The project, last inventory and response history stay
            saved. Continuing repository updates will stop.
          </p>
          <button
            type="button"
            className="button danger"
            disabled={busy}
            onClick={() => void action('detach')}
          >
            Detach repository source
          </button>
          <button type="button" className="button ghost" onClick={() => setConfirm(false)}>
            Keep connected
          </button>
        </div>
      )}
    </article>
  );
}
export function RepositorySettings({
  organizationId,
  canManage,
  userId,
}: {
  organizationId: string;
  canManage: boolean;
  userId: string;
}) {
  const connectionResult = useSearchParams().get('connection');
  const { data, error: loadError, loading, refresh } = useConnections();
  const [sources, setSources] = useState<RepositorySource[]>([]);
  const [sourceError, setSourceError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [disconnectId, setDisconnectId] = useState('');
  const loadSources = useCallback(async () => {
    try {
      setSources((await repositoryApi.sources(organizationId)).sources);
      setSourceError('');
    } catch (cause) {
      setSources([]);
      setSourceError(message(cause));
    }
  }, [organizationId]);
  useEffect(() => {
    void loadSources();
  }, [loadSources]);
  async function reload() {
    await Promise.all([refresh(), loadSources()]);
  }
  async function disconnect(id: string) {
    setBusy(true);
    setError('');
    try {
      await repositoryApi.disconnect(id);
      setDisconnectId('');
      await reload();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="repository-settings">
      {['connected', 'failed', 'denied', 'requested'].includes(connectionResult ?? '') && (
        <p className="notice" role="status">
          {connectionResult === 'connected'
            ? 'Repository account connected. Choose a repository to create a project.'
            : connectionResult === 'requested'
              ? 'GitHub access requested. After an organization owner approves it, connect again.'
              : connectionResult === 'denied'
                ? 'Repository access was not granted. You can connect again or upload an inventory.'
                : 'Couldn’t connect your repository account. Check access in GitHub or GitLab and try again.'}
        </p>
      )}
      <div className="page-heading">
        <div>
          <h1>Repository connections</h1>
          <p>Manage your connections and see when each project last synced.</p>
        </div>
        {canManage ? (
          <Link href="/app/projects/new" className="button primary">
            Connect a project
          </Link>
        ) : null}
      </div>
      <p className="notice">
        Connections belong to your account. Tracked projects belong to the selected organization.
        Wisesama reads dependency files and supported CI settings. Review the access you grant in
        GitHub or GitLab.{' '}
        <Link href="/security" className="text-link">
          Review data access
        </Link>
      </p>
      <GithubSignInSettings />
      {[loadError, error, sourceError].filter(Boolean).map((item) => (
        <p className="notice error" role="alert" key={item}>
          {item}
        </p>
      ))}
      {loading && !data ? (
        <p role="status">Loading connections…</p>
      ) : (
        data && (
          <>
            <ProviderConnect
              providers={data.providers}
              onConnected={(provider) => {
                setError('');
                void connect(provider).catch((cause) => setError(message(cause)));
              }}
            />
            <section className="repo-section">
              <h2>Connected accounts</h2>
              {!data.connections.length ? (
                <div className="repo-wait">
                  <Link2 />
                  <h3>No accounts connected yet</h3>
                  <p>
                    Connect GitHub or GitLab.com to import and maintain repository inventories.
                    Manual uploads remain available.
                  </p>
                </div>
              ) : (
                data.connections.map((connection) => (
                  <div className="connection-record" key={connection.id}>
                    <div>
                      <h3>
                        <ProviderMark provider={connection.provider} />
                        {connection.accountName}
                      </h3>
                      <p>
                        {label(connection.provider)} · {connection.status.replaceAll('_', ' ')}
                      </p>
                      <small>Access last checked {date(connection.validatedAt)}</small>
                      {connection.error && (
                        <p className="notice error">Check your repository access and reconnect.</p>
                      )}
                    </div>
                    <div className="connection-controls">
                      <a
                        className="button ghost"
                        href={
                          connection.provider === 'github'
                            ? 'https://github.com/settings/installations'
                            : 'https://gitlab.com/-/user_settings/applications'
                        }
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {label(connection.provider)} settings <ExternalLink />
                      </a>
                      <button
                        type="button"
                        className="button ghost"
                        disabled={busy}
                        onClick={() =>
                          setDisconnectId(disconnectId === connection.id ? '' : connection.id)
                        }
                      >
                        <Unplug />
                        Disconnect
                      </button>
                    </div>
                    {disconnectId === connection.id && (
                      <div className="notice">
                        <p>
                          Disconnect {connection.accountName}? All linked repository imports stop.
                          Projects, saved inventories and response records remain available.
                        </p>
                        <button
                          type="button"
                          className="button danger"
                          disabled={busy}
                          onClick={() => void disconnect(connection.id)}
                        >
                          Disconnect account
                        </button>
                        <button
                          type="button"
                          className="button ghost"
                          onClick={() => setDisconnectId('')}
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </div>
                ))
              )}
            </section>
          </>
        )
      )}
      <section className="repo-section source-section">
        <div className="repo-section-heading">
          <h2>Tracked repository sources</h2>
          <button type="button" className="button ghost" onClick={() => void reload()}>
            <RefreshCw />
            Refresh
          </button>
        </div>
        <p>
          Inventory synchronization and advisory assessment are separate checks. A newer commit does
          not prove that a deployed system is patched.
        </p>
        {sources.length ? (
          sources.map((source) => (
            <SourceRow
              key={source.id}
              source={source}
              onChange={reload}
              canManage={canManage}
              userId={userId}
            />
          ))
        ) : (
          <div className="repo-wait">
            <Check />
            <p>
              No repository sources are tracked.{' '}
              <Link href="/app/projects/new" className="text-link">
                Connect your first project
              </Link>
              .
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
