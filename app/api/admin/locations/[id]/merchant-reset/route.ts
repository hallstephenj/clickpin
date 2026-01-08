import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'clickpin-admin-2024';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// POST /api/admin/locations/[id]/merchant-reset
// Actions: de-verify, reset-settings, full-reset
export async function POST(request: NextRequest, context: RouteContext) {
  const password = request.headers.get('X-Admin-Password');
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id: locationId } = await context.params;
    const { action } = await request.json();

    if (!['de-verify', 'reset-settings', 'full-reset'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    // Verify location exists
    const { data: location, error: locError } = await supabaseAdmin
      .from('locations')
      .select('id, name, is_claimed')
      .eq('id', locationId)
      .single();

    if (locError || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    const updates: Record<string, unknown> = {};
    let claimDeleted = false;

    switch (action) {
      case 'de-verify':
        // Remove verified status but keep settings
        updates.is_claimed = false;
        // Delete the merchant claim record
        await supabaseAdmin
          .from('merchant_claims')
          .delete()
          .eq('location_id', locationId);
        claimDeleted = true;
        break;

      case 'reset-settings':
        // Clear merchant settings but keep verified status
        updates.merchant_settings = {};
        // Also clear merchant-specific pin flags
        await supabaseAdmin
          .from('pins')
          .update({
            is_merchant_pinned: false,
            is_merchant_hidden: false,
            is_merchant_post: false,
            is_daily_special: false,
            special_expires_at: null,
          })
          .eq('location_id', locationId);
        break;

      case 'full-reset':
        // Complete merchant reset - remove claim, clear settings
        updates.is_claimed = false;
        updates.merchant_settings = {};
        // Delete the merchant claim record
        await supabaseAdmin
          .from('merchant_claims')
          .delete()
          .eq('location_id', locationId);
        claimDeleted = true;
        // Clear all merchant-specific pin flags
        await supabaseAdmin
          .from('pins')
          .update({
            is_merchant_pinned: false,
            is_merchant_hidden: false,
            is_merchant_post: false,
            is_daily_special: false,
            special_expires_at: null,
          })
          .eq('location_id', locationId);
        break;
    }

    // Apply location updates
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await supabaseAdmin
        .from('locations')
        .update(updates)
        .eq('id', locationId);

      if (updateError) {
        console.error('Error updating location:', updateError);
        return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
      }
    }

    return NextResponse.json({
      success: true,
      action,
      location_id: locationId,
      claim_deleted: claimDeleted,
    });
  } catch (error) {
    console.error('Merchant reset error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
