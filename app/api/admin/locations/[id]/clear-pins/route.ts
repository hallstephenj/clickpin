import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

// DELETE /api/admin/locations/[id]/clear-pins - Delete all pins from a location
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin auth (supports both Supabase and legacy password)
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Verify location exists
    const { data: location, error: locationError } = await supabaseAdmin
      .from('locations')
      .select('id, name')
      .eq('id', id)
      .single();

    if (locationError || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    // Get count first
    const { count } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', id);

    // Delete all pins at this location
    const { error: pinsError } = await supabaseAdmin
      .from('pins')
      .delete()
      .eq('location_id', id);

    if (pinsError) {
      console.error('Error deleting pins:', pinsError);
      return NextResponse.json({ error: 'Failed to delete pins' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_count: count || 0,
      location_name: location.name
    });
  } catch (error) {
    console.error('Clear pins error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
