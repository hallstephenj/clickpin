import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';
import { verifyMerchantAuth, getMerchantSettings } from '@/lib/merchant';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { MerchantClaim } from '@/types';

/**
 * GET /api/merchant/dashboard
 * Fetch merchant dashboard data including settings and basic stats
 * Query params: location_id, session_id (optional if logged in via Supabase Auth)
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

    let claim: MerchantClaim | null = null;

    // Try Supabase Auth first (for multi-device access)
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (user) {
      // Look up claim by user_id
      const { data: userClaim } = await supabaseAdmin
        .from('merchant_claims')
        .select('*')
        .eq('location_id', location_id)
        .eq('user_id', user.id)
        .eq('status', 'verified')
        .single();

      if (userClaim) {
        claim = userClaim;
      }
    }

    // Fall back to device session auth
    if (!claim && session_id) {
      claim = await verifyMerchantAuth(location_id, session_id);
    }

    if (!claim) {
      return NextResponse.json(
        { error: 'Not authorized to manage this location' },
        { status: 403 }
      );
    }

    // Get location details
    const { data: location, error: locationError } = await supabaseAdmin
      .from('locations')
      .select('id, name, slug, city, is_claimed, merchant_settings, btcmap_id, address, phone, website, opening_hours')
      .eq('id', location_id)
      .single();

    if (locationError || !location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Get basic stats (privacy-preserving aggregates)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

    // Count pins in last 24h
    const { count: pinsToday } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', location_id)
      .is('parent_pin_id', null)
      .is('deleted_at', null)
      .gte('created_at', oneDayAgo);

    // Count pins in last 7 days
    const { count: pinsWeek } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', location_id)
      .is('parent_pin_id', null)
      .is('deleted_at', null)
      .gte('created_at', sevenDaysAgo);

    // Count total pins
    const { count: pinsTotal } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', location_id)
      .is('parent_pin_id', null)
      .is('deleted_at', null);

    // Count replies in last 7 days
    const { count: repliesWeek } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', location_id)
      .not('parent_pin_id', 'is', null)
      .is('deleted_at', null)
      .gte('created_at', sevenDaysAgo);

    // Get merchant settings
    const settings = await getMerchantSettings(location_id);

    return NextResponse.json({
      location: {
        id: location.id,
        name: location.name,
        slug: location.slug,
        city: location.city,
        btcmap_id: location.btcmap_id,
        address: location.address,
        phone: location.phone,
        website: location.website,
        opening_hours: location.opening_hours,
      },
      settings,
      claim: {
        id: claim.id,
        claimed_at: claim.claimed_at,
        verification_method: claim.verification_method,
        user_id: claim.user_id || null,
        linked_at: claim.linked_at || null,
      },
      stats: {
        pins_today: pinsToday || 0,
        pins_week: pinsWeek || 0,
        pins_total: pinsTotal || 0,
        replies_week: repliesWeek || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching merchant dashboard:', error);
    return NextResponse.json(
      { error: 'Failed to fetch dashboard' },
      { status: 500 }
    );
  }
}
