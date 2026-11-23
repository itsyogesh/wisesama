import type { CheckResponse } from '@wisesama/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QueryService } from '../query.service';

interface WhitelistRow {
  name: string;
  category: string;
  isActive: boolean;
}
const mocks = vi.hoisted(() => ({
  row: null as WhitelistRow | null,
  entity: { findUnique: vi.fn(), update: vi.fn() },
  whitelist: { findFirst: vi.fn(), findUnique: vi.fn() },
  search: { create: vi.fn() },
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
  cacheDel: vi.fn(),
  impersonation: vi.fn(),
  scanDomain: vi.fn(),
  reverseTwitter: vi.fn(),
  reverseDomain: vi.fn(),
}));

vi.mock('@wisesama/database', () => ({
  prisma: { entity: mocks.entity, whitelistedEntity: mocks.whitelist, search: mocks.search },
}));
vi.mock('../../../lib/redis', () => ({
  cacheGet: mocks.cacheGet,
  cacheSet: mocks.cacheSet,
  cacheDel: mocks.cacheDel,
  cacheKeys: { entity: (type: string, value: string) => `entity:${type}:${value}` },
}));
vi.mock('../levenshtein.service', () => ({
  LevenshteinService: class {
    checkImpersonation = mocks.impersonation;
  },
}));
vi.mock('../virustotal.service', () => ({
  VirusTotalService: class {
    scanDomain = mocks.scanDomain;
  },
}));
vi.mock('../reverse-lookup.service', () => ({
  ReverseLookupService: class {
    findByTwitter = mocks.reverseTwitter;
    findByDomain = mocks.reverseDomain;
  },
}));
vi.mock('../polkadot.service', () => ({ PolkadotService: class {} }));
vi.mock('../ml.service', () => ({ MLService: class {} }));
vi.mock('../subscan.service', () => ({ SubscanService: class {} }));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.row = null;
  mocks.entity.findUnique.mockResolvedValue(null);
  mocks.entity.update.mockResolvedValue({});
  mocks.search.create.mockResolvedValue({});
  mocks.cacheGet.mockResolvedValue(null);
  mocks.cacheSet.mockResolvedValue(undefined);
  mocks.cacheDel.mockResolvedValue(undefined);
  mocks.scanDomain.mockResolvedValue(null);
  mocks.reverseDomain.mockResolvedValue(undefined);
  mocks.reverseTwitter.mockResolvedValue(undefined);
  mocks.impersonation.mockResolvedValue({ isLookAlike: false });
  // Model the actual active-row filter, rather than returning an inactive row
  // for the fixed query. The legacy unfiltered lookup still sees that row.
  mocks.whitelist.findFirst.mockImplementation(
    async ({ where }: { where: { isActive?: boolean } }) => {
      return where.isActive === true && mocks.row?.isActive
        ? { name: mocks.row.name, category: mocks.row.category }
        : null;
    },
  );
  mocks.whitelist.findUnique.mockImplementation(async () => mocks.row);
});

function blacklist() {
  mocks.entity.findUnique.mockResolvedValue({
    id: 'known-threat',
    riskLevel: 'FRAUD',
    source: 'polkadot-js-phishing',
    userReportCount: 0,
    timesSearched: 1,
    lastSearchedAt: new Date('2026-01-01'),
  });
}

function expectNoRetiredDetails(response: CheckResponse) {
  expect(response.whitelist).toEqual({ found: false, name: undefined, category: undefined });
  expect(JSON.stringify(response)).not.toContain('Retired project');
  expect(JSON.stringify(response)).not.toContain('private-category');
}

describe('current whitelist trust', () => {
  it('keeps inactive rows out of trust and details while preserving domain normalization', async () => {
    mocks.row = { name: 'Retired project', category: 'private-category', isActive: false };
    blacklist();
    const response = await new QueryService().checkEntity(' https://www.Example.test/path ');
    expect(response.assessment.riskLevel).toBe('FRAUD');
    expectNoRetiredDetails(response);
    expect(mocks.whitelist.findFirst).toHaveBeenCalledWith({
      where: { entityType: 'DOMAIN', normalizedValue: 'example.test', isActive: true },
      select: { name: true, category: true },
    });
    expect(mocks.scanDomain).toHaveBeenCalledWith('example.test');
  });

  it('recomputes and replaces a cached SAFE response after deactivation', async () => {
    const service = new QueryService();
    mocks.row = { name: 'Retired project', category: 'private-category', isActive: true };
    blacklist();
    const positive = await service.checkEntity('example.test');
    expect(positive.assessment.riskLevel).toBe('SAFE');
    mocks.cacheGet.mockResolvedValue(positive);
    mocks.row.isActive = false;

    const response = await service.checkEntity('example.test');
    expect(response.assessment.riskLevel).toBe('FRAUD');
    expectNoRetiredDetails(response);
    expect(mocks.cacheDel).toHaveBeenCalledWith('entity:DOMAIN:example.test');
    expect(mocks.cacheSet).toHaveBeenLastCalledWith('entity:DOMAIN:example.test', response, 300);
  });

  it('rechecks active trust while reusing an unchanged cached response', async () => {
    const service = new QueryService();
    mocks.row = { name: 'Community', category: 'project', isActive: true };
    const positive = await service.checkEntity('example.test');
    mocks.cacheGet.mockResolvedValue(positive);

    const response = await service.checkEntity('example.test');
    expect(response.assessment.riskLevel).toBe('SAFE');
    expect(response.whitelist.name).toBe('Community');
    expect(mocks.whitelist.findFirst).toHaveBeenCalledTimes(2);
    expect(mocks.scanDomain).toHaveBeenCalledTimes(1);
    expect(mocks.cacheDel).not.toHaveBeenCalled();
  });

  it('replaces cached names and picks up newly active trust', async () => {
    const service = new QueryService();
    const unknown = await service.checkEntity('example.test');
    mocks.cacheGet.mockResolvedValue(unknown);
    mocks.row = { name: 'Current project', category: 'project', isActive: true };
    const active = await service.checkEntity('example.test');
    expect(active.assessment.riskLevel).toBe('SAFE');
    expect(active.whitelist.name).toBe('Current project');

    mocks.cacheGet.mockResolvedValue(active);
    mocks.row.name = 'Renamed project';
    const renamed = await service.checkEntity('example.test');
    expect(renamed.whitelist.name).toBe('Renamed project');
    expect(JSON.stringify(renamed)).not.toContain('Current project');
  });

  it('checks deactivation after provider work completes', async () => {
    mocks.row = { name: 'Retired project', category: 'private-category', isActive: true };
    mocks.scanDomain.mockImplementation(async () => {
      mocks.row!.isActive = false;
      return null;
    });
    const response = await new QueryService().checkEntity('example.test');
    expect(response.assessment.riskLevel).toBe('UNKNOWN');
    expectNoRetiredDetails(response);
  });

  it('removes cached look-alike labels when their whitelist reference is no longer active', async () => {
    const service = new QueryService();
    mocks.impersonation.mockResolvedValueOnce({
      isLookAlike: true,
      possibleImpersonating: 'Retired project',
      knownHandle: 'retired',
      similarity: 0.9,
      warning: 'Similar to Retired project',
    });
    const previous = await service.checkEntity('@Community');
    expect(previous.assessment.riskLevel).toBe('CAUTION');
    mocks.cacheGet.mockResolvedValue(previous);

    const response = await service.checkEntity('@Community');
    expect(response.assessment.riskLevel).toBe('UNKNOWN');
    expect(response.lookAlike).toEqual({ isLookAlike: false });
    expect(JSON.stringify(response)).not.toContain('Retired project');
    expect(mocks.cacheDel).toHaveBeenCalledWith('entity:TWITTER:community');
  });

  it('does not serve cached positive trust when current-active verification fails', async () => {
    const service = new QueryService();
    mocks.row = { name: 'Community', category: 'project', isActive: true };
    const positive = await service.checkEntity('example.test');
    mocks.cacheGet.mockResolvedValue(positive);
    mocks.whitelist.findFirst.mockRejectedValue(new Error('Current state unavailable'));
    await expect(service.checkEntity('example.test')).rejects.toThrow('Current state unavailable');
  });
});
