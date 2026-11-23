/** Shared local HTTP helpers. This module never loads a database or sends mail. */
import assert from 'node:assert/strict';
import { constants } from 'node:fs';
import { open, writeFile } from 'node:fs/promises';
import { CI_FIXTURE_PATH, type CiPreviewFixture } from './ci-preview-provider';

export const ORG_FIXTURE_PATH = '/private/tmp/wisesama-org-preview.json';
export const ORG_RESULT_PATH = '/private/tmp/wisesama-org-http-result.json';
export type PreviewAccount = CiPreviewFixture['owner'];
export type Organization = { id: string; name: string; role: string; revision: number };
export type Member = { id: string; userId: string; role: string; revision: number };
export type OrganizationDetail = {
  organization: Organization;
  canManage: boolean;
  currentMembershipId: string;
  members: Member[];
  invitations: Array<{ id: string; email: string; role: string; revision: number; status: string }>;
  audit: Array<{ action: string }>;
};
export type OrgPreviewFixture = {
  run: string;
  owner: PreviewAccount;
  outsider: PreviewAccount;
  member: PreviewAccount;
  admin: PreviewAccount;
  connector: PreviewAccount;
  invitee: PreviewAccount;
  organizationId: string;
  personalOrganizationId: string;
  manualProjectId: string;
  projectId: string;
  sourceId: string;
  connectorConnectionId: string;
  connectorProjectId: string;
  connectorSourceId: string;
  connectorPersonalProjectId: string;
  connectorPersonalSourceId: string;
  browserInvite?: { invitationId: string; token: string; inviteUrl: string };
};

export async function readPrivateJson<T>(path: string): Promise<T> {
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    assert.ok(info.isFile() && info.nlink === 1 && info.size < 32_768);
    assert.equal(info.mode & 0o077, 0, 'Fixture must remain private.');
    return JSON.parse(await file.readFile('utf8')) as T;
  } finally {
    await file.close();
  }
}
export async function readCiFixture() {
  const fixture = await readPrivateJson<CiPreviewFixture>(CI_FIXTURE_PATH);
  assert.match(fixture.run, /^[a-f0-9-]{36}$/);
  for (const account of [fixture.owner, fixture.outsider])
    assert.ok(account.id && account.email.endsWith(`-ci-${fixture.run}@example.invalid`));
  return fixture;
}
export async function readOrgFixture(allowPartial = false) {
  const fixture = await readPrivateJson<OrgPreviewFixture>(ORG_FIXTURE_PATH);
  assert.match(fixture.run, /^[a-f0-9-]{36}$/);
  for (const account of [fixture.member, fixture.admin, fixture.connector, fixture.invitee])
    assert.ok(
      (account.id || allowPartial) && account.email.endsWith(`-org-${fixture.run}@example.invalid`),
    );
  const ci = await readCiFixture();
  assert.equal(fixture.owner.id, ci.owner.id);
  assert.equal(fixture.outsider.id, ci.outsider.id);
  return fixture;
}
export const persistOrgFixture = (fixture: OrgPreviewFixture) =>
  writeFile(ORG_FIXTURE_PATH, JSON.stringify(fixture, null, 2), { mode: 0o600 });

export async function call<T = unknown>(
  path: string,
  cookie = '',
  method = 'GET',
  body?: unknown,
  extraHeaders: Record<string, string> = {},
) {
  const response = await fetch(`http://localhost:3001${path}`, {
    method,
    redirect: 'error',
    headers: {
      Origin: 'http://localhost:3003',
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...extraHeaders,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!path.startsWith('/api/auth/')) {
    assert.equal(response.headers.get('x-wisesama-local-preview'), 'disposable-wisesama_intel');
    assert.equal(response.headers.get('x-wisesama-ci-preview'), 'synthetic-immutable-repositories');
  }
  const json = (await response.json()) as { data?: T; error?: string };
  return { response, data: (json.data ?? json) as T };
}
export async function preflight() {
  const { response } = await call('/api/v1/intel/organizations');
  assert.equal(response.status, 401, 'Restart the migrated local organization preview first.');
}
export async function signin(account: PreviewAccount) {
  const { response } = await call('/api/auth/sign-in/email', '', 'POST', {
    email: account.email,
    password: account.password,
  });
  assert.equal(response.status, 200, 'Synthetic account sign-in failed.');
  const cookie = response.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  assert.ok(cookie.includes('session_token'));
  return cookie;
}
