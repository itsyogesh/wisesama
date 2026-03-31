/**
 * Ed25519 signature verification for Discord Interactions.
 * Discord requires verifying every interaction request.
 * Uses Web Crypto API (available in Node.js 18+).
 */

export async function verifyDiscordSignature(
  publicKey: string,
  signature: string,
  timestamp: string,
  body: string
): Promise<boolean> {
  try {
    const key = await crypto.subtle.importKey(
      'raw',
      hexToUint8Array(publicKey),
      { name: 'Ed25519' },
      false,
      ['verify']
    );

    const message = new TextEncoder().encode(timestamp + body);
    const sig = hexToUint8Array(signature);

    return await crypto.subtle.verify('Ed25519', key, sig, message);
  } catch (err) {
    console.error('[Discord] Signature verification error:', err);
    return false;
  }
}

function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}
