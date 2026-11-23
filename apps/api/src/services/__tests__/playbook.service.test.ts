import type { PrismaClient } from '@wisesama/database';
import { describe, expect, it, vi } from 'vitest';
import { getResponsePlaybook, playbookApplicability } from '../intel/playbooks';
import { projectScope } from '../organization-access';
import { createPlaybookService, type PlaybookUpdate } from '../playbook.service';
import { organizationFixture } from './organization-fixture';

const now = new Date('2026-11-05T09:00:00Z');
const template = getResponsePlaybook('malicious-dependency')!;
const record = () => ({
  id: 'response-1',
  userId: 'owner',
  projectId: 'project-1',
  playbookId: template.id,
  templateVersion: template.version,
  status: 'investigating',
  answers: {},
  checks: {},
  note: '',
  evidence: '',
  revision: 0,
  createdAt: now,
  updatedAt: now,
  closedAt: null,
  events: [],
});
const input = (): PlaybookUpdate => ({
  expectedRevision: 0,
  status: 'investigating',
  answers: { 'affected-release': 'unknown', executed: 'unknown' },
  checks: {},
  note: 'Review in progress',
  evidence: '',
});
function harness() {
  const access = organizationFixture('owner');
  const project = {
    id: 'project-1',
    organizationId: 'org-1',
    userId: 'owner',
    name: 'Synthetic project',
    environment: 'development',
  };
  const db = {
    organizationMember: access.organizationMember,
    securityProject: {
      findFirst: vi
        .fn()
        .mockImplementation(async ({ where }) =>
          access.projectMatches(where, project) ? project : null,
        ),
    },
    securityPlaybookResponse: {
      findFirst: vi.fn().mockResolvedValue(record()),
      findMany: vi.fn().mockResolvedValue([record()]),
      upsert: vi.fn().mockResolvedValue(record()),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    securityPlaybookEvent: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  return {
    db,
    access,
    service: createPlaybookService({ db: db as unknown as PrismaClient, now: () => now }),
  };
}
describe('response playbook boundaries', () => {
  it('denies foreign projects before accessing response evidence', async () => {
    const { db, service } = harness();
    db.securityProject.findFirst.mockResolvedValue(null);
    await expect(service.get('intruder', 'project-1', template.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.start('intruder', 'project-1', template.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      service.update('intruder', 'project-1', template.id, input()),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.securityPlaybookResponse.findFirst).not.toHaveBeenCalled();
    expect(db.securityPlaybookResponse.upsert).not.toHaveBeenCalled();
  });
  it('does not create a response on read and owner-scopes private reads', async () => {
    const { db, service } = harness();
    db.securityPlaybookResponse.findFirst.mockResolvedValue(null);
    expect((await service.get('owner', 'project-1', template.id)).response).toBeNull();
    expect(db.securityPlaybookResponse.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          projectId: 'project-1',
          playbookId: template.id,
          project: projectScope('owner', 'contribute'),
        },
      }),
    );
    expect(db.securityPlaybookResponse.upsert).not.toHaveBeenCalled();
  });
  it('starts idempotently without overwriting prior progress', async () => {
    const { db, service } = harness();
    await service.start('owner', 'project-1', template.id);
    expect(db.securityPlaybookResponse.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: {},
        create: expect.objectContaining({ userId: 'owner', templateVersion: template.version }),
      }),
    );
  });
  it('rejects unknown template and forged question/task keys', async () => {
    const { db, service } = harness();
    await expect(service.get('owner', 'project-1', 'arbitrary')).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(
      service.update('owner', 'project-1', template.id, { ...input(), answers: { forged: 'yes' } }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.update('owner', 'project-1', template.id, {
        ...input(),
        checks: { arbitrary: true },
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(db.securityPlaybookResponse.updateMany).not.toHaveBeenCalled();
  });
  it('does not equate unknown answers or incomplete tasks with closure', async () => {
    const { service } = harness();
    await expect(
      service.update('owner', 'project-1', template.id, { ...input(), status: 'closed' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.update('owner', 'project-1', template.id, {
        ...input(),
        status: 'closed',
        note: 'A sufficiently detailed summary',
        evidence: 'Evidence system reference INC-12345',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    await expect(
      service.update('owner', 'project-1', template.id, {
        ...input(),
        status: 'not_affected',
        note: 'A sufficiently detailed summary',
        evidence: 'Evidence system reference INC-12345',
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
  it('records attested not-affected with an explicit negative condition and evidence', async () => {
    const { db, service } = harness();
    await service.update('owner', 'project-1', template.id, {
      ...input(),
      status: 'not_affected',
      answers: { 'affected-release': 'no' },
      note: 'Historical inventory excludes this release',
      evidence: 'Inventory evidence reference BUILD-12345',
    });
    expect(db.securityPlaybookResponse.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'not_affected', closedAt: now }),
      }),
    );
    expect(db.securityPlaybookEvent.create).toHaveBeenCalledOnce();
  });
  it('records complete recovery and clears closure when reopened', async () => {
    const { db, service } = harness();
    const checks = Object.fromEntries(
      template.phases.flatMap((phase) => phase.tasks.map((task) => [task.id, true])),
    );
    await service.update('owner', 'project-1', template.id, {
      ...input(),
      status: 'closed',
      checks,
      note: 'Recovery reviewed by incident owner',
      evidence: 'Recovery evidence reference INC-12345',
    });
    expect(db.securityPlaybookResponse.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ closedAt: now, revision: { increment: 1 } }),
      }),
    );
    await service.update('owner', 'project-1', template.id, {
      ...input(),
      status: 'investigating',
    });
    expect(db.securityPlaybookResponse.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ closedAt: null }) }),
    );
  });
  it('does not append a misleading event when optimistic concurrency fails', async () => {
    const { db, service } = harness();
    db.securityPlaybookResponse.updateMany.mockResolvedValue({ count: 0 });
    await expect(service.update('owner', 'project-1', template.id, input())).rejects.toMatchObject({
      statusCode: 409,
    });
    expect(db.securityPlaybookEvent.create).not.toHaveBeenCalled();
  });
  it('treats applicability as a self-reported conjunction', () => {
    expect(playbookApplicability(template, {})).toBe('needs_review');
    expect(playbookApplicability(template, { 'affected-release': 'yes', executed: 'yes' })).toBe(
      'potentially_affected',
    );
    expect(playbookApplicability(template, { 'affected-release': 'no', executed: 'unknown' })).toBe(
      'not_indicated',
    );
  });
});

describe('shared organization response history', () => {
  it('allows a current member to read and contribute to another member response without changing its creator', async () => {
    const { db, service, access } = harness();
    access.members.set('teammate', 'member');
    expect((await service.get('teammate', 'project-1', template.id)).response?.id).toBe(
      'response-1',
    );
    await service.update('teammate', 'project-1', template.id, input());
    expect(db.securityPlaybookResponse.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'response-1', revision: 0, project: projectScope('teammate', 'contribute') },
        data: expect.not.objectContaining({ userId: 'teammate' }),
      }),
    );
  });
  it('revokes private response and history access immediately when membership is removed', async () => {
    const { db, service, access } = harness();
    access.members.set('teammate', 'member');
    await service.get('teammate', 'project-1', template.id);
    db.securityPlaybookResponse.findFirst.mockClear();
    access.members.delete('teammate');
    await expect(service.get('teammate', 'project-1', template.id)).rejects.toMatchObject({
      statusCode: 404,
    });
    await expect(service.list('teammate', 'project-1')).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      service.update('teammate', 'project-1', template.id, input()),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.securityPlaybookResponse.findFirst).not.toHaveBeenCalled();
    expect(db.securityPlaybookEvent.create).not.toHaveBeenCalled();
  });
  it('rechecks contribution access inside the write transaction', async () => {
    const { db, service, access } = harness();
    access.members.set('teammate', 'member');
    db.$transaction.mockImplementation(async (fn: (tx: typeof db) => unknown) => {
      access.members.delete('teammate');
      return fn(db);
    });
    await expect(
      service.update('teammate', 'project-1', template.id, input()),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(db.securityPlaybookResponse.updateMany).not.toHaveBeenCalled();
    expect(db.securityPlaybookEvent.create).not.toHaveBeenCalled();
  });
});
