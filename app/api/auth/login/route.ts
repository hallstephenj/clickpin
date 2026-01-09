import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { NextRequest, NextResponse } from 'next/server';
import { rateLimiters, checkRateLimit } from '@/lib/ratelimit';

/**
 * POST /api/auth/login
 * Sends a magic link email for passwordless authentication.
 */
export async function POST(request: NextRequest) {
  // Rate limit: 5 requests per minute per IP
  const rateLimitResponse = await checkRateLimit(request, rateLimiters.auth);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const { email, redirect_to } = await request.json();

    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email required' }, { status: 400 });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    // For admin logins, verify email is in admin_users table
    const isAdminLogin = redirect_to === '/admin' || redirect_to?.startsWith('/admin');
    if (isAdminLogin) {
      const { data: adminUser } = await supabaseAdmin
        .from('admin_users')
        .select('id')
        .eq('email', email.toLowerCase())
        .single();

      if (!adminUser) {
        // Return generic error to avoid email enumeration
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
    }

    const supabase = await createSupabaseServerClient();

    // Use configured base URL or fall back to request origin
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || request.nextUrl.origin;
    const redirectUrl = `${baseUrl}/api/auth/callback?next=${encodeURIComponent(redirect_to || '/')}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: redirectUrl,
      },
    });

    if (error) {
      console.error('Magic link error:', error);
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
