import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { type Prisma, type PrismaClient, prisma } from '@wisesama/database';
import { Resend } from 'resend';
import { z } from 'zod';
import type { IntelAdvisory } from './intel/index';
import { intelWorkspaceService } from './intel-workspace.service';
import { createPublicAdvisoryPolicy } from './public-advisory-policy';

export type PublicTopic = 'all' | 'npm' | 'PyPI' | 'known_exploited';
type Mail = {
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
  headers?: Record<string, string>;
};
type MailResult =
  | { status: 'sent'; messageId: string }
  | { status: 'failed' | 'unavailable'; error: string };
type Subscriber = Prisma.PublicSubscriberGetPayload<Record<string, never>>;
type Digest = { advisories: IntelAdvisory[]; omitted: number };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const NEUTRAL = {
  accepted: true,
  message:
    'If this address can receive updates, a link will arrive shortly. Check your inbox and spam folder.',
} as const;
const INVALID_LINK = 'This link has expired or is no longer available. Request a new email link.';
const MINUTE = 60_000;

export class PublicSubscriptionError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'PublicSubscriptionError';
  }
}

/** A collection timestamp, EPSS fluctuation or reference ordering alone is not a new edition. */
export function publicAdvisoryFingerprint(advisory: IntelAdvisory) {
  return hash(
    JSON.stringify({
      id: advisory.id,
      aliases: [...advisory.aliases].sort(),
      title: advisory.title,
      summary: advisory.summary,
      severity: advisory.severity,
      exploited: advisory.exploited,
      affected: [...advisory.affected]
        .map((item) => ({ ...item, ranges: [...(item.ranges ?? [])].sort() }))
        .sort((a, b) => `${a.ecosystem}:${a.name}`.localeCompare(`${b.ecosystem}:${b.name}`)),
      references: advisory.references.map((item) => item.url).sort(),
      ...(advisory.editorial?.guidance ? { guidance: advisory.editorial.guidance } : {}),
    }),
  );
}

export function matchesPublicTopics(advisory: IntelAdvisory, topics: PublicTopic[]) {
  return (
    topics.includes('all') ||
    (topics.includes('known_exploited') && advisory.exploited) ||
    advisory.affected.some((item) => topics.includes(item.ecosystem as PublicTopic))
  );
}

export function nextPublicDigest(now: Date) {
  const next = new Date(now);
  next.setUTCHours(9, 0, 0, 0);
  if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
  return next;
}

export async function sendPublicEmail(message: Mail): Promise<MailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { status: 'unavailable', error: 'Email delivery is not configured.' };
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': message.idempotencyKey,
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || 'Wisesama <noreply@wisesama.com>',
        to: [message.to],
        subject: message.subject,
        text: message.text,
        headers: message.headers,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok)
      return {
        status: 'failed',
        error: `Email provider rejected delivery (HTTP ${response.status}).`,
      };
    const data = (await response.json()) as { id?: unknown };
    return typeof data.id === 'string' && data.id
      ? { status: 'sent', messageId: data.id }
      : { status: 'failed', error: 'Email provider did not confirm acceptance.' };
  } catch {
    return { status: 'failed', error: 'Email provider could not be reached.' };
  }
}

/** Public consent is deliberately independent of account sessions and private project alerts. */
export class PublicSubscriptionService {
  constructor(
    private readonly db: PrismaClient = prisma,
    private readonly options: {
      now?: () => Date;
      send?: (mail: Mail) => Promise<MailResult>;
      available?: () => boolean;
      secret?: () => string | undefined;
      appUrl?: () => string;
      apiUrl?: () => string;
      getBriefings?: typeof intelWorkspaceService.getBriefings;
    } = {},
  ) {}

  private now() {
    return this.options.now?.() ?? new Date();
  }
  private secret() {
    return this.options.secret?.() ?? process.env.PUBLIC_SUBSCRIPTION_SECRET;
  }
  private appUrl() {
    return (
      this.options.appUrl?.() ??
      process.env.INTEL_APP_URL ??
      'http://localhost:3003'
    ).replace(/\/$/, '');
  }
  private apiUrl() {
    return (this.options.apiUrl?.() ?? process.env.API_URL ?? 'http://localhost:3001').replace(
      /\/$/,
      '',
    );
  }
  capabilities() {
    return {
      emailAvailable: Boolean(
        this.secret() &&
          this.secret()!.length >= 32 &&
          (this.options.available?.() ??
            Boolean(
              process.env.RESEND_API_KEY &&
                process.env.RESEND_FROM_EMAIL &&
                process.env.RESEND_WEBHOOK_SECRET &&
                process.env.INTEL_APP_URL &&
                process.env.API_URL,
            )),
      ),
      cadence: 'daily' as const,
      sendHourUtc: 9,
    };
  }

  private async token(
    db: Pick<PrismaClient, 'publicSubscriptionToken'>,
    subscriberId: string,
    purpose: 'confirm' | 'manage',
    topics?: PublicTopic[],
  ) {
    const value = randomBytes(32).toString('base64url');
    await db.publicSubscriptionToken.create({
      data: {
        subscriberId,
        tokenHash: hash(value),
        purpose,
        ...(topics ? { topics: json(topics) } : {}),
        expiresAt: new Date(
          this.now().getTime() + (purpose === 'confirm' ? 60 * MINUTE : 30 * 24 * 60 * MINUTE),
        ),
      },
    });
    return value;
  }

  async request(
    email: string,
    topics: PublicTopic[] = ['all'],
    purpose: 'confirm' | 'manage' = 'confirm',
  ) {
    if (!this.capabilities().emailAvailable)
      throw new PublicSubscriptionError(
        503,
        'Email subscriptions are not configured yet. You can use RSS in the meantime.',
      );
    try {
      const normalized = email.trim().toLowerCase();
      const now = this.now();
      const existing = await this.db.publicSubscriber.findUnique({ where: { email: normalized } });
      if (purpose === 'manage' && !existing) return NEUTRAL;
      if (existing?.status === 'suppressed') return NEUTRAL;
      if (existing && now.getTime() - existing.lastRequestAt.getTime() < 5 * MINUTE) return NEUTRAL;
      const subscriber =
        existing ??
        (await this.db.publicSubscriber.upsert({
          where: { email: normalized },
          create: { email: normalized, lastRequestAt: new Date(0) },
          update: {},
        }));
      const claim = await this.db.publicSubscriber.updateMany({
        where: { id: subscriber.id, lastRequestAt: { lt: new Date(now.getTime() - 5 * MINUTE) } },
        data: { lastRequestAt: now },
      });
      if (!claim.count) return NEUTRAL;
      let token: string | undefined;
      let response: Promise<MailResult> | undefined;
      let result: MailResult;
      try {
        const dispatch = await this.db.$transaction(async (tx) => {
          // Suppression and request mail share this row lock. A completed stop
          // must prevent a later transport start, including confirmation mail.
          const allowed = await tx.publicSubscriber.updateMany({
            where: { id: subscriber.id, status: { not: 'suppressed' } },
            data: { updatedAt: this.now() },
          });
          if (!allowed.count) return null;
          const current = await tx.publicSubscriber.findUnique({ where: { id: subscriber.id } });
          if (!current || current.status === 'suppressed') return null;
          // Current active subscribers receive management, never a new confirmation.
          const actualPurpose = current.status === 'active' ? 'manage' : purpose;
          token = await this.token(
            tx,
            current.id,
            actualPurpose,
            actualPurpose === 'confirm' ? topics : undefined,
          );
          const link = `${this.appUrl()}/subscribe/${actualPurpose === 'confirm' ? 'confirm' : 'manage'}#token=${token}`;
          try {
            response = (this.options.send ?? sendPublicEmail)({
              to: current.email,
              subject:
                actualPurpose === 'confirm'
                  ? 'Confirm your Wisesama feed subscription'
                  : 'Manage your Wisesama feed subscription',
              text:
                actualPurpose === 'confirm'
                  ? `Confirm your request for the Wisesama daily security digest (09:00 UTC). No account is required.\n\n${link}\n\nOpen this link and choose Confirm subscription. The link expires in one hour. No updates will be sent before confirmation. If you did not request this, ignore this email.`
                  : `Manage your public Wisesama feed subscription:\n\n${link}\n\nThis protected link expires in 30 days. Opening it does not change your subscription. If you did not request this email, you can ignore it.`,
              idempotencyKey: `public-${actualPurpose}-${hash(token)}`,
            }).catch(() => ({ status: 'failed', error: 'Email provider could not be reached.' }));
          } catch {
            response = Promise.resolve({
              status: 'failed',
              error: 'Email provider could not be reached.',
            });
          }
          // Never hold the database lock while awaiting the provider response.
          return { response };
        });
        if (!dispatch) return NEUTRAL;
        result = await dispatch.response;
      } catch {
        // The provider may already have accepted mail when a commit fails.
        if (!response) throw new Error('Email request could not be prepared.');
        result = await response;
      }
      if (result.status !== 'sent') {
        console.warn('[PublicSubscriptions] Email request delivery was not accepted.');
        try {
          if (token)
            await this.db.publicSubscriptionToken.updateMany({
              where: { tokenHash: hash(token), consumedAt: null },
              data: { consumedAt: now },
            });
        } catch {
          console.warn('[PublicSubscriptions] Failed email request link could not be invalidated.');
        }
        return NEUTRAL;
      }
      await this.db.publicMailReceipt.upsert({
        where: { id: result.messageId },
        create: { id: result.messageId, subscriberId: subscriber.id },
        update: {},
      });
      await this.reconcileMailFeedback(25, result.messageId);
    } catch {
      // Configured requests must not reveal which addresses reached a database or provider operation.
      // Keep the request cooldown claimed, including when delivery or receipt persistence fails.
      console.warn('[PublicSubscriptions] Email request could not complete.');
    }
    return NEUTRAL;
  }

  async confirm(value: string) {
    const now = this.now();
    return this.db.$transaction(async (tx) => {
      const token = await tx.publicSubscriptionToken.findUnique({
        where: { tokenHash: hash(value) },
        include: { subscriber: true },
      });
      if (
        !token ||
        token.purpose !== 'confirm' ||
        token.consumedAt ||
        token.expiresAt <= now ||
        token.subscriber.status === 'suppressed'
      )
        throw new PublicSubscriptionError(400, INVALID_LINK);
      const claim = await tx.publicSubscriptionToken.updateMany({
        where: { id: token.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (!claim.count) throw new PublicSubscriptionError(400, INVALID_LINK);
      const activated = await tx.publicSubscriber.updateMany({
        where: { id: token.subscriberId, status: { not: 'suppressed' } },
        data: {
          status: 'active',
          adminRevision: { increment: 1 },
          topics: token.topics ?? json(['all']),
          confirmedAt: now,
          nextDigestAt: nextPublicDigest(now),
          lastCompiledAt: now,
        },
      });
      if (!activated.count) throw new PublicSubscriptionError(400, INVALID_LINK);
      const subscriber = await tx.publicSubscriber.findUniqueOrThrow({
        where: { id: token.subscriberId },
      });
      return this.preferences(subscriber);
    });
  }

  private preferences(subscriber: Subscriber) {
    return {
      status: subscriber.status,
      topics: subscriber.topics as PublicTopic[],
      cadence: 'daily' as const,
      sendHourUtc: 9,
    };
  }

  private async management(value: string) {
    const token = await this.db.publicSubscriptionToken.findUnique({
      where: { tokenHash: hash(value) },
      include: { subscriber: true },
    });
    if (!token || token.purpose !== 'manage' || token.consumedAt || token.expiresAt <= this.now())
      throw new PublicSubscriptionError(400, INVALID_LINK);
    return token.subscriber;
  }

  async readPreferences(value: string) {
    return this.preferences(await this.management(value));
  }

  async updatePreferences(value: string, topics: PublicTopic[]) {
    const subscriber = await this.management(value);
    if (subscriber.status !== 'active')
      throw new PublicSubscriptionError(400, 'Confirm a new subscription before enabling updates.');
    const changed = await this.db.publicSubscriber.updateMany({
      where: { id: subscriber.id, status: 'active' },
      data: { topics: json(topics), adminRevision: { increment: 1 } },
    });
    if (!changed.count)
      throw new PublicSubscriptionError(400, 'This subscription is no longer active.');
    return this.preferences(
      await this.db.publicSubscriber.findUniqueOrThrow({ where: { id: subscriber.id } }),
    );
  }

  /** Stable unsubscribe-only capability; it cannot read an address or change topics. */
  unsubscribeToken(subscriber: Pick<Subscriber, 'id' | 'unsubscribeVersion'>) {
    const secret = this.secret();
    if (!secret || secret.length < 32)
      throw new PublicSubscriptionError(503, 'Subscription link signing is not configured.');
    const payload = `${subscriber.id}.${subscriber.unsubscribeVersion}`;
    return `${payload}.${createHmac('sha256', secret).update(`unsubscribe:${payload}`).digest('base64url')}`;
  }

  async unsubscribe(value: string) {
    let id: string;
    if (value.includes('.')) {
      const parts = value.split('.');
      if (parts.length !== 3 || !/^[a-zA-Z0-9_-]+$/.test(parts[0] ?? ''))
        throw new PublicSubscriptionError(400, INVALID_LINK);
      const subscriber = await this.db.publicSubscriber.findUnique({ where: { id: parts[0] } });
      if (!subscriber) throw new PublicSubscriptionError(400, INVALID_LINK);
      const expected = this.unsubscribeToken(subscriber);
      if (
        value.length !== expected.length ||
        !timingSafeEqual(Buffer.from(value), Buffer.from(expected))
      )
        throw new PublicSubscriptionError(400, INVALID_LINK);
      id = subscriber.id;
    } else id = (await this.management(value)).id;
    await this.db.$transaction(async (tx) => {
      await tx.publicSubscriber.updateMany({
        where: { id, status: { not: 'suppressed' } },
        data: { status: 'unsubscribed', nextDigestAt: null, adminRevision: { increment: 1 } },
      });
      await tx.publicSubscriptionToken.updateMany({
        where: { subscriberId: id, consumedAt: null },
        data: { consumedAt: this.now() },
      });
      await tx.publicFeedDelivery.updateMany({
        where: { subscriberId: id, status: { in: ['pending', 'failed', 'unavailable'] } },
        data: { status: 'skipped', error: 'Subscription is no longer active.' },
      });
    });
    return { status: 'unsubscribed' as const };
  }

  async recordFeedEvents(advisories: IntelAdvisory[]) {
    for (const advisory of advisories) {
      const fingerprint = publicAdvisoryFingerprint(advisory);
      await this.db.$transaction(async (tx) => {
        const previous = await tx.publicFeedState.findUnique({
          where: { advisoryId: advisory.id },
        });
        if (previous?.fingerprint === fingerprint) return;
        await tx.publicFeedEvent.upsert({
          where: { id: hash(`${advisory.id}:${fingerprint}`) },
          update: {},
          create: {
            id: hash(`${advisory.id}:${fingerprint}`),
            advisoryId: advisory.id,
            fingerprint,
            data: json(advisory),
            createdAt: this.now(),
          },
        });
        await tx.publicFeedState.upsert({
          where: { advisoryId: advisory.id },
          create: { advisoryId: advisory.id, fingerprint },
          update: { fingerprint },
        });
      });
    }
  }

  async runDailyDigest(limit = 25) {
    const now = this.now();
    await this.reconcileMailFeedback(limit);
    const briefings = await (
      this.options.getBriefings ?? intelWorkspaceService.getBriefings.bind(intelWorkspaceService)
    )();
    await this.recordFeedEvents(briefings.advisories);
    const due = await this.db.publicSubscriber.findMany({
      where: { status: 'active', nextDigestAt: { lte: now }, confirmedAt: { not: null } },
      orderBy: { nextDigestAt: 'asc' },
      take: Math.min(limit, 100),
    });
    let compiled = 0;
    for (const subscriber of due) {
      await this.db.$transaction(async (tx) => {
        const claimed = await tx.publicSubscriber.updateMany({
          where: { id: subscriber.id, status: 'active', nextDigestAt: { lte: now } },
          data: { nextDigestAt: nextPublicDigest(now), lastCompiledAt: now },
        });
        if (!claimed.count) return;
        const events = await tx.publicFeedEvent.findMany({
          where: {
            createdAt: { gt: subscriber.lastCompiledAt ?? subscriber.confirmedAt!, lte: now },
          },
          orderBy: { createdAt: 'asc' },
          take: 1000,
        });
        const latest = new Map<string, IntelAdvisory>();
        const hidden = await createPublicAdvisoryPolicy(tx).hiddenIds(
          events.map((event) => event.data as unknown as IntelAdvisory),
        );
        for (const event of events) {
          const advisory = event.data as unknown as IntelAdvisory;
          if (
            !hidden.has(advisory.id) &&
            matchesPublicTopics(advisory, subscriber.topics as PublicTopic[])
          )
            latest.set(advisory.id, advisory);
        }
        const items = [...latest.values()].sort(
          (a, b) => Number(b.exploited) - Number(a.exploited),
        );
        if (!items.length) return;
        const digest: Digest = {
          advisories: items.slice(0, 30),
          omitted: Math.max(items.length - 30, 0),
        };
        await tx.publicFeedDelivery.create({
          data: {
            subscriberId: subscriber.id,
            eventKey: `digest:${subscriber.id}:${now.toISOString().slice(0, 10)}`,
            items: json(digest),
            subject: `Wisesama: ${items.length} security ${items.length === 1 ? 'update' : 'updates'}`,
          },
        });
        compiled++;
      });
    }
    const deliveries = await this.processDeliveries(limit);
    // Retain tokens only as long as they can authorize a request.
    await this.db.publicSubscriptionToken.deleteMany({
      where: { expiresAt: { lt: new Date(now.getTime() - 24 * 60 * MINUTE) } },
    });
    return { compiled, ...deliveries, cadence: 'daily', sendHourUtc: 9 };
  }

  async processDeliveries(limit = 25, targetId?: string) {
    const now = this.now();
    const feedback = await this.reconcileMailFeedback(limit);
    const pending = await this.db.publicFeedDelivery.findMany({
      where: {
        ...(targetId ? { id: targetId } : {}),
        status: { in: ['pending', 'failed', 'unavailable'] },
        nextAttemptAt: { lte: now },
        attempts: { lt: 5 },
        OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - 15 * MINUTE) } }],
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: Math.min(limit, 100),
    });
    let accepted = 0,
      failed = 0,
      unavailable = 0,
      skipped = 0;
    for (const delivery of pending) {
      const claimed = await this.db.publicFeedDelivery.updateMany({
        where: {
          id: delivery.id,
          status: { in: ['pending', 'failed', 'unavailable'] },
          attempts: { equals: delivery.attempts, lt: 5 },
          nextAttemptAt: { lte: now },
          OR: [{ claimedAt: null }, { claimedAt: { lt: new Date(now.getTime() - 15 * MINUTE) } }],
        },
        data: { claimedAt: now, attempts: { increment: 1 } },
      });
      if (!claimed.count) continue;
      // The attempt number fences a worker even if another claim uses the same clock timestamp.
      const lease = {
        id: delivery.id,
        subscriberId: delivery.subscriberId,
        status: { in: ['pending', 'failed', 'unavailable'] },
        claimedAt: now,
        attempts: delivery.attempts + 1,
      };
      let result: MailResult;
      let response: Promise<MailResult> | undefined;
      try {
        const digest = delivery.items as unknown as Digest;
        const hidden = await createPublicAdvisoryPolicy(this.db).hiddenIds(digest.advisories);
        if (hidden.size) {
          skipped++;
          await this.db.publicFeedDelivery.updateMany({
            where: lease,
            data: {
              status: 'skipped',
              claimedAt: null,
              error:
                'This edition contains an advisory hidden before delivery. The original payload is retained without sending.',
            },
          });
          continue;
        }
        // A stable edition payload makes provider idempotency work across retries.
        const manageUrl = `${this.appUrl()}/subscribe/manage`;
        const updates = digest.advisories
          .map(
            (item) =>
              `${item.id} — ${item.title}\nSeverity: ${item.severity}. ${item.exploited ? 'Known exploitation: listed in CISA KEV.' : 'No affirmative KEV evidence in this record; absence is not proof of safety.'}\n${this.appUrl()}/feed/${encodeURIComponent(item.id)}\nSource updated: ${item.modifiedAt}\n`,
          )
          .join('\n');
        const dispatch = await this.db.$transaction(async (tx) => {
          // Every opt-out, admin stop and signed suppression writes this same subscriber row.
          // PostgreSQL holds this update's row lock until this short transaction completes.
          const consent = await tx.publicSubscriber.updateMany({
            where: { id: delivery.subscriberId, status: 'active', confirmedAt: { not: null } },
            data: { updatedAt: this.now() },
          });
          if (!consent.count) return null;
          const subscriber = await tx.publicSubscriber.findUnique({
            where: { id: delivery.subscriberId },
          });
          if (!subscriber || subscriber.status !== 'active' || !subscriber.confirmedAt) return null;
          // Subscriber first, delivery second: use the same row-lock order as the stop paths.
          const current = await tx.publicFeedDelivery.updateMany({
            where: lease,
            data: { claimedAt: now },
          });
          if (!current.count) return null;
          const unsubscribe = this.unsubscribeToken(subscriber);
          const unsubscribeUrl = `${this.apiUrl()}/api/v1/intel/subscriptions/one-click/${unsubscribe}`;
          const humanUnsubscribe = `${this.appUrl()}/subscribe/manage#unsubscribe=${unsubscribe}`;
          // Invoke the transport before releasing the consent lock. Return its promise nested:
          // awaiting the provider response must happen outside the database transaction.
          response = (this.options.send ?? sendPublicEmail)({
            to: subscriber.email,
            subject: delivery.subject,
            text: `Your Wisesama daily security digest\n\n${updates}${digest.omitted ? `\n${digest.omitted} more matching updates are available in the public feed.\n` : ''}\nThese are public advisories, not an assessment of your software or deployment.\n\nManage preferences: ${manageUrl}\nUnsubscribe: ${humanUnsubscribe}\n\nYou receive this because you confirmed a Wisesama public feed subscription.`,
            idempotencyKey: delivery.eventKey,
            headers: {
              'List-Unsubscribe': `<${unsubscribeUrl}>`,
              'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
            },
          }).catch(() => ({
            status: 'unavailable' as const,
            error: 'Subscription email could not be sent.',
          }));
          return { response };
        });
        if (!dispatch) {
          skipped++;
          await this.db.publicFeedDelivery.updateMany({
            where: lease,
            data: {
              status: 'skipped',
              claimedAt: null,
              error: 'Subscription is no longer active.',
            },
          });
          continue;
        }
        result = await dispatch.response;
      } catch {
        // A transaction can fail after transport invocation. Still preserve its eventual receipt.
        result = response
          ? await response
          : { status: 'unavailable', error: 'Subscription email could not be prepared.' };
      }
      if (result.status === 'sent') {
        // Stops can revoke the delivery while its provider response is in flight. Retain independent
        // correlation for signed feedback without changing a skipped delivery back to sent.
        await this.db.publicMailReceipt.upsert({
          where: { id: result.messageId },
          create: { id: result.messageId, subscriberId: delivery.subscriberId },
          update: {},
        });
      }
      await this.db.publicFeedDelivery.updateMany({
        where: lease,
        data: {
          status: result.status,
          claimedAt: null,
          ...(result.status === 'sent'
            ? { providerMessageId: result.messageId, sentAt: now, error: null }
            : {
                error: result.error,
                nextAttemptAt: new Date(
                  now.getTime() + Math.min(24 * 60, 5 * 2 ** delivery.attempts) * MINUTE,
                ),
              }),
        },
      });
      if (result.status === 'sent') {
        await this.reconcileMailFeedback(25, result.messageId);
        accepted++;
      }
      if (result.status === 'failed') failed++;
      if (result.status === 'unavailable') unavailable++;
    }
    return {
      attempted: pending.length,
      accepted,
      failed,
      unavailable,
      skipped,
      pendingFeedback: feedback.pending,
    };
  }

  /** Unmatched signed feedback is operationally visible and retried; it is never marked processed. */
  async reconcileMailFeedback(limit = 25, providerMessageId?: string, eventId?: string) {
    const now = this.now();
    const pending = await this.db.publicMailWebhook.findMany({
      where: {
        ...(eventId ? { id: eventId } : {}),
        status: 'pending',
        ...(providerMessageId ? { providerMessageId } : { nextAttemptAt: { lte: now } }),
      },
      orderBy: { nextAttemptAt: 'asc' },
      take: Math.min(limit, 100),
    });
    let processed = 0;
    for (const event of pending) {
      await this.db.$transaction(async (tx) => {
        const claim = await tx.publicMailWebhook.updateMany({
          where: { id: event.id, status: 'pending' },
          data: { status: 'processing', attempts: { increment: 1 } },
        });
        if (!claim.count) return;
        const messageId = event.providerMessageId;
        const delivery = messageId
          ? await tx.publicFeedDelivery.findUnique({ where: { providerMessageId: messageId } })
          : null;
        const receipt =
          delivery ??
          (messageId ? await tx.publicMailReceipt.findUnique({ where: { id: messageId } }) : null);
        if (!receipt) {
          await tx.publicMailWebhook.update({
            where: { id: event.id },
            data: {
              status: 'pending',
              lastError:
                'A matching provider send receipt is not recorded yet; suppression is pending reconciliation.',
              nextAttemptAt: new Date(
                now.getTime() + Math.min(60, 2 ** Math.min(event.attempts, 6)) * MINUTE,
              ),
            },
          });
          return;
        }
        await tx.publicSubscriber.update({
          where: { id: receipt.subscriberId },
          data: { status: 'suppressed', nextDigestAt: null, adminRevision: { increment: 1 } },
        });
        await tx.publicFeedDelivery.updateMany({
          where: {
            subscriberId: receipt.subscriberId,
            status: { in: ['pending', 'failed', 'unavailable'] },
          },
          data: { status: 'skipped', error: 'Email feedback suppressed this subscription.' },
        });
        await tx.publicSubscriptionToken.updateMany({
          where: { subscriberId: receipt.subscriberId, consumedAt: null },
          data: { consumedAt: now },
        });
        await tx.publicMailWebhook.update({
          where: { id: event.id },
          data: { status: 'processed', processedAt: now, lastError: null },
        });
        processed++;
      });
    }
    return {
      processed,
      pending: await this.db.publicMailWebhook.count({ where: { status: 'pending' } }),
    };
  }

  /** Resend verifies the original raw bytes and timestamp before a message-id lookup. */
  async handleWebhook(
    payload: string,
    headers: { id: string; timestamp: string; signature: string },
  ) {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) throw new PublicSubscriptionError(503, 'Email feedback is not configured.');
    let event: { type: string; data: { email_id?: string } };
    try {
      event = z
        .object({
          type: z.string(),
          data: z.object({ email_id: z.string().optional() }).passthrough(),
        })
        .parse(
          new Resend(process.env.RESEND_API_KEY || 'verification-only').webhooks.verify({
            payload,
            headers,
            webhookSecret: secret,
          }),
        );
    } catch {
      throw new PublicSubscriptionError(401, 'Invalid email feedback signature.');
    }
    const actionable = ['email.bounced', 'email.complained'].includes(event.type);
    if (actionable && !event.data.email_id)
      throw new PublicSubscriptionError(400, 'Feedback provider message id is required.');
    await this.db.publicMailWebhook.upsert({
      where: { id: headers.id },
      update: {},
      create: {
        id: headers.id,
        type: event.type,
        providerMessageId: event.data.email_id,
        status: actionable ? 'pending' : 'ignored',
        processedAt: actionable ? null : this.now(),
      },
    });
    const feedback = actionable
      ? await this.reconcileMailFeedback(25, event.data.email_id)
      : { pending: 0 };
    return { accepted: true, pendingFeedback: feedback.pending };
  }
}

export const publicSubscriptionService = new PublicSubscriptionService();
