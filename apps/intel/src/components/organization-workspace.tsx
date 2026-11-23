'use client';

import { ArrowRight, Building2, Check, Copy, Plus, RefreshCw, Users } from 'lucide-react';
import Link from 'next/link';
import { type FormEvent, useCallback, useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '../lib/api';
import { authClient, useSession } from '../lib/auth-client';
import {
  canManageOrganization,
  type InvitationPreview,
  type Organization,
  type OrganizationDetail,
  type OrganizationRole,
  organizationApi,
  organizationSelectionKey,
} from '../lib/organization-api';
import { AccountAccess } from './account-access';
import {
  CheckControl,
  Choice,
  FormField,
  SearchChoice,
  TextArea,
  TextInput,
} from './ui/form-controls';
import './organization-workspace.css';

const message = (cause: unknown) =>
  cause instanceof Error ? cause.message : 'This request could not complete. Try again.';
const date = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(
    new Date(value),
  );
const roleHelp: Record<OrganizationRole, string> = {
  owner: 'Manage projects, members and owner access.',
  admin: 'Manage projects and members. Owner access stays with owners.',
  member: 'Review projects and contribute findings, context and responses.',
};

export function OrganizationSwitcher({
  organizations,
  current,
  onChange,
  busy,
}: {
  organizations: Organization[];
  current?: Organization;
  onChange: (id: string) => void;
  busy: boolean;
}) {
  const id = useId();
  return (
    <div className="org-switcher">
      <label htmlFor={`${id}-organization`}>Organization</label>
      <SearchChoice
        id={`${id}-organization`}
        value={current?.id || ''}
        disabled={busy || !organizations.length}
        loading={busy}
        onValueChange={onChange}
        options={organizations.map((organization) => ({
          value: organization.id,
          label: organization.name,
          description: `${organization.role}${organization.personal ? ' · Personal organization' : ''}`,
        }))}
        placeholder={busy ? 'Loading organizations…' : 'Select an organization'}
        searchLabel="Find an organization"
        emptyMessage="No matching organizations."
        icon={<Building2 />}
      />
      <div className="org-switcher-meta">
        <span>
          {current
            ? `${current.role}${current.personal ? ' · Personal organization' : ''}`
            : 'Membership required'}
        </span>
        <Link href="/app/settings/organization">Manage</Link>
      </div>
    </div>
  );
}

export function OrganizationCreation({
  onCreated,
}: {
  onCreated: (organization: Organization) => void;
}) {
  const id = useId();
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  return (
    <section className="org-view">
      <div className="page-heading">
        <div>
          <h1>Create an organization</h1>
          <p>Group projects and invite the people who respond with you.</p>
        </div>
      </div>
      <p className="org-explanation">
        You do not currently belong to an organization. Create one as its first owner, or ask a
        teammate for an invitation.
      </p>
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      <form
        className="org-inline-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (busy) return;
          setBusy(true);
          setError('');
          void organizationApi
            .create(name.trim())
            .then((result) => onCreated(result.organization))
            .catch((cause) => setError(message(cause)))
            .finally(() => setBusy(false));
        }}
      >
        <FormField
          id={`${id}-name`}
          label="Organization name"
          required
          error={
            nameTouched && name.trim().length < 2
              ? 'Use at least 2 characters for the organization name.'
              : undefined
          }
        >
          {(field) => (
            <TextInput
              {...field}
              icon={<Building2 />}
              onBlur={() => setNameTouched(true)}
              value={name}
              required
              minLength={2}
              maxLength={80}
              pattern=".*\S.*"
              disabled={busy}
              onChange={(event) => setName(event.target.value)}
            />
          )}
        </FormField>
        <button className="button primary" type="submit" disabled={busy}>
          {busy ? 'Creating…' : 'Create organization'}
        </button>
      </form>
    </section>
  );
}

type PendingChange = {
  kind: 'role' | 'remove' | 'revoke';
  id: string;
  label: string;
  role: OrganizationRole;
};

export function OrganizationSettings({
  organization,
  userId,
  onChanged,
  onCreated,
}: {
  organization: Organization;
  userId: string;
  onChanged: () => Promise<void>;
  onCreated: (organization: Organization) => void;
}) {
  const fieldId = useId();
  const [data, setData] = useState<OrganizationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [conflict, setConflict] = useState(false);
  const [name, setName] = useState(organization.name);
  const [newName, setNewName] = useState('');
  const [newNameTouched, setNewNameTouched] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [issuedLink, setIssuedLink] = useState<{
    id: string;
    url: string;
    email: string;
    expiresAt: string;
  } | null>(null);
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const confirmationKey = pending ? `${pending.kind}:${pending.id}` : '';
  const current = data?.organization || organization;
  const canManage = Boolean(
    data?.canManage &&
      canManageOrganization(current.role) &&
      canManageOrganization(organization.role),
  );
  const issuedLinkIsActive =
    issuedLink &&
    data?.invitations.some(
      (invitation) => invitation.id === issuedLink.id && invitation.status === 'pending',
    );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      try {
        const result = await organizationApi.detail(organization.id, signal);
        if (signal?.aborted) return;
        setData(result);
        setConflict(false);
        setConfirmed(false);
        setError('');
      } catch (cause) {
        if (signal?.aborted) return;
        if (cause instanceof ApiError && [401, 403, 404].includes(cause.status)) setData(null);
        setError(message(cause));
      } finally {
        if (!signal?.aborted) setLoading(false);
      }
    },
    [organization.id],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: Directory changes must revalidate access without remounting and discarding form drafts.
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load, organization.role, organization.revision]);
  useEffect(() => {
    if (confirmationKey) {
      confirmationHeading.current?.focus({ preventScroll: true });
      confirmationHeading.current?.scrollIntoView({ block: 'start' });
    }
  }, [confirmationKey]);

  async function run(key: string, operation: () => Promise<void>) {
    if (busy) return;
    setBusy(key);
    setError('');
    setStatus('');
    try {
      await operation();
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 409) {
        setConflict(true);
        setConfirmed(false);
        setError(
          `${message(cause)} Reload the latest details, review the change and confirm again. Your draft is kept.`,
        );
      } else if (cause instanceof ApiError && [401, 403].includes(cause.status)) {
        setData(null);
        setIssuedLink(null);
        setPending(null);
        setReason('');
        setError(message(cause));
        await onChanged().catch(() => {});
      } else setError(message(cause));
    } finally {
      setBusy('');
    }
  }

  function chooseChange(change: PendingChange) {
    setPending(change);
    setReason('');
    setConfirmed(false);
    setStatus('');
  }
  const targetMember = data?.members.find((member) => member.id === pending?.id);
  const targetInvitation = data?.invitations.find((invitation) => invitation.id === pending?.id);
  const targetAvailable =
    pending?.kind === 'revoke' ? targetInvitation?.status === 'pending' : Boolean(targetMember);
  const targetAllowed =
    pending?.kind === 'revoke' || current.role === 'owner' || targetMember?.role !== 'owner';

  async function applyChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pending || !confirmed || conflict || !targetAvailable || !targetAllowed) return;
    await run('change', async () => {
      if (pending.kind === 'revoke' && targetInvitation)
        await organizationApi.revoke(
          current.id,
          targetInvitation.id,
          targetInvitation.revision,
          reason.trim(),
        );
      else if (pending.kind === 'role' && targetMember)
        await organizationApi.setRole(
          current.id,
          targetMember.id,
          pending.role,
          targetMember.revision,
          reason.trim(),
        );
      else if (pending.kind === 'remove' && targetMember)
        await organizationApi.remove(
          current.id,
          targetMember.id,
          targetMember.revision,
          reason.trim(),
        );
      setPending(null);
      setReason('');
      setConfirmed(false);
      setStatus('Organization access updated.');
      await load();
      await onChanged();
    });
  }

  return (
    <section className="org-view" aria-labelledby={`${fieldId}-title`}>
      <div className="page-heading">
        <div>
          <h1 id={`${fieldId}-title`}>Organization</h1>
          <p>Projects and response records shared with {current.name}.</p>
        </div>
        <button
          className="button"
          type="button"
          disabled={loading || Boolean(busy)}
          onClick={() => void load()}
        >
          <RefreshCw size={15} aria-hidden="true" />
          Reload details
        </button>
      </div>
      <div className="org-context">
        <Building2 size={21} aria-hidden="true" />
        <div>
          <strong>{current.name}</strong>
          <span>
            {current.personal ? 'Personal organization' : 'Organization'} · Your role:{' '}
            {current.role}
          </span>
        </div>
        <span className="org-role">{current.role}</span>
      </div>
      <p className="org-explanation">
        {roleHelp[current.role]} Organization roles apply here; platform operator access is
        separate.
      </p>
      {error ? (
        <div className="notice error" role="alert">
          <p>
            {error}
            {data && !conflict ? ' Previously loaded organization details are still shown.' : ''}
          </p>
          {conflict ? (
            <button className="button" type="button" disabled={loading} onClick={() => void load()}>
              Reload and keep draft
            </button>
          ) : null}
        </div>
      ) : null}
      {status ? (
        <p className="org-success" role="status">
          <Check size={16} aria-hidden="true" />
          {status}
        </p>
      ) : null}
      {loading && !data ? <p role="status">Loading members and organization details…</p> : null}
      {data ? (
        <>
          {current.role === 'owner' && organization.role === 'owner' ? (
            <section className="org-section">
              <h2>Organization name</h2>
              <form
                className="org-inline-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run('rename', async () => {
                    await organizationApi.rename(current.id, name.trim(), current.revision);
                    await load();
                    await onChanged();
                    setStatus('Organization name saved.');
                  });
                }}
              >
                <FormField id={`${fieldId}-name`} label="Name" required>
                  {(field) => (
                    <TextInput
                      {...field}
                      icon={<Building2 />}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      required
                      minLength={2}
                      maxLength={80}
                      pattern=".*\S.*"
                      disabled={Boolean(busy)}
                    />
                  )}
                </FormField>
                <button
                  className="button"
                  type="submit"
                  disabled={Boolean(busy) || conflict || name.trim() === current.name}
                >
                  {busy === 'rename' ? 'Saving…' : 'Save name'}
                </button>
              </form>
            </section>
          ) : null}
          <section className="org-section" aria-labelledby={`${fieldId}-members`}>
            <div className="org-section-heading">
              <div>
                <h2 id={`${fieldId}-members`}>Members</h2>
                <p>
                  {data.members.length} {data.members.length === 1 ? 'person has' : 'people have'}{' '}
                  access to this organization.
                </p>
              </div>
              <Users size={20} aria-hidden="true" />
            </div>
            <div className="org-member-list">
              {data.members.map((member) => {
                const manageable =
                  canManage &&
                  member.userId !== userId &&
                  (current.role === 'owner' || member.role !== 'owner');
                return (
                  <article className="org-member" key={member.id}>
                    <div className="org-member-identity">
                      <span className="avatar" aria-hidden="true">
                        {(member.name || member.email).slice(0, 2).toUpperCase()}
                      </span>
                      <div>
                        <h3>
                          {member.name || member.email}
                          {member.userId === userId ? <span className="org-you">You</span> : null}
                        </h3>
                        {member.name ? <p>{member.email}</p> : null}
                        <small>
                          Joined {date(member.joinedAt)}
                          {member.suspended ? ' · Account suspended' : ''}
                        </small>
                      </div>
                    </div>
                    <div className="org-member-access">
                      <strong className="org-role">{member.role}</strong>
                      <p>{roleHelp[member.role]}</p>
                    </div>
                    {manageable ? (
                      <details className="org-member-actions">
                        <summary>Manage access</summary>
                        <div>
                          <button
                            className="button ghost"
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              chooseChange({
                                kind: 'role',
                                id: member.id,
                                label: member.email,
                                role: member.role,
                              })
                            }
                          >
                            Change role
                          </button>
                          <button
                            className="button ghost"
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() =>
                              chooseChange({
                                kind: 'remove',
                                id: member.id,
                                label: member.email,
                                role: member.role,
                              })
                            }
                          >
                            Remove member
                          </button>
                        </div>
                      </details>
                    ) : (
                      <span className="org-static-note">
                        {member.userId === userId
                          ? 'Your access · another owner can change it'
                          : member.role === 'owner'
                            ? 'Managed by owners'
                            : 'Member access'}
                      </span>
                    )}
                  </article>
                );
              })}
            </div>
            <p className="org-footnote">
              At least one owner must remain. Removing a member ends their access to these projects
              and stops use of their repository credentials for this organization.
            </p>
          </section>
          {canManage ? (
            <section className="org-section" aria-labelledby={`${fieldId}-invite-title`}>
              <h2 id={`${fieldId}-invite-title`}>Invite a teammate</h2>
              <p>
                Create a private invitation for one email address. Share the link yourself; Wisesama
                does not email it.
              </p>
              <form
                className="org-invite-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  void run('invite', async () => {
                    const result = await organizationApi.invite(
                      current.id,
                      email.trim(),
                      inviteRole,
                    );
                    setIssuedLink({
                      id: result.invitation.id,
                      url: result.inviteUrl,
                      email: result.invitation.email,
                      expiresAt: result.invitation.expiresAt,
                    });
                    setEmail('');
                    await load();
                    setStatus('Invitation link created. Share it with the invited person.');
                  });
                }}
              >
                <FormField id={`${fieldId}-email`} label="Teammate email" required>
                  {(field) => (
                    <TextInput
                      {...field}
                      type="email"
                      autoComplete="off"
                      maxLength={254}
                      required
                      value={email}
                      disabled={Boolean(busy)}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="teammate@company.com"
                    />
                  )}
                </FormField>
                <FormField id={`${fieldId}-invite-role`} label="Role">
                  {(field) => (
                    <Choice
                      {...field}
                      value={inviteRole}
                      disabled={Boolean(busy)}
                      onValueChange={(value) => setInviteRole(value as 'admin' | 'member')}
                      options={[
                        { value: 'member', label: 'Member' },
                        { value: 'admin', label: 'Admin' },
                      ]}
                    />
                  )}
                </FormField>
                <button className="button primary" type="submit" disabled={Boolean(busy)}>
                  {busy === 'invite' ? 'Creating…' : 'Create invitation link'}
                </button>
                <p className="org-form-help">
                  {roleHelp[inviteRole]} Acceptance requires a verified account with the invited
                  email.
                </p>
              </form>
              {issuedLink && issuedLinkIsActive ? (
                <div className="org-issued-link" role="status">
                  <strong>Invitation for {issuedLink.email}</strong>
                  <p>
                    Expires {date(issuedLink.expiresAt)}. This link is shown only after creation.
                  </p>
                  <div>
                    <TextInput
                      aria-label="New invitation link"
                      value={issuedLink.url}
                      readOnly
                      autoComplete="off"
                      onFocus={(event) => event.target.select()}
                    />
                    <button
                      className="button"
                      type="button"
                      onClick={() => {
                        void navigator.clipboard
                          .writeText(issuedLink.url)
                          .then(() => setStatus('Invitation link copied.'))
                          .catch(() =>
                            setError(
                              'Could not copy the link. Select the link and copy it manually.',
                            ),
                          );
                      }}
                    >
                      <Copy size={15} aria-hidden="true" />
                      Copy link
                    </button>
                  </div>
                  <button
                    className="button ghost"
                    type="button"
                    onClick={() => setIssuedLink(null)}
                  >
                    Hide invitation link
                  </button>
                </div>
              ) : null}
              {data.invitations.length ? (
                <div className="org-invitations">
                  <h3>Invitations</h3>
                  {data.invitations.map((invitation) => (
                    <div className="org-invitation-record" key={invitation.id}>
                      <div>
                        <strong>{invitation.email}</strong>
                        <p>
                          {invitation.role} · {invitation.status}
                        </p>
                        <small>
                          {invitation.status === 'pending' ? 'Expires' : 'Expiry'}{' '}
                          {date(invitation.expiresAt)}
                        </small>
                      </div>
                      {invitation.status === 'pending' ? (
                        <button
                          className="button ghost"
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            chooseChange({
                              kind: 'revoke',
                              id: invitation.id,
                              label: invitation.email,
                              role: invitation.role,
                            })
                          }
                        >
                          Revoke invitation
                        </button>
                      ) : (
                        <span className="org-static-note">{invitation.status}</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="org-empty">
                  No invitations yet. Existing members already have access.
                </p>
              )}
            </section>
          ) : (
            <p className="notice">
              Ask an owner or admin to invite teammates or change project settings. You can still
              contribute to findings, project context and responses.
            </p>
          )}
          {canManage && pending ? (
            <form
              className="org-change-confirmation"
              onSubmit={(event) => void applyChange(event)}
              aria-labelledby={`${fieldId}-confirm-title`}
            >
              <h2 id={`${fieldId}-confirm-title`} ref={confirmationHeading} tabIndex={-1}>
                {pending.kind === 'role'
                  ? 'Change member role'
                  : pending.kind === 'remove'
                    ? 'Remove member'
                    : 'Revoke invitation'}
              </h2>
              <p>
                <strong>{pending.label}</strong> · {current.name}
              </p>
              {pending.kind === 'role' ? (
                <FormField
                  id={`${fieldId}-role`}
                  label="New role"
                  description={roleHelp[pending.role]}
                >
                  {(field) => (
                    <Choice
                      {...field}
                      value={pending.role}
                      disabled={Boolean(busy)}
                      onValueChange={(value) => {
                        setPending({ ...pending, role: value as OrganizationRole });
                        setConfirmed(false);
                      }}
                      options={[
                        ...(current.role === 'owner' ? [{ value: 'owner', label: 'Owner' }] : []),
                        { value: 'admin', label: 'Admin' },
                        { value: 'member', label: 'Member' },
                      ]}
                    />
                  )}
                </FormField>
              ) : (
                <p>
                  {pending.kind === 'remove'
                    ? 'They will lose access to all projects and response records in this organization. Their personal account remains available.'
                    : 'The invitation link will stop working. Existing memberships are unchanged.'}
                </p>
              )}
              {!targetAvailable || !targetAllowed ? (
                <p className="notice error">
                  This record or your permission changed. Reload details and review access before
                  continuing.
                </p>
              ) : null}
              <FormField
                id={`${fieldId}-reason`}
                label="Reason for this change"
                required
                description="10–500 characters. Saved in organization history; do not include secrets."
              >
                {(field) => (
                  <TextArea
                    {...field}
                    rows={3}
                    minLength={10}
                    maxLength={500}
                    required
                    value={reason}
                    disabled={Boolean(busy)}
                    onChange={(event) => setReason(event.target.value)}
                  />
                )}
              </FormField>
              <label className="org-confirm-checkbox" htmlFor={`${fieldId}-confirmed`}>
                <CheckControl
                  id={`${fieldId}-confirmed`}
                  checked={confirmed}
                  disabled={Boolean(busy) || conflict}
                  onCheckedChange={setConfirmed}
                />
                <span>I have reviewed this change to {pending.label}&apos;s access.</span>
              </label>
              <div className="org-actions">
                <button
                  className={`button ${pending.kind === 'role' ? 'primary' : 'danger'}`}
                  type="submit"
                  disabled={
                    Boolean(busy) ||
                    loading ||
                    conflict ||
                    !confirmed ||
                    !targetAvailable ||
                    !targetAllowed ||
                    (pending.kind === 'role' && pending.role === targetMember?.role)
                  }
                >
                  {busy === 'change'
                    ? 'Updating access…'
                    : pending.kind === 'role'
                      ? 'Confirm role change'
                      : pending.kind === 'remove'
                        ? 'Confirm removal'
                        : 'Confirm revocation'}
                </button>
                <button
                  className="button ghost"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => {
                    setPending(null);
                    setReason('');
                    setConfirmed(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          {canManage && data.audit.length ? (
            <details className="org-history">
              <summary>
                Organization history <span>{data.audit.length} recent events</span>
              </summary>
              <ol>
                {data.audit.map((event) => (
                  <li key={event.id}>
                    <strong>{event.action.replaceAll('_', ' ')}</strong>
                    <small>
                      {date(event.createdAt)}
                      {event.actorName ? ` · ${event.actorName}` : ''}
                    </small>
                    {event.reason ? <p>{event.reason}</p> : null}
                  </li>
                ))}
              </ol>
            </details>
          ) : null}
        </>
      ) : !loading ? (
        <button className="button" type="button" onClick={() => void load()}>
          Try again
        </button>
      ) : null}
      <details className="org-create">
        <summary>
          <Plus size={16} aria-hidden="true" />
          Create another organization
        </summary>
        <p>
          Start a separate group of projects with your account as its first owner. Existing projects
          stay in their current organization.
        </p>
        <form
          className="org-inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            void run('create', async () => {
              const result = await organizationApi.create(newName.trim());
              setNewName('');
              setNewNameTouched(false);
              onCreated(result.organization);
            });
          }}
        >
          <FormField
            id={`${fieldId}-new-name`}
            label="Organization name"
            required
            error={
              newNameTouched && newName.trim().length < 2
                ? 'Use at least 2 characters for the organization name.'
                : undefined
            }
          >
            {(field) => (
              <TextInput
                {...field}
                icon={<Building2 />}
                onBlur={() => setNewNameTouched(true)}
                required
                minLength={2}
                maxLength={80}
                pattern=".*\S.*"
                value={newName}
                disabled={Boolean(busy)}
                onChange={(event) => setNewName(event.target.value)}
              />
            )}
          </FormField>
          <button className="button" type="submit" disabled={Boolean(busy)}>
            {busy === 'create' ? 'Creating…' : 'Create organization'}
          </button>
        </form>
      </details>
    </section>
  );
}

export function OrganizationInvitation() {
  const { data: session, isPending, error: sessionError, refetch } = useSession();
  const [token, setToken] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [preview, setPreview] = useState<InvitationPreview['invitation'] | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');
  const [joined, setJoined] = useState<Organization | null>(null);
  const initializedRef = useRef(false);
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;
    const secret = new URLSearchParams(window.location.search).get('token');
    // Keep invitation secrets out of subsequent links, referrers and browser history.
    if (window.location.search) window.history.replaceState(window.history.state, '', '/invite');
    setToken(secret && /^[a-zA-Z0-9_-]{32,128}$/.test(secret) ? secret : null);
    setInitialized(true);
  }, []);
  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      setBusy('preview');
      setError('');
      try {
        const result = await organizationApi.previewInvitation(token, signal);
        if (!signal?.aborted) setPreview(result.invitation);
      } catch (cause) {
        if (!signal?.aborted) {
          setPreview(null);
          setError(message(cause));
        }
      } finally {
        if (!signal?.aborted) setBusy('');
      }
    },
    [token],
  );
  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  async function accept() {
    if (!token || busy || preview?.status !== 'pending') return;
    setBusy('accept');
    setError('');
    try {
      const result = await organizationApi.acceptInvitation(token);
      setJoined(result.organization);
      setToken(null);
      if (session?.user) {
        try {
          localStorage.setItem(organizationSelectionKey(session.user.id), result.organization.id);
        } catch {
          /* Selection is optional; live membership remains authoritative. */
        }
      }
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy('');
    }
  }

  async function verify() {
    if (!session?.user || busy) return;
    setBusy('verify');
    setError('');
    setStatus('');
    try {
      const result = await authClient.sendVerificationEmail({
        email: session.user.email,
        callbackURL: `${window.location.origin}/invite`,
      });
      if (result.error)
        throw new Error(
          result.error.message || 'Verification email could not be requested. Try again.',
        );
      setStatus(
        'Verification email requested. Keep this invitation tab open. After verifying, check your account below.',
      );
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy('');
    }
  }

  if (!initialized || isPending)
    return (
      <section className="org-invite-page" role="status">
        <p>Checking your invitation and account…</p>
      </section>
    );
  if (joined)
    return (
      <section className="org-invite-page">
        <Check size={30} aria-hidden="true" />
        <h1>You joined {joined.name}</h1>
        <p>
          Your organization role is {joined.role}. Its projects and response records are now
          available in your workspace.
        </p>
        <Link className="button primary" href="/app/projects">
          Open organization <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </section>
    );
  if (!token)
    return (
      <section className="org-invite-page">
        <h1>Open your invitation link</h1>
        <p>
          Return to the original invitation tab, or reopen the link shared with you. Invitation
          links are removed from the address bar after opening to protect access.
        </p>
        <Link className="button" href="/app/inbox">
          Go to your workspace
        </Link>
      </section>
    );
  return (
    <section className="org-invite-page">
      <Building2 size={30} aria-hidden="true" />
      <h1>{preview ? `Join ${preview.organizationName}` : 'Organization invitation'}</h1>
      {busy === 'preview' ? <p role="status">Checking the invitation…</p> : null}
      {error ? (
        <p className="notice error" role="alert">
          {error}
        </p>
      ) : null}
      {error && preview ? (
        <button
          className="button"
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void load()}
        >
          Check invitation status
        </button>
      ) : null}
      {sessionError ? (
        <p className="notice error" role="alert">
          Your account could not be checked. Try again before accepting.
        </p>
      ) : null}
      {status ? (
        <p className="org-success" role="status">
          {status}
        </p>
      ) : null}
      {!preview && !busy ? (
        <button className="button" type="button" onClick={() => void load()}>
          Check invitation again
        </button>
      ) : null}
      {preview ? (
        <>
          <div className="org-invite-summary">
            <strong>{preview.role === 'admin' ? 'Admin' : 'Member'} access</strong>
            <p>{roleHelp[preview.role]}</p>
            <small>
              {preview.status === 'pending' ? 'Expires' : `Invitation ${preview.status} · Expiry`}{' '}
              {date(preview.expiresAt)}
            </small>
          </div>
          {preview.status !== 'pending' ? (
            <p className="notice">
              {preview.status === 'accepted'
                ? 'This invitation has already been accepted. Open your workspace if you joined with this account.'
                : 'This invitation cannot be accepted. Ask an owner or admin for a new invitation link.'}
            </p>
          ) : session?.user ? (
            <>
              <p>
                Signed in as <strong>{session.user.email}</strong>. This must match the invited
                address. Only accepting below adds you to the organization.
              </p>
              {!session.user.emailVerified ? (
                <div className="org-invite-verification">
                  <h2>Verify your account email</h2>
                  <p>
                    Verify this address before accepting the invitation. If this is a different
                    address from the invitation, sign out and use the invited account.
                  </p>
                  <div className="org-actions">
                    <button
                      className="button"
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void verify()}
                    >
                      {busy === 'verify' ? 'Requesting…' : 'Request verification email'}
                    </button>
                    <button
                      className="button"
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => void refetch()}
                    >
                      Check verification
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="org-actions">
                <button
                  className="button primary"
                  type="button"
                  disabled={Boolean(busy) || !session.user.emailVerified || Boolean(sessionError)}
                  onClick={() => void accept()}
                >
                  {busy === 'accept' ? 'Accepting…' : 'Accept invitation'}
                  <ArrowRight size={16} aria-hidden="true" />
                </button>
                <button
                  className="button ghost"
                  type="button"
                  disabled={Boolean(busy)}
                  onClick={() => void authClient.signOut().then(() => refetch())}
                >
                  Use a different account
                </button>
              </div>
            </>
          ) : (
            <>
              <p>
                Sign in or create an account with the invited email. Your account must be verified
                before you explicitly accept the invitation.
              </p>
              <AccountAccess onAuthenticated={() => void refetch()} />
            </>
          )}
        </>
      ) : null}
      <Link className="text-link" href="/app/inbox" referrerPolicy="no-referrer">
        Return to workspace
      </Link>
    </section>
  );
}
