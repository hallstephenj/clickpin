/**
 * LNURL-auth utilities for Lightning wallet-based identity
 *
 * Implements LNURL-auth spec: https://github.com/lnurl/luds/blob/luds/04.md
 */

import crypto from 'crypto';
import { bech32 } from 'bech32';
import { ec as EC } from 'elliptic';
import { LnurlIdentity } from '@/types';

// Use elliptic library for secp256k1 signature verification
const secp256k1 = new EC('secp256k1');

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
 * @param k1 - The original challenge (hex string, 64 chars = 32 bytes)
 * @param sig - The DER-encoded signature from the wallet (hex string)
 * @param key - The wallet's public key / linking key (hex string, 66 chars compressed)
 * @returns boolean indicating if signature is valid
 */
export function verifyLnurlSignature(k1: string, sig: string, key: string): boolean {
  try {
    // Create key from public key hex
    const pubKey = secp256k1.keyFromPublic(key, 'hex');

    // The k1 is the message (32 bytes as hex)
    // Wallets sign the raw k1 bytes, not a hash of it
    const k1Bytes = Buffer.from(k1, 'hex');

    // Signature is in DER format - elliptic handles this directly
    const sigBuffer = Buffer.from(sig, 'hex');

    // Verify the signature
    return pubKey.verify(k1Bytes, sigBuffer);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
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

    // Try to parse as a public key - elliptic will throw if invalid
    secp256k1.keyFromPublic(key, 'hex');
    return true;
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
