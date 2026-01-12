import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';
import { LnurlAuthStatusResponse, LnurlIdentity } from '@/types';

/**
 * GET /api/lnurl/status
 * Check the status of an LNURL-auth challenge
 * Client polls this endpoint after displaying QR code
 *
 * Query parameters:
 * - k1: The challenge ID
 *
 * Response:
 * {
 *   status: 'pending' | 'verified' | 'expired'
 *   identity?: LnurlIdentity  // Only if status is 'verified'
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Check if feature is enabled
    const flags = await getFeatureFlags();
    if (!flags.LNURL_AUTH) {
      return NextResponse.json(
        { error: 'LNURL-auth feature is not enabled' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const k1 = searchParams.get('k1');

    if (!k1) {
      return NextResponse.json(
        { error: 'k1 parameter is required' },
        { status: 400 }
      );
    }

    // Find the challenge
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from('lnurl_challenges')
      .select('*')
      .eq('k1', k1)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404 }
      );
    }

    // Check if expired (and update status if needed)
    if (challenge.status === 'pending' && new Date(challenge.expires_at) < new Date()) {
      await supabaseAdmin
        .from('lnurl_challenges')
        .update({ status: 'expired' })
        .eq('id', challenge.id);

      const response: LnurlAuthStatusResponse = { status: 'expired' };
      return NextResponse.json(response);
    }

    // If verified, fetch the identity
    if (challenge.status === 'verified' && challenge.linking_key) {
      const { data: identity } = await supabaseAdmin
        .from('lnurl_identities')
        .select('*')
        .eq('linking_key', challenge.linking_key)
        .single();

      if (identity) {
        const response: LnurlAuthStatusResponse = {
          status: 'verified',
          identity: identity as LnurlIdentity,
        };
        return NextResponse.json(response);
      }
    }

    // Return current status
    const response: LnurlAuthStatusResponse = {
      status: challenge.status as 'pending' | 'verified' | 'expired',
    };
    return NextResponse.json(response);
  } catch (error) {
    console.error('LNURL status error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
