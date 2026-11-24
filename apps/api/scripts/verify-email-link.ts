/** Real Prisma/auth regression in the guarded disposable database; all mail is synthetic. */
import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { assertCiPreviewDatabase } from './ci-preview-provider';

process.env.DATABASE_URL = assertCiPreviewDatabase();
process.env.BETTER_AUTH_SECRET = randomBytes(32).toString('hex');
process.env.BETTER_AUTH_URL = 'http://localhost:3001';
process.env.INTEL_APP_URL = 'http://localhost:3003';
process.env.BREVO_API_KEY = 'synthetic-local-verification-only';
process.env.BREVO_SENDER_EMAIL = 'synthetic@example.invalid';
const run = randomUUID();
const email = `email-link-${run}@example.invalid`;
const { prisma: db } = await import('@wisesama/database');
const { auth } = await import('../src/lib/auth');
const originalFetch = globalThis.fetch;
let landing = '';
globalThis.fetch = async (input, init) => {
  const url = String(input);
  assert.equal(url, 'https://api.brevo.com/v3/smtp/email', 'No real outbound request is allowed.');
  const body = JSON.parse(String(init?.body));
  assert.equal(body.to[0].email, email);
  assert.equal(body.subject, 'Your Wisesama sign-in link');
  const match = body.textContent.match(
    /Continue to Wisesama: (http:\/\/localhost:3003\/sign-in\/verify#[^\s]+)/,
  );
  assert.ok(match);
  landing = match[1];
  return Response.json({ messageId: 'synthetic-local-receipt' });
};
let verificationIdentifier = '';
try {
  const before = await db.user.count();
  const start = await auth.handler(
    new Request('http://localhost:3001/api/auth/sign-in/magic-link', {
      method: 'POST',
      headers: { Origin: 'http://localhost:3003', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email,
        name: 'Synthetic email sign-in',
        callbackURL: 'http://localhost:3003/app/settings/integrations',
        errorCallbackURL: 'http://localhost:3003/sign-in',
      }),
    }),
  );
  assert.equal(start.status, 200);
  assert.ok(landing);
  assert.equal(await db.user.count(), before, 'Preparing a link must not create an account.');
  const params = new URLSearchParams(new URL(landing).hash.slice(1));
  const pending = await db.verification.findFirstOrThrow({ where: { value: { contains: email } } });
  verificationIdentifier = pending.identifier;
  assert.ok(!pending.identifier.includes(params.get('token')!));
  const verify = new URL('http://localhost:3001/api/auth/magic-link/verify');
  verify.search = params.toString();
  const responses = await Promise.all([
    auth.handler(new Request(verify)),
    auth.handler(new Request(verify)),
  ]);
  const accepted = responses.filter(
    (response) =>
      response.headers.get('location') === 'http://localhost:3003/app/settings/integrations',
  );
  assert.equal(accepted.length, 1, 'A concurrent second redemption must fail.');
  const user = await db.user.findUniqueOrThrow({ where: { email } });
  assert.equal(user.emailVerified, true);
  assert.equal(await db.session.count({ where: { userId: user.id } }), 1);
  const cookie = accepted[0]!.headers
    .getSetCookie()
    .map((value) => value.split(';')[0])
    .join('; ');
  assert.ok(cookie.includes('session_token'));
  const session = await auth.handler(
    new Request('http://localhost:3001/api/auth/get-session', { headers: { Cookie: cookie } }),
  );
  assert.equal(session.status, 200);
  assert.equal((await session.json()).user.email, email);
  const replay = await auth.handler(new Request(verify));
  assert.match(replay.headers.get('location') || '', /INVALID_TOKEN/);
  console.log(
    'PASS: requested email → unconsumed fragment link → explicit confirmation → one verified fresh account and issued session. Concurrent redemption/replay rejected. Real Prisma storage; no network email or production records used.',
  );
} finally {
  globalThis.fetch = originalFetch;
  await db.user.deleteMany({ where: { email } });
  if (verificationIdentifier)
    await db.verification.deleteMany({ where: { identifier: verificationIdentifier } });
  await db.$disconnect();
}
