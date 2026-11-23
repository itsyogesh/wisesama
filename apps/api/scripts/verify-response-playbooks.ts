/** Disposable PostgreSQL verification. No provider, host inspection, or email requests. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const database = process.env.INTEL_TEST_DATABASE_URL;
if (!database) throw new Error('Set INTEL_TEST_DATABASE_URL to the disposable local database.');
const url = new URL(database);
if (!['postgres:', 'postgresql:'].includes(url.protocol) || !['localhost', '127.0.0.1'].includes(url.hostname) || url.pathname !== '/wisesama_intel' || url.searchParams.has('host') || url.searchParams.has('socket')) throw new Error('Only the disposable loopback wisesama_intel database is allowed.');
process.env.DATABASE_URL = database;
const { prisma } = await import('@wisesama/database');
const { createPlaybookService } = await import('../src/services/playbook.service');
const { getResponsePlaybook } = await import('../src/services/intel/playbooks');
const service = createPlaybookService({ db: prisma });
const run = randomUUID();
const owner = `playbook-verify-${run}`;
try {
  await prisma.user.create({ data: { id: owner, email: `playbook-${run}@example.invalid`, name: 'Synthetic response verification', emailVerified: false } });
  const project = await prisma.securityProject.create({ data: { userId: owner, name: 'Synthetic response verification', environment: 'development' } });
  const template = getResponsePlaybook('malicious-dependency')!;
  assert.equal((await service.get(owner, project.id, template.id)).response, null, 'GET must not start a response.');
  const started = (await service.start(owner, project.id, template.id)).response;
  assert.equal((await service.start(owner, project.id, template.id)).response.id, started.id, 'Start must be idempotent.');
  const input = { expectedRevision: started.revision, status: 'investigating' as const, answers: { 'affected-release': 'yes' as const, executed: 'unknown' as const }, checks: {}, note: 'Preserving records while investigating', evidence: 'Evidence system reference TEST-12345' };
  await assert.rejects(service.update('foreign-owner', project.id, template.id, input), (error: unknown) => Boolean(error && typeof error === 'object' && 'statusCode' in error && error.statusCode === 404));
  const attempts = await Promise.allSettled([service.update(owner, project.id, template.id, input), service.update(owner, project.id, template.id, input)]);
  assert.equal(attempts.filter((result) => result.status === 'fulfilled').length, 1, 'Exactly one concurrent revision may save.');
  const saved = (await service.get(owner, project.id, template.id)).response!;
  assert.equal(saved.revision, 1); assert.equal(saved.events.length, 2);
  await assert.rejects(service.update(owner, project.id, template.id, { ...input, expectedRevision: saved.revision, status: 'closed' }), /each response task/);
  await assert.rejects(service.update(owner, project.id, template.id, { ...input, expectedRevision: saved.revision, status: 'not_affected' }), /applicability condition/);
  const checks = Object.fromEntries(template.phases.flatMap((phase) => phase.tasks.map((task) => [task.id, true])));
  const closed = (await service.update(owner, project.id, template.id, { ...input, expectedRevision: saved.revision, status: 'closed', checks })).response;
  assert.equal(closed.verificationState, 'user_attested'); assert.ok(closed.closedAt);
  const reopened = (await service.update(owner, project.id, template.id, { ...input, expectedRevision: closed.revision, status: 'investigating', checks })).response;
  assert.equal(reopened.closedAt, null); assert.equal(reopened.events.length, 4);
  const unaffected = (await service.update(owner, project.id, template.id, { ...input, expectedRevision: reopened.revision, status: 'not_affected', answers: { 'affected-release': 'no', executed: 'unknown' } })).response;
  assert.ok(unaffected.closedAt); assert.equal(unaffected.events.length, 5);
  await prisma.securityProject.delete({ where: { id: project.id } });
  assert.equal(await prisma.securityPlaybookResponse.count({ where: { id: started.id } }), 0);
  assert.equal(await prisma.securityPlaybookEvent.count({ where: { responseId: started.id } }), 0);
  console.log('PASS: persisted start/read/save, ownership, concurrent revision, closure evidence/tasks, reopen, attested not-affected, history, and cascade deletion.');
} finally {
  await prisma.user.deleteMany({ where: { id: owner } });
  await prisma.$disconnect();
}
