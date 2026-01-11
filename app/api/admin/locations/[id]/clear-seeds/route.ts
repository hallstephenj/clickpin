import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

// DELETE /api/admin/locations/[id]/clear-seeds - Delete all seed plantings for a location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin auth
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Get count first
    const { count } = await supabaseAdmin
      .from('seed_plantings')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', id);

    // Delete all seed plantings for this location
    const { error } = await supabaseAdmin
      .from('seed_plantings')
      .delete()
      .eq('location_id', id);

    if (error) {
      console.error('Error clearing seeds:', error);
      return NextResponse.json({ error: 'Failed to clear seed data' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_count: count || 0
    });
  } catch (error) {
    console.error('Clear seeds error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
