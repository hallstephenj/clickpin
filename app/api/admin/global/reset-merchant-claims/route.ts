import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

// DELETE /api/admin/global/reset-merchant-claims - Reset all merchant claims
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    // Get count of claimed locations
    const { count } = await supabaseAdmin
      .from('locations')
      .select('*', { count: 'exact', head: true })
      .eq('is_claimed', true);

    // Reset all claims
    const { error: locError } = await supabaseAdmin
      .from('locations')
      .update({ is_claimed: false, merchant_settings: {} })
      .eq('is_claimed', true);

    if (locError) {
      console.error('Error resetting claims:', locError);
      return NextResponse.json({ error: 'Failed to reset claims' }, { status: 500 });
    }

    // Also delete all merchant_claims records
    const { error: claimsError } = await supabaseAdmin
      .from('merchant_claims')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (claimsError) {
      console.error('Error deleting merchant_claims:', claimsError);
      // Don't fail, just log - the table might not exist
    }

    return NextResponse.json({
      success: true,
      reset_count: count || 0
    });
  } catch (error) {
    console.error('Reset merchant claims error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
