/**
 * Input validation utilities for security
 */

// UUID v4 regex pattern
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Validate UUID v4 format
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

/**
 * Validate latitude coordinate
 */
export function isValidLatitude(lat: number): boolean {
  return typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90;
}

/**
 * Validate longitude coordinate
 */
export function isValidLongitude(lng: number): boolean {
  return typeof lng === 'number' && !isNaN(lng) && lng >= -180 && lng <= 180;
}

/**
 * Validate coordinate pair
 */
export function isValidCoordinates(lat: number, lng: number): boolean {
  return isValidLatitude(lat) && isValidLongitude(lng);
}

/**
 * Validate value is in allowed list (type-safe enum validation)
 */
export function isValidEnum<T extends readonly string[]>(
  value: unknown,
  allowedValues: T
): value is T[number] {
  return typeof value === 'string' && allowedValues.includes(value as T[number]);
}

/**
 * Validate string length within bounds
 */
export function isValidStringLength(
  value: unknown,
  minLength: number,
  maxLength: number
): value is string {
  return typeof value === 'string' && value.length >= minLength && value.length <= maxLength;
}

/**
 * Sanitize and validate redirect path (prevent open redirect)
 */
export function sanitizeRedirectPath(path: string | null | undefined): string {
  const defaultPath = '/';

  if (!path || typeof path !== 'string') {
    return defaultPath;
  }

  // Must start with single slash, not protocol-relative or absolute URL
  if (!path.startsWith('/') || path.startsWith('//') || path.includes('://')) {
    return defaultPath;
  }

  return path;
}

/**
 * Validate positive integer within range
 */
export function isValidPositiveInt(
  value: unknown,
  min: number = 1,
  max: number = Number.MAX_SAFE_INTEGER
): boolean {
  if (typeof value === 'number') {
    return Number.isInteger(value) && value >= min && value <= max;
  }
  if (typeof value === 'string') {
    const parsed = parseInt(value, 10);
    return !isNaN(parsed) && parsed >= min && parsed <= max;
  }
  return false;
}
