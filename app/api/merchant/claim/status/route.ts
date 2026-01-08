import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';
import { getLightningProvider } from '@/lib/lightning';
import { verifyMerchantClaim } from '@/lib/merchant';

/**
 * GET /api/merchant/claim/status
 * Check the claim status for a location
 * Query params: location_id, session_id (optional)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location_id = searchParams.get('location_id');
    const session_id = searchParams.get('session_id');

    if (!location_id) {
      return NextResponse.json(
        { error: 'Missing location_id' },
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

    // Check if location is claimed by anyone
    const { data: verifiedClaim } = await supabaseAdmin
      .from('merchant_claims')
      .select('id, device_session_id, claimed_at')
      .eq('location_id', location_id)
      .eq('status', 'verified')
      .single();

    // If there's a verified claim, check if current session owns it
    if (verifiedClaim) {
      const isOwner = session_id && verifiedClaim.device_session_id === session_id;
      return NextResponse.json({
        status: 'claimed',
        is_owner: isOwner,
        claimed_at: verifiedClaim.claimed_at,
      });
    }

    // Check for pending claims by this session
    if (session_id) {
      const { data: pendingClaim } = await supabaseAdmin
        .from('merchant_claims')
        .select('id, invoice_id, claim_code, created_at')
        .eq('location_id', location_id)
        .eq('device_session_id', session_id)
        .eq('status', 'pending')
        .not('invoice_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (pendingClaim) {
        // Check if invoice has been paid
        const provider = getLightningProvider();
        const paymentStatus = await provider.checkPaymentStatus(pendingClaim.invoice_id);

        if (paymentStatus === 'paid') {
          // Payment confirmed - verify the claim
          const verified = await verifyMerchantClaim(pendingClaim.invoice_id);
          if (verified) {
            return NextResponse.json({
              status: 'claimed',
              is_owner: true,
              claimed_at: verified.claimed_at,
              just_verified: true,
            });
          }
        }

        // Still pending
        return NextResponse.json({
          status: 'pending',
          invoice_id: pendingClaim.invoice_id,
          claim_code: pendingClaim.claim_code,
          payment_status: paymentStatus,
        });
      }
    }

    // Location is unclaimed
    return NextResponse.json({
      status: 'unclaimed',
    });
  } catch (error) {
    console.error('Error checking claim status:', error);
    return NextResponse.json(
      { error: 'Failed to check claim status' },
      { status: 500 }
    );
  }
}
