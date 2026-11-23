import { type PrismaClient, prisma } from '@wisesama/database';

export const INTEL_SOURCES = [
  {
    id: 'osv',
    name: 'OSV',
    purpose: 'Exact package/version vulnerability matching',
    url: 'https://osv.dev/',
  },
  {
    id: 'github',
    name: 'GitHub Advisory Database',
    purpose: 'Reviewed and malware public advisory feeds',
    url: 'https://github.com/advisories',
  },
  {
    id: 'kev',
    name: 'CISA KEV',
    purpose: 'Affirmative evidence of known exploitation',
    url: 'https://www.cisa.gov/known-exploited-vulnerabilities-catalog',
  },
  {
    id: 'epss',
    name: 'FIRST EPSS',
    purpose: 'Predicted exploitation probability',
    url: 'https://www.first.org/epss/',
  },
] as const;
export type IntelSourceId = (typeof INTEL_SOURCES)[number]['id'];
export const sourceIdForName = (name: string): IntelSourceId | undefined =>
  name === 'OSV'
    ? 'osv'
    : name.startsWith('GitHub')
      ? 'github'
      : name === 'CISA KEV'
        ? 'kev'
        : name === 'FIRST EPSS'
          ? 'epss'
          : undefined;
export class SourceControlError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'SourceControlError';
  }
}
export interface IntelSourcePolicy {
  assertEnabled(name: string): Promise<void>;
  markAttempt(name: string): Promise<Date>;
  recordResult(
    name: string,
    health: 'healthy' | 'unavailable',
    error: string | undefined,
    attemptedAt: Date,
  ): Promise<void>;
}
export function safeOperationError(error: unknown) {
  const known = new Set([
    'SourceControlError',
    'RepositoryError',
    'IntelWorkspaceError',
    'IntelProviderError',
    'PublicSubscriptionError',
    'AdminJobError',
  ]);
  if (error instanceof Error && known.has(error.name))
    return error.message
      .replace(/https?:\/\/\S+/gi, '[provider URL]')
      .replace(/(?:Bearer\s+|token[=:]\s*)\S+/gi, '[redacted]')
      .slice(0, 1200);
  return 'The operation could not complete. Check configuration and the target state before retrying.';
}
const identity = (id: string) => {
  const source = INTEL_SOURCES.find((value) => value.id === id);
  if (!source) throw new SourceControlError(404, 'Intelligence source not found.');
  return source;
};
export function createSourceControlService(options: { db?: PrismaClient; now?: () => Date } = {}) {
  const db = options.db ?? prisma;
  const now = options.now ?? (() => new Date());
  async function list() {
    const saved = await db.intelSourceControl.findMany({
      where: { id: { in: INTEL_SOURCES.map((source) => source.id) } },
    });
    return {
      items: INTEL_SOURCES.map((source) => {
        const value = saved.find((item) => item.id === source.id);
        return {
          ...source,
          paused: value?.paused ?? false,
          revision: value?.revision ?? 0,
          health: value?.paused ? 'paused' : (value?.health ?? 'unknown'),
          lastAttemptAt: value?.lastAttemptAt?.toISOString() ?? null,
          lastSuccessAt: value?.lastSuccessAt?.toISOString() ?? null,
          lastError: value?.lastError ?? null,
          updatedAt: value?.updatedAt?.toISOString() ?? null,
        };
      }),
      checkedAt: now().toISOString(),
    };
  }
  async function assertEnabled(name: string) {
    const id = sourceIdForName(name);
    if (!id) throw new SourceControlError(400, 'Unsupported intelligence source.');
    const value = await db.intelSourceControl.findUnique({ where: { id } });
    if (value?.paused)
      throw new SourceControlError(
        409,
        `${identity(id).name} is paused by an administrator. Previous evidence is retained.`,
      );
  }
  let lastAttempt = 0;
  async function markAttempt(name: string) {
    const id = sourceIdForName(name);
    if (!id) throw new SourceControlError(400, 'Unsupported intelligence source.');
    lastAttempt = Math.max(now().getTime(), lastAttempt + 1);
    const attemptedAt = new Date(lastAttempt);
    await db.intelSourceControl.upsert({ where: { id }, create: { id }, update: {} });
    const changed = await db.intelSourceControl.updateMany({
      where: { id, paused: false },
      data: { lastAttemptAt: attemptedAt },
    });
    if (!changed.count)
      throw new SourceControlError(
        409,
        `${identity(id).name} is paused by an administrator. Previous evidence is retained.`,
      );
    return attemptedAt;
  }
  async function recordResult(
    name: string,
    health: 'healthy' | 'unavailable',
    error: string | undefined,
    attemptedAt: Date,
  ) {
    const id = sourceIdForName(name);
    if (!id) return;
    await db.intelSourceControl.updateMany({
      where: { id, paused: false, lastAttemptAt: attemptedAt },
      data: {
        health,
        lastError:
          health === 'healthy' ? null : (error ?? 'Source validation failed.').slice(0, 1200),
        ...(health === 'healthy' ? { lastSuccessAt: attemptedAt } : {}),
      },
    });
  }
  async function update(
    actorId: string,
    id: string,
    input: { paused: boolean; expectedRevision: number; reason: string },
  ) {
    identity(id);
    if (
      typeof input.paused !== 'boolean' ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0 ||
      input.reason.trim().length < 20 ||
      input.reason.length > 1000
    )
      throw new SourceControlError(
        400,
        'Provide the current source revision and a reason of 20–1,000 characters.',
      );
    await db.$transaction(async (tx) => {
      const actor = await tx.user.findUnique({
        where: { id: actorId },
        select: { intelAdmin: true, intelSuspendedAt: true },
      });
      if (!actor?.intelAdmin || actor.intelSuspendedAt)
        throw new SourceControlError(403, 'Wisesama administrator access is required.');
      await tx.intelSourceControl.upsert({ where: { id }, create: { id }, update: {} });
      const changed = await tx.intelSourceControl.updateMany({
        where: { id, revision: input.expectedRevision },
        data: {
          paused: input.paused,
          revision: { increment: 1 },
          ...(input.paused ? { health: 'paused' } : { health: 'unknown' }),
        },
      });
      if (!changed.count)
        throw new SourceControlError(409, 'This source changed. Reload before saving.');
      await tx.intelAdminAudit.create({
        data: {
          actorId,
          action: input.paused ? 'source.pause' : 'source.resume',
          targetType: 'source',
          targetId: id,
          reason: input.reason.trim(),
          metadata: { paused: input.paused, previousRevision: input.expectedRevision },
        },
      });
    });
    return { source: (await list()).items.find((source) => source.id === id)! };
  }
  return { list, update, assertEnabled, markAttempt, recordResult };
}
export const sourceControlService = createSourceControlService();
