/** Actual local auth + HTTP + PostgreSQL organization workflows; synthetic providers only. */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { assertCiPreviewDatabase } from './ci-preview-provider';
import {
  call,
  type Member,
  ORG_RESULT_PATH,
  type Organization,
  type OrganizationDetail,
  persistOrgFixture,
  preflight,
  readCiFixture,
  readOrgFixture,
  signin,
} from './org-preview';

process.env.DATABASE_URL = assertCiPreviewDatabase();
const { prisma: db } = await import('@wisesama/database');
const fixture = await readOrgFixture();
const ci = await readCiFixture();
const checks: string[] = [];
const orgPath = `/api/v1/intel/organizations/${fixture.organizationId}`;
const projectPath = `/api/v1/intel/projects/${fixture.projectId}`;
const reason = 'Synthetic local organization verification';
const digest = (token: string) => createHash('sha256').update(token).digest('hex');
async function status(
  path: string,
  cookie: string,
  method: string,
  body: unknown,
  expected: number,
  headers: Record<string, string> = {},
) {
  const result = await call(path, cookie, method, body, headers);
  assert.equal(
    result.response.status,
    expected,
    `${method} organization workflow returned unexpected status.`,
  );
  return result;
}
async function detail(cookie: string) {
  const result = await call<OrganizationDetail>(orgPath, cookie);
  assert.equal(result.response.status, 200);
  assert.ok(result.response.headers.get('cache-control')?.includes('no-store'));
  assert.equal(result.response.headers.get('referrer-policy'), 'no-referrer');
  return result.data;
}
const memberFor = (value: OrganizationDetail, userId: string) => {
  const member = value.members.find((item) => item.userId === userId);
  assert.ok(member, 'Expected synthetic membership not found.');
  return member;
};
async function invite(cookie: string, email: string, role: 'admin' | 'member' = 'member') {
  const result = await call<{
    invitation: { id: string; email: string; revision: number };
    inviteUrl: string;
    delivery: string;
  }>(`${orgPath}/invitations`, cookie, 'POST', { email, role });
  assert.equal(result.response.status, 201);
  assert.equal(result.data.delivery, 'share_link');
  const url = new URL(result.data.inviteUrl);
  assert.equal(url.origin, 'http://localhost:3003');
  assert.equal(url.pathname, '/invite');
  const token = url.searchParams.get('token');
  assert.ok(token && /^[a-zA-Z0-9_-]{43}$/.test(token));
  const record = await db.organizationInvitation.findUniqueOrThrow({
    where: { id: result.data.invitation.id },
  });
  assert.equal(record.tokenHash, digest(token));
  assert.equal(record.tokenHash.length, 64);
  assert.ok(!JSON.stringify(record).includes(token), 'Raw invitation token must never be stored.');
  return { ...result.data, token, path: `/api/v1/intel/organization-invitations/${token}` };
}
async function change(cookie: string, member: Member, role: string, expected = 200) {
  return status(
    `${orgPath}/members/${member.id}`,
    cookie,
    'PATCH',
    { role, expectedRevision: member.revision, reason },
    expected,
  );
}

try {
  await preflight();
  const owner = await signin(fixture.owner);
  const outsider = await signin(fixture.outsider);
  const member = await signin(fixture.member);
  const admin = await signin(fixture.admin);
  const connector = await signin(fixture.connector);
  const invitee = await signin(fixture.invitee);
  const privateIds = [fixture.organizationId, fixture.personalOrganizationId];
  await status(
    '/api/v1/intel/organizations',
    '',
    'POST',
    { name: 'Unauthorized organization' },
    401,
  );
  await status('/api/v1/intel/organizations', owner, 'POST', { name: 'Wrong origin' }, 403, {
    Origin: 'https://evil.example.invalid',
  });
  await status('/api/v1/intel/organizations', owner, 'POST', undefined, 415);
  await status(
    '/api/v1/intel/organizations',
    owner,
    'POST',
    { name: 'Unknown field', ownerId: fixture.outsider.id },
    400,
  );
  await status(
    '/api/v1/intel/organizations',
    owner,
    'POST',
    { name: 'API key organization' },
    401,
    { 'X-API-Key': 'synthetic-key-rejected-before-use' },
  );
  for (const id of privateIds) {
    assert.equal((await call(`/api/v1/intel/organizations/${id}`, outsider)).response.status, 404);
    assert.equal(
      (await call(`/api/v1/intel/workspace?organizationId=${id}`, outsider)).response.status,
      404,
    );
    assert.equal(
      (await call(`/api/v1/intel/repositories/sources?organizationId=${id}`, outsider)).response
        .status,
      404,
    );
  }
  await status(`${projectPath}/baseline`, outsider, 'POST', {}, 404);
  checks.push(
    'Exact-origin JSON, strict input and session-only management; outsider org/project/source scopes rejected.',
  );

  const firstVisits = await Promise.all([
    call<{ organizations: Organization[]; defaultOrganizationId: string }>(
      '/api/v1/intel/organizations',
      member,
    ),
    call<{ organizations: Organization[]; defaultOrganizationId: string }>(
      '/api/v1/intel/organizations',
      member,
    ),
  ]);
  assert.ok(firstVisits.every((result) => result.response.status === 200));
  assert.equal(
    firstVisits[0]!.data.defaultOrganizationId,
    firstVisits[1]!.data.defaultOrganizationId,
  );
  assert.equal(await db.organization.count({ where: { personalForUserId: fixture.member.id } }), 1);
  assert.equal(
    await db.organizationMember.count({
      where: { userId: fixture.member.id, organization: { personalForUserId: fixture.member.id } },
    }),
    1,
  );
  let ownerDetail = await detail(owner);
  assert.equal(ownerDetail.organization.role, 'owner');
  assert.equal(ownerDetail.members.length, 1);
  checks.push(
    'Concurrent real first visits converge on one personal organization and owner; new organization starts with its creator only.',
  );

  const memberInvite = await invite(owner, fixture.member.email.toUpperCase());
  assert.equal(memberInvite.invitation.email, fixture.member.email);
  const beforePreview = await db.organizationInvitation.findUniqueOrThrow({
    where: { id: memberInvite.invitation.id },
  });
  for (let attempt = 0; attempt < 2; attempt++) {
    const preview = await call<{
      invitation: { organizationName: string; role: string; expiresAt: string; status: string };
    }>(memberInvite.path);
    assert.equal(preview.response.status, 200);
    assert.equal(preview.data.invitation.status, 'pending');
    assert.deepEqual(Object.keys(preview.data.invitation).sort(), [
      'expiresAt',
      'organizationName',
      'role',
      'status',
    ]);
    assert.ok(preview.response.headers.get('cache-control')?.includes('no-store'));
    assert.equal(preview.response.headers.get('referrer-policy'), 'no-referrer');
  }
  const afterPreview = await db.organizationInvitation.findUniqueOrThrow({
    where: { id: memberInvite.invitation.id },
  });
  assert.equal(afterPreview.revision, beforePreview.revision);
  assert.equal(afterPreview.status, 'pending');
  assert.equal(
    await db.organizationMember.count({ where: { organizationId: fixture.organizationId } }),
    1,
  );
  await status(`${memberInvite.path}/accept`, '', 'POST', {}, 401);
  await status(`${memberInvite.path}/accept`, admin, 'POST', {}, 403);
  const unverified = await status(`${memberInvite.path}/accept`, member, 'POST', {}, 403);
  assert.match((unverified.data as { error: string }).error, /[Vv]erify/);
  await db.user.updateMany({
    where: { id: fixture.member.id, email: fixture.member.email },
    data: { emailVerified: true },
  });
  await status(`${memberInvite.path}/accept`, member, 'POST', {}, 200);
  await status(`${memberInvite.path}/accept`, member, 'POST', {}, 409);
  assert.equal(
    await db.organizationMember.count({
      where: { organizationId: fixture.organizationId, userId: fixture.member.id },
    }),
    1,
  );
  checks.push(
    'Invitation previews do not consume or disclose invitee data; digest-only storage, verified matching email, one acceptance and replay conflict verified.',
  );

  const memberDetail = await detail(member);
  assert.equal(memberDetail.canManage, false);
  assert.deepEqual(memberDetail.invitations, []);
  assert.deepEqual(memberDetail.audit, []);
  const scoped = await call<{ projects: Array<{ id: string; organizationId: string }> }>(
    `/api/v1/intel/workspace?organizationId=${fixture.organizationId}`,
    member,
  );
  assert.equal(scoped.response.status, 200);
  assert.ok(scoped.data.projects.some((project) => project.id === fixture.manualProjectId));
  assert.ok(scoped.data.projects.some((project) => project.id === fixture.projectId));
  assert.ok(
    scoped.data.projects.every((project) => project.organizationId === fixture.organizationId),
  );
  assert.ok(!scoped.data.projects.some((project) => project.id === ci.projectId));
  assert.equal(
    (await call(`/api/v1/intel/projects/${ci.projectId}/security`, member)).response.status,
    404,
  );
  assert.equal((await call(`${projectPath}/security`, member)).response.status, 200);
  const personalConnections = await call<{ connections: Array<{ id: string }> }>(
    '/api/v1/intel/repositories/connections',
    member,
  );
  assert.equal(personalConnections.response.status, 200);
  assert.ok(
    !personalConnections.data.connections.some((connection) => connection.id === ci.connectionId),
  );
  assert.equal(
    (await call(`/api/v1/intel/repositories/connections/${ci.connectionId}/repositories`, member))
      .response.status,
    404,
  );
  await status(
    `${projectPath}/context`,
    member,
    'PATCH',
    { internetFacing: 'unknown', sensitiveData: 'no', hosting: 'Synthetic staging' },
    200,
  );
  await status(`${projectPath}/baseline`, member, 'POST', {}, 200);
  await status(
    `/api/v1/intel/repositories/sources/${fixture.sourceId}/sync`,
    member,
    'POST',
    {},
    403,
  );
  const responsePath = `${projectPath}/responses/malicious-dependency`;
  const started = await call<{ response: { id: string; revision: number } }>(
    responsePath,
    member,
    'POST',
    {},
  );
  assert.equal(started.response.status, 200);
  await status(
    responsePath,
    member,
    'PATCH',
    {
      expectedRevision: started.data.response.revision,
      status: 'investigating',
      answers: {},
      checks: {},
      note: 'Synthetic team response progress',
      evidence: '',
    },
    200,
  );
  const event = await db.securityPlaybookEvent.findFirstOrThrow({
    where: { responseId: started.data.response.id },
    orderBy: { createdAt: 'desc' },
  });
  assert.equal(event.actorId, fixture.member.id);
  await status(
    '/api/v1/intel/projects',
    member,
    'POST',
    {
      organizationId: fixture.organizationId,
      name: 'Denied member creation',
      environment: 'staging',
      inventory: { format: 'package-json', content: '{"dependencies":{}}' },
    },
    403,
  );
  await status(
    `/api/v1/intel/projects/${fixture.manualProjectId}/inventory`,
    member,
    'POST',
    {
      inventory: { format: 'package-json', content: '{"dependencies":{}}' },
    },
    403,
  );
  await status(
    `/api/v1/intel/repositories/sources/${fixture.sourceId}`,
    member,
    'PATCH',
    { paused: true },
    403,
  );
  await status(
    `${orgPath}/invitations`,
    member,
    'POST',
    { email: fixture.invitee.email, role: 'member' },
    403,
  );
  checks.push(
    'Member sees only shared projects and directory; context, bounded baseline and attributed response progress work; project/inventory/sync/source/membership configuration is denied.',
  );

  const adminInvite = await invite(owner, fixture.admin.email, 'admin');
  await status(`${adminInvite.path}/accept`, admin, 'POST', {}, 200);
  const connectorInvite = await invite(owner, fixture.connector.email);
  const acceptedTwice = await Promise.all([
    call(`${connectorInvite.path}/accept`, connector, 'POST', {}),
    call(`${connectorInvite.path}/accept`, connector, 'POST', {}),
  ]);
  assert.deepEqual(acceptedTwice.map((result) => result.response.status).sort(), [200, 409]);
  ownerDetail = await detail(owner);
  let memberRecord = memberFor(ownerDetail, fixture.member.id);
  await change(owner, memberRecord, 'admin');
  await change(owner, memberRecord, 'member', 409);
  memberRecord = memberFor(await detail(owner), fixture.member.id);
  await change(owner, memberRecord, 'member');
  let adminRecord = memberFor(await detail(owner), fixture.admin.id);
  const ownerRecord = memberFor(await detail(owner), fixture.owner.id);
  let connectorRecord = memberFor(await detail(owner), fixture.connector.id);
  await change(admin, connectorRecord, 'owner', 403);
  await change(admin, ownerRecord, 'member', 403);
  await change(admin, adminRecord, 'member', 409);
  await change(owner, ownerRecord, 'member', 409);
  await status(
    `${orgPath}/members/${ownerRecord.id}`,
    owner,
    'DELETE',
    { expectedRevision: ownerRecord.revision, reason },
    409,
  );
  assert.equal(
    await db.organizationMember.count({
      where: {
        organizationId: fixture.organizationId,
        role: 'owner',
        user: { intelSuspendedAt: null },
      },
    }),
    1,
  );
  await change(owner, adminRecord, 'owner');
  adminRecord = memberFor(await detail(owner), fixture.admin.id);
  await change(owner, adminRecord, 'admin');
  const beforeRename = (await detail(owner)).organization.revision;
  await status(
    orgPath,
    owner,
    'PATCH',
    {
      name: `Synthetic organization verified ${fixture.run.slice(0, 8)}`,
      expectedRevision: beforeRename,
    },
    200,
  );
  await status(
    orgPath,
    owner,
    'PATCH',
    { name: 'Synthetic organization stale rename', expectedRevision: beforeRename },
    409,
  );
  await status(
    orgPath,
    admin,
    'PATCH',
    {
      name: 'Synthetic organization admin rename',
      expectedRevision: (await detail(owner)).organization.revision,
    },
    403,
  );
  checks.push(
    'Concurrent invitation acceptance has one winner; live role changes, stale membership/rename revisions, owner-only ownership/rename and self/final-owner safeguards hold.',
  );

  const invalidated = await invite(admin, fixture.invitee.email);
  adminRecord = memberFor(await detail(owner), fixture.admin.id);
  await change(owner, adminRecord, 'member');
  const invalidPreview = await call<{ invitation: { status: string } }>(invalidated.path);
  assert.equal(invalidPreview.data.invitation.status, 'revoked');
  await status(`${invalidated.path}/accept`, invitee, 'POST', {}, 409);
  await status(
    `${orgPath}/invitations/${invalidated.invitation.id}/revoke`,
    owner,
    'POST',
    { expectedRevision: invalidated.invitation.revision, reason },
    200,
  );
  await status(
    `${orgPath}/invitations/${invalidated.invitation.id}/revoke`,
    owner,
    'POST',
    { expectedRevision: invalidated.invitation.revision, reason },
    409,
  );
  const expiring = await invite(owner, fixture.invitee.email);
  assert.notEqual(digest(expiring.token), digest(invalidated.token));
  await status(`${invalidated.path}/accept`, invitee, 'POST', {}, 404);
  await db.organizationInvitation.update({
    where: { id: expiring.invitation.id },
    data: { expiresAt: new Date('2000-01-01') },
  });
  const expired = await call<{ invitation: { status: string } }>(expiring.path);
  assert.equal(expired.data.invitation.status, 'expired');
  await status(`${expiring.path}/accept`, invitee, 'POST', {}, 409);
  await status(
    `${orgPath}/invitations/${expiring.invitation.id}/revoke`,
    owner,
    'POST',
    { expectedRevision: expiring.invitation.revision, reason },
    200,
  );
  const browserInvite = await invite(owner, fixture.invitee.email);
  fixture.browserInvite = {
    invitationId: browserInvite.invitation.id,
    token: browserInvite.token,
    inviteUrl: browserInvite.inviteUrl,
  };
  await persistOrgFixture(fixture);
  adminRecord = memberFor(await detail(owner), fixture.admin.id);
  await change(owner, adminRecord, 'admin');
  checks.push(
    'Demoted inviter cannot authorize acceptance; stale revocation, rotated old link and expiry are rejected; a fresh pending browser link remains private.',
  );

  const connectorOrganizations = await call<{ defaultOrganizationId: string }>(
    '/api/v1/intel/organizations',
    connector,
  );
  assert.equal(connectorOrganizations.response.status, 200);
  const originalSource = await db.projectRepositorySource.findUniqueOrThrow({
    where: { id: fixture.sourceId },
  });
  const connectionBefore = await db.repositoryConnection.findUniqueOrThrow({
    where: { id: fixture.connectorConnectionId },
  });
  const seedAt = new Date();
  for (const [projectId, sourceId, organizationId] of [
    [fixture.connectorProjectId, fixture.connectorSourceId, fixture.organizationId],
    [
      fixture.connectorPersonalProjectId,
      fixture.connectorPersonalSourceId,
      connectorOrganizations.data.defaultOrganizationId,
    ],
  ] as const) {
    await db.securityProject.create({
      data: {
        id: projectId,
        userId: fixture.connector.id,
        organizationId,
        name: 'Synthetic organization removal control',
        environment: 'staging',
        packages: [{ name: 'synthetic-ci-package', version: '1.0.0', ecosystem: 'npm' }],
        nextScanAt: new Date('2100-01-01'),
      },
    });
    await db.projectRepositorySource.create({
      data: {
        id: sourceId,
        userId: fixture.connector.id,
        projectId,
        connectionId: fixture.connectorConnectionId,
        provider: 'github',
        repositoryId: ci.repositoryId,
        repositoryName: 'synthetic/ci-checkout',
        repositoryUrl: 'https://github.com/synthetic/ci-checkout',
        branch: 'main',
        paths: ['package.json'],
        status: 'current',
        importedCommit: originalSource.importedCommit,
        observedCommit: originalSource.observedCommit,
        baseline: JSON.parse(JSON.stringify(originalSource.baseline)),
        baselineCheckedAt: originalSource.baselineCheckedAt,
        nextSyncAt: new Date('2100-01-01'),
        syncToken: 'synthetic-sync-lease',
        syncStartedAt: seedAt,
        baselineToken: 'synthetic-baseline-lease',
        baselineStartedAt: seedAt,
      },
    });
  }
  assert.equal(
    (await call(`/api/v1/intel/projects/${fixture.connectorProjectId}/security`, connector))
      .response.status,
    200,
  );
  connectorRecord = memberFor(await detail(owner), fixture.connector.id);
  await status(
    `${orgPath}/members/${connectorRecord.id}`,
    owner,
    'DELETE',
    { expectedRevision: connectorRecord.revision, reason },
    200,
  );
  assert.equal((await call(orgPath, connector)).response.status, 404);
  assert.equal(
    (await call(`/api/v1/intel/projects/${fixture.connectorProjectId}/security`, connector))
      .response.status,
    404,
  );
  await status(
    `/api/v1/intel/repositories/sources/${fixture.connectorSourceId}/sync`,
    connector,
    'POST',
    {},
    404,
  );
  await status(
    `/api/v1/intel/repositories/sources/${fixture.connectorSourceId}/sync`,
    owner,
    'POST',
    {},
    409,
  );
  const removed = await db.projectRepositorySource.findUniqueOrThrow({
    where: { id: fixture.connectorSourceId },
  });
  assert.equal(removed.paused, true);
  assert.equal(removed.status, 'access_removed');
  for (const field of ['syncToken', 'syncStartedAt', 'baselineToken', 'baselineStartedAt'] as const)
    assert.equal(removed[field], null);
  assert.deepEqual(removed.baseline, originalSource.baseline);
  const retainedProject = await db.securityProject.findUniqueOrThrow({
    where: { id: fixture.connectorProjectId },
  });
  assert.equal((retainedProject.packages as unknown[]).length, 1);
  const unaffected = await db.projectRepositorySource.findUniqueOrThrow({
    where: { id: fixture.connectorPersonalSourceId },
  });
  assert.equal(unaffected.paused, false);
  assert.equal(unaffected.status, 'current');
  assert.equal(unaffected.syncToken, 'synthetic-sync-lease');
  const connectionAfter = await db.repositoryConnection.findUniqueOrThrow({
    where: { id: fixture.connectorConnectionId },
  });
  assert.equal(connectionAfter.status, connectionBefore.status);
  assert.equal(connectionAfter.credentials, connectionBefore.credentials);
  const removedList = await call<{ organizations: Organization[] }>(
    '/api/v1/intel/organizations',
    connector,
  );
  assert.ok(
    !removedList.data.organizations.some(
      (organization) => organization.id === fixture.organizationId,
    ),
  );
  checks.push(
    'Removal blocks the very next session request, pauses only connector sources in that organization and clears leases; inventory/baseline, personal sources and encrypted personal connection remain.',
  );

  const audits = await db.organizationAudit.findMany({
    where: { organizationId: fixture.organizationId },
  });
  assert.ok(audits.some((audit) => audit.action === 'member.removed'));
  assert.ok(audits.every((audit) => !JSON.stringify(audit).includes(browserInvite.token)));
  assert.equal((await call('/api/v1/intel/admin/session', member)).response.status, 403);
  assert.equal((await call('/api/v1/intel/admin/session', owner)).response.status, 403);
  await db.securityProject.updateMany({
    where: { organizationId: fixture.organizationId },
    data: { nextScanAt: new Date('2100-01-01') },
  });
  await db.projectRepositorySource.updateMany({
    where: { id: fixture.sourceId },
    data: { nextSyncAt: new Date('2100-01-01') },
  });
  checks.push(
    'Organization audit persists safe actions; organization ownership and membership confer no operator access.',
  );
  await writeFile(
    ORG_RESULT_PATH,
    JSON.stringify(
      {
        passed: true,
        checks,
        transport:
          'actual local sessions/HTTP/PostgreSQL, synthetic immutable repository transport',
        noProviderOrEmailCalls: true,
        fixturePath: '/private/tmp/wisesama-org-preview.json',
      },
      null,
      2,
    ),
    { mode: 0o600 },
  );
  console.log(
    `Organization HTTP verification passed: ${checks.length} workflow groups. Evidence: ${ORG_RESULT_PATH}.`,
  );
} finally {
  await db.$disconnect();
}
