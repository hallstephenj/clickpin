import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import {
  getActivityLevel,
  formatLastActive,
  generateSignalText,
  GHOST_CONFIG,
} from '@/lib/ghostEvents';
import { GhostCard, ActivityLevel } from '@/types';

// Haversine formula for distance calculation
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// GET /api/ghosts - Get ghost feed (activity signals)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get('city');
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);

    // Check if GHOSTS feature is enabled
    const { data: ghostsFlag } = await supabaseAdmin
      .from('feature_flags')
      .select('enabled')
      .eq('key', 'GHOSTS')
      .single();

    if (!ghostsFlag?.enabled) {
      return NextResponse.json({
        nearby: [],
        city_wide: [],
        sponsored: [],
        ghosts_enabled: false,
      });
    }

    // Get locations with ghosts enabled and their rollups
    const { data: locations, error: locError } = await supabaseAdmin
      .from('locations')
      .select(`
        id,
        name,
        slug,
        city,
        lat,
        lng,
        ghosts_enabled
      `)
      .eq('is_active', true)
      .eq('ghosts_enabled', true);

    if (locError) {
      console.error('Error fetching locations:', locError);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    if (!locations || locations.length === 0) {
      return NextResponse.json({
        nearby: [],
        city_wide: [],
        sponsored: [],
        ghosts_enabled: true,
      });
    }

    // Get rollups for these locations
    const locationIds = locations.map((l) => l.id);
    const { data: rollups } = await supabaseAdmin
      .from('location_activity_rollups')
      .select('*')
      .in('location_id', locationIds);

    // Get active sponsorships
    const now = new Date().toISOString();
    const { data: sponsorships } = await supabaseAdmin
      .from('location_sponsorships')
      .select('location_id, sponsor_label, active_at')
      .in('location_id', locationIds)
      .in('status', ['paid', 'active'])
      .lte('active_at', now);

    // Build rollup map
    const rollupMap = new Map(rollups?.map((r) => [r.location_id, r]) || []);

    // Build sponsorship map (most recent active per location)
    const sponsorMap = new Map<string, { sponsor_label: string; active_at: string }>();
    for (const s of sponsorships || []) {
      const existing = sponsorMap.get(s.location_id);
      if (!existing || s.active_at > existing.active_at) {
        sponsorMap.set(s.location_id, { sponsor_label: s.sponsor_label, active_at: s.active_at });
      }
    }

    // Build ghost cards
    const hasUserLocation = !isNaN(lat) && !isNaN(lng);
    const ghostCards: GhostCard[] = [];

    for (const loc of locations) {
      const rollup = rollupMap.get(loc.id);
      const sponsor = sponsorMap.get(loc.id);

      // Skip locations that don't meet k-anonymity threshold
      // Unless they have active sponsorship (which is public anyway)
      if (!rollup?.min_k_threshold_met && !sponsor) {
        continue;
      }

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
        loc.slug
      );

      // Calculate distance if user location is available
      const distance_m = hasUserLocation
        ? Math.round(calculateDistance(lat, lng, loc.lat, loc.lng))
        : null;

      ghostCards.push({
        location_id: loc.id,
        name: loc.name,
        slug: loc.slug,
        city: loc.city,
        activity_level: activityLevel,
        activity_score: activityScore,
        pins_today: pinsToday,
        boosts_today: boostsToday,
        sponsorship_active: sponsorshipActive,
        sponsor_label: sponsorLabel,
        last_activity_text: lastActivityText,
        signal_text: signalText,
        distance_m,
      });
    }

    // Separate into categories
    let nearby: GhostCard[] = [];
    let cityWide: GhostCard[] = [];
    let sponsored: GhostCard[] = [];

    // Nearby: sorted by distance (if user location available)
    if (hasUserLocation) {
      nearby = [...ghostCards]
        .filter((c) => c.distance_m != null && c.distance_m <= 50000) // Within 50km
        .sort((a, b) => (a.distance_m ?? 0) - (b.distance_m ?? 0))
        .slice(0, limit);
    }

    // City-wide: filtered by city, sorted by activity score
    const targetCity = city || 'Austin'; // Default to Austin for now
    cityWide = [...ghostCards]
      .filter((c) => c.city?.toLowerCase().includes(targetCity.toLowerCase()))
      .sort((a, b) => b.activity_score - a.activity_score)
      .slice(0, limit);

    // Sponsored: only locations with active sponsorship, sorted by score
    sponsored = [...ghostCards]
      .filter((c) => c.sponsorship_active)
      .sort((a, b) => b.activity_score - a.activity_score)
      .slice(0, 10);

    return NextResponse.json({
      nearby,
      city_wide: cityWide,
      sponsored,
      ghosts_enabled: true,
    });
  } catch (error) {
    console.error('Ghosts feed error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
