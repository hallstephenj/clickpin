import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

// DELETE /api/admin/global/reset-seeds - Delete all seed plantings globally
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    // Get count first
    const { count } = await supabaseAdmin
      .from('seed_plantings')
      .select('*', { count: 'exact', head: true });

    // Delete all seed plantings
    const { error } = await supabaseAdmin
      .from('seed_plantings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all (neq trick)

    if (error) {
      console.error('Error resetting seeds:', error);
      return NextResponse.json({ error: 'Failed to reset seeds' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_count: count || 0
    });
  } catch (error) {
    console.error('Reset seeds error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
