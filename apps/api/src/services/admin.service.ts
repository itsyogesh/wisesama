import { type Prisma, type PrismaClient, prisma } from '@wisesama/database';

export class IntelAdminError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'IntelAdminError';
  }
}
export type AdminListQuery = { q?: string; cursor?: string; limit?: number };
const userSelect = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  intelAdmin: true,
  intelSuspendedAt: true,
  intelSuspensionReason: true,
  intelRevision: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { securityProjects: true, repositoryConnections: true } },
} as const;
type UserRecord = Prisma.UserGetPayload<{ select: typeof userSelect }>;
type AdvisoryRecord = Prisma.SecurityAdvisoryGetPayload<{ include: { adminReview: true } }>;
type SubscriberRecord = Prisma.PublicSubscriberGetPayload<Record<string, never>>;
const iso = (value: Date | null) => value?.toISOString() ?? null;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const adminSafeError = (value: string | null) =>
  value
    ?.replace(/https?:\/\/\S+/gi, '[redacted URL]')
    .replace(/\bBearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/(?:bearer|token|secret|password|api[_-]?key)\s*[:=]\s*\S+/gi, '[redacted credential]')
    .slice(0, 800) ?? null;
const userDto = (user: UserRecord) => ({
  id: user.id,
  email: user.email,
  name: user.name,
  emailVerified: user.emailVerified,
  intelAdmin: user.intelAdmin,
  status: user.intelSuspendedAt ? 'suspended' : 'active',
  suspendedAt: iso(user.intelSuspendedAt),
  suspensionReason: user.intelSuspensionReason,
  revision: user.intelRevision,
  createdAt: user.createdAt.toISOString(),
  updatedAt: user.updatedAt.toISOString(),
  projectCount: user._count.securityProjects,
  connectionCount: user._count.repositoryConnections,
});
const advisoryDto = (record: AdvisoryRecord) => ({
  id: record.id,
  aliases: record.aliases,
  data: record.data,
  fetchedAt: record.fetchedAt.toISOString(),
  review: {
    visibility: record.adminReview?.visibility ?? 'published',
    guidance: record.adminReview?.guidance ?? '',
    note: record.adminReview?.note ?? '',
    revision: record.adminReview?.revision ?? 0,
    reviewedAt: iso(record.adminReview?.reviewedAt ?? null),
  },
});
const subscriberDto = (record: SubscriberRecord) => ({
  id: record.id,
  email: record.email,
  status: record.status,
  topics: Array.isArray(record.topics)
    ? record.topics.filter((value): value is string => typeof value === 'string')
    : [],
  confirmedAt: iso(record.confirmedAt),
  nextDigestAt: iso(record.nextDigestAt),
  createdAt: record.createdAt.toISOString(),
  updatedAt: record.updatedAt.toISOString(),
  revision: record.adminRevision,
});
const deliveryDto = (value: {
  id: string;
  subject: string;
  status: string;
  error: string | null;
  attempts: number;
  createdAt: Date;
  sentAt: Date | null;
}) => ({
  id: value.id,
  subject: value.subject,
  status: value.status,
  error: adminSafeError(value.error),
  attempts: value.attempts,
  createdAt: value.createdAt.toISOString(),
  sentAt: iso(value.sentAt),
});
const deliverySelect = {
  id: true,
  subject: true,
  status: true,
  error: true,
  attempts: true,
  createdAt: true,
  sentAt: true,
} as const;

function pagination(query: AdminListQuery, field: 'createdAt' | 'fetchedAt' = 'createdAt') {
  const limit = Math.min(50, Math.max(1, query.limit ?? 20));
  if (!query.cursor) return { limit, boundary: {} };
  try {
    const parsed = JSON.parse(Buffer.from(query.cursor, 'base64url').toString('utf8')) as {
      id: unknown;
      at: unknown;
    };
    if (
      typeof parsed.id !== 'string' ||
      !/^[a-zA-Z0-9._:-]{1,200}$/.test(parsed.id) ||
      typeof parsed.at !== 'string'
    )
      throw new Error('Cursor');
    const at = new Date(parsed.at);
    if (!Number.isFinite(at.getTime())) throw new Error('Cursor');
    return {
      limit,
      boundary: { OR: [{ [field]: { lt: at } }, { [field]: at, id: { lt: parsed.id } }] },
    };
  } catch {
    throw new IntelAdminError(400, 'The page cursor is invalid. Start from the first page.');
  }
}
function page<T extends { id: string }>(rows: T[], limit: number, date: (value: T) => Date) {
  const items = rows.slice(0, limit);
  const last = items.at(-1);
  return {
    items,
    nextCursor:
      rows.length > limit && last
        ? Buffer.from(JSON.stringify({ id: last.id, at: date(last).toISOString() })).toString(
            'base64url',
          )
        : null,
  };
}

function validateMutation(input: { expectedRevision: number; reason: string }) {
  if (
    !Number.isSafeInteger(input.expectedRevision) ||
    input.expectedRevision < 0 ||
    typeof input.reason !== 'string' ||
    input.reason.trim().length < 10 ||
    input.reason.length > 1000
  )
    throw new IntelAdminError(400, 'Add a reason and a valid record revision before saving.');
}

export function createIntelAdminService(options: { db?: PrismaClient; now?: () => Date } = {}) {
  const db = options.db ?? prisma;
  const now = options.now ?? (() => new Date());
  async function actor(tx: Prisma.TransactionClient, actorId: string) {
    const current = await tx.user.findFirst({
      where: { id: actorId, intelAdmin: true, intelSuspendedAt: null },
      select: { id: true },
    });
    if (!current) throw new IntelAdminError(403, 'Wisesama administrator access is required.');
  }
  async function audit(query: AdminListQuery & { targetType?: string; targetId?: string } = {}) {
    const { limit, boundary } = pagination(query);
    const rows = await db.intelAdminAudit.findMany({
      where: {
        AND: [
          boundary,
          ...(query.targetType ? [{ targetType: query.targetType }] : []),
          ...(query.targetId ? [{ targetId: query.targetId }] : []),
        ],
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
    });
    const result = page(rows, limit, (value) => value.createdAt);
    return {
      items: result.items.map((value) => ({ ...value, createdAt: value.createdAt.toISOString() })),
      nextCursor: result.nextCursor,
    };
  }
  async function overview() {
    const [
      users,
      suspended,
      advisories,
      hidden,
      active,
      pending,
      suppressed,
      unsubscribed,
      recentAudit,
    ] = await Promise.all([
      db.user.count(),
      db.user.count({ where: { intelSuspendedAt: { not: null } } }),
      db.securityAdvisory.count(),
      db.intelAdvisoryReview.count({ where: { visibility: 'hidden' } }),
      db.publicSubscriber.count({ where: { status: 'active' } }),
      db.publicSubscriber.count({ where: { status: 'pending' } }),
      db.publicSubscriber.count({ where: { status: 'suppressed' } }),
      db.publicSubscriber.count({ where: { status: 'unsubscribed' } }),
      audit({ limit: 8 }),
    ]);
    return {
      users: { total: users, suspended },
      advisories: { total: advisories, hidden },
      subscriptions: { active, pending, suppressed, unsubscribed },
      recentAudit: recentAudit.items,
    };
  }
  async function users(query: AdminListQuery & { status?: 'active' | 'suspended' } = {}) {
    const { limit, boundary } = pagination(query);
    const where: Prisma.UserWhereInput = {
      AND: [
        boundary,
        ...(query.q
          ? [
              {
                OR: [
                  { email: { contains: query.q, mode: 'insensitive' as const } },
                  { name: { contains: query.q, mode: 'insensitive' as const } },
                  { id: query.q },
                ],
              },
            ]
          : []),
        ...(query.status
          ? [{ intelSuspendedAt: query.status === 'active' ? null : { not: null } }]
          : []),
      ],
    };
    const result = page(
      await db.user.findMany({
        where,
        select: userSelect,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      limit,
      (value) => value.createdAt,
    );
    return { items: result.items.map(userDto), nextCursor: result.nextCursor };
  }
  async function user(id: string) {
    const value = await db.user.findUnique({ where: { id }, select: userSelect });
    if (!value) throw new IntelAdminError(404, 'User not found.');
    const [projects, deliveries, history] = await Promise.all([
      db.securityProject.findMany({
        where: { userId: id },
        select: { id: true, name: true, environment: true, lastScannedAt: true, scanError: true },
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      db.securityDelivery.findMany({
        where: { userId: id },
        select: deliverySelect,
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      audit({ targetType: 'user', targetId: id, limit: 20 }),
    ]);
    return {
      user: userDto(value),
      projects: projects.map((project) => ({
        ...project,
        lastScannedAt: iso(project.lastScannedAt),
        scanError: adminSafeError(project.scanError),
      })),
      deliveries: deliveries.map(deliveryDto),
      audit: history.items,
    };
  }
  async function access(
    actorId: string,
    id: string,
    input: { suspended: boolean; expectedRevision: number; reason: string },
  ) {
    validateMutation(input);
    if (typeof input.suspended !== 'boolean')
      throw new IntelAdminError(400, 'Choose an access state.');
    if (actorId === id)
      throw new IntelAdminError(409, 'You cannot change your own administrator access here.');
    await db.$transaction(async (tx) => {
      await actor(tx, actorId);
      const target = await tx.user.findUnique({
        where: { id },
        select: { intelAdmin: true, intelSuspendedAt: true },
      });
      if (!target) throw new IntelAdminError(404, 'User not found.');
      if (target.intelAdmin)
        throw new IntelAdminError(
          409,
          'Administrator access must be managed through the operator bootstrap process.',
        );
      const applied = await tx.user.updateMany({
        where: { id, intelRevision: input.expectedRevision, intelAdmin: false },
        data: {
          intelSuspendedAt: input.suspended ? now() : null,
          intelSuspensionReason: input.suspended ? input.reason : '',
          intelRevision: { increment: 1 },
        },
      });
      if (!applied.count)
        throw new IntelAdminError(409, 'This user changed. Reload their record before saving.');
      if (input.suspended) {
        await tx.projectRepositorySource.updateMany({
          where: { userId: id },
          data: {
            paused: true,
            status: 'access_removed',
            error: 'The repository connector’s Wisesama access is suspended.',
            syncToken: null,
            syncStartedAt: null,
            baselineToken: null,
            baselineStartedAt: null,
          },
        });
      }
      await tx.intelAdminAudit.create({
        data: {
          actorId,
          action: input.suspended ? 'user.suspend' : 'user.resume',
          targetType: 'user',
          targetId: id,
          reason: input.reason,
          metadata: json({
            before: target.intelSuspendedAt ? 'suspended' : 'active',
            after: input.suspended ? 'suspended' : 'active',
            scope: 'wisesama_v2',
          }),
        },
      });
    });
    return user(id);
  }
  async function advisories(query: AdminListQuery & { visibility?: 'published' | 'hidden' } = {}) {
    const { limit, boundary } = pagination(query, 'fetchedAt');
    const where: Prisma.SecurityAdvisoryWhereInput = {
      AND: [
        boundary,
        ...(query.q
          ? [
              {
                OR: [
                  { id: { contains: query.q, mode: 'insensitive' as const } },
                  { aliases: { has: query.q.toUpperCase() } },
                  {
                    data: {
                      path: ['title'],
                      string_contains: query.q,
                      mode: 'insensitive' as const,
                    },
                  },
                ],
              },
            ]
          : []),
        ...(query.visibility
          ? [
              query.visibility === 'hidden'
                ? { adminReview: { is: { visibility: 'hidden' } } }
                : {
                    OR: [
                      { adminReview: { is: null } },
                      { adminReview: { is: { visibility: 'published' } } },
                    ],
                  },
            ]
          : []),
      ],
    };
    const result = page(
      await db.securityAdvisory.findMany({
        where,
        include: { adminReview: true },
        orderBy: [{ fetchedAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      limit,
      (value) => value.fetchedAt,
    );
    return { items: result.items.map(advisoryDto), nextCursor: result.nextCursor };
  }
  async function advisory(id: string) {
    const value = await db.securityAdvisory.findUnique({
      where: { id },
      include: { adminReview: true },
    });
    if (!value) throw new IntelAdminError(404, 'Advisory not found.');
    return {
      advisory: advisoryDto(value),
      audit: (await audit({ targetType: 'advisory', targetId: id, limit: 20 })).items,
    };
  }
  async function review(
    actorId: string,
    id: string,
    input: {
      expectedRevision: number;
      visibility: 'published' | 'hidden';
      guidance: string;
      note: string;
      reason: string;
    },
  ) {
    validateMutation(input);
    if (
      !['published', 'hidden'].includes(input.visibility) ||
      typeof input.guidance !== 'string' ||
      input.guidance.length > 4000 ||
      typeof input.note !== 'string' ||
      input.note.length > 4000
    )
      throw new IntelAdminError(400, 'Check the advisory review fields.');
    await db.$transaction(async (tx) => {
      await actor(tx, actorId);
      if (!(await tx.securityAdvisory.findUnique({ where: { id }, select: { id: true } })))
        throw new IntelAdminError(404, 'Advisory not found.');
      await tx.intelAdvisoryReview.upsert({
        where: { advisoryId: id },
        create: { advisoryId: id },
        update: {},
      });
      const previous = await tx.intelAdvisoryReview.findUnique({ where: { advisoryId: id } });
      const applied = await tx.intelAdvisoryReview.updateMany({
        where: { advisoryId: id, revision: input.expectedRevision },
        data: {
          visibility: input.visibility,
          guidance: input.guidance,
          note: input.note,
          revision: { increment: 1 },
          reviewedAt: now(),
          reviewedById: actorId,
        },
      });
      if (!applied.count)
        throw new IntelAdminError(409, 'This advisory review changed. Reload it before saving.');
      await tx.intelAdminAudit.create({
        data: {
          actorId,
          action: 'advisory.review',
          targetType: 'advisory',
          targetId: id,
          reason: input.reason,
          metadata: json({
            before: {
              visibility: previous?.visibility ?? 'published',
              revision: input.expectedRevision,
            },
            after: { visibility: input.visibility, revision: input.expectedRevision + 1 },
            guidanceChanged: previous?.guidance !== input.guidance,
            noteChanged: previous?.note !== input.note,
          }),
        },
      });
    });
    return advisory(id);
  }
  async function subscriptions(query: AdminListQuery & { status?: string } = {}) {
    const { limit, boundary } = pagination(query);
    const result = page(
      await db.publicSubscriber.findMany({
        where: {
          AND: [
            boundary,
            ...(query.q ? [{ email: { contains: query.q, mode: 'insensitive' as const } }] : []),
            ...(query.status ? [{ status: query.status }] : []),
          ],
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: limit + 1,
      }),
      limit,
      (value) => value.createdAt,
    );
    return { items: result.items.map(subscriberDto), nextCursor: result.nextCursor };
  }
  async function subscription(id: string) {
    const value = await db.publicSubscriber.findUnique({ where: { id } });
    if (!value) throw new IntelAdminError(404, 'Subscription not found.');
    const [deliveries, receipts, history] = await Promise.all([
      db.publicFeedDelivery.findMany({
        where: { subscriberId: id },
        select: deliverySelect,
        orderBy: { createdAt: 'desc' },
        take: 25,
      }),
      db.publicMailReceipt.findMany({
        where: { subscriberId: id },
        select: { id: true },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      audit({ targetType: 'subscription', targetId: id, limit: 20 }),
    ]);
    const feedback = receipts.length
      ? await db.publicMailWebhook.findMany({
          where: { providerMessageId: { in: receipts.map((receipt) => receipt.id) } },
          select: {
            id: true,
            type: true,
            status: true,
            attempts: true,
            processedAt: true,
            lastError: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 25,
        })
      : [];
    return {
      subscriber: subscriberDto(value),
      deliveries: deliveries.map(deliveryDto),
      feedback: feedback.map((event) => ({
        ...event,
        processedAt: iso(event.processedAt),
        lastError: adminSafeError(event.lastError),
      })),
      audit: history.items,
    };
  }
  async function subscriptionStatus(
    actorId: string,
    id: string,
    input: { status: 'unsubscribed' | 'suppressed'; expectedRevision: number; reason: string },
  ) {
    validateMutation(input);
    if (!['unsubscribed', 'suppressed'].includes(input.status))
      throw new IntelAdminError(400, 'Subscription controls may only stop delivery.');
    await db.$transaction(async (tx) => {
      await actor(tx, actorId);
      const previous = await tx.publicSubscriber.findUnique({
        where: { id },
        select: { status: true },
      });
      if (!previous) throw new IntelAdminError(404, 'Subscription not found.');
      if (previous.status === 'suppressed' && input.status !== 'suppressed')
        throw new IntelAdminError(
          409,
          'A suppressed address cannot be reactivated or unsuppressed from this admin.',
        );
      const applied = await tx.publicSubscriber.updateMany({
        where: { id, adminRevision: input.expectedRevision, status: previous.status },
        data: {
          status: input.status,
          adminRevision: { increment: 1 },
          unsubscribeVersion: { increment: 1 },
          nextDigestAt: null,
        },
      });
      if (!applied.count)
        throw new IntelAdminError(409, 'This subscription changed. Reload it before saving.');
      await tx.publicSubscriptionToken.deleteMany({ where: { subscriberId: id } });
      await tx.publicFeedDelivery.updateMany({
        where: { subscriberId: id, status: { in: ['pending', 'failed', 'unavailable'] } },
        data: { status: 'skipped', error: 'An administrator stopped this subscription.' },
      });
      await tx.intelAdminAudit.create({
        data: {
          actorId,
          action: `subscription.${input.status}`,
          targetType: 'subscription',
          targetId: id,
          reason: input.reason,
          metadata: json({ before: previous.status, after: input.status, consentOverride: false }),
        },
      });
    });
    return subscription(id);
  }
  return {
    overview,
    users,
    user,
    access,
    advisories,
    advisory,
    review,
    subscriptions,
    subscription,
    subscriptionStatus,
    audit,
  };
}
export const intelAdminService = createIntelAdminService();
