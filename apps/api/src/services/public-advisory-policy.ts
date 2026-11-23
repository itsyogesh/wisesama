import type { PrismaClient } from '@wisesama/database';
import type { IntelAdvisory } from './intel/types';

/** Editorial choices affect public distribution, never the official match or private finding. */
export function createPublicAdvisoryPolicy(
  db: Pick<PrismaClient, 'intelAdvisoryReview' | 'securityAdvisory'>,
) {
  type Identity = Pick<IntelAdvisory, 'id' | 'aliases'>;
  const keys = (value: Identity) => new Set([value.id, ...value.aliases].filter(Boolean));
  async function reviewsFor(advisories: Identity[]) {
    const identities = [...new Set(advisories.flatMap((value) => [...keys(value)]))];
    if (identities.length > 20_000)
      throw new Error('Public advisory identity scope exceeds the safe distribution limit.');
    return db.intelAdvisoryReview.findMany({
      where: {
        advisory: { OR: [{ id: { in: identities } }, { aliases: { hasSome: identities } }] },
      },
      select: {
        advisoryId: true,
        visibility: true,
        guidance: true,
        reviewedAt: true,
        advisory: { select: { id: true, aliases: true } },
      },
      orderBy: [{ reviewedAt: 'desc' }, { advisoryId: 'asc' }],
    });
  }
  const equivalent = (input: Identity, review: { advisoryId: string; advisory?: Identity }) => {
    const inputKeys = keys(input);
    return [...keys(review.advisory ?? { id: review.advisoryId, aliases: [] })].some((key) =>
      inputKeys.has(key),
    );
  };
  async function apply(advisories: IntelAdvisory[]) {
    if (!advisories.length) return [];
    const reviews = await reviewsFor(advisories);
    return advisories.flatMap((advisory) => {
      const related = reviews.filter((review) => equivalent(advisory, review));
      if (related.some((review) => review.visibility === 'hidden')) return [];
      const review = related.find((review) => review.advisoryId === advisory.id) ?? related[0];
      // Strip earlier editorial metadata before applying the current operator-controlled facts.
      const { editorial: _prior, ...source } = advisory;
      return [
        {
          ...source,
          ...(review?.guidance.trim()
            ? {
                editorial: {
                  guidance: review.guidance,
                  reviewedAt: review.reviewedAt?.toISOString() ?? null,
                  publisher: 'Wisesama' as const,
                },
              }
            : {}),
        },
      ];
    });
  }
  async function hiddenIds(inputs: Array<string | Identity>) {
    if (!inputs.length) return new Set<string>();
    const ids = inputs.map((value) => (typeof value === 'string' ? value : value.id));
    const records = await db.securityAdvisory.findMany({
      where: { id: { in: ids } },
      select: { id: true, aliases: true },
    });
    const identities = inputs.map((value) => {
      const id = typeof value === 'string' ? value : value.id;
      return {
        id,
        aliases: [
          ...new Set([
            ...(typeof value === 'string' ? [] : value.aliases),
            ...(records.find((record) => record.id === id)?.aliases ?? []),
          ]),
        ],
      };
    });
    const reviews = await reviewsFor(identities);
    return new Set(
      identities
        .filter((identity) =>
          reviews.some((review) => review.visibility === 'hidden' && equivalent(identity, review)),
        )
        .map((identity) => identity.id),
    );
  }
  return { apply, hiddenIds };
}
