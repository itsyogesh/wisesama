import { distance } from 'fastest-levenshtein';
import { prisma } from '@wisesama/database';
import type { LookAlikeResult } from '@wisesama/types';

export class LevenshteinService {
  async checkImpersonation(
    handle: string,
    platform: 'twitter' | 'telegram' = 'twitter'
  ): Promise<LookAlikeResult> {
    // Get whitelisted handles for the platform
    const whitelisted = await prisma.whitelistedEntity.findMany({
      where: {
        entityType: platform === 'twitter' ? 'TWITTER' : 'TWITTER', // TODO: Add TELEGRAM type
        isActive: true,
        twitter: { not: null },
      },
      select: {
        twitter: true,
        name: true,
      },
    });

    if (whitelisted.length === 0) {
      return { isLookAlike: false };
    }

    const normalizedHandle = handle.toLowerCase().replace(/^@/, '');

    // Calculate similarity for each known handle
    const matches = whitelisted
      .filter((w) => w.twitter)
      .map((w) => {
        const knownHandle = w.twitter!.toLowerCase().replace(/^@/, '');
        const dist = distance(normalizedHandle, knownHandle);
        const maxLen = Math.max(normalizedHandle.length, knownHandle.length);
        const similarity = 1 - dist / maxLen;

        return {
          handle: w.twitter!,
          name: w.name,
          distance: dist,
          similarity,
        };
      })
      .filter((m) => m.similarity > 0.7 && m.distance > 0) // Similar but not exact match
      .sort((a, b) => b.similarity - a.similarity);

    const topMatch = matches[0];
    if (!topMatch) {
      return { isLookAlike: false };
    }

    return {
      isLookAlike: true,
      possibleImpersonating: topMatch.name,
      knownHandle: topMatch.handle,
      similarity: topMatch.similarity,
      warning: `This handle is similar to ${topMatch.name} (${topMatch.handle})`,
    };
  }

  // Check if two strings are similar enough to be considered impersonation
  areSimilar(str1: string, str2: string, threshold: number = 0.7): boolean {
    const s1 = str1.toLowerCase();
    const s2 = str2.toLowerCase();
    const dist = distance(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    const similarity = 1 - dist / maxLen;
    return similarity >= threshold;
  }
}
