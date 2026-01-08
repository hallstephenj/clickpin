import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  getActivityLevel,
  formatLastActive,
  generateSignalText,
} from '@/lib/ghostEvents';
import { GhostCard, ActivityLevel } from '@/types';

// GET /api/ghosts/[slug] - Get ghost summary for a single location
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params;

    // Check if GHOSTS feature is enabled
    const { data: ghostsFlag } = await supabaseAdmin
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'GHOSTS')
      .single();

    if (!ghostsFlag?.enabled) {
      return NextResponse.json({ error: 'Ghosts feature is disabled' }, { status: 404 });
    }

    // Get location
    const { data: location, error: locError } = await supabaseAdmin
      .from('locations')
      .select('id, name, slug, city, lat, lng, ghosts_enabled')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (locError || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    if (!location.ghosts_enabled) {
      return NextResponse.json({ error: 'Ghosts not enabled for this location' }, { status: 404 });
    }

    // Get rollup
    const { data: rollup } = await supabaseAdmin
      .from('location_activity_rollups')
      .select('*')
      .eq('location_id', location.id)
      .single();

    // Get active sponsorship
    const now = new Date().toISOString();
    const { data: sponsor } = await supabaseAdmin
      .from('location_sponsorships')
      .select('sponsor_label, active_at')
      .eq('location_id', location.id)
      .in('status', ['paid', 'active'])
      .lte('active_at', now)
      .order('active_at', { ascending: false })
      .limit(1)
      .single();

    // Get daily history (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split('T')[0];

    const { data: dailyHistory } = await supabaseAdmin
      .from('location_activity_daily')
      .select('date, pins, replies, boosts, activity_score')
      .eq('location_id', location.id)
      .gte('date', sevenDaysAgo)
      .order('date', { ascending: true });

    // Build ghost card
    const pinsToday = rollup?.pins_last_24h || 0;
    const repliesToday = rollup?.replies_last_24h || 0;
    const boostsToday = rollup?.boosts_last_24h || 0;
    const activityScore = rollup?.activity_score || (sponsor ? 10 : 0);
    const sponsorshipActive = !!sponsor;
    const sponsorLabel = sponsor?.sponsor_label || null;
    const lastActivityBucket = rollup?.last_activity_bucket || null;

    const activityLevel = getActivityLevel(activityScore) as ActivityLevel;
    const lastActivityText = formatLastActive(lastActivityBucket);
    const signalText = generateSignalText(
      pinsToday,
      repliesToday,
      boostsToday,
      sponsorshipActive,
      sponsorLabel,
      location.slug
    );

    const ghostCard: GhostCard = {
      location_id: location.id,
      name: location.name,
      slug: location.slug,
      city: location.city,
      activity_level: activityLevel,
      activity_score: activityScore,
      pins_today: pinsToday,
      boosts_today: boostsToday,
      sponsorship_active: sponsorshipActive,
      sponsor_label: sponsorLabel,
      last_activity_text: lastActivityText,
      signal_text: signalText,
      distance_m: null,
    };

    return NextResponse.json({
      ghost: ghostCard,
      daily_history: dailyHistory || [],
      k_threshold_met: rollup?.min_k_threshold_met || false,
    });
  } catch (error) {
    console.error('Ghost location error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
