import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

// DELETE /api/admin/global/clear-sessions - Clear all device sessions
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    // Get count of sessions
    const { count } = await supabaseAdmin
      .from('device_sessions')
      .select('*', { count: 'exact', head: true });

    // Delete all sessions
    const { error } = await supabaseAdmin
      .from('device_sessions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (neq trick)

    if (error) {
      console.error('Error clearing sessions:', error);
      return NextResponse.json({ error: 'Failed to clear sessions' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_count: count || 0
    });
  } catch (error) {
    console.error('Clear sessions error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
