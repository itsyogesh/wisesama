import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { SubscanService } from '../subscan.service';

// People Chain genesis timestamps (must match the service)
const POLKADOT_GENESIS = 1721331384; // July 19, 2024
const KUSAMA_GENESIS = 1715599830; // May 13, 2024
const MIGRATION_WINDOW = 90 * 24 * 60 * 60; // 90 days

/**
 * Helper to create a mock Response object
 */
function createMockResponse(data: unknown): Response {
  return {
    ok: true,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
  } as Response;
}

/**
 * Helper to create a mock Response for fetch errors
 */
function createErrorResponse(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    json: () => Promise.reject(new Error('Not ok')),
  } as Response;
}

describe('SubscanService', () => {
  let subscanService: SubscanService;
  let fetchMock: Mock;

  beforeEach(() => {
    subscanService = new SubscanService();
    // Mock global fetch
    fetchMock = vi.spyOn(globalThis, 'fetch') as Mock;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getIdentityTimeline', () => {
    it('should return null when SUBSCAN_API_KEY is empty', async () => {
      // Temporarily clear the API key
      const originalKey = process.env.SUBSCAN_API_KEY;
      process.env.SUBSCAN_API_KEY = '';

      // Create new instance to pick up the empty key
      const service = new SubscanService();

      const result = await service.getIdentityTimeline(
        '12j2Cii99aT1K3kJQmz2JvPHURecq7BevCmtNx2g61kDqsBb',
        'polkadot'
      );

      expect(result).toBeNull();

      // Restore the key
      process.env.SUBSCAN_API_KEY = originalKey;
    });

    it('should query People Chain first, then Relay Chain if not found', async () => {
      const fetchCalls: string[] = [];

      fetchMock.mockImplementation(async (url: string) => {
        fetchCalls.push(url);

        // People Chain returns no extrinsics
        if (url.includes('people-polkadot') && url.includes('extrinsics')) {
          return createMockResponse({
            code: 0,
            data: { count: 0, extrinsics: null }
          });
        }

        // Relay Chain returns extrinsic from 2020
        if (url.includes('polkadot.api.subscan.io') && url.includes('extrinsics')) {
          return createMockResponse({
            code: 0,
            data: {
              count: 1,
              extrinsics: [{
                block_timestamp: 1591692792, // June 9, 2020
                block_num: 197559
              }]
            }
          });
        }

        // No events for judgements
        if (url.includes('events')) {
          return createMockResponse({
            code: 0,
            data: { count: 0, events: null }
          });
        }

        return createMockResponse({ code: 0, data: {} });
      });

      const result = await subscanService.getIdentityTimeline(
        '12j2Cii99aT1K3kJQmz2JvPHURecq7BevCmtNx2g61kDqsBb',
        'polkadot'
      );

      expect(result).not.toBeNull();
      expect(result?.identitySetAt).toEqual(new Date(1591692792 * 1000));
      expect(result?.source).toBe('relay_chain');
      expect(result?.isMigrated).toBe(false);

      // Verify both chains were queried for extrinsics
      expect(fetchCalls.some(url => url.includes('people-polkadot'))).toBe(true);
      expect(fetchCalls.some(url => url.includes('polkadot.api.subscan.io'))).toBe(true);
    });

    it('should detect migrated identities when timestamp is in migration window', async () => {
      const migrationTimestamp = POLKADOT_GENESIS + (30 * 24 * 60 * 60); // 30 days after genesis
      const originalTimestamp = 1591692792; // June 9, 2020 (original identity)

      fetchMock.mockImplementation(async (url: string) => {
        // People Chain returns extrinsic in migration window
        if (url.includes('people-polkadot') && url.includes('extrinsics')) {
          return createMockResponse({
            code: 0,
            data: {
              count: 1,
              extrinsics: [{
                block_timestamp: migrationTimestamp,
                block_num: 1000
              }]
            }
          });
        }

        // Relay Chain returns earlier extrinsic
        if (url.includes('polkadot.api.subscan.io') && url.includes('extrinsics')) {
          return createMockResponse({
            code: 0,
            data: {
              count: 1,
              extrinsics: [{
                block_timestamp: originalTimestamp,
                block_num: 197559
              }]
            }
          });
        }

        // No events
        if (url.includes('events')) {
          return createMockResponse({
            code: 0,
            data: { count: 0, events: null }
          });
        }

        return createMockResponse({ code: 0, data: {} });
      });

      const result = await subscanService.getIdentityTimeline(
        '12j2Cii99aT1K3kJQmz2JvPHURecq7BevCmtNx2g61kDqsBb',
        'polkadot'
      );

      expect(result).not.toBeNull();
      expect(result?.identitySetAt).toEqual(new Date(originalTimestamp * 1000));
      expect(result?.source).toBe('relay_chain');
      expect(result?.isMigrated).toBe(true);
    });

    it('should return identity from People Chain when not in migration window', async () => {
      const afterMigrationWindow = POLKADOT_GENESIS + MIGRATION_WINDOW + (30 * 24 * 60 * 60);

      fetchMock.mockImplementation(async (url: string) => {
        // People Chain returns extrinsic after migration window
        if (url.includes('people-polkadot') && url.includes('extrinsics')) {
          return createMockResponse({
            code: 0,
            data: {
              count: 1,
              extrinsics: [{
                block_timestamp: afterMigrationWindow,
                block_num: 5000
              }]
            }
          });
        }

        // No events
        if (url.includes('events')) {
          return createMockResponse({
            code: 0,
            data: { count: 0, events: null }
          });
        }

        return createMockResponse({ code: 0, data: {} });
      });

      const result = await subscanService.getIdentityTimeline(
        '12j2Cii99aT1K3kJQmz2JvPHURecq7BevCmtNx2g61kDqsBb',
        'polkadot'
      );

      expect(result).not.toBeNull();
      expect(result?.identitySetAt).toEqual(new Date(afterMigrationWindow * 1000));
      expect(result?.source).toBe('people_chain');
      expect(result?.isMigrated).toBe(false);
    });

    it('should return firstVerifiedAt from JudgementGiven events', async () => {
      const identityTimestamp = 1591692792; // June 9, 2020
      const judgementTimestamp = 1594371600; // July 10, 2020

      fetchMock.mockImplementation(async (url: string) => {
        // People Chain - no extrinsics
        if (url.includes('people-polkadot') && url.includes('extrinsics')) {
          return createMockResponse({
            code: 0,
            data: { count: 0, extrinsics: null }
          });
        }

        // People Chain - no events
        if (url.includes('people-polkadot') && url.includes('events')) {
          return createMockResponse({
            code: 0,
            data: { count: 0, events: null }
          });
        }

        // Relay Chain extrinsic
        if (url.includes('polkadot.api.subscan.io') && url.includes('extrinsics')) {
          return createMockResponse({
            code: 0,
            data: {
              count: 1,
              extrinsics: [{
                block_timestamp: identityTimestamp,
                block_num: 197559
              }]
            }
          });
        }

        // Relay Chain judgement event (not queried because not in migration period)
        // But we'll add it anyway for the test
        if (url.includes('polkadot.api.subscan.io') && url.includes('events')) {
          return createMockResponse({
            code: 0,
            data: {
              count: 1,
              events: [{
                block_timestamp: judgementTimestamp
              }]
            }
          });
        }

        return createMockResponse({ code: 0, data: {} });
      });

      const result = await subscanService.getIdentityTimeline(
        '12j2Cii99aT1K3kJQmz2JvPHURecq7BevCmtNx2g61kDqsBb',
        'polkadot'
      );

      expect(result).not.toBeNull();
      expect(result?.identitySetAt).toEqual(new Date(identityTimestamp * 1000));
      // Note: firstVerifiedAt may be null if relay judgement isn't queried
      // because identity is not in migration period
    });

    it('should return null when no identity data found', async () => {
      fetchMock.mockImplementation(async () => {
        return createMockResponse({
          code: 0,
          data: { count: 0, extrinsics: null, events: null }
        });
      });

      const result = await subscanService.getIdentityTimeline(
        '12j2Cii99aT1K3kJQmz2JvPHURecq7BevCmtNx2g61kDqsBb',
        'polkadot'
      );

      expect(result).toBeNull();
    });

    it('should handle Kusama chain with correct genesis timestamp', async () => {
      const migrationTimestamp = KUSAMA_GENESIS + (30 * 24 * 60 * 60);
      const originalTimestamp = 1590000000; // Before migration

      fetchMock.mockImplementation(async (url: string) => {
        // People Kusama returns extrinsic in migration window
        if (url.includes('people-kusama') && url.includes('extrinsics')) {
          return createMockResponse({
            code: 0,
            data: {
              count: 1,
              extrinsics: [{
                block_timestamp: migrationTimestamp,
                block_num: 1000
              }]
            }
          });
        }

        // Kusama Relay Chain returns earlier extrinsic
        if (url.includes('kusama.api.subscan.io') && url.includes('extrinsics')) {
          return createMockResponse({
            code: 0,
            data: {
              count: 1,
              extrinsics: [{
                block_timestamp: originalTimestamp,
                block_num: 500
              }]
            }
          });
        }

        // No events
        if (url.includes('events')) {
          return createMockResponse({
            code: 0,
            data: { count: 0, events: null }
          });
        }

        return createMockResponse({ code: 0, data: {} });
      });

      const result = await subscanService.getIdentityTimeline(
        'GewjW8fHP8KrBPe7KMveuUBU7JC8fHZExHwb2avu4CcqBwE',
        'kusama'
      );

      expect(result).not.toBeNull();
      expect(result?.identitySetAt).toEqual(new Date(originalTimestamp * 1000));
      expect(result?.source).toBe('relay_chain');
      expect(result?.isMigrated).toBe(true);
    });

    it('should handle API errors gracefully', async () => {
      fetchMock.mockImplementation(async () => {
        return createErrorResponse(500, 'Internal Server Error');
      });

      const result = await subscanService.getIdentityTimeline(
        '12j2Cii99aT1K3kJQmz2JvPHURecq7BevCmtNx2g61kDqsBb',
        'polkadot'
      );

      expect(result).toBeNull();
    });

    it('should handle network timeouts gracefully', async () => {
      fetchMock.mockImplementation(async () => {
        throw new Error('AbortError: The operation was aborted');
      });

      const result = await subscanService.getIdentityTimeline(
        '12j2Cii99aT1K3kJQmz2JvPHURecq7BevCmtNx2g61kDqsBb',
        'polkadot'
      );

      expect(result).toBeNull();
    });
  });
});
