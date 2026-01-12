import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { generateK1, createLnurlAuth } from '@/lib/lnurl';
import { getFeatureFlags } from '@/lib/featureFlags';
import { LnurlAuthChallengeResponse } from '@/types';

/**
 * POST /api/lnurl/challenge
 * Create a new LNURL-auth challenge for the client to display as QR code
 *
 * Request body:
 * {
 *   device_session_id: string  // The user's device session
 *   action?: 'login' | 'link'  // Optional action type (default: 'login')
 * }
 *
 * Response:
 * {
 *   lnurl: string       // Bech32-encoded LNURL for QR code
 *   k1: string          // Challenge ID for status polling
 *   expires_at: string  // ISO timestamp when challenge expires
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check if feature is enabled
    const flags = await getFeatureFlags();
    if (!flags.LNURL_AUTH) {
      return NextResponse.json(
        { error: 'LNURL-auth feature is not enabled' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { device_session_id, action = 'login' } = body;

    // Validate device session
    if (!device_session_id || typeof device_session_id !== 'string') {
      return NextResponse.json(
        { error: 'device_session_id is required' },
        { status: 400 }
      );
    }

    // Validate action
    if (!['login', 'link', 'auth'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action type' },
        { status: 400 }
      );
    }

    // Verify device session exists
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('device_sessions')
      .select('id')
      .eq('id', device_session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Invalid device session' },
        { status: 400 }
      );
    }

    // Generate k1 challenge
    const k1 = generateK1();

    // Calculate expiration (5 minutes from now)
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    // Store challenge in database
    const { error: insertError } = await supabaseAdmin
      .from('lnurl_challenges')
      .insert({
        k1,
        device_session_id,
        action,
        status: 'pending',
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error creating challenge:', insertError);
      return NextResponse.json(
        { error: 'Failed to create challenge' },
        { status: 500 }
      );
    }

    // Create LNURL
    const lnurl = createLnurlAuth(k1);

    const response: LnurlAuthChallengeResponse = {
      lnurl,
      k1,
      expires_at: expiresAt.toISOString(),
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('LNURL challenge error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
