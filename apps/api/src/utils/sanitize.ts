import { hexToString } from '@polkadot/util';

/**
 * Strip null bytes from on-chain strings.
 * Blockchain identity fields are stored as fixed-width byte arrays
 * padded with \x00, which causes PostgreSQL UTF-8 encoding errors.
 */
export function sanitizeString(s: string | null): string | null {
  if (!s) return null;
  // eslint-disable-next-line no-control-regex
  const cleaned = s.replace(/\x00/g, '').trim();
  return cleaned || null;
}

/**
 * Parse a Polkadot `Data` enum field into a string.
 * Handles Raw hex data, toHuman() format, and plain strings.
 * All outputs are sanitized to strip null bytes.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parseField(field: any): string | null {
  if (!field) return null;

  // Check if it's a Raw type with hex data
  if (field.isRaw && field.asRaw?.toHex) {
    const hex = field.asRaw.toHex();
    if (hex && hex !== '0x') {
      return sanitizeString(hexToString(hex));
    }
  }

  // Try toHuman() for human-readable format
  if (field.toHuman) {
    const human = field.toHuman();
    if (human && typeof human === 'object') {
      const humanObj = human as { Raw?: string };
      if (humanObj.Raw) {
        if (humanObj.Raw.startsWith('0x')) {
          return sanitizeString(hexToString(humanObj.Raw));
        }
        return sanitizeString(humanObj.Raw);
      }
    }
    if (typeof human === 'string' && human !== 'None') {
      return sanitizeString(human);
    }
  }

  return null;
}
