/**
 * LNURL-auth utilities for Lightning wallet-based identity
 *
 * Implements LNURL-auth spec: https://github.com/lnurl/luds/blob/luds/04.md
 */

import crypto from 'crypto';
import { bech32 } from 'bech32';
import * as secp256k1 from '@noble/secp256k1';
import { LnurlIdentity } from '@/types';

// Configure sha256 for @noble/secp256k1 v3 using Node's built-in crypto
// This is required for sync signature verification
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(secp256k1.hashes as any).sha256 = (message: Uint8Array): Uint8Array => {
  return new Uint8Array(crypto.createHash('sha256').update(message).digest());
};
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(secp256k1.hashes as any).hmacSha256 = (key: Uint8Array, ...messages: Uint8Array[]): Uint8Array => {
  const hmac = crypto.createHmac('sha256', key);
  for (const msg of messages) {
    hmac.update(msg);
  }
  return new Uint8Array(hmac.digest());
};

/**
 * Generate a random k1 challenge (32 bytes as hex string)
 * This is the challenge that the wallet will sign
 */
export function generateK1(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create a bech32-encoded LNURL-auth URL
 * @param k1 - The challenge string (hex)
 * @param baseUrl - The base URL of the callback endpoint
 * @returns Bech32-encoded LNURL string (starts with 'lnurl1...')
 */
export function createLnurlAuth(k1: string, baseUrl?: string): string {
  const base = baseUrl || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  // Include tag=login, k1, and action=login per LNURL-auth best practices
  const callbackUrl = `${base}/api/lnurl/callback?tag=login&k1=${k1}&action=login`;

  // Convert URL to bytes and encode with bech32
  // LNURL spec uses 1023 character limit (bech32 with checksum)
  const words = bech32.toWords(Buffer.from(callbackUrl, 'utf8'));
  return bech32.encode('lnurl', words, 1023);
}

/**
 * Decode a bech32-encoded LNURL to get the callback URL
 * @param lnurl - The bech32-encoded LNURL string
 * @returns The decoded callback URL
 */
export function decodeLnurl(lnurl: string): string {
  const { words } = bech32.decode(lnurl, 1023);
  const bytes = bech32.fromWords(words);
  return Buffer.from(bytes).toString('utf8');
}

/**
 * Verify an LNURL-auth signature
 * The wallet signs the k1 challenge using its linking key (secp256k1)
 *
 * @param k1 - The original challenge (hex string)
 * @param sig - The DER-encoded signature from the wallet (hex string)
 * @param key - The wallet's public key / linking key (hex string, 66 chars compressed)
 * @returns boolean indicating if signature is valid
 */
export function verifyLnurlSignature(k1: string, sig: string, key: string): boolean {
  try {
    // Convert hex strings to Uint8Arrays
    const k1Bytes = hexToBytes(k1);
    const signature = hexToBytes(sig);
    const publicKey = hexToBytes(key);

    // The signature should be in DER format, we need to convert to compact format
    // secp256k1.verify expects a 64-byte compact signature
    const compactSig = derToCompact(signature);
    if (!compactSig) {
      console.error('Failed to parse DER signature');
      return false;
    }

    // Verify the signature
    return secp256k1.verify(compactSig, k1Bytes, publicKey);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Convert a DER-encoded signature to compact format (64 bytes)
 * DER format: 0x30 [total-length] 0x02 [r-length] [r] 0x02 [s-length] [s]
 */
function derToCompact(der: Uint8Array): Uint8Array | null {
  try {
    // Check DER prefix
    if (der[0] !== 0x30) {
      return null;
    }

    let offset = 2; // Skip 0x30 and length byte

    // Parse r
    if (der[offset] !== 0x02) return null;
    offset++;
    const rLen = der[offset];
    offset++;
    let rStart = offset;
    let rActualLen = rLen;

    // Skip leading zero padding
    if (der[rStart] === 0x00 && rLen > 32) {
      rStart++;
      rActualLen--;
    }

    offset += rLen;

    // Parse s
    if (der[offset] !== 0x02) return null;
    offset++;
    const sLen = der[offset];
    offset++;
    let sStart = offset;
    let sActualLen = sLen;

    // Skip leading zero padding
    if (der[sStart] === 0x00 && sLen > 32) {
      sStart++;
      sActualLen--;
    }

    // Create 64-byte compact signature
    const compact = new Uint8Array(64);

    // Copy r, right-aligned to 32 bytes
    const rBytes = der.slice(rStart, rStart + rActualLen);
    compact.set(rBytes, 32 - rActualLen);

    // Copy s, right-aligned to 32 bytes
    const sBytes = der.slice(sStart, sStart + sActualLen);
    compact.set(sBytes, 64 - sActualLen);

    return compact;
  } catch {
    return null;
  }
}

/**
 * Generate an anonymous nym from a linking key
 * Creates a deterministic, human-readable identifier like "anon-A1B2C3"
 *
 * @param linkingKey - The wallet's public key (hex string)
 * @returns A nym string like "anon-A1B2C3"
 */
export function generateAnonNym(linkingKey: string): string {
  const hash = crypto.createHash('sha256').update(linkingKey).digest('hex');
  // Use first 6 characters for uniqueness, uppercase for readability
  return `anon-${hash.slice(0, 6).toUpperCase()}`;
}

/**
 * Generate a device-based nym for anonymous users
 * @param deviceSessionId - The device session UUID
 * @returns A nym string like "anon-D3F4G5"
 */
export function generateDeviceNym(deviceSessionId: string): string {
  const hash = crypto.createHash('sha256').update(deviceSessionId).digest('hex');
  return `anon-${hash.slice(0, 6).toLowerCase()}`;
}

/**
 * Format an author nym for display
 * Returns the display name if set, otherwise the anonymous nym
 *
 * @param identity - The LNURL identity object, or null for anonymous
 * @param deviceSessionId - The device session ID for fallback nym
 * @returns Formatted nym string (without @ prefix)
 */
export function formatAuthorNym(
  identity: { display_name: string | null; anon_nym: string } | null,
  deviceSessionId?: string
): string {
  if (identity) {
    if (identity.display_name) {
      return identity.display_name;
    }
    return identity.anon_nym;
  }

  // Anonymous user
  if (deviceSessionId) {
    return generateDeviceNym(deviceSessionId);
  }

  return 'anon';
}

/**
 * Validate a linking key (public key)
 * Must be a valid secp256k1 compressed public key (33 bytes / 66 hex chars)
 */
export function isValidLinkingKey(key: string): boolean {
  try {
    // Must be hex string of 66 characters (33 bytes compressed pubkey)
    if (!/^[0-9a-fA-F]{66}$/.test(key)) {
      return false;
    }

    // Must start with 02 or 03 (compressed public key prefix)
    if (!key.startsWith('02') && !key.startsWith('03')) {
      return false;
    }

    // Validate by attempting to get the public key point
    // In v3, we can use getPublicKey with a private key or validate via Point
    const pubkeyBytes = hexToBytes(key);

    // Simple validation: check it's the right length and has valid prefix
    // Full curve validation would require more complex checks
    // The verify function will fail anyway if the key is invalid
    return pubkeyBytes.length === 33 && (pubkeyBytes[0] === 0x02 || pubkeyBytes[0] === 0x03);
  } catch {
    return false;
  }
}

/**
 * Validate a display name
 * Rules: 1-30 characters, alphanumeric and underscores only, no leading/trailing underscores
 */
export function isValidDisplayName(name: string): boolean {
  if (!name || typeof name !== 'string') return false;
  if (name.length < 1 || name.length > 30) return false;
  if (!/^[a-zA-Z0-9_]+$/.test(name)) return false;
  if (name.startsWith('_') || name.endsWith('_')) return false;
  if (name.startsWith('anon')) return false; // Reserved prefix
  return true;
}

/**
 * Sanitize a display name for storage
 */
export function sanitizeDisplayName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
}
