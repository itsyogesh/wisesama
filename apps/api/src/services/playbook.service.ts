import { type Prisma, type PrismaClient, prisma } from '@wisesama/database';
import {
  getResponsePlaybook,
  type PlaybookAnswer,
  type PlaybookStatus,
  playbookApplicability,
} from './intel/playbooks';
import { projectScope, requireProjectAccess } from './organization-access';

export class PlaybookError extends Error {
  constructor(
    public readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'PlaybookError';
  }
}
export interface PlaybookUpdate {
  expectedRevision: number;
  status: PlaybookStatus;
  answers: Record<string, PlaybookAnswer>;
  checks: Record<string, boolean>;
  note: string;
  evidence: string;
}
type ResponseRecord = Prisma.SecurityPlaybookResponseGetPayload<{ include: { events: true } }>;
const include = { events: { orderBy: { createdAt: 'desc' as const }, take: 30 } };
const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
const object = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};

function toResponse(value: ResponseRecord) {
  return {
    id: value.id,
    projectId: value.projectId,
    playbookId: value.playbookId,
    templateVersion: value.templateVersion,
    status: value.status,
    answers: object(value.answers),
    checks: object(value.checks),
    note: value.note,
    evidence: value.evidence,
    revision: value.revision,
    verificationState: 'user_attested' as const,
    createdAt: value.createdAt.toISOString(),
    updatedAt: value.updatedAt.toISOString(),
    closedAt: value.closedAt?.toISOString() ?? null,
    events: value.events.map((event) => ({
      id: event.id,
      actorId: event.actorId,
      status: event.status,
      note: event.note,
      evidence: event.evidence,
      answers: object(event.answers),
      checks: object(event.checks),
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

export function createPlaybookService(options: { db?: PrismaClient; now?: () => Date } = {}) {
  const db = options.db ?? prisma;
  const now = options.now ?? (() => new Date());
  async function accessibleProject(userId: string, projectId: string) {
    const project = await requireProjectAccess(db, userId, projectId, 'contribute');
    return {
      id: project.id,
      organizationId: project.organizationId,
      name: project.name,
      environment: project.environment,
    };
  }
  function template(id: string) {
    const value = getResponsePlaybook(id);
    if (!value) throw new PlaybookError(404, 'Response playbook not found.');
    return value;
  }
  async function get(userId: string, projectId: string, playbookId: string) {
    const project = await accessibleProject(userId, projectId);
    const playbook = template(playbookId);
    const value = await db.securityPlaybookResponse.findFirst({
      where: { projectId, playbookId, project: projectScope(userId, 'contribute') },
      include,
    });
    return { project, playbook, response: value ? toResponse(value) : null };
  }
  async function list(userId: string, projectId: string) {
    await accessibleProject(userId, projectId);
    const values = await db.securityPlaybookResponse.findMany({
      where: { projectId, project: projectScope(userId, 'contribute') },
      orderBy: { updatedAt: 'desc' },
      take: 50,
      include,
    });
    return { responses: values.map(toResponse) };
  }
  async function start(userId: string, projectId: string, playbookId: string) {
    await accessibleProject(userId, projectId);
    const playbook = template(playbookId);
    const value = await db.$transaction(async (tx) => {
      await requireProjectAccess(tx, userId, projectId, 'contribute');
      return tx.securityPlaybookResponse.upsert({
        where: { projectId_playbookId: { projectId, playbookId } },
        create: {
          userId,
          projectId,
          playbookId,
          templateVersion: playbook.version,
          events: {
            create: {
              actorId: userId,
              status: 'investigating',
              note: 'Response started. Applicability has not been assessed.',
            },
          },
        },
        update: {},
        include,
      });
    });
    return { response: toResponse(value) };
  }
  async function update(
    userId: string,
    projectId: string,
    playbookId: string,
    input: PlaybookUpdate,
  ) {
    await accessibleProject(userId, projectId);
    const playbook = template(playbookId);
    const questionIds = new Set(playbook.questions.map((question) => question.id));
    const taskIds = new Set(playbook.phases.flatMap((phase) => phase.tasks.map((task) => task.id)));
    if (
      Object.keys(input.answers).some((key) => !questionIds.has(key)) ||
      Object.keys(input.checks).some((key) => !taskIds.has(key))
    )
      throw new PlaybookError(
        400,
        'The response contains fields outside this playbook. Reload the current playbook.',
      );
    if (
      !Number.isInteger(input.expectedRevision) ||
      input.expectedRevision < 0 ||
      !['investigating', 'contained', 'recovering', 'closed', 'not_affected'].includes(
        input.status,
      ) ||
      Object.values(input.answers).some((answer) => !['yes', 'no', 'unknown'].includes(answer)) ||
      Object.values(input.checks).some((check) => typeof check !== 'boolean') ||
      input.note.length > 4000 ||
      input.evidence.length > 4000
    )
      throw new PlaybookError(400, 'Check the response fields.');
    const closing = input.status === 'closed' || input.status === 'not_affected';
    if (closing && (input.note.trim().length < 20 || input.evidence.trim().length < 20))
      throw new PlaybookError(
        400,
        'Add a response summary and evidence reference of at least 20 characters each before closing.',
      );
    if (input.status === 'closed' && [...taskIds].some((id) => input.checks[id] !== true))
      throw new PlaybookError(
        400,
        'Review and complete each response task before closing this incident.',
      );
    if (
      input.status === 'not_affected' &&
      playbookApplicability(playbook, input.answers) !== 'not_indicated'
    )
      throw new PlaybookError(
        400,
        'Record which applicability condition was not met and the supporting evidence before marking not affected.',
      );
    return db.$transaction(async (tx) => {
      await requireProjectAccess(tx, userId, projectId, 'contribute');
      const existing = await tx.securityPlaybookResponse.findFirst({
        where: { projectId, playbookId, project: projectScope(userId, 'contribute') },
      });
      if (!existing) throw new PlaybookError(409, 'Start this response before saving progress.');
      const applied = await tx.securityPlaybookResponse.updateMany({
        where: {
          id: existing.id,
          project: projectScope(userId, 'contribute'),
          revision: input.expectedRevision,
        },
        data: {
          status: input.status,
          templateVersion: playbook.version,
          answers: json(input.answers),
          checks: json(input.checks),
          note: input.note.trim(),
          evidence: input.evidence.trim(),
          revision: { increment: 1 },
          closedAt: closing ? (existing.closedAt ?? now()) : null,
        },
      });
      if (!applied.count)
        throw new PlaybookError(
          409,
          'This response changed in another tab. Reload it before saving your changes.',
        );
      await tx.securityPlaybookEvent.create({
        data: {
          responseId: existing.id,
          actorId: userId,
          status: input.status,
          answers: json(input.answers),
          checks: json(input.checks),
          note: input.note.trim(),
          evidence: input.evidence.trim(),
        },
      });
      const saved = await tx.securityPlaybookResponse.findFirst({
        where: { id: existing.id, project: projectScope(userId, 'contribute') },
        include,
      });
      if (!saved) throw new PlaybookError(404, 'Response no longer available.');
      return { response: toResponse(saved) };
    });
  }
  return { get, list, start, update };
}

export const playbookService = createPlaybookService();
