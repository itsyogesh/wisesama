import type { PrismaClient } from '@wisesama/database';
import { describe, expect, it, vi } from 'vitest';
import { createIntelProvider, INTEL_ENDPOINTS } from '../intel/provider';
import {
  createSourceControlService,
  SourceControlError,
  sourceIdForName,
} from '../source-control.service';

const now = new Date('2026-11-05T09:00:00Z');
function harness() {
  const db = {
    user: { findUnique: vi.fn().mockResolvedValue({ intelAdmin: true, intelSuspendedAt: null }) },
    intelSourceControl: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockResolvedValue({ paused: false }),
      upsert: vi.fn(),
      updateMany: vi.fn().mockResolvedValue({ count: 1 }),
    },
    intelAdminAudit: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation((fn: (tx: typeof db) => unknown) => fn(db));
  return {
    db,
    service: createSourceControlService({ db: db as unknown as PrismaClient, now: () => now }),
  };
}
describe('operator source policy', () => {
  it('lists only fixed official sources without probing them', async () => {
    const { service, db } = harness();
    const result = await service.list();
    expect(result.items.map((source) => source.id)).toEqual(['osv', 'github', 'kev', 'epss']);
    expect(
      result.items.every((source) => source.health === 'unknown' && source.lastSuccessAt === null),
    ).toBe(true);
    expect(db.intelSourceControl.upsert).not.toHaveBeenCalled();
    expect(sourceIdForName('https://private-network.invalid')).toBeUndefined();
  });
  it('records pause with revision and audit in one transaction', async () => {
    const { service, db } = harness();
    await service.update('operator', 'osv', {
      paused: true,
      expectedRevision: 2,
      reason: 'Investigating upstream source failures',
    });
    expect(db.intelSourceControl.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'osv', revision: 2 },
        data: expect.objectContaining({ paused: true, health: 'paused' }),
      }),
    );
    expect(db.intelAdminAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actorId: 'operator',
          action: 'source.pause',
          targetType: 'source',
        }),
      }),
    );
  });
  it('rejects stale, revoked, unknown and unexplained mutations', async () => {
    const { service, db } = harness();
    await expect(
      service.update('operator', 'arbitrary', {
        paused: true,
        expectedRevision: 0,
        reason: 'A valid operator explanation here',
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    await expect(
      service.update('operator', 'osv', { paused: true, expectedRevision: 0, reason: 'short' }),
    ).rejects.toMatchObject({ statusCode: 400 });
    db.user.findUnique.mockResolvedValue({ intelAdmin: false });
    await expect(
      service.update('operator', 'osv', {
        paused: true,
        expectedRevision: 0,
        reason: 'A valid operator explanation here',
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    db.user.findUnique.mockResolvedValue({ intelAdmin: true });
    db.intelSourceControl.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.update('operator', 'osv', {
        paused: true,
        expectedRevision: 0,
        reason: 'A valid operator explanation here',
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(db.intelAdminAudit.create).not.toHaveBeenCalled();
  });
  it('never overwrites pause or a newer attempt with a previous result', async () => {
    const { service, db } = harness();
    const attemptedAt = await service.markAttempt('OSV');
    await service.recordResult('OSV', 'healthy', undefined, attemptedAt);
    expect(db.intelSourceControl.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { id: 'osv', paused: false, lastAttemptAt: attemptedAt },
        data: expect.objectContaining({ lastSuccessAt: attemptedAt }),
      }),
    );
  });
  it('checks pause before reusing a warm upstream cache', async () => {
    let paused = false;
    const control = {
      assertEnabled: vi.fn(async () => {
        if (paused) throw new Error('Paused');
      }),
      markAttempt: vi.fn().mockResolvedValue(now),
      recordResult: vi.fn(),
    };
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.startsWith(INTEL_ENDPOINTS.github)) return new Response('[]');
      if (url === INTEL_ENDPOINTS.kev)
        return Response.json({ vulnerabilities: [{ cveID: 'CVE-2021-44228' }] });
      throw new Error('Unexpected source');
    });
    const provider = createIntelProvider({ control, fetch: fetcher, now: () => now });
    await provider.getBriefings();
    const reads = fetcher.mock.calls.length;
    await provider.getBriefings();
    expect(fetcher.mock.calls).toHaveLength(reads);
    const recorded = control.recordResult.mock.calls.length;
    await provider.getBriefings();
    expect(control.recordResult.mock.calls).toHaveLength(recorded);
    paused = true;
    await expect(provider.getBriefings()).rejects.toThrow('could not be refreshed');
    expect(fetcher.mock.calls).toHaveLength(reads);
  });
  it('semantic validation failures never produce healthy probe state', async () => {
    const control = {
      assertEnabled: vi.fn(),
      markAttempt: vi.fn().mockResolvedValue(now),
      recordResult: vi.fn(),
    };
    const provider = createIntelProvider({
      control,
      fetch: vi
        .fn()
        .mockResolvedValue(Response.json({ data: [{ cve: 'CVE-2021-44228', epss: 5 }] })),
      now: () => now,
    });
    await expect(provider.probe('epss')).rejects.toThrow('invalid probe');
    expect(control.recordResult).toHaveBeenLastCalledWith(
      'FIRST EPSS',
      'unavailable',
      expect.any(String),
      now,
    );
    expect(control.recordResult.mock.calls.some((call) => call[1] === 'healthy')).toBe(false);
  });
  it('keeps package matches with unknown enrichment when KEV is paused', async () => {
    const control = {
      assertEnabled: vi.fn(async (name: string) => {
        if (name === 'CISA KEV')
          throw new SourceControlError(409, 'CISA KEV is paused by an administrator.');
      }),
      markAttempt: vi.fn().mockResolvedValue(now),
      recordResult: vi.fn(),
    };
    const fetcher = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === INTEL_ENDPOINTS.osvBatch)
        return Response.json({ results: [{ vulns: [{ id: 'TEST-001' }] }] });
      if (url.startsWith(INTEL_ENDPOINTS.osvAdvisory))
        return Response.json({
          id: 'TEST-001',
          aliases: ['CVE-2026-12345'],
          summary: 'Synthetic package issue',
          published: '2026-11-01T00:00:00Z',
          modified: '2026-11-02T00:00:00Z',
          affected: [{ package: { name: 'pkg', ecosystem: 'npm' } }],
        });
      if (url.startsWith(INTEL_ENDPOINTS.epss)) return Response.json({ data: [] });
      throw new Error('Paused KEV must not be fetched');
    });
    const result = await createIntelProvider({ control, fetch: fetcher, now: () => now }).scan([
      { name: 'pkg', ecosystem: 'npm', version: '1.0.0' },
    ]);
    expect(result.matches).toHaveLength(1);
    expect(result.matches[0]?.advisory.exploitationStatus).toBe('unknown');
    expect(result.sources).toContainEqual(
      expect.objectContaining({ name: 'CISA KEV', status: 'unavailable' }),
    );
    expect(fetcher.mock.calls.some(([url]) => String(url) === INTEL_ENDPOINTS.kev)).toBe(false);
  });
  it('stops an OSV assessment before any upstream request while paused', async () => {
    const control = {
      assertEnabled: vi.fn().mockRejectedValue(new SourceControlError(409, 'OSV is paused.')),
      markAttempt: vi.fn(),
      recordResult: vi.fn(),
    };
    const fetcher = vi.fn();
    await expect(
      createIntelProvider({ control, fetch: fetcher }).scan([
        { name: 'pkg', ecosystem: 'npm', version: '1.0.0' },
      ]),
    ).rejects.toThrow('paused');
    expect(fetcher).not.toHaveBeenCalled();
    expect(control.markAttempt).not.toHaveBeenCalled();
  });
});
