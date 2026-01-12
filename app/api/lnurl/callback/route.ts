import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyLnurlSignature, generateAnonNym, isValidLinkingKey } from '@/lib/lnurl';
import { getFeatureFlags } from '@/lib/featureFlags';

/**
 * GET /api/lnurl/callback
 * LNURL-auth callback endpoint - called by the user's Lightning wallet
 *
 * Query parameters (per LNURL-auth spec):
 * - tag: 'login' (required by spec)
 * - k1: The challenge string (hex)
 * - sig: DER-encoded signature of k1 (hex)
 * - key: Wallet's linking key / public key (hex, 33 bytes compressed)
 * - action: Optional action type
 *
 * Response (per LNURL-auth spec):
 * Success: { status: 'OK' }
 * Error: { status: 'ERROR', reason: 'error message' }
 */
export async function GET(request: NextRequest) {
  try {
    // Check if feature is enabled
    const flags = await getFeatureFlags();
    if (!flags.LNURL_AUTH) {
      return NextResponse.json(
        { status: 'ERROR', reason: 'LNURL-auth feature is not enabled' },
        { status: 200 } // LNURL spec requires 200 even for errors
      );
    }

    const { searchParams } = new URL(request.url);
    const tag = searchParams.get('tag');
    const k1 = searchParams.get('k1');
    const sig = searchParams.get('sig');
    const key = searchParams.get('key');

    // Validate required parameters
    if (tag !== 'login') {
      return NextResponse.json(
        { status: 'ERROR', reason: 'Invalid tag parameter' },
        { status: 200 }
      );
    }

    if (!k1 || !sig || !key) {
      return NextResponse.json(
        { status: 'ERROR', reason: 'Missing required parameters (k1, sig, key)' },
        { status: 200 }
      );
    }

    // Validate linking key format
    if (!isValidLinkingKey(key)) {
      return NextResponse.json(
        { status: 'ERROR', reason: 'Invalid linking key format' },
        { status: 200 }
      );
    }

    // Find the challenge
    const { data: challenge, error: challengeError } = await supabaseAdmin
      .from('lnurl_challenges')
      .select('*')
      .eq('k1', k1)
      .eq('status', 'pending')
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json(
        { status: 'ERROR', reason: 'Challenge not found or expired' },
        { status: 200 }
      );
    }

    // Check if challenge has expired
    if (new Date(challenge.expires_at) < new Date()) {
      // Mark as expired
      await supabaseAdmin
        .from('lnurl_challenges')
        .update({ status: 'expired' })
        .eq('id', challenge.id);

      return NextResponse.json(
        { status: 'ERROR', reason: 'Challenge has expired' },
        { status: 200 }
      );
    }

    // Verify the signature
    const signatureValid = verifyLnurlSignature(k1, sig, key);

    if (!signatureValid) {
      return NextResponse.json(
        { status: 'ERROR', reason: 'Invalid signature' },
        { status: 200 }
      );
    }

    // Signature is valid! Now handle identity creation/linking

    // Check if this linking key already has an identity
    const { data: existingIdentity } = await supabaseAdmin
      .from('lnurl_identities')
      .select('*')
      .eq('linking_key', key)
      .single();

    let identityId: string;

    if (existingIdentity) {
      // Existing identity - just link the device
      identityId = existingIdentity.id;

      // Update last auth time
      await supabaseAdmin
        .from('lnurl_identities')
        .update({ last_auth_at: new Date().toISOString() })
        .eq('id', identityId);
    } else {
      // Create new identity
      const anonNym = generateAnonNym(key);

      const { data: newIdentity, error: identityError } = await supabaseAdmin
        .from('lnurl_identities')
        .insert({
          linking_key: key,
          anon_nym: anonNym,
          display_name: null,
        })
        .select()
        .single();

      if (identityError || !newIdentity) {
        console.error('Error creating identity:', identityError);
        return NextResponse.json(
          { status: 'ERROR', reason: 'Failed to create identity' },
          { status: 200 }
        );
      }

      identityId = newIdentity.id;
    }

    // Create/update device link
    const { error: linkError } = await supabaseAdmin
      .from('lnurl_device_links')
      .upsert({
        identity_id: identityId,
        device_session_id: challenge.device_session_id,
        last_used_at: new Date().toISOString(),
      }, {
        onConflict: 'identity_id,device_session_id',
      });

    if (linkError) {
      console.error('Error creating device link:', linkError);
      // Don't fail - identity is created, link is nice-to-have
    }

    // Update device session with identity
    await supabaseAdmin
      .from('device_sessions')
      .update({ lnurl_identity_id: identityId })
      .eq('id', challenge.device_session_id);

    // Mark challenge as verified
    await supabaseAdmin
      .from('lnurl_challenges')
      .update({
        status: 'verified',
        linking_key: key,
        verified_at: new Date().toISOString(),
      })
      .eq('id', challenge.id);

    // Success response per LNURL spec
    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    console.error('LNURL callback error:', error);
    return NextResponse.json(
      { status: 'ERROR', reason: 'Internal server error' },
      { status: 200 }
    );
  }
}
