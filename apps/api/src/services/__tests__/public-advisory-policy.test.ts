import type { PrismaClient } from '@wisesama/database';
import { describe, expect, it, vi } from 'vitest';
import type { IntelAdvisory } from '../intel/types';
import { createPublicAdvisoryPolicy } from '../public-advisory-policy';

const advisory: IntelAdvisory = {
  id: 'GHSA-synthetic',
  aliases: [],
  title: 'Official title',
  summary: 'Synthetic source summary.',
  severity: 'high',
  cvss: 8,
  exploited: false,
  epss: null,
  publishedAt: '2026-11-05T00:00:00Z',
  modifiedAt: '2026-11-05T00:00:00Z',
  references: [],
  source: 'Synthetic test source',
  affected: [{ name: 'synthetic', ecosystem: 'npm' }],
};
function setup(reviews: unknown[]) {
  const db = {
    intelAdvisoryReview: { findMany: vi.fn().mockResolvedValue(reviews) },
    securityAdvisory: { findMany: vi.fn().mockResolvedValue([]) },
  };
  return {
    db,
    policy: createPublicAdvisoryPolicy(
      db as unknown as Pick<PrismaClient, 'intelAdvisoryReview' | 'securityAdvisory'>,
    ),
  };
}
describe('public advisory distribution policy', () => {
  it('lets a hidden review win across GHSA, CVE and OSV alias records, including saved editions', async () => {
    const { db, policy } = setup([
      {
        advisoryId: 'GHSA-hidden',
        visibility: 'hidden',
        guidance: '',
        reviewedAt: null,
        advisory: { id: 'GHSA-hidden', aliases: ['CVE-2026-9999'] },
      },
      {
        advisoryId: 'PYSEC-visible',
        visibility: 'published',
        guidance: 'Visible override must not bypass hiding.',
        reviewedAt: null,
        advisory: { id: 'PYSEC-visible', aliases: ['CVE-2026-9999', 'GHSA-hidden'] },
      },
    ]);
    const alias = { ...advisory, id: 'PYSEC-visible', aliases: ['CVE-2026-9999', 'GHSA-hidden'] };
    expect(await policy.apply([alias])).toEqual([]);
    db.securityAdvisory.findMany.mockResolvedValue([{ id: alias.id, aliases: alias.aliases }]);
    expect(await policy.hiddenIds([alias.id])).toEqual(new Set([alias.id]));
    expect(await policy.hiddenIds([alias])).toEqual(new Set([alias.id]));
    expect(db.intelAdvisoryReview.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          advisory: {
            OR: [
              {
                id: {
                  in: expect.arrayContaining(['PYSEC-visible', 'CVE-2026-9999', 'GHSA-hidden']),
                },
              },
              { aliases: { hasSome: expect.arrayContaining(['CVE-2026-9999']) } },
            ],
          },
        },
      }),
    );
  });
  it('hides only public records without mutating source facts', async () => {
    const { policy } = setup([
      { advisoryId: advisory.id, visibility: 'hidden', guidance: '', reviewedAt: null },
    ]);
    expect(await policy.apply([advisory])).toEqual([]);
    expect(advisory.title).toBe('Official title');
  });
  it('labels guidance separately and strips previously embedded editorial data', async () => {
    const { policy } = setup([
      {
        advisoryId: advisory.id,
        visibility: 'published',
        guidance: 'Review the vendor notice.',
        reviewedAt: new Date('2026-11-05T00:00:00Z'),
      },
    ]);
    const result = (
      await policy.apply([
        {
          ...advisory,
          editorial: { guidance: 'Stale guidance', reviewedAt: null, publisher: 'Wisesama' },
        },
      ])
    )[0]!;
    expect(result.title).toBe(advisory.title);
    expect(result.affected).toEqual(advisory.affected);
    expect(result.editorial).toEqual({
      guidance: 'Review the vendor notice.',
      reviewedAt: '2026-11-05T00:00:00.000Z',
      publisher: 'Wisesama',
    });
  });
  it('fails closed if public visibility cannot be read', async () => {
    const { db, policy } = setup([]);
    db.intelAdvisoryReview.findMany.mockRejectedValue(new Error('Database unavailable'));
    await expect(policy.apply([advisory])).rejects.toThrow('Database unavailable');
  });
});
