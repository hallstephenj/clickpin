import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, checkRateLimit } from '@/lib/ratelimit';

/**
 * POST /api/merchant/auth/login
 * Sends a magic link email for merchant passwordless authentication.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 5 requests per minute per IP
  const rateLimitResponse = await checkRateLimit(request, rateLimiters.auth);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { email, redirect_to, location_id } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const supabase = await createSupabaseServerClient();

    // Build redirect URL with location context if provided
    let redirectPath = redirect_to || '/';

    // SECURITY: Prevent open redirect attacks
    // Only allow internal paths starting with single slash
    if (!redirectPath.startsWith('/') || redirectPath.startsWith('//') || redirectPath.includes('://')) {
      redirectPath = '/';
    }

    if (location_id) {
      const separator = redirectPath.includes('?') ? '&' : '?';
      redirectPath = `${redirectPath}${separator}link_claim=true`;
    }

    // Use configured base URL or fall back to request origin
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const redirectUrl = `${baseUrl}/api/auth/callback?next=${encodeURIComponent(redirectPath)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error('Merchant magic link error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Merchant login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
