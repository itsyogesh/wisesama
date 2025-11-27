import { decodeAddress } from '@polkadot/util-crypto';
import { u8aToHex } from '@polkadot/util';
import type { EntityType } from '@wisesama/types';

/**
 * Normalize an entity value based on its type.
 * - ADDRESS: Convert to hex public key (chain-agnostic)
 * - TWITTER: Lowercase, strip @ prefix
 * - DOMAIN: Lowercase, strip protocol/www
 * - EMAIL: Lowercase
 */
export function normalizeEntityValue(value: string, entityType: EntityType): string {
  switch (entityType) {
    case 'ADDRESS':
      return normalizeAddress(value);
    case 'TWITTER':
      return value.toLowerCase().replace(/^@/, '');
    case 'DOMAIN':
      return normalizeDomain(value);
    case 'EMAIL':
      return value.toLowerCase();
    default:
      return value.toLowerCase();
  }
}

/**
 * Normalize a Polkadot/Substrate address to hex public key.
 * This is chain-agnostic - same address on any SS58 network resolves to same hex.
 *
 * Example:
 * - Polkadot: 155dDX3rWoNsY4aiJFbsu6wLB91c2J2Ws5BgMfJKyM1eGnkS
 * - Kusama:   GewjW8fHP8KrBPe7KMveuUBU7JC8fHZExHwb2avu4CcqBwE
 * Both resolve to: 0xb477d42ac66fb36b2e5d1c53f8b1530de94c3cfe7a666ea5d6c72c467c53b429
 *
 * See: https://forum.polkadot.network/t/unifying-polkadot-ecosystem-address-format/10042
 */
export function normalizeAddress(address: string): string {
  const decoded = decodeAddress(address);
  return u8aToHex(decoded);
}

/**
 * Normalize a domain for consistent lookup.
 * - Lowercase
 * - Strip protocol (http://, https://)
 * - Strip www. prefix
 * - Remove path
 */
export function normalizeDomain(domain: string): string {
  return (
    domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .split('/')[0] ?? ''
  );
}

/**
 * Check if a string is a valid Polkadot/Substrate address.
 */
export function isValidAddress(address: string): boolean {
  try {
    decodeAddress(address);
    return true;
  } catch {
    return false;
  }
}
