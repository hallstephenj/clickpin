import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';
import { verifyMerchantAuth, getMerchantSettings } from '@/lib/merchant';

/**
 * GET /api/merchant/dashboard
 * Fetch merchant dashboard data including settings and basic stats
 * Query params: location_id, session_id
 */
export async function GET(request: NextRequest) {
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
