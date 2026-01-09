import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';
import { getLightningProvider } from '@/lib/lightning';
import { generateClaimCode, createPendingClaim, isLocationClaimed } from '@/lib/merchant';
import { config } from '@/lib/config';
import { rateLimiters, checkRateLimit } from '@/lib/ratelimit';

/**
 * POST /api/merchant/claim/lightning
 * Generate a Lightning invoice for merchant claim verification
 */
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, rateLimiters.invoice);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { location_id, session_id, claim_code } = body;

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
    if (await isLocationClaimed(location_id)) {
      return NextResponse.json(
        { error: 'This location has already been claimed' },
        { status: 409 }
      );
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

    // Check for existing pending claim with invoice
    const { data: existingClaim } = await supabaseAdmin
      .from('merchant_claims')
      .select('id, invoice_id, claim_code')
      .eq('location_id', location_id)
      .eq('device_session_id', session_id)
      .eq('status', 'pending')
      .not('invoice_id', 'is', null)
      .single();

    if (existingClaim) {
      // Return existing invoice info (they need to pay or it will expire)
      return NextResponse.json(
        { error: 'You already have a pending claim. Please complete payment or wait for it to expire.' },
        { status: 409 }
      );
    }

    // Use provided claim_code or generate new one
    const finalClaimCode = claim_code || generateClaimCode();

    // Create Lightning invoice
    const provider = getLightningProvider();
    const amountSats = config.merchant.claimPriceSats;
    const memo = `Claim ${location.name}: ${finalClaimCode}`;

    const invoice = await provider.createInvoice(amountSats, memo);

    // Create pending claim record
    await createPendingClaim(
      location_id,
      session_id,
      invoice.invoice_id,
      amountSats,
      finalClaimCode
    );

    return NextResponse.json({
      invoice_id: invoice.invoice_id,
      payment_request: invoice.payment_request,
      amount_sats: invoice.amount_sats,
      expires_at: invoice.expires_at.toISOString(),
      claim_code: finalClaimCode,
      location_name: location.name,
    });
  } catch (error) {
    console.error('Error creating merchant claim invoice:', error);
    return NextResponse.json(
      { error: 'Failed to create invoice' },
      { status: 500 }
    );
  }
}
