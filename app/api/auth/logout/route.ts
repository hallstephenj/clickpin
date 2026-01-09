import { createSupabaseServerClient } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

/**
 * POST /api/auth/logout
 * Signs out the current user and clears the session.
 */
export async function POST() {
  try {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Logout error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
