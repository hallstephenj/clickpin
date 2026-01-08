import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';
import { generateClaimCode, isLocationClaimed } from '@/lib/merchant';
import { config } from '@/lib/config';

/**
 * POST /api/merchant/claim/start
 * Initiate a merchant claim for a location
 * Returns claim_code and available verification options
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { location_id, session_id } = body;

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

    // Verify the location exists and is a merchant location
    const { data: location, error: locationError } = await supabaseAdmin
      .from('locations')
      .select('id, name, is_bitcoin_merchant, btcmap_id, is_claimed')
      .eq('id', location_id)
      .single();

    if (locationError || !location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Only allow claiming merchant locations
    if (!location.is_bitcoin_merchant && !location.btcmap_id) {
      return NextResponse.json(
        { error: 'Only merchant locations can be claimed' },
        { status: 400 }
      );
    }

    // Check if already claimed
    if (location.is_claimed) {
      const alreadyClaimed = await isLocationClaimed(location_id);
      if (alreadyClaimed) {
        return NextResponse.json(
          { error: 'This location has already been claimed' },
          { status: 409 }
        );
      }
    }

    // Verify device session exists
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('device_sessions')
      .select('id')
      .eq('id', session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Check if this device already has a pending claim for this location
    const { data: existingClaim } = await supabaseAdmin
      .from('merchant_claims')
      .select('id, claim_code, status')
      .eq('location_id', location_id)
      .eq('device_session_id', session_id)
      .eq('status', 'pending')
      .single();

    // If there's already a pending claim, return its code
    if (existingClaim) {
      return NextResponse.json({
        claim_code: existingClaim.claim_code,
        location_name: location.name,
        amount_sats: config.merchant.claimPriceSats,
        verification_options: ['lightning'],
        existing: true,
      });
    }

    // Generate a new claim code
    const claimCode = generateClaimCode();

    return NextResponse.json({
      claim_code: claimCode,
      location_name: location.name,
      amount_sats: config.merchant.claimPriceSats,
      verification_options: ['lightning'],
      existing: false,
    });
  } catch (error) {
    console.error('Error starting merchant claim:', error);
    return NextResponse.json(
      { error: 'Failed to start claim' },
      { status: 500 }
    );
  }
}
