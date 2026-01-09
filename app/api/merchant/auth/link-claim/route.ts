import { createSupabaseServerClient } from '@/lib/supabase-server';
import { supabaseAdmin } from '@/lib/supabase';
import { linkMerchantClaim } from '@/lib/auth';
import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/merchant/auth/link-claim
 * Links an existing verified merchant claim to the authenticated user.
 * This enables multi-device access and account recovery.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { claim_id, device_session_id } = await request.json();

    if (!claim_id || !device_session_id) {
      return NextResponse.json(
        { error: 'claim_id and device_session_id required' },
        { status: 400 }
      );
    }

    // Verify the claim exists and belongs to this device session
    const { data: claim, error: claimError } = await supabaseAdmin
      .from('merchant_claims')
      .select('id, location_id, device_session_id, user_id, status')
      .eq('id', claim_id)
      .single();

    if (claimError || !claim) {
      return NextResponse.json({ error: 'Claim not found' }, { status: 404 });
    }

    // Verify the claim is verified
    if (claim.status !== 'verified') {
      return NextResponse.json(
        { error: 'Only verified claims can be linked' },
        { status: 400 }
      );
    }

    // Verify the device session matches (security check)
    if (claim.device_session_id !== device_session_id) {
      return NextResponse.json(
        { error: 'Device session mismatch' },
        { status: 403 }
      );
    }

    // Check if already linked to a different user
    if (claim.user_id && claim.user_id !== user.id) {
      return NextResponse.json(
        { error: 'Claim already linked to another account' },
        { status: 409 }
      );
    }

    // Already linked to this user
    if (claim.user_id === user.id) {
      return NextResponse.json({
        success: true,
        message: 'Claim already linked to your account',
        location_id: claim.location_id,
      });
    }

    // Link the claim to the user
    const linked = await linkMerchantClaim(user.id, claim_id, device_session_id);

    if (!linked) {
      return NextResponse.json(
        { error: 'Failed to link claim' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Claim linked successfully',
      location_id: claim.location_id,
    });
  } catch (error) {
    console.error('Link claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
