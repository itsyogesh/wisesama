import Fastify, { type FastifyReply, type FastifyRequest } from 'fastify';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../../../middleware/auth.middleware';
import { whitelistRequestRoutes } from '../request.routes';

const mocks = vi.hoisted(() => ({
  sessionUser: null as AuthUser | null,
  storedAccount: null as { email: string; emailVerified: boolean } | null,
  pending: false,
  retired: false,
  authenticate: vi.fn(),
  user: { findUnique: vi.fn() },
  whitelist: { findFirst: vi.fn(), findUnique: vi.fn() },
  requests: { findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
  confirmation: vi.fn(),
  adminAlert: vi.fn(),
}));
vi.mock('@wisesama/database', () => ({
  prisma: {
    user: mocks.user,
    whitelistedEntity: mocks.whitelist,
    whitelistRequest: mocks.requests,
  },
}));
vi.mock('../../../../middleware/auth.middleware', () => ({ authenticate: mocks.authenticate }));
vi.mock('../../../services/email.service', () => ({
  sendWhitelistRequestConfirmation: mocks.confirmation,
  sendAdminNewRequestAlert: mocks.adminAlert,
}));

const OWNER_EMAIL = 'owner@example.test';
const USER: AuthUser = {
  id: 'account-1',
  email: OWNER_EMAIL,
  role: 'USER',
  tier: 'free',
  remainingQuota: 100,
};
const DETAILS = {
  id: 'request-1',
  name: 'Community',
  entityType: 'DOMAIN',
  value: 'example.test',
  category: 'project',
  status: 'REJECTED',
  requesterEmail: OWNER_EMAIL,
  rejectionReason: 'Private review notes',
  createdAt: new Date('2026-01-01'),
  reviewedAt: new Date('2026-01-02'),
  whitelistedEntity: { id: 'entry-1', name: 'Retired project', isActive: false },
};
const SUBMISSION = {
  entityType: 'DOMAIN',
  value: 'example.test',
  name: 'Community',
  category: 'project',
  requesterEmail: 'new-requester@example.test',
};
const apps: ReturnType<typeof Fastify>[] = [];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.sessionUser = null;
  mocks.storedAccount = { email: OWNER_EMAIL, emailVerified: true };
  mocks.pending = false;
  mocks.retired = false;
  mocks.authenticate.mockImplementation(async (request: FastifyRequest, reply: FastifyReply) => {
    if (!mocks.sessionUser) return reply.status(401).send({ error: 'Authentication required' });
    request.user = mocks.sessionUser;
  });
  mocks.user.findUnique.mockImplementation(async () => mocks.storedAccount);
  mocks.whitelist.findFirst.mockResolvedValue(null);
  mocks.whitelist.findUnique.mockImplementation(async () =>
    mocks.retired ? { name: 'Retired project', isActive: false } : null,
  );
  mocks.requests.findUnique.mockResolvedValue(DETAILS);
  mocks.requests.findFirst.mockImplementation(
    async ({ where }: { where: { id?: string; requesterEmail?: { equals: string } } }) => {
      if (where.id) {
        return where.id === DETAILS.id && where.requesterEmail?.equals.toLowerCase() === OWNER_EMAIL
          ? DETAILS
          : null;
      }
      return mocks.pending ? { id: 'another-requester-pending-id' } : null;
    },
  );
  mocks.requests.create.mockResolvedValue({ id: 'new-request', status: 'PENDING' });
  mocks.confirmation.mockResolvedValue({ success: true });
  mocks.adminAlert.mockResolvedValue({ success: true });
});

afterEach(async () => {
  await Promise.all(apps.splice(0).map((app) => app.close()));
});

async function setup() {
  const app = Fastify();
  apps.push(app);
  await app.register(whitelistRequestRoutes);
  return app;
}

describe('whitelist request privacy', () => {
  it('requires sign-in even when a caller supplies the matching email', async () => {
    const app = await setup();
    const response = await app.inject({
      method: 'GET',
      url: `/whitelist/requests/request-1/status?email=${OWNER_EMAIL}`,
    });
    expect(response.statusCode).toBe(401);
    expect(mocks.user.findUnique).not.toHaveBeenCalled();
    expect(mocks.requests.findFirst).not.toHaveBeenCalled();
    expect(mocks.requests.findUnique).not.toHaveBeenCalled();
    expect(response.body).not.toContain('Private review notes');
  });

  it.each([false, null])('requires live stored email verification (%s)', async (verified) => {
    mocks.sessionUser = USER;
    mocks.storedAccount =
      verified === null ? null : { email: OWNER_EMAIL, emailVerified: verified };
    const app = await setup();
    const response = await app.inject({
      method: 'GET',
      url: `/whitelist/requests/request-1/status?email=${OWNER_EMAIL}`,
    });
    expect(response.statusCode).toBe(403);
    expect(mocks.requests.findFirst).not.toHaveBeenCalled();
    expect(mocks.requests.findUnique).not.toHaveBeenCalled();
  });

  it('uses the stored account email rather than a stale session email or query value', async () => {
    mocks.sessionUser = USER;
    mocks.storedAccount = { email: 'different-owner@example.test', emailVerified: true };
    const app = await setup();
    const response = await app.inject({
      method: 'GET',
      url: `/whitelist/requests/request-1/status?email=${OWNER_EMAIL}`,
    });
    expect(response.statusCode).toBe(404);
    expect(mocks.requests.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'request-1',
          requesterEmail: { equals: 'different-owner@example.test', mode: 'insensitive' },
        },
      }),
    );
    expect(response.body).not.toContain('Private review notes');
    expect(response.body).not.toContain('Community');
  });

  it('returns private status only to the verified owner, without a caller email', async () => {
    mocks.sessionUser = { ...USER, email: 'stale-session@example.test' };
    mocks.storedAccount = { email: 'Owner@Example.test', emailVerified: true };
    const app = await setup();
    const response = await app.inject({
      method: 'GET',
      url: '/whitelist/requests/request-1/status',
    });
    expect(response.statusCode).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(mocks.user.findUnique).toHaveBeenCalledWith({
      where: { id: USER.id },
      select: { email: true, emailVerified: true },
    });
    expect(response.json().timeline.at(-1).description).toBe('Private review notes');
    expect(response.json().whitelistedEntity).toBeNull();
    expect(response.body).not.toContain('Retired project');
  });

  it('accepts the old optional email parameter without using it as authority', async () => {
    mocks.sessionUser = USER;
    const app = await setup();
    const response = await app.inject({
      method: 'GET',
      url: '/whitelist/requests/request-1/status?email=unrelated@example.test',
    });
    expect(response.statusCode).toBe(200);
  });

  it("does not return someone else's pending request ID on a public duplicate", async () => {
    mocks.pending = true;
    const app = await setup();
    const response = await app.inject({
      method: 'POST',
      url: '/whitelist/requests',
      payload: SUBMISSION,
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: 'A request for this entity is already pending review',
    });
    expect(response.body).not.toContain('another-requester-pending-id');
    expect(mocks.requests.create).not.toHaveBeenCalled();
    expect(mocks.confirmation).not.toHaveBeenCalled();
  });

  it('keeps public submission available without disclosing an inactive retained name', async () => {
    mocks.retired = true;
    const app = await setup();
    const response = await app.inject({
      method: 'POST',
      url: '/whitelist/requests',
      payload: SUBMISSION,
    });
    expect(response.statusCode).toBe(201);
    expect(response.json().id).toBe('new-request');
    expect(response.body).not.toContain('Retired project');
    expect(mocks.whitelist.findFirst).toHaveBeenCalledWith({
      where: { entityType: 'DOMAIN', normalizedValue: 'example.test', isActive: true },
      select: { name: true },
    });
  });
});
