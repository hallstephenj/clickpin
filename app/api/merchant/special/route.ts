import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';
import { verifyMerchantAuth } from '@/lib/merchant';
import { config } from '@/lib/config';

/**
 * POST /api/merchant/special
 * Create a daily special post
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { location_id, session_id, body: specialBody } = body;

    if (!location_id || !session_id) {
      return NextResponse.json(
        { error: 'Missing location_id or session_id' },
        { status: 400 }
      );
    }

    if (!specialBody || typeof specialBody !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid special body' },
        { status: 400 }
      );
    }

    if (specialBody.length > config.pin.maxBodyLength) {
      return NextResponse.json(
        { error: `Special must be ${config.pin.maxBodyLength} characters or less` },
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

    // Verify merchant owns this location
    const claim = await verifyMerchantAuth(location_id, session_id);
    if (!claim) {
      return NextResponse.json(
        { error: 'Not authorized to manage this location' },
        { status: 403 }
      );
    }

    // Calculate expiration (end of day or configured hours)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + config.merchant.specialExpiresHours);

    // Check if there's already an active special
    const { data: existingSpecial } = await supabaseAdmin
      .from('pins')
      .select('id')
      .eq('location_id', location_id)
      .eq('is_daily_special', true)
      .is('deleted_at', null)
      .gt('special_expires_at', new Date().toISOString())
      .single();

    if (existingSpecial) {
      return NextResponse.json(
        { error: 'You already have an active daily special. Delete it first to create a new one.' },
        { status: 409 }
      );
    }

    // Create the special post
    const { data: special, error: createError } = await supabaseAdmin
      .from('pins')
      .insert({
        location_id,
        device_session_id: session_id,
        body: specialBody.trim(),
        is_merchant_post: true,
        is_daily_special: true,
        special_expires_at: expiresAt.toISOString(),
        is_merchant_pinned: true, // Auto-pin specials
      })
      .select()
      .single();

    if (createError) {
      throw createError;
    }

    return NextResponse.json({
      success: true,
      special: {
        id: special.id,
        body: special.body,
        expires_at: special.special_expires_at,
      },
    });
  } catch (error) {
    console.error('Error creating daily special:', error);
    return NextResponse.json(
      { error: 'Failed to create daily special' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/merchant/special
 * Delete the current daily special
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location_id = searchParams.get('location_id');
    const session_id = searchParams.get('session_id');

    if (!location_id || !session_id) {
      return NextResponse.json(
        { error: 'Missing location_id or session_id' },
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

    // Verify merchant owns this location
    const claim = await verifyMerchantAuth(location_id, session_id);
    if (!claim) {
      return NextResponse.json(
        { error: 'Not authorized to manage this location' },
        { status: 403 }
      );
    }

    // Find and delete the active special
    const now = new Date().toISOString();
    const { data: special, error: findError } = await supabaseAdmin
      .from('pins')
      .select('id')
      .eq('location_id', location_id)
      .eq('is_daily_special', true)
      .is('deleted_at', null)
      .gt('special_expires_at', now)
      .single();

    if (findError || !special) {
      return NextResponse.json(
        { error: 'No active daily special found' },
        { status: 404 }
      );
    }

    // Soft delete the special
    const { error: deleteError } = await supabaseAdmin
      .from('pins')
      .update({ deleted_at: now })
      .eq('id', special.id);

    if (deleteError) {
      throw deleteError;
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting daily special:', error);
    return NextResponse.json(
      { error: 'Failed to delete daily special' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/merchant/special
 * Get the current daily special for a location
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location_id = searchParams.get('location_id');

    if (!location_id) {
      return NextResponse.json(
        { error: 'Missing location_id' },
        { status: 400 }
      );
    }

    // Check if MERCHANTS feature is enabled
    const flags = await getFeatureFlags();
    if (!flags.MERCHANTS) {
      return NextResponse.json({ special: null });
    }

    // Find active special
    const now = new Date().toISOString();
    const { data: special } = await supabaseAdmin
      .from('pins')
      .select('id, body, created_at, special_expires_at')
      .eq('location_id', location_id)
      .eq('is_daily_special', true)
      .is('deleted_at', null)
      .gt('special_expires_at', now)
      .single();

    return NextResponse.json({
      special: special
        ? {
            id: special.id,
            body: special.body,
            created_at: special.created_at,
            expires_at: special.special_expires_at,
          }
        : null,
    });
  } catch (error) {
    console.error('Error fetching daily special:', error);
    return NextResponse.json(
      { error: 'Failed to fetch daily special' },
      { status: 500 }
    );
  }
}
