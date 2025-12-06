/**
 * Subscan Service - Feature Extraction for ML Analysis
 *
 * Extracts on-chain features from Polkadot/Kusama addresses using Subscan API.
 * These features are used for ML-based risk scoring.
 *
 * Subscan API Docs: https://support.subscan.io/
 */

import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import type { MLFeatures } from './ml.service';
import type { TransactionSummary, IdentityTimeline } from '@wisesama/types';

const SUBSCAN_API_KEY = process.env.SUBSCAN_API_KEY;

// People Chain genesis timestamps (Unix seconds)
// Used to detect if an identity was migrated from Relay Chain
const PEOPLE_CHAIN_GENESIS: Record<string, number> = {
  polkadot: 1721331384, // July 19, 2024
  kusama: 1715599830, // May 13, 2024
};

// Migration window: first 3 months after People Chain launch
const MIGRATION_WINDOW_SECONDS = 90 * 24 * 60 * 60; // 90 days

// People Chain API URLs
const PEOPLE_CHAIN_URLS: Record<string, string> = {
  polkadot: 'https://people-polkadot.api.subscan.io',
  kusama: 'https://people-kusama.api.subscan.io',
};

/**
 * Check if a timestamp falls within the migration window after People Chain genesis
 */
function isMigrationPeriod(
  timestampSeconds: number,
  chain: 'polkadot' | 'kusama'
): boolean {
  const genesis = PEOPLE_CHAIN_GENESIS[chain]!;
  return (
    timestampSeconds >= genesis &&
    timestampSeconds <= genesis + MIGRATION_WINDOW_SECONDS
  );
}

// SS58 prefixes for address conversion
const SS58_PREFIXES: Record<string, number> = {
  polkadot: 0,
  kusama: 2,
};

/**
 * Normalize address to SS58 format for the specified chain
 * Handles both hex public keys and existing SS58 addresses
 */
function normalizeToSS58(address: string, chain: 'polkadot' | 'kusama'): string {
  try {
    const prefix = SS58_PREFIXES[chain] ?? 0;
    const decoded = decodeAddress(address);
    return encodeAddress(decoded, prefix);
  } catch {
    return address;
  }
}
const SUBSCAN_TIMEOUT = 10000; // 10 seconds

interface SubscanAccountInfo {
  address: string;
  balance: string;
  lock: string;
  balance_lock: string;
  is_evm_contract: boolean;
  account_display?: {
    address: string;
    display: string;
    judgements: Array<{ index: number; judgement: string }>;
    identity: boolean;
    parent?: { address: string; display: string };
  };
  substrate_account?: {
    address: string;
    nonce: number;
  };
}

interface SubscanTransfer {
  from: string;
  to: string;
  amount: string;
  success: boolean;
  block_timestamp: number;
  extrinsic_index: string;
}

interface SubscanTransfersResponse {
  count: number;
  transfers: SubscanTransfer[] | null;
}

export class SubscanService {
  private baseUrls: Record<string, string> = {
    polkadot: 'https://polkadot.api.subscan.io',
    kusama: 'https://kusama.api.subscan.io',
  };

  /**
   * Extract ML features for an address
   */
  async extractFeatures(
    address: string,
    chain: 'polkadot' | 'kusama'
  ): Promise<Partial<MLFeatures> | null> {
    if (!SUBSCAN_API_KEY) {
      console.warn('Subscan API key not configured');
      return null;
    }

    try {
      // Fetch account info and transfers in parallel
      const [accountInfo, transfers] = await Promise.all([
        this.getAccountInfo(address, chain),
        this.getTransfers(address, chain, 100),
      ]);

      if (!accountInfo) {
        return null;
      }

      return this.computeFeatures(accountInfo, transfers);
    } catch (error) {
      console.error('Feature extraction error:', error);
      return null;
    }
  }

  /**
   * Get account info from Subscan
   */
  private async getAccountInfo(
    address: string,
    chain: 'polkadot' | 'kusama'
  ): Promise<SubscanAccountInfo | null> {
    const baseUrl = this.baseUrls[chain];
    if (!baseUrl) return null;

    try {
      const response = await globalThis.fetch(`${baseUrl}/api/v2/scan/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': SUBSCAN_API_KEY!,
        },
        body: JSON.stringify({ key: address }),
        signal: AbortSignal.timeout(SUBSCAN_TIMEOUT),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { data?: { account?: SubscanAccountInfo } };
      return data.data?.account ?? null;
    } catch (error) {
      console.error('Subscan account info error:', error);
      return null;
    }
  }

  /**
   * Get recent transfers for an address
   */
  private async getTransfers(
    address: string,
    chain: 'polkadot' | 'kusama',
    limit: number = 100
  ): Promise<SubscanTransfersResponse | null> {
    const baseUrl = this.baseUrls[chain];
    if (!baseUrl) return null;

    try {
      const response = await globalThis.fetch(`${baseUrl}/api/v2/scan/transfers`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': SUBSCAN_API_KEY!,
        },
        body: JSON.stringify({
          address,
          row: limit,
          page: 0,
        }),
        signal: AbortSignal.timeout(SUBSCAN_TIMEOUT),
      });

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as { data?: SubscanTransfersResponse };
      return data.data ?? null;
    } catch (error) {
      console.error('Subscan transfers error:', error);
      return null;
    }
  }

  /**
   * Compute ML features from Subscan data
   */
  private computeFeatures(
    accountInfo: SubscanAccountInfo,
    transfers: SubscanTransfersResponse | null
  ): Partial<MLFeatures> {
    const transfersList = transfers?.transfers ?? [];
    const now = Date.now() / 1000;

    // Find account creation time (approximate from first transfer)
    const sortedTransfers = [...transfersList].sort(
      (a, b) => a.block_timestamp - b.block_timestamp
    );
    const firstTransfer = sortedTransfers[0];
    const accountAgeHours = firstTransfer
      ? (now - firstTransfer.block_timestamp) / 3600
      : 0;

    // Count unique counterparties
    const counterparties = new Set<string>();
    let inbound = 0;
    let outbound = 0;
    let totalValue = 0;
    let maxValue = 0;
    const values: number[] = [];
    const timestamps: number[] = [];

    for (const tx of transfersList) {
      if (!tx.success) continue;

      const value = parseFloat(tx.amount) || 0;
      values.push(value);
      timestamps.push(tx.block_timestamp);
      totalValue += value;
      if (value > maxValue) maxValue = value;

      if (tx.from.toLowerCase() === accountInfo.address.toLowerCase()) {
        outbound++;
        counterparties.add(tx.to);
      } else {
        inbound++;
        counterparties.add(tx.from);
      }
    }

    // Calculate timing patterns
    const timeDiffs: number[] = [];
    for (let i = 1; i < timestamps.length; i++) {
      timeDiffs.push(timestamps[i]! - timestamps[i - 1]!);
    }
    const avgTimeBetweenTx =
      timeDiffs.length > 0
        ? timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length
        : 0;

    // Check if recently active (last transfer within 7 days)
    const lastTransfer = sortedTransfers[sortedTransfers.length - 1];
    const isActiveNow = lastTransfer
      ? now - lastTransfer.block_timestamp < 7 * 24 * 3600
      : false;

    // Count dust transactions (very small amounts, potentially spam)
    const dustThreshold = 0.001; // 0.001 DOT/KSM
    const dustTransactions = values.filter((v) => v < dustThreshold).length;

    return {
      accountAgeHours,
      hasIdentity: accountInfo.account_display?.identity ?? false,
      totalTransactions: transfersList.length,
      avgTransactionsPerDay:
        accountAgeHours > 0
          ? (transfersList.length / accountAgeHours) * 24
          : 0,
      uniqueCounterparties: counterparties.size,
      inboundOutboundRatio: outbound > 0 ? inbound / outbound : inbound || 0,
      avgTransactionValue:
        values.length > 0
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0,
      maxTransactionValue: maxValue,
      totalVolumeUsd: 0, // Would need price feed integration
      avgTimeBetweenTx,
      hasRegularPattern: this.detectRegularPattern(timeDiffs),
      isActiveNow,
      knownFraudInteractions: 0, // Would need cross-reference with blacklist
      exchangeInteractions: 0, // Would need exchange address list
      dustTransactions,
    };
  }

  /**
   * Detect if transfers follow a regular timing pattern (potential bot behavior)
   */
  private detectRegularPattern(timeDiffs: number[]): boolean {
    if (timeDiffs.length < 5) return false;

    const mean =
      timeDiffs.reduce((a, b) => a + b, 0) / timeDiffs.length;
    const variance =
      timeDiffs.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      timeDiffs.length;
    const stdDev = Math.sqrt(variance);

    // Coefficient of variation < 0.3 suggests regular pattern
    const cv = mean > 0 ? stdDev / mean : 0;
    return cv < 0.3;
  }

  /**
   * Get transaction summary for display in UI
   */
  async getTransactionSummary(
    address: string,
    chain: 'polkadot' | 'kusama'
  ): Promise<TransactionSummary | null> {
    if (!SUBSCAN_API_KEY) {
      return null;
    }

    try {
      const [accountInfo, transfers] = await Promise.all([
        this.getAccountInfo(address, chain),
        this.getTransfers(address, chain, 100),
      ]);

      if (!accountInfo) {
        return null;
      }

      const transfersList = transfers?.transfers ?? [];
      const symbol = chain === 'polkadot' ? 'DOT' : 'KSM';
      const decimals = chain === 'polkadot' ? 10 : 12;

      // Calculate totals
      let totalReceived = 0;
      let totalSent = 0;
      let lastActivityAt: Date | null = null;

      for (const tx of transfersList) {
        if (!tx.success) continue;

        const amount = parseFloat(tx.amount) || 0;
        if (tx.to.toLowerCase() === address.toLowerCase()) {
          totalReceived += amount;
        } else {
          totalSent += amount;
        }

        const txDate = new Date(tx.block_timestamp * 1000);
        if (!lastActivityAt || txDate > lastActivityAt) {
          lastActivityAt = txDate;
        }
      }

      // Parse balance from subscan (already in correct units)
      const rawBalance = parseFloat(accountInfo.balance) || 0;
      const currentBalance = rawBalance / Math.pow(10, decimals);

      return {
        totalTransactions: transfers?.count ?? transfersList.length,
        totalReceived: `${totalReceived.toFixed(5)} ${symbol}`,
        totalSent: `${totalSent.toFixed(5)} ${symbol}`,
        currentBalance: `${currentBalance.toFixed(5)} ${symbol}`,
        lastActivityAt,
      };
    } catch (error) {
      console.error('Transaction summary error:', error);
      return null;
    }
  }

  /**
   * Get block explorer URL for an address
   */
  getBlockExplorerUrl(address: string, chain: 'polkadot' | 'kusama'): string {
    return `https://${chain}.subscan.io/account/${address}`;
  }

  /**
   * Get on-chain identity via Subscan HTTP API
   * This is more reliable in serverless environments than WebSocket RPC
   */
  async getIdentity(
    address: string,
    chain: 'polkadot' | 'kusama'
  ): Promise<{
    hasIdentity: boolean;
    isVerified: boolean;
    displayName: string | null;
    judgements: Array<{ registrarId: number; judgement: string }>;
  } | null> {
    if (!SUBSCAN_API_KEY) {
      console.warn('Subscan API key not configured for identity lookup');
      return null;
    }

    const baseUrl = this.baseUrls[chain];
    if (!baseUrl) return null;

    // Convert hex/any format to SS58 for Subscan API
    const ss58Address = normalizeToSS58(address, chain);
    console.log(`[Subscan] Identity lookup - input: ${address}, ss58: ${ss58Address}, chain: ${chain}`);

    try {
      const response = await globalThis.fetch(`${baseUrl}/api/v2/scan/search`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': SUBSCAN_API_KEY!,
        },
        body: JSON.stringify({ key: ss58Address }),
        signal: AbortSignal.timeout(SUBSCAN_TIMEOUT),
      });

      if (!response.ok) {
        console.error(`Subscan identity lookup failed: ${response.status}`);
        return null;
      }

      const data = (await response.json()) as { data?: { account?: SubscanAccountInfo } };
      const account = data.data?.account;
      console.log(`[Subscan] Response - account_display:`, JSON.stringify(account?.account_display));

      if (!account?.account_display) {
        return {
          hasIdentity: false,
          isVerified: false,
          displayName: null,
          judgements: [],
        };
      }

      const display = account.account_display;
      // Identity data can be in display.people (newer API) or directly in display
      const peopleData = (display as any).people;
      const hasIdentity = peopleData?.identity === true || display.identity === true;
      const rawJudgements = peopleData?.judgements || display.judgements || [];
      const judgements = rawJudgements.map((j: { index: number; judgement: string }) => ({
        registrarId: j.index,
        judgement: j.judgement,
      }));
      const isVerified = judgements.some((j: { registrarId: number; judgement: string }) =>
        ['Reasonable', 'KnownGood'].includes(j.judgement)
      );
      const displayName = peopleData?.display || display.display || null;

      return {
        hasIdentity,
        isVerified,
        displayName: hasIdentity ? displayName : null,
        judgements,
      };
    } catch (error) {
      console.error('Subscan identity lookup error:', error);
      return null;
    }
  }

  /**
   * Get identity timeline showing when identity was created and first verified.
   * Handles migration from Relay Chain to People Chain by checking both chains.
   */
  async getIdentityTimeline(
    address: string,
    chain: 'polkadot' | 'kusama'
  ): Promise<IdentityTimeline | null> {
    if (!SUBSCAN_API_KEY) {
      return null;
    }

    const ss58Address = normalizeToSS58(address, chain);
    const peopleChainUrl = PEOPLE_CHAIN_URLS[chain];
    const relayChainUrl = this.baseUrls[chain];


    if (!peopleChainUrl || !relayChainUrl) {
      return null;
    }

    try {
      // 1. Query People Chain for setIdentity extrinsic
      const peopleChainResult = await this.queryIdentityExtrinsic(
        peopleChainUrl,
        ss58Address
      );

      let identitySetAt = peopleChainResult?.timestamp || null;
      let isMigrated = false;
      let source: 'people_chain' | 'relay_chain' | null = peopleChainResult
        ? 'people_chain'
        : null;

      // 2. If timestamp is in migration window, check Relay Chain for original
      if (
        identitySetAt &&
        isMigrationPeriod(identitySetAt.getTime() / 1000, chain)
      ) {
        const relayChainResult = await this.queryIdentityExtrinsic(
          relayChainUrl,
          ss58Address
        );

        if (
          relayChainResult?.timestamp &&
          relayChainResult.timestamp < identitySetAt
        ) {
          identitySetAt = relayChainResult.timestamp;
          isMigrated = true;
          source = 'relay_chain';
        }
      }

      // 3. If no identity found on People Chain, check Relay Chain
      // (for very old identities that weren't migrated)
      if (!identitySetAt) {
        const relayChainResult = await this.queryIdentityExtrinsic(
          relayChainUrl,
          ss58Address
        );
        if (relayChainResult?.timestamp) {
          identitySetAt = relayChainResult.timestamp;
          source = 'relay_chain';
        }
      }

      // 4. Query for first judgement (verification date)
      const shouldCheckRelayJudgement =
        isMigrated ||
        (identitySetAt &&
          isMigrationPeriod(identitySetAt.getTime() / 1000, chain));

      const [peopleJudgement, relayJudgement] = await Promise.all([
        this.queryJudgementEvent(peopleChainUrl, ss58Address),
        shouldCheckRelayJudgement
          ? this.queryJudgementEvent(relayChainUrl, ss58Address)
          : Promise.resolve(null),
      ]);

      // Use earliest positive judgement
      const judgements = [peopleJudgement, relayJudgement].filter(
        (j): j is Date => j !== null
      );
      const firstVerifiedAt =
        judgements.length > 0
          ? judgements.sort((a, b) => a.getTime() - b.getTime())[0]!
          : null;

      // Return null if no identity data found at all
      if (!identitySetAt && !firstVerifiedAt) {
        return null;
      }

      return {
        identitySetAt,
        firstVerifiedAt,
        isMigrated,
        source,
      };
    } catch (error) {
      console.error('Identity timeline lookup error:', error);
      return null;
    }
  }

  /**
   * Query Subscan for the earliest identity.setIdentity extrinsic
   * Includes retry logic for rate limiting (429 errors)
   */
  private async queryIdentityExtrinsic(
    baseUrl: string,
    address: string,
    retryCount = 0
  ): Promise<{ timestamp: Date; blockNum: number } | null> {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1000; // 1 second delay between retries

    try {
      const response = await globalThis.fetch(
        `${baseUrl}/api/v2/scan/extrinsics`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-API-Key': SUBSCAN_API_KEY!,
          },
          body: JSON.stringify({
            address,
            module: 'identity',
            call: 'set_identity',
            page: 0,
            row: 1,
            order: 'asc', // Get earliest
          }),
          signal: AbortSignal.timeout(SUBSCAN_TIMEOUT),
        }
      );

      // Handle rate limiting with retry
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        console.log(`[Timeline] Rate limited, retrying in ${RETRY_DELAY}ms (attempt ${retryCount + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return this.queryIdentityExtrinsic(baseUrl, address, retryCount + 1);
      }

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        code?: number;
        message?: string;
        data?: {
          count?: number;
          extrinsics?: Array<{ block_timestamp: number; block_num: number }>;
        };
      };

      if (data.code !== 0) {
        return null;
      }

      const extrinsic = data.data?.extrinsics?.[0];

      if (!extrinsic) {
        return null;
      }

      return {
        timestamp: new Date(extrinsic.block_timestamp * 1000),
        blockNum: extrinsic.block_num,
      };
    } catch (error) {
      console.error('Query identity extrinsic error:', error);
      return null;
    }
  }

  /**
   * Query Subscan for the earliest JudgementGiven event for an address
   * Includes retry logic for rate limiting (429 errors)
   */
  private async queryJudgementEvent(
    baseUrl: string,
    address: string,
    retryCount = 0
  ): Promise<Date | null> {
    const MAX_RETRIES = 2;
    const RETRY_DELAY = 1000;

    try {
      const response = await globalThis.fetch(`${baseUrl}/api/v2/scan/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': SUBSCAN_API_KEY!,
        },
        body: JSON.stringify({
          address,
          module: 'identity',
          event_id: 'JudgementGiven',
          page: 0,
          row: 1,
          order: 'asc', // Get earliest
        }),
        signal: AbortSignal.timeout(SUBSCAN_TIMEOUT),
      });

      // Handle rate limiting with retry
      if (response.status === 429 && retryCount < MAX_RETRIES) {
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
        return this.queryJudgementEvent(baseUrl, address, retryCount + 1);
      }

      if (!response.ok) {
        return null;
      }

      const data = (await response.json()) as {
        data?: { events?: Array<{ block_timestamp: number }> };
      };
      const event = data.data?.events?.[0];

      if (!event) {
        return null;
      }

      return new Date(event.block_timestamp * 1000);
    } catch (error) {
      console.error('Query judgement event error:', error);
      return null;
    }
  }
}
