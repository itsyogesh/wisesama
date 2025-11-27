import { decodeAddress, encodeAddress } from '@polkadot/util-crypto';
import type { EntityType } from '@wisesama/types';

interface DetectionResult {
  type: EntityType;
  normalized: string;
  chain?: string;
}

// SS58 prefixes for different chains
const SS58_PREFIXES: Record<number, string> = {
  0: 'polkadot',
  2: 'kusama',
  5: 'astar',
  7: 'edgeware',
  42: 'substrate', // Generic substrate
};

export function detectEntityType(input: string): DetectionResult {
  const trimmed = input.trim();

  // Check if it's a Twitter handle
  if (isTwitterHandle(trimmed)) {
    return {
      type: 'TWITTER',
      normalized: normalizeTwitterHandle(trimmed),
    };
  }

  // Check if it's an email
  if (isEmail(trimmed)) {
    return {
      type: 'EMAIL',
      normalized: trimmed.toLowerCase(),
    };
  }

  // Check if it's a Polkadot/Substrate address
  const addressResult = isPolkadotAddress(trimmed);
  if (addressResult) {
    return {
      type: 'ADDRESS',
      normalized: addressResult.normalized,
      chain: addressResult.chain,
    };
  }

  // Check if it's a domain
  if (isDomain(trimmed)) {
    return {
      type: 'DOMAIN',
      normalized: normalizeDomain(trimmed),
    };
  }

  // Default to treating as a domain if nothing else matches
  return {
    type: 'DOMAIN',
    normalized: trimmed.toLowerCase(),
  };
}

function isTwitterHandle(input: string): boolean {
  // Twitter handles: @username or just username (1-15 chars, alphanumeric + underscore)
  const handle = input.startsWith('@') ? input.slice(1) : input;
  return /^[a-zA-Z0-9_]{1,15}$/.test(handle) && !isDomain(input);
}

function normalizeTwitterHandle(input: string): string {
  const handle = input.startsWith('@') ? input.slice(1) : input;
  return handle.toLowerCase();
}

function isEmail(input: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input);
}

function isPolkadotAddress(input: string): { normalized: string; chain: string } | null {
  try {
    // Try to decode as SS58
    const decoded = decodeAddress(input);

    // Re-encode to get normalized form
    // Try to detect the chain from the prefix
    let chain = 'unknown';
    for (const [prefix, chainName] of Object.entries(SS58_PREFIXES)) {
      try {
        const encoded = encodeAddress(decoded, parseInt(prefix));
        if (encoded === input) {
          chain = chainName;
          break;
        }
      } catch {
        // Try next prefix
      }
    }

    // Normalize to generic substrate format (SS58 prefix 42)
    const normalized = encodeAddress(decoded, 42);

    return { normalized: normalized.toLowerCase(), chain };
  } catch {
    return null;
  }
}

function isDomain(input: string): boolean {
  // Remove protocol if present
  const cleaned = input.replace(/^https?:\/\//, '').split('/')[0] ?? '';

  // Check if it looks like a domain
  return /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+$/.test(
    cleaned
  );
}

function normalizeDomain(input: string): string {
  // Remove protocol and path
  const cleaned = (input
    .replace(/^https?:\/\//, '')
    .split('/')[0] ?? '')
    .toLowerCase();

  // Remove www. prefix
  return cleaned.replace(/^www\./, '');
}

export function normalizeEntity(input: string, type: EntityType): string {
  switch (type) {
    case 'TWITTER':
      return normalizeTwitterHandle(input);
    case 'EMAIL':
      return input.toLowerCase();
    case 'DOMAIN':
      return normalizeDomain(input);
    case 'ADDRESS':
      return isPolkadotAddress(input)?.normalized || input.toLowerCase();
    default:
      return input.toLowerCase();
  }
}
