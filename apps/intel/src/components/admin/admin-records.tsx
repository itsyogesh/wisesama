'use client';

import { ArrowRight, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState } from 'react';
import {
  type AdminAdvisory,
  type AdminAdvisoryDetail,
  type AdminPage,
  type AdminSubscriber,
  type AdminSubscriberDetail,
  type AdminUser,
  type AdminUserDetail,
  adminApi,
} from '../../lib/admin-api';
import {
  AuditTrail,
  BackLink,
  collectionPath,
  DeliveryTable,
  dateTime,
  detailHref,
  EmptyState,
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
  VisibilityFilter,
} from './admin-common';

export function UsersList() {
  const params = useSearchParams();
  const state = useAdminData<AdminPage<AdminUser>>(collectionPath('/users', params));
  return (
    <>
      <PageHeading
        title="Users"
        description="Review account access and the health of each user’s security workspace."
      />
      <ListFilters
        statuses={[
          ['active', 'Active'],
          ['suspended', 'Suspended'],
        ]}
      />
      <LoadState
        error={state.error}
        loading={state.loading}
        hasData={Boolean(state.data)}
        onRetry={() => void state.reload()}
      />
      {state.data ? (
        state.data.items.length ? (
          <>
            <TableFrame label="Wisesama users">
              <table className="am-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>V2 access</th>
                    <th>Projects</th>
                    <th>Connections</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <Link
                          className="am-record-link"
                          href={detailHref('users', user.id, params)}
                        >
                          {user.name || user.email}
                          <ArrowRight />
                        </Link>
                        <small>{user.email}</small>
                        {user.intelAdmin ? (
                          <span className="am-inline-note">Platform administrator</span>
                        ) : null}
                        <MobileRowFacts
                          items={[
                            ['V2 access', <Status key="access" value={user.status} />],
                            [
                              'Email confirmation',
                              user.emailVerified ? 'Verified' : 'Not verified',
                            ],
                            ['Projects', user.projectCount],
                            ['Connections', user.connectionCount],
                            ['Joined', dateTime(user.createdAt)],
                          ]}
                        />
                      </td>
                      <td>
                        <Status value={user.status} />
                        <small>
                          {user.emailVerified ? 'Email verified' : 'Email not verified'}
                        </small>
                      </td>
                      <td>{user.projectCount}</td>
                      <td>{user.connectionCount}</td>
                      <td>{dateTime(user.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
            <Pagination nextCursor={state.data.nextCursor} count={state.data.items.length} />
          </>
        ) : (
          <EmptyState
            title="No users match these filters"
            description="Try another name or email, or clear the access filter."
          />
        )
      ) : null}
    </>
  );
}

export function UserRecord({ id, actorId }: { id: string; actorId: string }) {
  const state = useAdminData<AdminUserDetail>(`/users/${encodeURIComponent(id)}`);
  const [feedback, setFeedback] = useState('');
  const value = state.data;
  const user = value?.user;
  return (
    <>
      <BackLink section="users" label="All users" />
      <PageHeading
        title={user?.name || user?.email || 'User record'}
        description="V2 access, project assessment health, and recent operator changes."
      />
      <LoadState
        error={state.error}
        loading={state.loading}
        hasData={Boolean(value)}
        onRetry={() => void state.reload()}
      />
      {value && user ? (
        <>
          <div className="am-record-top">
            <Status value={user.status} />
            {user.intelAdmin ? (
              <span className="am-inline-note">Platform administrator</span>
            ) : null}
            <span>{user.email}</span>
          </div>
          {feedback ? (
            <p className="am-success" role="status">
              {feedback}
            </p>
          ) : null}
          <div className="am-record-layout">
            <div>
              <section className="am-section">
                <h2>Account details</h2>
                <RecordFacts
                  items={[
                    ['User ID', <code key="id">{user.id}</code>],
                    ['Email confirmation', user.emailVerified ? 'Verified' : 'Not verified'],
                    ['Created', dateTime(user.createdAt)],
                    ['Last updated', dateTime(user.updatedAt)],
                    ['V2 access suspended', dateTime(user.suspendedAt)],
                    ['Suspension reason', user.suspensionReason || 'None recorded'],
                  ]}
                />
              </section>
              <section className="am-section">
                <h2>Projects</h2>
                {value.projects.length ? (
                  <TableFrame label="User project assessment health">
                    <table className="am-table">
                      <thead>
                        <tr>
                          <th>Project</th>
                          <th>Environment</th>
                          <th>Last assessment</th>
                        </tr>
                      </thead>
                      <tbody>
                        {value.projects.map((project) => (
                          <tr key={project.id}>
                            <td>
                              <strong>{project.name}</strong>
                              <small>{project.scanError || project.id}</small>
                              <MobileRowFacts
                                items={[
                                  ['Environment', project.environment],
                                  [
                                    'Assessment state',
                                    project.scanError
                                      ? 'Failure recorded'
                                      : project.lastScannedAt
                                        ? 'Assessment recorded'
                                        : 'Not assessed',
                                  ],
                                  ['Last assessment', dateTime(project.lastScannedAt)],
                                ]}
                              />
                            </td>
                            <td>{project.environment}</td>
                            <td>{dateTime(project.lastScannedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableFrame>
                ) : (
                  <p className="am-muted">No projects in this workspace.</p>
                )}
                <p className="am-help">
                  Project inventory and private finding evidence are outside this account-management
                  view.
                </p>
              </section>
              <section className="am-section">
                <h2>Recent private alert deliveries</h2>
                <DeliveryTable deliveries={value.deliveries} />
              </section>
            </div>
            <aside className="am-record-aside">
              {actorId === user.id || user.intelAdmin ? (
                <section className="am-section">
                  <h2>Protected account</h2>
                  <p>
                    This view does not suspend platform administrators or your own account. Operator
                    privileges are managed through the deployment’s controlled access process.
                  </p>
                </section>
              ) : (
                <ReasonForm
                  key={`${user.id}-${user.revision}`}
                  title={
                    user.status === 'suspended'
                      ? 'Restore Wisesama access'
                      : 'Suspend Wisesama access'
                  }
                  description={
                    user.status === 'suspended'
                      ? 'Restore the user’s V2 workspace access. Public feed subscription consent remains separate.'
                      : 'Pause access to this user’s V2 workspace and its background activity. Their records remain available for review; Dotsama access and separate public subscriptions are not changed.'
                  }
                  effect={
                    user.status === 'suspended'
                      ? 'restore V2 access for this user.'
                      : 'suspend V2 access for this user.'
                  }
                  submitLabel={
                    user.status === 'suspended'
                      ? 'Confirm access restoration'
                      : 'Confirm suspension'
                  }
                  danger={user.status !== 'suspended'}
                  onReload={() => void state.reload()}
                  onSubmit={async (reason) => {
                    const updated = await adminApi.access(user.id, {
                      suspended: user.status !== 'suspended',
                      expectedRevision: user.revision,
                      reason,
                    });
                    state.setData(updated);
                    setFeedback('User access updated and recorded in the audit history.');
                  }}
                />
              )}
            </aside>
          </div>
          <AuditTrail events={value.audit} />
        </>
      ) : null}
    </>
  );
}

export function AdvisoriesList() {
  const params = useSearchParams();
  const state = useAdminData<AdminPage<AdminAdvisory>>(collectionPath('/advisories', params));
  return (
    <>
      <PageHeading
        title="Advisories"
        description="Review sourced intelligence and manage its public visibility and Wisesama guidance."
      >
        <Link className="button" href="/admin/jobs/new?kind=feed_refresh">
          Refresh public feed <ArrowRight />
        </Link>
      </PageHeading>
      <ListFilters>
        <VisibilityFilter />
      </ListFilters>
      <LoadState
        error={state.error}
        loading={state.loading}
        hasData={Boolean(state.data)}
        onRetry={() => void state.reload()}
      />
      {state.data ? (
        state.data.items.length ? (
          <>
            <TableFrame label="Sourced security advisories">
              <table className="am-table">
                <thead>
                  <tr>
                    <th>Advisory</th>
                    <th>Public visibility</th>
                    <th>Severity</th>
                    <th>Source collected</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          className="am-record-link"
                          href={detailHref('advisories', item.id, params)}
                        >
                          {item.data.title}
                          <ArrowRight />
                        </Link>
                        <small>
                          {item.id}
                          {item.aliases.length ? ` · ${item.aliases.join(', ')}` : ''}
                        </small>
                        <MobileRowFacts
                          items={[
                            [
                              'Public visibility',
                              <Status key="visibility" value={item.review.visibility} />,
                            ],
                            ['Severity', <Status key="severity" value={item.data.severity} />],
                            ['Source collected', dateTime(item.fetchedAt)],
                          ]}
                        />
                      </td>
                      <td>
                        <Status value={item.review.visibility} />
                      </td>
                      <td>
                        <Status value={item.data.severity} />
                      </td>
                      <td>{dateTime(item.fetchedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
            <Pagination nextCursor={state.data.nextCursor} count={state.data.items.length} />
          </>
        ) : (
          <EmptyState
            title="No advisories match these filters"
            description="Clear the search or queue a public-feed refresh to collect current upstream records."
          />
        )
      ) : null}
      <p className="am-boundary">
        Public curation is separate from package matching and private finding history. Source facts
        remain unchanged.
      </p>
    </>
  );
}

function AdvisoryReview({
  value,
  onSaved,
  onReload,
}: {
  value: AdminAdvisory;
  onSaved: (value: AdminAdvisoryDetail) => void;
  onReload: () => void;
}) {
  const [visibility, setVisibility] = useState(value.review.visibility);
  const [guidance, setGuidance] = useState(value.review.guidance);
  const [note, setNote] = useState(value.review.note);
  return (
    <ReasonForm
      title="Public review"
      description="Edit Wisesama’s response guidance and internal review note. Hiding removes this advisory from public discovery; it does not erase a customer’s findings or change upstream evidence."
      effect="save the public visibility and editorial guidance shown here."
      submitLabel="Confirm public review"
      onReload={onReload}
      onSubmit={async (reason) =>
        onSaved(
          await adminApi.review(value.id, {
            expectedRevision: value.review.revision,
            visibility,
            guidance,
            note,
            reason,
          }),
        )
      }
    >
      <label htmlFor="am-visibility">Public visibility</label>
      <select
        id="am-visibility"
        value={visibility}
        onChange={(event) => setVisibility(event.target.value as typeof visibility)}
      >
        <option value="published">Published</option>
        <option value="hidden">Hidden from public discovery</option>
      </select>
      <label htmlFor="am-guidance">Wisesama response guidance</label>
      <textarea
        id="am-guidance"
        rows={6}
        maxLength={4000}
        value={guidance}
        onChange={(event) => setGuidance(event.target.value)}
        placeholder="Add bounded, source-backed next steps. Keep uncertainty explicit."
      />
      <label htmlFor="am-review-note">Internal review note</label>
      <textarea
        id="am-review-note"
        rows={3}
        maxLength={4000}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Record why this needs attention or reference the editorial review."
      />
    </ReasonForm>
  );
}
export function AdvisoryRecord({ id }: { id: string }) {
  const state = useAdminData<AdminAdvisoryDetail>(`/advisories/${encodeURIComponent(id)}`);
  const value = state.data;
  const item = value?.advisory;
  const [feedback, setFeedback] = useState('');
  return (
    <>
      <BackLink section="advisories" label="All advisories" />
      <PageHeading
        title={item?.data.title || 'Advisory record'}
        description="Keep authoritative facts, public guidance, and review history distinct."
      />
      <LoadState
        error={state.error}
        loading={state.loading}
        hasData={Boolean(value)}
        onRetry={() => void state.reload()}
      />
      {value && item ? (
        <>
          <div className="am-record-top">
            <code>{item.id}</code>
            <Status value={item.review.visibility} />
            <Status value={item.data.severity} />
            <span>Collected {dateTime(item.fetchedAt)}</span>
          </div>
          {feedback ? (
            <p className="am-success" role="status">
              {feedback}
            </p>
          ) : null}
          <div className="am-record-layout">
            <div>
              <section className="am-section">
                <h2>Upstream advisory</h2>
                <p className="am-body-copy am-prewrap">{item.data.summary}</p>
                <RecordFacts
                  items={[
                    ['Source', item.data.source],
                    ['Published', dateTime(item.data.publishedAt)],
                    ['Modified', dateTime(item.data.modifiedAt)],
                    ['Aliases', item.aliases.join(', ') || 'None recorded'],
                    [
                      'Known exploitation',
                      item.data.exploitationStatus
                        ? item.data.exploitationStatus.replaceAll('_', ' ')
                        : 'Unknown',
                    ],
                    ['CVSS', item.data.cvss === null ? 'Not supplied' : String(item.data.cvss)],
                    [
                      'EPSS',
                      item.data.epss === null
                        ? 'Not supplied'
                        : `${(item.data.epss * 100).toFixed(2)}%`,
                    ],
                  ]}
                />
              </section>
              <section className="am-section">
                <h2>Affected software</h2>
                {item.data.affected.length ? (
                  <TableFrame label="Advisory affected software">
                    <table className="am-table">
                      <thead>
                        <tr>
                          <th>Package</th>
                          <th>Ecosystem</th>
                          <th>Reported fix</th>
                        </tr>
                      </thead>
                      <tbody>
                        {item.data.affected.map((affected) => (
                          <tr key={JSON.stringify(affected)}>
                            <td>
                              <code>{affected.name}</code>
                              {affected.ranges?.length ? (
                                <small>{affected.ranges.join('; ')}</small>
                              ) : null}
                              <MobileRowFacts
                                items={[
                                  ['Ecosystem', affected.ecosystem],
                                  [
                                    'Reported fix',
                                    affected.fixedVersion || 'Check source guidance',
                                  ],
                                ]}
                              />
                            </td>
                            <td>{affected.ecosystem}</td>
                            <td>{affected.fixedVersion || 'Check source guidance'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableFrame>
                ) : (
                  <p className="am-muted">No normalized affected packages.</p>
                )}
              </section>
              <section className="am-section">
                <h2>Source references</h2>
                <ul className="am-reference-list">
                  {item.data.references
                    .filter((ref) => safeUrl(ref.url))
                    .map((ref) => (
                      <li key={ref.url}>
                        <a href={safeUrl(ref.url)} target="_blank" rel="noreferrer">
                          {ref.url}
                          <ExternalLink />
                        </a>
                      </li>
                    ))}
                </ul>
              </section>
            </div>
            <aside className="am-record-aside">
              <AdvisoryReview
                key={`${item.id}-${item.review.revision}`}
                value={item}
                onReload={() => void state.reload()}
                onSaved={(updated) => {
                  state.setData(updated);
                  setFeedback(
                    'Public review saved. Upstream facts and private finding history remain intact.',
                  );
                }}
              />
            </aside>
          </div>
          <AuditTrail events={value.audit} />
        </>
      ) : null}
    </>
  );
}

export function SubscribersList() {
  const params = useSearchParams();
  const state = useAdminData<AdminPage<AdminSubscriber>>(collectionPath('/subscriptions', params));
  return (
    <>
      <PageHeading
        title="Subscriptions"
        description="Manage public feed email consent, suppression, and delivery problems."
      />
      <ListFilters
        statuses={[
          ['active', 'Active'],
          ['pending', 'Pending confirmation'],
          ['unsubscribed', 'Unsubscribed'],
          ['suppressed', 'Suppressed'],
        ]}
      />
      <LoadState
        error={state.error}
        loading={state.loading}
        hasData={Boolean(state.data)}
        onRetry={() => void state.reload()}
      />
      {state.data ? (
        state.data.items.length ? (
          <>
            <TableFrame label="Public feed email subscriptions">
              <table className="am-table">
                <thead>
                  <tr>
                    <th>Subscriber</th>
                    <th>Consent state</th>
                    <th>Topics</th>
                    <th>Confirmed</th>
                    <th>Next digest</th>
                  </tr>
                </thead>
                <tbody>
                  {state.data.items.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link
                          className="am-record-link"
                          href={detailHref('subscriptions', item.id, params)}
                        >
                          {item.email}
                          <ArrowRight />
                        </Link>
                        <small>Joined {dateTime(item.createdAt)}</small>
                        <MobileRowFacts
                          items={[
                            ['Consent state', <Status key="consent" value={item.status} />],
                            ['Topics', item.topics.join(', ')],
                            ['Confirmed', dateTime(item.confirmedAt)],
                            ['Next digest', dateTime(item.nextDigestAt)],
                          ]}
                        />
                      </td>
                      <td>
                        <Status value={item.status} />
                      </td>
                      <td>{item.topics.join(', ')}</td>
                      <td>{dateTime(item.confirmedAt)}</td>
                      <td>{dateTime(item.nextDigestAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableFrame>
            <Pagination nextCursor={state.data.nextCursor} count={state.data.items.length} />
          </>
        ) : (
          <EmptyState
            title="No subscriptions match these filters"
            description="Search another address or clear the consent-state filter."
          />
        )
      ) : null}
      <p className="am-boundary">
        Public feed consent is separate from user accounts and private project alerts. An operator
        cannot force confirmation or reactivate a suppressed address here.
      </p>
    </>
  );
}
function SubscriberAction({
  item,
  onSaved,
  onReload,
}: {
  item: AdminSubscriber;
  onSaved: (value: AdminSubscriberDetail) => void;
  onReload: () => void;
}) {
  const [status, setStatus] = useState<'unsubscribed' | 'suppressed'>('unsubscribed');
  return (
    <ReasonForm
      title="Stop public feed delivery"
      description="An operator can unsubscribe or suppress an address. This action does not delete its consent history, create a confirmed subscription, or change private project alerts."
      submitLabel={status === 'suppressed' ? 'Confirm suppression' : 'Confirm unsubscribe'}
      effect={
        status === 'suppressed'
          ? 'suppress public feed email to this address.'
          : 'unsubscribe this address from public feed email.'
      }
      danger
      onReload={onReload}
      onSubmit={async (reason) =>
        onSaved(
          await adminApi.subscription(item.id, { status, reason, expectedRevision: item.revision }),
        )
      }
    >
      <label htmlFor="am-consent-action">Delivery action</label>
      <select
        id="am-consent-action"
        value={status}
        onChange={(event) => setStatus(event.target.value as typeof status)}
      >
        <option value="unsubscribed">Unsubscribe</option>
        <option value="suppressed">Suppress delivery</option>
      </select>
    </ReasonForm>
  );
}
export function SubscriberRecord({ id }: { id: string }) {
  const state = useAdminData<AdminSubscriberDetail>(`/subscriptions/${encodeURIComponent(id)}`);
  const value = state.data;
  const item = value?.subscriber;
  const [feedback, setFeedback] = useState('');
  return (
    <>
      <BackLink section="subscriptions" label="All subscriptions" />
      <PageHeading
        title={item?.email || 'Subscription record'}
        description="Consent, delivery, and operator history for a public feed subscriber."
      />
      <LoadState
        error={state.error}
        loading={state.loading}
        hasData={Boolean(value)}
        onRetry={() => void state.reload()}
      />
      {value && item ? (
        <>
          <div className="am-record-top">
            <Status value={item.status} />
            <span>Updated {dateTime(item.updatedAt)}</span>
          </div>
          {feedback ? (
            <p className="am-success" role="status">
              {feedback}
            </p>
          ) : null}
          <div className="am-record-layout">
            <div>
              <section className="am-section">
                <h2>Consent record</h2>
                <RecordFacts
                  items={[
                    ['Subscriber ID', <code key="id">{item.id}</code>],
                    ['Topic preferences', item.topics.join(', ')],
                    ['Created', dateTime(item.createdAt)],
                    ['Confirmed', dateTime(item.confirmedAt)],
                    ['Next digest', dateTime(item.nextDigestAt)],
                  ]}
                />
                <p className="am-boundary">
                  A confirmation timestamp records consent. It does not override unsubscribe,
                  suppression, or a delivery-provider complaint.
                </p>
              </section>
              <section className="am-section">
                <h2>Recent public email deliveries</h2>
                <DeliveryTable deliveries={value.deliveries} />
                <Link className="am-text-link" href="/admin/jobs">
                  Inspect failed jobs <ArrowRight />
                </Link>
              </section>
              <section className="am-section">
                <h2>Delivery feedback</h2>
                {value.feedback.length ? (
                  <TableFrame label="Verified email provider feedback">
                    <table className="am-table">
                      <thead>
                        <tr>
                          <th>Event</th>
                          <th>Processing</th>
                          <th>Attempts</th>
                          <th>Processed</th>
                        </tr>
                      </thead>
                      <tbody>
                        {value.feedback.map((event) => (
                          <tr key={event.id}>
                            <td>
                              <strong>{event.type}</strong>
                              <small>{event.lastError || event.id}</small>
                              <MobileRowFacts
                                items={[
                                  ['Processing', <Status key="processing" value={event.status} />],
                                  ['Attempts', event.attempts],
                                  ['Processed', dateTime(event.processedAt)],
                                ]}
                              />
                            </td>
                            <td>
                              <Status value={event.status} />
                            </td>
                            <td>{event.attempts}</td>
                            <td>{dateTime(event.processedAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </TableFrame>
                ) : (
                  <p className="am-muted">No associated provider feedback recorded.</p>
                )}
              </section>
            </div>
            <aside className="am-record-aside">
              {item.status === 'active' || item.status === 'pending' ? (
                <SubscriberAction
                  key={`${item.id}-${item.revision}`}
                  item={item}
                  onReload={() => void state.reload()}
                  onSaved={(updated) => {
                    state.setData(updated);
                    setFeedback('Delivery preference updated and recorded in the audit history.');
                  }}
                />
              ) : (
                <section className="am-section">
                  <h2>Delivery is stopped</h2>
                  <p>
                    This address is {item.status}. The admin does not provide a shortcut to confirm
                    or reactivate it. Consent and provider suppression safeguards continue to apply.
                  </p>
                </section>
              )}
            </aside>
          </div>
          <AuditTrail events={value.audit} />
        </>
      ) : null}
    </>
  );
}
