import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPresenceToken } from '@/lib/presence';
import { getFeatureFlags } from '@/lib/featureFlags';
import { v4 as uuidv4 } from 'uuid';
import type { SeedOutcome } from '@/types';
import { formatAuthorNym } from '@/lib/lnurl';

const SEED_OUTCOMES: SeedOutcome[] = ['positive', 'neutral', 'negative'];
const MAX_COMMENTARY_LENGTH = 280;

// POST /api/seed/plant - Plant a seed at a merchant location
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { presence_token, outcome, commentary } = body;

    // Check feature flag
    const flags = await getFeatureFlags();
    if (!flags.SEED_PLANTED) {
      return NextResponse.json({ error: 'Seed planting feature is not enabled' }, { status: 403 });
    }

    // Validate presence token
    const tokenResult = verifyPresenceToken(presence_token);
    if (!tokenResult.valid || !tokenResult.token) {
      return NextResponse.json({ error: tokenResult.error }, { status: 401 });
    }

    const { device_session_id, location_id } = tokenResult.token;

    // Get device session's identity for attribution
    let lnurlIdentityId: string | null = null;
    let authorNym: string | null = null;

    const { data: sessionWithIdentity } = await supabaseAdmin
      .from('device_sessions')
      .select('lnurl_identity_id')
      .eq('id', device_session_id)
      .single();

    if (sessionWithIdentity?.lnurl_identity_id) {
      lnurlIdentityId = sessionWithIdentity.lnurl_identity_id;

      // Get identity to capture the nym at post time
      const { data: identity } = await supabaseAdmin
        .from('lnurl_identities')
        .select('display_name, anon_nym')
        .eq('id', lnurlIdentityId)
        .single();

      if (identity) {
        authorNym = formatAuthorNym(identity);
      }
    }

    // Validate outcome
    if (!outcome || !SEED_OUTCOMES.includes(outcome)) {
      return NextResponse.json({ error: 'Invalid outcome. Must be positive, neutral, or negative.' }, { status: 400 });
    }

    // Validate commentary if provided
    if (commentary && commentary.length > MAX_COMMENTARY_LENGTH) {
      return NextResponse.json({ error: `Commentary exceeds maximum length of ${MAX_COMMENTARY_LENGTH} characters` }, { status: 400 });
    }

    // Verify location exists and is type 'merchant' (not bitcoin_merchant or community_space)
    const { data: location, error: locationError } = await supabaseAdmin
      .from('locations')
      .select('id, location_type')
      .eq('id', location_id)
      .single();

    if (locationError || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    if (location.location_type !== 'merchant') {
      return NextResponse.json({
        error: 'Seeds can only be planted at non-Bitcoin merchant locations'
      }, { status: 400 });
    }

    // Check if user already planted a seed today at this location
    const today = new Date().toISOString().split('T')[0];
    const { data: existingSeed } = await supabaseAdmin
      .from('seed_plantings')
      .select('id')
      .eq('device_session_id', device_session_id)
      .eq('location_id', location_id)
      .gte('created_at', `${today}T00:00:00.000Z`)
      .lt('created_at', `${today}T23:59:59.999Z`)
      .single();

    if (existingSeed) {
      return NextResponse.json({
        error: 'You have already planted a seed at this location today. Come back tomorrow!'
      }, { status: 429 });
    }

    // Create pin if commentary provided
    let pinId: string | null = null;
    if (commentary && commentary.trim()) {
      pinId = uuidv4();
      const { error: pinError } = await supabaseAdmin
        .from('pins')
        .insert({
          id: pinId,
          location_id,
          device_session_id,
          body: commentary.trim(),
          badge: `Seed:${outcome}`,
          // LNURL identity attribution
          lnurl_identity_id: lnurlIdentityId,
          author_nym: authorNym,
        });

      if (pinError) {
        console.error('Error creating seed pin:', pinError);
        // Continue without pin - seed planting should still succeed
        pinId = null;
      }
    }

    // Create seed planting record
    const seedId = uuidv4();
    const { error: seedError } = await supabaseAdmin
      .from('seed_plantings')
      .insert({
        id: seedId,
        location_id,
        device_session_id,
        outcome,
        commentary: commentary?.trim() || null,
        pin_id: pinId,
        // LNURL identity attribution
        lnurl_identity_id: lnurlIdentityId,
      });

    if (seedError) {
      console.error('Error creating seed planting:', seedError);
      // If we created a pin, we should clean it up
      if (pinId) {
        await supabaseAdmin.from('pins').delete().eq('id', pinId);
      }
      return NextResponse.json({ error: 'Failed to plant seed' }, { status: 500 });
    }

    // Get updated total count
    const { count: totalSeeds } = await supabaseAdmin
      .from('seed_plantings')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', location_id);

    return NextResponse.json({
      success: true,
      seed_id: seedId,
      pin_id: pinId,
      total_seeds: totalSeeds || 1,
    });
  } catch (error) {
    console.error('Seed planting error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
