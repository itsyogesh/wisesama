import { createHash, randomUUID } from 'node:crypto';
import { Prisma, type PrismaClient, prisma } from '@wisesama/database';
import {
  BREVO_RECONCILIATION_REQUIRED,
  brevoRetryBlocked,
  sendBrevoEmail,
  usesBrevo,
  workspaceEmailConfigured,
} from './brevo-email.service';
import {
  type IntelAdvisory,
  type InventoryFormat,
  type InventoryPackage,
  intelProvider,
  parseInventory,
} from './intel/index';
import {
  isActiveOrganizationMember,
  OrganizationError,
  type ProjectAction,
  projectScope,
  requireOrganizationAccess,
  requireProjectAccess,
} from './organization-access';
import { createPublicAdvisoryPolicy } from './public-advisory-policy';
import {
  dependencyAlertEmail,
  notificationTestEmail,
  renderStoredAlert,
} from './workspace-email-template';

export class IntelWorkspaceError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'IntelWorkspaceError';
  }
}

export type FindingStatus = 'open' | 'investigating' | 'mitigated' | 'resolved' | 'not_affected';
type Runtime = { name: string; version: string };
type InventoryInput = { format: InventoryFormat; content: string };
type ProjectInput = {
  organizationId: string;
  name: string;
  environment: 'production' | 'staging' | 'development';
  inventory: InventoryInput;
  runtime?: Runtime;
};
type ProjectRecord = Prisma.SecurityProjectGetPayload<{
  include: { _count: { select: { findings: true } } };
}>;
type FindingRecord = Prisma.SecurityFindingGetPayload<{
  include: { advisory: true; project: { select: { name: true } }; events: true };
}>;
type DeliveryRecord = Prisma.SecurityDeliveryGetPayload<Record<string, never>>;
export type MailResult =
  | { status: 'sent'; messageId: string }
  | { status: 'failed' | 'unavailable'; error: string };
type MailTransport = (message: {
  to: string;
  subject: string;
  text: string;
  idempotencyKey: string;
}) => Promise<MailResult>;

const OPEN_STATUSES = ['open', 'investigating', 'mitigated'];
const FINDING_INCLUDE = {
  advisory: true,
  project: { select: { name: true } },
  events: { orderBy: { createdAt: 'desc' as const }, take: 25 },
} as const;
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const fingerprint = (value: unknown) =>
  createHash('sha256').update(JSON.stringify(value)).digest('hex');
const workspaceUrl = () =>
  (process.env.INTEL_APP_URL || process.env.APP_URL || 'https://www.wisesama.com').replace(
    /\/$/,
    '',
  );

/** A failed or narrower refresh cannot undo prior affirmative exploitation evidence. */
function preserveExploitationEvidence(
  current: IntelAdvisory,
  previous?: IntelAdvisory,
): IntelAdvisory {
  if (!previous?.exploited || current.exploited) return current;
  const references = [
    ...new Map(
      [...current.references, ...previous.references].map((reference) => [
        reference.url,
        reference,
      ]),
    ).values(),
  ];
  return {
    ...current,
    exploited: true,
    exploitationStatus: 'known_exploited',
    exploitationCheckedAt: previous.exploitationCheckedAt,
    references,
  };
}

function toProject(project: ProjectRecord) {
  return {
    id: project.id,
    organizationId: project.organizationId,
    name: project.name,
    environment: project.environment,
    runtime: project.runtime,
    packages: project.packages,
    inventoryUpdatedAt: project.inventoryUpdatedAt.toISOString(),
    createdAt: project.createdAt.toISOString(),
    lastScannedAt: project.lastScannedAt?.toISOString() ?? null,
    scanError: project.scanError,
    scanInProgress: Boolean(project.scanToken),
    sources: project.sources,
    warnings: project.warnings,
    openFindings: project._count.findings,
  };
}

function toFinding(finding: FindingRecord) {
  return {
    id: finding.id,
    projectId: finding.projectId,
    projectName: finding.project.name,
    advisory: finding.advisory.data as unknown as IntelAdvisory,
    packageName: finding.packageName,
    ecosystem: finding.ecosystem,
    installedVersion: finding.installedVersion,
    fixedVersion: finding.fixedVersion,
    status: finding.status,
    note: finding.note,
    evidence: finding.evidence,
    verificationState: finding.resolvedAt ? 'user_attested' : 'unverified',
    firstSeenAt: finding.firstSeenAt.toISOString(),
    lastSeenAt: finding.lastSeenAt.toISOString(),
    resolvedAt: finding.resolvedAt?.toISOString() ?? null,
    events: finding.events.map((event) => ({
      id: event.id,
      actorId: event.actorId,
      status: event.status,
      note: event.note,
      evidence: event.evidence,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

function toDelivery(delivery: DeliveryRecord) {
  return {
    id: delivery.id,
    projectId: delivery.projectId,
    subject: delivery.subject,
    channel: 'email',
    status: delivery.status,
    attempts: delivery.attempts,
    error: delivery.error,
    createdAt: delivery.createdAt.toISOString(),
    sentAt: delivery.sentAt?.toISOString() ?? null,
    nextAttemptAt:
      delivery.status === 'sent' || delivery.status === 'skipped'
        ? null
        : delivery.nextAttemptAt.toISOString(),
  };
}

/** A missing provider is an unavailable delivery, never a successful mock. */
export const sendIntelEmail: MailTransport = async (message) => {
  const html = renderStoredAlert(message.subject, message.text, workspaceUrl());
  if (usesBrevo()) return sendBrevoEmail({ ...message, html });
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
        html,
      }),
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok)
      return {
        status: 'failed',
        error: `Email provider rejected delivery (HTTP ${response.status}).`,
      };
    const data = (await response.json()) as { id?: unknown };
    if (typeof data.id !== 'string' || !data.id)
      return { status: 'failed', error: 'Email provider did not confirm delivery acceptance.' };
    return { status: 'sent', messageId: data.id };
  } catch {
    return {
      status: 'failed',
      error: 'Email provider could not be reached. Delivery will be retried.',
    };
  }
};

export function createIntelWorkspaceService(
  options: {
    db?: PrismaClient;
    provider?: Pick<typeof intelProvider, 'scan' | 'getBriefings'>;
    mail?: MailTransport;
    now?: () => Date;
  } = {},
) {
  const db = options.db ?? prisma;
  const provider = options.provider ?? intelProvider;
  const mail = options.mail ?? sendIntelEmail;
  const now = options.now ?? (() => new Date());
  const publicPolicy = createPublicAdvisoryPolicy(db);

  async function getProject(userId: string, id: string, action: ProjectAction = 'read') {
    if (action === 'manage') await requireProjectAccess(db, userId, id, action);
    const project = await db.securityProject.findFirst({
      where: { id, ...projectScope(userId, action) },
      include: { _count: { select: { findings: { where: { status: { in: OPEN_STATUSES } } } } } },
    });
    if (!project) throw new IntelWorkspaceError(404, 'Project not found.');
    return project;
  }

  async function getNotificationSettings(userId: string) {
    const [settings, user] = await Promise.all([
      db.securityNotificationSettings.findUnique({ where: { userId } }),
      db.user.findUnique({ where: { id: userId }, select: { email: true, emailVerified: true } }),
    ]);
    if (!user) throw new IntelWorkspaceError(404, 'Account not found.');
    return {
      emailEnabled: settings?.emailEnabled ?? false,
      emailVerified: user.emailVerified,
      recipient: user.email,
      deliveryAvailable: workspaceEmailConfigured(),
    };
  }

  async function getBriefings() {
    try {
      const result = await provider.getBriefings();
      const advisories: IntelAdvisory[] = [];
      for (const advisory of result.advisories) {
        const previous = await db.securityAdvisory.findUnique({ where: { id: advisory.id } });
        const previousData = previous?.data as unknown as IntelAdvisory | undefined;
        const collectedAdvisory = preserveExploitationEvidence(advisory, previousData);
        await db.securityAdvisory.upsert({
          where: { id: advisory.id },
          create: {
            id: advisory.id,
            aliases: advisory.aliases,
            data: json(collectedAdvisory),
            fetchedAt: now(),
          },
          update: { aliases: advisory.aliases, data: json(collectedAdvisory), fetchedAt: now() },
        });
        advisories.push(collectedAdvisory);
      }
      return { ...result, advisories: await publicPolicy.apply(advisories), stale: false };
    } catch {
      const records = await db.securityAdvisory.findMany({
        orderBy: { fetchedAt: 'desc' },
        take: 50,
      });
      return {
        advisories: await publicPolicy.apply(
          records.map((record) => record.data as unknown as IntelAdvisory),
        ),
        sources: [
          {
            name: 'GitHub Advisory Database',
            status: 'unavailable' as const,
            checkedAt: now().toISOString(),
            error: 'Live advisory refresh failed. Showing previously collected records.',
          },
        ],
        fetchedAt: records[0]?.fetchedAt.toISOString() ?? null,
        stale: true,
      };
    }
  }

  async function getBriefing(id: string) {
    let record = await db.securityAdvisory.findUnique({ where: { id } });
    if (!record) {
      await getBriefings();
      record = await db.securityAdvisory.findFirst({
        where: { OR: [{ id }, { aliases: { has: id } }] },
      });
    }
    if (!record) throw new IntelWorkspaceError(404, 'Briefing not found.');
    const [advisory] = await publicPolicy.apply([record.data as unknown as IntelAdvisory]);
    if (!advisory) throw new IntelWorkspaceError(404, 'Briefing not found.');
    return advisory;
  }

  async function listDeliveries(userId: string, organizationId?: string) {
    if (organizationId) await requireOrganizationAccess(db, userId, organizationId);
    return (
      await db.securityDelivery.findMany({
        where: {
          userId,
          OR: [
            ...(organizationId ? [] : [{ projectId: null }]),
            { project: projectScope(userId, 'read', organizationId) },
          ],
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    ).map(toDelivery);
  }

  async function getWorkspace(userId: string, organizationId?: string) {
    if (organizationId) await requireOrganizationAccess(db, userId, organizationId);
    const [projects, findings, notificationSettings, deliveries] = await Promise.all([
      db.securityProject.findMany({
        where: projectScope(userId, 'read', organizationId),
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { findings: { where: { status: { in: OPEN_STATUSES } } } } } },
      }),
      db.securityFinding.findMany({
        where: { project: projectScope(userId, 'read', organizationId) },
        include: FINDING_INCLUDE,
        orderBy: { lastSeenAt: 'desc' },
        take: 1000,
      }),
      getNotificationSettings(userId),
      listDeliveries(userId, organizationId),
    ]);
    const mappedFindings = findings.map(toFinding);
    const advisories = [
      ...new Map(mappedFindings.map((finding) => [finding.advisory.id, finding.advisory])).values(),
    ];
    return {
      projects: projects.map(toProject),
      findings: mappedFindings,
      advisories,
      sources: projects.flatMap((project) =>
        Array.isArray(project.sources) ? project.sources : [],
      ),
      notificationSettings,
      deliveries,
      summary: {
        projects: projects.length,
        packages: projects.reduce(
          (count, project) =>
            count + (Array.isArray(project.packages) ? project.packages.length : 0),
          0,
        ),
        openFindings: findings.filter((finding) => OPEN_STATUSES.includes(finding.status)).length,
        exploitedFindings: mappedFindings.filter(
          (finding) => OPEN_STATUSES.includes(finding.status) && finding.advisory.exploited,
        ).length,
        resolvedFindings: findings.filter((finding) => finding.status === 'resolved').length,
      },
    };
  }

  async function processDeliveries(userId?: string, limit = 10, targetId?: string) {
    const candidates = await db.securityDelivery.findMany({
      where: {
        ...(userId ? { userId } : {}),
        ...(targetId ? { id: targetId } : {}),
        user: { intelSuspendedAt: null },
        attempts: { lt: 5 },
        nextAttemptAt: { lte: now() },
        OR: [
          { status: { in: ['pending', 'failed', 'unavailable'] } },
          { status: 'processing', claimedAt: { lt: new Date(now().getTime() - 5 * 60_000) } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: Math.min(limit, 25),
    });
    const results = [];
    for (const candidate of candidates) {
      const claimedAt = now();
      const claim = await db.securityDelivery.updateMany({
        where: {
          id: candidate.id,
          status: candidate.status,
          attempts: candidate.attempts,
          claimedAt: candidate.claimedAt,
        },
        data: { status: 'processing', claimedAt, attempts: { increment: 1 } },
      });
      if (!claim.count) continue;
      const [user, settings] = await Promise.all([
        db.user.findUnique({
          where: { id: candidate.userId },
          select: { email: true, emailVerified: true, intelSuspendedAt: true },
        }),
        db.securityNotificationSettings.findUnique({ where: { userId: candidate.userId } }),
      ]);
      const recipientProject = candidate.projectId
        ? await db.securityProject.findFirst({
            where: { id: candidate.projectId },
            select: { organizationId: true },
          })
        : null;
      const recipientHasAccess =
        !candidate.projectId ||
        Boolean(
          recipientProject &&
            (await isActiveOrganizationMember(
              db,
              candidate.userId,
              recipientProject.organizationId,
            )),
        );
      if (
        !user?.emailVerified ||
        !settings?.emailEnabled ||
        user.intelSuspendedAt ||
        !recipientHasAccess
      ) {
        results.push(
          await db.securityDelivery.update({
            where: { id: candidate.id },
            data: {
              status: 'skipped',
              error: !recipientHasAccess
                ? 'The alert recipient no longer has access to this organization.'
                : user?.intelSuspendedAt
                  ? 'Wisesama workspace access is suspended.'
                  : 'Email alerts are disabled or the account email is unverified.',
              claimedAt: null,
            },
          }),
        );
        continue;
      }
      if (usesBrevo() && brevoRetryBlocked(candidate, claimedAt)) {
        results.push(
          await db.securityDelivery.update({
            where: { id: candidate.id },
            data: {
              status: 'failed',
              error: BREVO_RECONCILIATION_REQUIRED,
              claimedAt: null,
              attempts: 5,
            },
          }),
        );
        continue;
      }
      let result: MailResult;
      try {
        result = await mail({
          to: user.email,
          subject: candidate.subject,
          text: candidate.body,
          idempotencyKey: candidate.eventKey,
        });
      } catch {
        result = { status: 'failed', error: 'Email transport failed. Delivery will be retried.' };
      }
      results.push(
        await db.securityDelivery.update({
          where: { id: candidate.id },
          data:
            result.status === 'sent'
              ? {
                  status: 'sent',
                  sentAt: now(),
                  providerMessageId: result.messageId,
                  error: null,
                  claimedAt: null,
                }
              : {
                  status: result.status,
                  error: result.error,
                  claimedAt: null,
                  // Missing configuration should not exhaust retry attempts before launch.
                  ...(result.error === BREVO_RECONCILIATION_REQUIRED
                    ? { attempts: 5 }
                    : result.status === 'unavailable'
                      ? { attempts: { decrement: 1 } }
                      : {}),
                  nextAttemptAt: new Date(
                    now().getTime() +
                      (result.status === 'unavailable'
                        ? 30 * 60_000
                        : Math.min(60 * 60_000, 30_000 * 2 ** candidate.attempts)),
                  ),
                },
        }),
      );
    }
    return results.map(toDelivery);
  }

  async function scanProject(userId: string, id: string) {
    const project = await getProject(userId, id);
    const token = randomUUID();
    const scanStartedAt = now();
    const claimed = await db.securityProject.updateMany({
      where: {
        id,
        ...projectScope(userId, 'read'),
        inventoryRevision: project.inventoryRevision,
        OR: [
          { scanToken: null },
          { scanStartedAt: { lt: new Date(now().getTime() - 10 * 60_000) } },
        ],
      },
      data: {
        scanToken: token,
        scanStartedAt,
        nextScanAt: new Date(now().getTime() + 6 * 60 * 60_000),
      },
    });
    if (!claimed.count)
      throw new IntelWorkspaceError(
        409,
        'A scan is already running, or this inventory changed. Refresh and try again.',
      );

    try {
      const result = await provider.scan(project.packages as unknown as InventoryPackage[]);
      const scanWarnings = [
        ...result.warnings,
        ...(project.runtime
          ? ['Runtime metadata is recorded but is not covered by package vulnerability matching.']
          : []),
      ];
      await db.$transaction(
        async (tx) => {
          await requireProjectAccess(tx, userId, id);
          const current = await tx.securityProject.updateMany({
            where: {
              id,
              ...projectScope(userId),
              scanToken: token,
              inventoryRevision: project.inventoryRevision,
            },
            data: {
              lastScannedAt: now(),
              scanError: null,
              sources: json(result.sources),
              warnings: json(scanWarnings),
              scanToken: null,
              scanStartedAt: null,
            },
          });
          if (!current.count)
            throw new IntelWorkspaceError(
              409,
              'The inventory changed during the scan. Scan the latest inventory again.',
            );
          const [settings, user] = await Promise.all([
            tx.securityNotificationSettings.findUnique({ where: { userId: project.userId } }),
            tx.user.findUnique({ where: { id: project.userId }, select: { emailVerified: true } }),
          ]);

          const recipientHasAccess = await isActiveOrganizationMember(
            tx,
            project.userId,
            project.organizationId,
          );
          for (const match of result.matches) {
            const advisory = match.advisory;
            const priorAdvisory = await tx.securityAdvisory.findFirst({
              where: {
                OR: [
                  { id: advisory.id },
                  { aliases: { hasSome: [advisory.id, ...advisory.aliases] } },
                ],
              },
            });
            const canonicalId = priorAdvisory?.id ?? advisory.id;
            const priorData = priorAdvisory?.data as unknown as IntelAdvisory | undefined;
            const canonicalAdvisory = {
              ...preserveExploitationEvidence(advisory, priorData),
              id: canonicalId,
              aliases: [
                ...new Set([
                  ...advisory.aliases,
                  ...(canonicalId !== advisory.id ? [advisory.id] : []),
                ]),
              ],
            };
            await tx.securityAdvisory.upsert({
              where: { id: canonicalId },
              create: {
                id: canonicalId,
                aliases: canonicalAdvisory.aliases,
                data: json(canonicalAdvisory),
                fetchedAt: now(),
              },
              update: {
                aliases: canonicalAdvisory.aliases,
                data: json(canonicalAdvisory),
                fetchedAt: now(),
              },
            });
            const key = {
              projectId: id,
              advisoryId: canonicalId,
              ecosystem: match.ecosystem,
              packageName: match.packageName,
              installedVersion: match.installedVersion,
            };
            const existing = await tx.securityFinding.findUnique({
              where: { projectId_advisoryId_ecosystem_packageName_installedVersion: key },
            });
            const priorRisk = existing?.riskSnapshot as
              | { exploited?: boolean; severity?: string }
              | undefined;
            const riskSnapshot = {
              exploited: canonicalAdvisory.exploited,
              severity: canonicalAdvisory.severity,
              fixedVersion: match.fixedVersion ?? null,
            };
            const reopen = Boolean(
              existing &&
                (existing.status === 'resolved' ||
                  (existing.status === 'not_affected' &&
                    existing.installedVersion !== match.installedVersion)),
            );
            const finding = await tx.securityFinding.upsert({
              where: { projectId_advisoryId_ecosystem_packageName_installedVersion: key },
              create: {
                ...key,
                riskSnapshot: json(riskSnapshot),
                fixedVersion: match.fixedVersion ?? null,
                firstSeenAt: now(),
                lastSeenAt: now(),
              },
              update: {
                riskSnapshot: json(riskSnapshot),
                fixedVersion: match.fixedVersion ?? null,
                lastSeenAt: now(),
                ...(reopen ? { status: 'open', resolvedAt: null, evidence: '' } : {}),
              },
            });
            if (!existing || reopen) {
              await tx.securityFindingEvent.create({
                data: {
                  findingId: finding.id,
                  status: 'open',
                  note: existing
                    ? 'A new inventory scan still matches this advisory. Reopened for assessment.'
                    : 'An exact package version matched a published advisory. Production exposure has not been verified.',
                },
              });
            }
            const severityRank = { unknown: 0, low: 1, medium: 2, high: 3, critical: 4 };
            const severityIncreased =
              severityRank[canonicalAdvisory.severity] >
              (severityRank[priorRisk?.severity as keyof typeof severityRank] ?? 0);
            const meaningfulChange =
              !existing ||
              reopen ||
              (!priorRisk?.exploited && canonicalAdvisory.exploited) ||
              existing.fixedVersion !== (match.fixedVersion ?? null) ||
              severityIncreased;
            if (
              meaningfulChange &&
              recipientHasAccess &&
              settings?.emailEnabled &&
              user?.emailVerified &&
              finding.status !== 'not_affected'
            ) {
              const eventKey = fingerprint([
                finding.id,
                match.installedVersion,
                canonicalAdvisory.exploited,
                match.fixedVersion ?? null,
                canonicalAdvisory.severity,
                reopen ? (existing?.resolvedAt?.toISOString() ?? 'reopened') : null,
              ]);
              const { subject, text: body } = dependencyAlertEmail({
                project: project.name,
                dependency: match.packageName,
                version: match.installedVersion,
                severity: canonicalAdvisory.severity,
                exploited: canonicalAdvisory.exploited,
                fixedVersion: match.fixedVersion,
                findingId: finding.id,
                appUrl: workspaceUrl(),
                changed: Boolean(existing),
              });
              await tx.securityDelivery.upsert({
                where: { eventKey },
                create: {
                  userId: project.userId,
                  projectId: id,
                  eventKey,
                  subject,
                  body,
                  nextAttemptAt: now(),
                },
                update: {},
              });
            }
          }
          // Missing matches never silently close findings: package removal, stale
          // inventories and changed upstream coverage are not proof of remediation.
        },
        { timeout: 30_000 },
      );
      const deliveryWarnings: string[] = [];
      try {
        await processDeliveries(project.userId);
      } catch {
        deliveryWarnings.push(
          'The scan completed, but email delivery could not be processed. Queued alerts will be retried.',
        );
      }
      return {
        project: toProject(await getProject(userId, id)),
        findings: (
          await db.securityFinding.findMany({
            where: { projectId: id, project: projectScope(userId) },
            include: FINDING_INCLUDE,
            orderBy: { lastSeenAt: 'desc' },
          })
        ).map(toFinding),
        sources: result.sources,
        warnings: [...scanWarnings, ...deliveryWarnings],
        scannedAt: result.scannedAt,
      };
    } catch (error) {
      const message =
        error instanceof IntelWorkspaceError || error instanceof OrganizationError
          ? error.message
          : 'The vulnerability sources could not complete this scan. Existing findings remain unchanged.';
      await db.securityProject.updateMany({
        where: { id, scanToken: token },
        data: { scanError: message, nextScanAt: new Date(now().getTime() + 60 * 60_000) },
      });
      if (error instanceof IntelWorkspaceError || error instanceof OrganizationError) throw error;
      throw new IntelWorkspaceError(503, message);
    } finally {
      await db.securityProject.updateMany({
        where: { id, scanToken: token },
        data: { scanToken: null, scanStartedAt: null },
      });
    }
  }

  async function createProject(userId: string, input: ProjectInput) {
    await requireOrganizationAccess(db, userId, input.organizationId, 'manage');
    const parsed = parseInventory(input.inventory.content, input.inventory.format);
    const project = await db.$transaction(async (tx) => {
      await requireOrganizationAccess(tx, userId, input.organizationId, 'manage');
      if (
        (await tx.securityProject.count({ where: { organizationId: input.organizationId } })) >= 50
      )
        throw new IntelWorkspaceError(409, 'This organization has reached the 50-project limit.');
      return tx.securityProject.create({
        data: {
          userId,
          organizationId: input.organizationId,
          name: input.name,
          environment: input.environment,
          packages: json(parsed.packages),
          runtime: input.runtime ? json(input.runtime) : Prisma.DbNull,
          warnings: json(parsed.warnings),
          inventoryUpdatedAt: now(),
          nextScanAt: now(),
        },
      });
    });
    return { project: toProject(await getProject(userId, project.id)), warnings: parsed.warnings };
  }

  async function updateInventory(
    userId: string,
    id: string,
    input: { inventory: InventoryInput; runtime?: Runtime },
  ) {
    await getProject(userId, id, 'manage');
    const repositorySource = await db.projectRepositorySource.findFirst({
      where: {
        projectId: id,
        project: projectScope(userId, 'manage'),
        status: { not: 'disconnected' },
      },
      select: { id: true },
    });
    if (repositorySource)
      throw new IntelWorkspaceError(
        409,
        'This project tracks a repository. Edit its source in Repository connections, or detach it before uploading a manual inventory.',
      );
    const parsed = parseInventory(input.inventory.content, input.inventory.format);
    const updated = await db.securityProject.updateMany({
      where: { id, ...projectScope(userId, 'manage') },
      data: {
        packages: json(parsed.packages),
        ...(input.runtime ? { runtime: json(input.runtime) } : {}),
        inventoryRevision: randomUUID(),
        inventoryUpdatedAt: now(),
        nextScanAt: now(),
        scanError: null,
        warnings: json(parsed.warnings),
      },
    });
    if (!updated.count) throw new IntelWorkspaceError(404, 'Project not found.');
    return { project: toProject(await getProject(userId, id)), warnings: parsed.warnings };
  }

  async function updateFinding(
    userId: string,
    id: string,
    input: { status: FindingStatus; note?: string; evidence?: string },
  ) {
    const existing = await db.securityFinding.findFirst({
      where: { id, project: projectScope(userId, 'contribute') },
    });
    if (!existing) throw new IntelWorkspaceError(404, 'Finding not found.');
    if (
      (input.status === 'resolved' || input.status === 'not_affected') &&
      (input.evidence?.trim().length ?? 0) < 10
    ) {
      throw new IntelWorkspaceError(
        400,
        'Add evidence describing the deployed fix or why this service is not affected (at least 10 characters).',
      );
    }
    await db.$transaction(async (tx) => {
      await requireProjectAccess(tx, userId, existing.projectId, 'contribute');
      const applied = await tx.securityFinding.updateMany({
        where: { id, project: projectScope(userId, 'contribute') },
        data: {
          status: input.status,
          ...(input.note !== undefined ? { note: input.note.trim() } : {}),
          ...(input.evidence !== undefined ? { evidence: input.evidence.trim() } : {}),
          resolvedAt: input.status === 'resolved' || input.status === 'not_affected' ? now() : null,
        },
      });
      if (!applied.count) throw new IntelWorkspaceError(404, 'Finding not found.');
      await tx.securityFindingEvent.create({
        data: {
          findingId: id,
          actorId: userId,
          status: input.status,
          note: input.note?.trim() ?? '',
          evidence: input.evidence?.trim() ?? '',
        },
      });
    });
    const finding = await db.securityFinding.findFirst({
      where: { id, project: projectScope(userId, 'contribute') },
      include: FINDING_INCLUDE,
    });
    if (!finding) throw new IntelWorkspaceError(404, 'Finding not found.');
    return toFinding(finding);
  }

  async function updateNotificationSettings(userId: string, emailEnabled: boolean) {
    const current = await getNotificationSettings(userId);
    if (emailEnabled && !current.emailVerified)
      throw new IntelWorkspaceError(403, 'Verify your account email before enabling alerts.');
    await db.securityNotificationSettings.upsert({
      where: { userId },
      create: { userId, emailEnabled },
      update: { emailEnabled },
    });
    return getNotificationSettings(userId);
  }

  async function testNotification(userId: string) {
    const settings = await getNotificationSettings(userId);
    if (!settings.emailEnabled || !settings.emailVerified)
      throw new IntelWorkspaceError(
        403,
        'Enable email alerts for your verified account address first.',
      );
    const recent = await db.securityDelivery.findFirst({
      where: { userId, projectId: null, createdAt: { gte: new Date(now().getTime() - 60_000) } },
    });
    if (recent)
      throw new IntelWorkspaceError(
        429,
        'A test was requested recently. Wait one minute before trying again.',
      );
    const { subject, text: body } = notificationTestEmail(workspaceUrl());
    const delivery = await db.securityDelivery.create({
      data: {
        userId,
        eventKey: `test-${randomUUID()}`,
        subject,
        body,
        nextAttemptAt: now(),
      },
    });
    await processDeliveries(userId);
    const updated = await db.securityDelivery.findUnique({ where: { id: delivery.id } });
    return toDelivery(updated ?? delivery);
  }

  async function runScheduledScans(limit = 20) {
    const projects = await db.securityProject.findMany({
      where: { nextScanAt: { lte: now() }, user: { intelSuspendedAt: null } },
      orderBy: [{ nextScanAt: 'asc' }, { createdAt: 'asc' }],
      take: Math.min(limit, 50),
      select: { id: true, userId: true, organizationId: true },
    });
    const results = [];
    for (const project of projects) {
      if (!(await isActiveOrganizationMember(db, project.userId, project.organizationId))) {
        // Keep revoked creators out of the next scheduled batch while retaining
        // the inventory and allowing current organization members to reassess.
        await db.securityProject.updateMany({
          where: {
            id: project.id,
            userId: project.userId,
            organizationId: project.organizationId,
            nextScanAt: { lte: now() },
          },
          data: { nextScanAt: new Date(now().getTime() + 24 * 60 * 60_000) },
        });
        results.push({ projectId: project.id, status: 'access_removed' });
        continue;
      }
      try {
        await scanProject(project.userId, project.id);
        results.push({ projectId: project.id, status: 'scanned' });
      } catch (error) {
        results.push({
          projectId: project.id,
          status:
            error instanceof IntelWorkspaceError && error.statusCode === 409 ? 'busy' : 'failed',
        });
      }
    }
    const deliveries = await processDeliveries();
    return { projects: results, deliveries };
  }

  return {
    getBriefings,
    getBriefing,
    getWorkspace,
    createProject,
    updateInventory,
    scanProject,
    updateFinding,
    getNotificationSettings,
    updateNotificationSettings,
    testNotification,
    listDeliveries,
    processDeliveries,
    runScheduledScans,
  };
}

export const intelWorkspaceService = createIntelWorkspaceService();
