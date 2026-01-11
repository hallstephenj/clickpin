import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

// DELETE /api/admin/global/clear-requests - Clear all pending location requests
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    // Get count of pending requests
    const { count } = await supabaseAdmin
      .from('location_requests')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');

    // Update all pending to rejected
    const { error } = await supabaseAdmin
      .from('location_requests')
      .update({ status: 'rejected' })
      .eq('status', 'pending');

    if (error) {
      console.error('Error clearing requests:', error);
      return NextResponse.json({ error: 'Failed to clear requests' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      deleted_count: count || 0
    });
  } catch (error) {
    console.error('Clear requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
