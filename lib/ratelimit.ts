import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

// Initialize Redis client (uses UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN env vars)
const redis = process.env.UPSTASH_REDIS_REST_URL
  ? new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  : null;

// Rate limiters for different endpoints
export const rateLimiters = {
  // Auth endpoints: 5 requests per minute per IP
  auth: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, '1 m'),
        prefix: 'ratelimit:auth',
      })
    : null,

  // Invoice creation: 10 requests per minute per IP
  invoice: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(10, '1 m'),
        prefix: 'ratelimit:invoice',
      })
    : null,

  // General API: 60 requests per minute per IP
  api: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(60, '1 m'),
        prefix: 'ratelimit:api',
      })
    : null,

  // Flag endpoint: 20 flags per minute per IP
  flag: redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(20, '1 m'),
        prefix: 'ratelimit:flag',
      })
    : null,
};

/**
 * Get client IP from request headers
 */
export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  return forwardedFor?.split(',')[0]?.trim() || realIp || 'unknown';
}

/**
 * Check rate limit for a request
 * Returns null if rate limiting is not configured or if within limits
 * Returns a 429 response if rate limited
 */
export async function checkRateLimit(
  request: NextRequest,
  limiter: Ratelimit | null,
  identifier?: string
): Promise<NextResponse | null> {
  if (!limiter) {
    // Rate limiting not configured - allow request
    return null;
  }

  const ip = identifier || getClientIp(request);
  const { success, limit, remaining, reset } = await limiter.limit(ip);

  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'X-RateLimit-Limit': limit.toString(),
          'X-RateLimit-Remaining': remaining.toString(),
          'X-RateLimit-Reset': reset.toString(),
          'Retry-After': Math.ceil((reset - Date.now()) / 1000).toString(),
        },
      }
    );
  }

  return null;
}

/**
 * Higher-order function to wrap route handlers with rate limiting
 */
export function withRateLimit(
  limiter: Ratelimit | null,
  handler: (request: NextRequest) => Promise<NextResponse>
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const rateLimitResponse = await checkRateLimit(request, limiter);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }
    return handler(request);
  };
}
