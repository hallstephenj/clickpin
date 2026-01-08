import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';
import { verifyMerchantAuth } from '@/lib/merchant';

/**
 * POST /api/merchant/pin
 * Pin or unpin a post on the merchant's board
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin_id, session_id, action } = body;

    if (!pin_id || !session_id) {
      return NextResponse.json(
        { error: 'Missing pin_id or session_id' },
        { status: 400 }
      );
    }

    if (!action || !['pin', 'unpin'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Use "pin" or "unpin"' },
        { status: 400 }
      );
    }

    // Check if MERCHANTS feature is enabled
    const flags = await getFeatureFlags();
    if (!flags.MERCHANTS) {
      return NextResponse.json(
        { error: 'Merchant features are not enabled' },
        { status: 403 }
      );
    }

    // Get the pin and its location
    const { data: pin, error: pinError } = await supabaseAdmin
      .from('pins')
      .select('id, location_id, is_merchant_pinned')
      .eq('id', pin_id)
      .is('deleted_at', null)
      .single();

    if (pinError || !pin) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Verify merchant owns this location
    const claim = await verifyMerchantAuth(pin.location_id, session_id);
    if (!claim) {
      return NextResponse.json(
        { error: 'Not authorized to moderate this board' },
        { status: 403 }
      );
    }

    // Toggle pin status
    const isPinned = action === 'pin';

    const { error: updateError } = await supabaseAdmin
      .from('pins')
      .update({ is_merchant_pinned: isPinned })
      .eq('id', pin_id);

    if (updateError) {
      throw updateError;
    }

    return NextResponse.json({
      success: true,
      is_merchant_pinned: isPinned,
    });
  } catch (error) {
    console.error('Error updating pin status:', error);
    return NextResponse.json(
      { error: 'Failed to update pin status' },
      { status: 500 }
    );
  }
}
