/**
 * Explicit, disposable-PostgreSQL verification. Never selects a database from app env files.
 *
 * INTEL_TEST_DATABASE_URL=postgresql://...@127.0.0.1:55439/wisesama_intel \
 *   pnpm --filter @wisesama/api exec node --import tsx scripts/verify-intel-workflow.ts
 *
 * All intelligence and email providers are deterministic local fixtures. Cleanup
 * is restricted to the exact synthetic user/advisory IDs allocated by this run.
 */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import type { IntelAdvisory, IntelMatch, InventoryPackage } from '../src/services/intel/types';

function testDatabaseUrl(): string {
  const value = process.env.INTEL_TEST_DATABASE_URL;
  if (!value)
    throw new Error('Set INTEL_TEST_DATABASE_URL to opt into disposable database verification.');
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('INTEL_TEST_DATABASE_URL must be a PostgreSQL URL.');
  }
  if (
    !['postgresql:', 'postgres:'].includes(parsed.protocol) ||
    !['localhost', '127.0.0.1'].includes(parsed.hostname) ||
    parsed.pathname !== '/wisesama_intel' ||
    parsed.searchParams.has('host') ||
    parsed.searchParams.has('socket')
  ) {
    throw new Error(
      'Verification is restricted to localhost/127.0.0.1 and the database wisesama_intel.',
    );
  }
  return value;
}

async function verify() {
  // Validate before loading the database module; its singleton reads DATABASE_URL.
  process.env.DATABASE_URL = testDatabaseUrl();
  const { prisma: db } = await import('@wisesama/database');
  const { createIntelWorkspaceService } = await import('../src/services/intel-workspace.service');
  const run = randomUUID();
  const advisoryId = `TEST-INTEL-${run}`;
  const users: string[] = [];
  const now = new Date();
  const sent: Array<{ to: string; subject: string; text: string; idempotencyKey: string }> = [];
  let providerCalls = 0;
  const advisory: IntelAdvisory = {
    id: advisoryId,
    aliases: [],
    title: 'Synthetic PostgreSQL smoke advisory',
    summary: 'Test fixture only. This advisory is removed after verification.',
    severity: 'high',
    cvss: 8.1,
    exploited: false,
    exploitationStatus: 'not_in_kev',
    exploitationCheckedAt: now.toISOString(),
    epss: 0.01,
    publishedAt: now.toISOString(),
    modifiedAt: now.toISOString(),
    references: [{ url: 'https://example.invalid/wisesama-smoke-fixture', type: 'ADVISORY' }],
    affected: [{ ecosystem: 'npm', name: 'wisesama-smoke-fixture' }],
    source: 'Synthetic verification fixture',
  };
  const provider = {
    scan: async (packages: InventoryPackage[]) => {
      providerCalls++;
      return {
        matches: packages.map(
          (pkg): IntelMatch => ({
            advisory,
            ecosystem: pkg.ecosystem,
            packageName: pkg.name,
            installedVersion: pkg.version,
            fixedVersion: pkg.version.startsWith('1.') ? '1.0.1' : '2.0.1',
          }),
        ),
        warnings: [],
        sources: [
          { name: 'Synthetic fixture', status: 'healthy' as const, checkedAt: now.toISOString() },
        ],
        scannedAt: now.toISOString(),
      };
    },
    getBriefings: async () => ({
      advisories: [advisory],
      sources: [],
      fetchedAt: now.toISOString(),
    }),
  };
  const service = createIntelWorkspaceService({
    db,
    provider,
    now: () => now,
    mail: async (message) => {
      sent.push(message);
      return { status: 'sent', messageId: `synthetic-${sent.length}` };
    },
  });

  try {
    const owner = await db.user.create({
      data: {
        email: `wisesama-smoke-owner-${run}@example.invalid`,
        emailVerified: true,
        name: 'Synthetic owner',
      },
    });
    users.push(owner.id);
    const intruder = await db.user.create({
      data: {
        email: `wisesama-smoke-intruder-${run}@example.invalid`,
        emailVerified: true,
        name: 'Synthetic intruder',
      },
    });
    users.push(intruder.id);
    await service.updateNotificationSettings(owner.id, true);

    const inventory: InventoryPackage[] = ['1.0.0', '2.0.0'].map((version) => ({
      name: 'wisesama-smoke-fixture',
      ecosystem: 'npm',
      version,
    }));
    const created = await service.createProject(owner.id, {
      name: `Synthetic service ${run}`,
      environment: 'development',
      inventory: { format: 'inventory', content: JSON.stringify(inventory) },
    });
    const projectId = created.project.id;
    assert.deepEqual(created.project.packages, inventory, 'Exact inventory must persist.');

    const first = await service.scanProject(owner.id, projectId);
    assert.equal(
      first.findings.length,
      2,
      'Both installed versions must have independent findings.',
    );
    assert.deepEqual(first.findings.map((finding) => finding.installedVersion).sort(), [
      '1.0.0',
      '2.0.0',
    ]);
    assert.equal(await db.securityFinding.count({ where: { projectId } }), 2);
    assert.equal(sent.length, 2, 'One opt-in delivery per independently actionable finding.');
    assert.ok(
      sent.every((message) => message.to === owner.email),
      'Only the verified owner may receive alerts.',
    );
    assert.equal(new Set(sent.map((message) => message.idempotencyKey)).size, 2);

    const callsBeforeIntrusion = providerCalls;
    await assert.rejects(service.scanProject(intruder.id, projectId), { statusCode: 404 });
    assert.equal(
      providerCalls,
      callsBeforeIntrusion,
      'Cross-tenant access must fail before upstream assessment.',
    );
    const intruderWorkspace = await service.getWorkspace(intruder.id);
    assert.equal(intruderWorkspace.projects.length, 0);
    assert.equal(intruderWorkspace.findings.length, 0);
    assert.equal(intruderWorkspace.deliveries.length, 0);

    await service.scanProject(owner.id, projectId);
    assert.equal(sent.length, 2, 'An unchanged repeat scan must not deliver duplicate alerts.');
    assert.equal(await db.securityDelivery.count({ where: { userId: owner.id } }), 2);

    const findingId = first.findings[0]!.id;
    await assert.rejects(
      service.updateFinding(intruder.id, findingId, { status: 'investigating' }),
      { statusCode: 404 },
    );
    await assert.rejects(
      service.updateFinding(owner.id, findingId, { status: 'resolved', evidence: 'done' }),
      { statusCode: 400 },
    );
    await service.updateFinding(owner.id, findingId, {
      status: 'investigating',
      note: 'Checking the deployed service.',
    });
    const resolved = await service.updateFinding(owner.id, findingId, {
      status: 'resolved',
      note: 'Synthetic verification completed.',
      evidence: 'Synthetic evidence: the deployment was rebuilt using the fixed package release.',
    });
    assert.equal(resolved.status, 'resolved');
    assert.equal(
      resolved.verificationState,
      'user_attested',
      'A human claim must not masquerade as automated verification.',
    );
    assert.ok(resolved.events.some((event) => event.status === 'investigating'));
    assert.ok(
      resolved.events.some(
        (event) => event.status === 'resolved' && event.evidence.includes('Synthetic evidence'),
      ),
    );

    const ownerWorkspace = await service.getWorkspace(owner.id);
    assert.equal(ownerWorkspace.projects.length, 1);
    assert.equal(ownerWorkspace.summary.openFindings, 1);
    assert.equal(ownerWorkspace.summary.resolvedFindings, 1);
    assert.ok(ownerWorkspace.deliveries.every((delivery) => delivery.status === 'sent'));
    console.log(
      'PASS: real PostgreSQL inventory, versioned findings, tenant isolation, opt-in delivery deduplication, evidence-required closure, and response history.',
    );
  } finally {
    try {
      if (users.length) await db.user.deleteMany({ where: { id: { in: users } } });
      await db.securityAdvisory.deleteMany({ where: { id: advisoryId } });
    } finally {
      await db.$disconnect();
    }
  }
}

verify().catch((error: unknown) => {
  console.error(
    'FAIL:',
    error instanceof Error ? error.message : 'Security workflow verification failed.',
  );
  process.exitCode = 1;
});
