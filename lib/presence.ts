import crypto from 'crypto';
import { PresenceToken } from '@/types';

// SECURITY: Require presence token secret - no fallback to weak default
function getPresenceTokenSecret(): string {
  const secret = process.env.PRESENCE_TOKEN_SECRET;
  if (!secret) {
    throw new Error('PRESENCE_TOKEN_SECRET environment variable is required for security');
  }
  return secret;
}

const PRESENCE_TOKEN_TTL_MS = 2 * 60 * 1000; // 2 minutes

export function createPresenceToken(
  deviceSessionId: string,
  locationId: string,
  locationSlug: string,
  accuracy: number
): string {
  const timestamp = Date.now();
  const payload = {
    device_session_id: deviceSessionId,
    location_id: locationId,
    location_slug: locationSlug,
    timestamp,
    accuracy,
  };

  const payloadString = JSON.stringify(payload);
  const signature = crypto
    .createHmac('sha256', getPresenceTokenSecret())
    .update(payloadString)
    .digest('hex');

  const token: PresenceToken = {
    ...payload,
    signature,
  };

  return Buffer.from(JSON.stringify(token)).toString('base64');
}

export function verifyPresenceToken(tokenString: string): {
  valid: boolean;
  token?: PresenceToken;
  error?: string;
} {
  try {
    const decoded = Buffer.from(tokenString, 'base64').toString('utf-8');
    const token: PresenceToken = JSON.parse(decoded);

    // Verify timestamp (not expired)
    const age = Date.now() - token.timestamp;
    if (age > PRESENCE_TOKEN_TTL_MS) {
      return { valid: false, error: 'Presence token expired. Please refresh your location.' };
    }

    // Verify signature
    const { signature, ...payload } = token;
    const expectedSignature = crypto
      .createHmac('sha256', getPresenceTokenSecret())
      .update(JSON.stringify(payload))
      .digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false, error: 'Invalid presence token signature.' };
    }

    return { valid: true, token };
  } catch {
    return { valid: false, error: 'Invalid presence token format.' };
  }
}
