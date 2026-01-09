import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

/**
 * GET /api/auth/callback
 * Handles the OAuth callback from Supabase magic link emails.
 * Exchanges the code for a session and redirects to the specified destination.
 */
export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  let next = requestUrl.searchParams.get('next') || '/';

  // SECURITY: Prevent open redirect attacks
  // Only allow internal paths starting with single slash, not protocol-relative URLs
  if (!next.startsWith('/') || next.startsWith('//') || next.includes('://')) {
    next = '/';
  }

  if (code) {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Auth callback error:', error);
      // Redirect to login with error
      return NextResponse.redirect(new URL(`/admin?error=auth_failed`, requestUrl.origin));
    }
  }

  // Redirect to the specified destination
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
