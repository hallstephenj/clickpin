import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createPresenceToken } from '@/lib/presence';
import { config } from '@/lib/config';
import { isValidCoordinate, findNearestLocationFallback } from '@/lib/geo';
import { Location } from '@/types';

// POST /api/resolve-location - Find nearest location and return presence token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng, accuracy, session_id } = body;

    // Validate inputs
    if (!isValidCoordinate(lat, lng)) {
      console.log('Invalid coordinates:', { lat, lng });
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    if (typeof accuracy !== 'number' || accuracy < 0) {
      console.log('Invalid accuracy:', accuracy);
      return NextResponse.json({ error: 'Invalid accuracy value' }, { status: 400 });
    }

    if (!session_id) {
      console.log('Missing session_id');
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    // Check accuracy threshold
    if (accuracy > config.geo.maxAccuracyM) {
      console.log('Accuracy too low:', accuracy, 'max:', config.geo.maxAccuracyM);
      return NextResponse.json(
        {
          error: `Location accuracy too low. Need ${config.geo.maxAccuracyM}m or better, got ${Math.round(accuracy)}m.`,
          location: null,
          presence_token: null,
        },
        { status: 400 }
      );
    }

    // Try PostGIS function first
    let location: (Location & { distance_m: number }) | null = null;

    try {
      const { data, error } = await supabaseAdmin.rpc('find_nearest_location', {
        user_lat: lat,
        user_lng: lng,
        max_distance_m: config.geo.maxDistanceM,
      });

      if (!error && data && data.length > 0) {
        location = data[0];
      }
    } catch (postgisError) {
      console.warn('PostGIS query failed, using fallback:', postgisError);

      // Fallback: Fetch all active locations and compute distance client-side
      const { data: allLocations, error: fetchError } = await supabaseAdmin
        .from('locations')
        .select('*')
        .eq('is_active', true);

      if (fetchError) {
        console.error('Failed to fetch locations:', fetchError);
        return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
      }

      if (allLocations && allLocations.length > 0) {
        location = findNearestLocationFallback({ lat, lng }, allLocations, config.geo.maxDistanceM);
      }
    }

    if (!location) {
      return NextResponse.json({
        location: null,
        presence_token: null,
        message: "Sorry! This location doesn't have a clickpin (yet!). You can look for nearby boards, refresh your location, or request this location to have its own board.",
      });
    }

    // Get active sponsorship for this location (where active_at has passed)
    const now = new Date().toISOString();
    const { data: sponsorship } = await supabaseAdmin
      .from('location_sponsorships')
      .select('sponsor_label, amount_sats')
      .eq('location_id', location.id)
      .in('status', ['paid', 'active'])
      .lte('active_at', now)
      .order('active_at', { ascending: false })
      .limit(1)
      .single();

    const locationWithSponsor = {
      ...location,
      sponsor_label: sponsorship?.sponsor_label || null,
      sponsor_amount_sats: sponsorship?.amount_sats || null,
    };

    // Create presence token
    const presenceToken = createPresenceToken(session_id, location.id, location.slug, accuracy);

    return NextResponse.json({
      location: locationWithSponsor,
      presence_token: presenceToken,
      distance_m: location.distance_m,
    });
  } catch (error) {
    console.error('Resolve location error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
