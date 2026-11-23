/** Development regression: issued local fixture session, actual revocation and private routes. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  assertCiPreviewDatabase,
  CI_FIXTURE_PATH,
  type CiPreviewFixture,
} from './ci-preview-provider';

process.env.DATABASE_URL = assertCiPreviewDatabase();
const { prisma: db } = await import('@wisesama/database');
const fixture = JSON.parse(await readFile(CI_FIXTURE_PATH, 'utf8')) as CiPreviewFixture;
assert.match(fixture.run, /^[a-f0-9-]{36}$/);
assert.ok(fixture.owner.email.endsWith(`-ci-${fixture.run}@example.invalid`));
const base = 'http://localhost:3001';
const origin = 'http://localhost:3003';
let cookie = '';
async function call(path: string, method = 'GET', body?: unknown, includeOrigin = true) {
  const response = await fetch(`${base}${path}`, {
    method,
    redirect: 'error',
    headers: {
      ...(includeOrigin ? { Origin: origin } : {}),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!path.startsWith('/api/auth/')) {
    assert.equal(response.headers.get('x-wisesama-local-preview'), 'disposable-wisesama_intel');
    assert.equal(response.headers.get('x-wisesama-ci-preview'), 'synthetic-immutable-repositories');
  }
  return response;
}
try {
  const signIn = await call('/api/auth/sign-in/email', 'POST', {
    email: fixture.owner.email,
    password: fixture.owner.password,
  });
  assert.equal(signIn.status, 200);
  cookie = signIn.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  assert.ok(cookie.includes('session_token'));
  const session = (await (await call('/api/auth/get-session')).json()) as {
    session: { id: string };
  };
  assert.ok(session.session.id);
  assert.ok(await db.session.findUnique({ where: { id: session.session.id } }));
  assert.equal((await call('/api/v1/intel/workspace')).status, 200);
  const baseline = `/api/v1/intel/projects/${fixture.projectId}/baseline`;
  assert.equal((await call(baseline, 'POST', {}, false)).status, 403);
  assert.equal((await call('/api/auth/sign-out', 'POST', {})).status, 200);
  assert.equal(await db.session.findUnique({ where: { id: session.session.id } }), null);
  // Reuse the originally issued cookie bytes after confirmed DB deletion; never invent a token.
  assert.equal((await call('/api/v1/intel/workspace')).status, 401);
  console.log(
    'PASS: actual issued session works, missing-origin mutation fails, sign-out deletes its stored session, and replay of the same issued cookie is immediately rejected.',
  );
} finally {
  if (cookie) await call('/api/auth/sign-out', 'POST', {}).catch(() => undefined);
  await db.$disconnect();
}
