import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

// DELETE /api/admin/global/purge-hidden-pins - Delete all hidden/moderated posts
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    // Get count of hidden posts
    const { count } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('is_hidden', true);

    // Delete all hidden posts
    const { error } = await supabaseAdmin
      .from('pins')
      .delete()
      .eq('is_hidden', true);

    if (error) {
      console.error('Error purging hidden pins:', error);
      return NextResponse.json({ error: 'Failed to purge hidden posts' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_count: count || 0
    });
  } catch (error) {
    console.error('Purge hidden pins error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
