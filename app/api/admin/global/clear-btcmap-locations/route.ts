import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

// DELETE /api/admin/global/clear-btcmap-locations - Delete all BTCMap-imported locations
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    // Get count of BTCMap locations
    const { count } = await supabaseAdmin
      .from('locations')
      .select('*', { count: 'exact', head: true })
      .not('btcmap_id', 'is', null);

    // Delete all BTCMap-imported locations
    const { error } = await supabaseAdmin
      .from('locations')
      .delete()
      .not('btcmap_id', 'is', null);

    if (error) {
      console.error('Error clearing BTCMap locations:', error);
      return NextResponse.json({ error: 'Failed to clear BTCMap locations' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_count: count || 0
    });
  } catch (error) {
    console.error('Clear BTCMap locations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
