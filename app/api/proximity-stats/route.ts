import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const ONE_MILE_METERS = 1609.34;

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export interface NearbyBoardStats {
  id: string;
  name: string;
  slug: string;
  distance_m: number;
  pins_last_hour: number;
  pins_today: number;
  active_sessions: number;
  lat: number;
  lng: number;
  radius_m: number;
  btcmap_id?: number | null;
  is_bitcoin_merchant?: boolean;
}

export interface ProximityStatsResponse {
  boards_within_mile: number;
  total_pins_last_hour: number;
  trending_board: { name: string; active_users: number } | null;
  nearby_boards: NearbyBoardStats[];
  user_lat: number;
  user_lng: number;
}

// GET /api/proximity-stats?lat=xxx&lng=xxx
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');

    if (isNaN(lat) || isNaN(lng)) {
      return NextResponse.json({ error: 'lat and lng required' }, { status: 400 });
    }

    // Fetch all active locations
    const { data: locations, error: locError } = await supabaseAdmin
      .from('locations')
      .select('id, name, slug, lat, lng, radius_m, btcmap_id, is_bitcoin_merchant')
      .eq('is_active', true);

    if (locError || !locations) {
      console.error('Error fetching locations:', locError);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    // Calculate distances and filter to within 1 mile
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const nearbyLocations = locations
      .map(loc => ({
        ...loc,
        distance_m: calculateDistance(lat, lng, loc.lat, loc.lng)
      }))
      .filter(loc => loc.distance_m <= ONE_MILE_METERS)
      .sort((a, b) => a.distance_m - b.distance_m);

    // Get pin counts and activity for nearby locations
    const nearbyWithStats: NearbyBoardStats[] = await Promise.all(
      nearbyLocations.map(async (loc) => {
        // Get pins from last hour
        const { count: pinsLastHour } = await supabaseAdmin
          .from('pins')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', loc.id)
          .is('parent_pin_id', null)
          .is('deleted_at', null)
          .eq('is_hidden', false)
          .gte('created_at', oneHourAgo.toISOString());

        // Get pins from today
        const { count: pinsToday } = await supabaseAdmin
          .from('pins')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', loc.id)
          .is('parent_pin_id', null)
          .is('deleted_at', null)
          .eq('is_hidden', false)
          .gte('created_at', todayStart.toISOString());

        // Estimate active sessions (unique device sessions that posted today)
        const { data: activeSessions } = await supabaseAdmin
          .from('pins')
          .select('device_session_id')
          .eq('location_id', loc.id)
          .is('deleted_at', null)
          .gte('created_at', todayStart.toISOString());

        const uniqueSessions = new Set(activeSessions?.map(p => p.device_session_id) || []);

        return {
          id: loc.id,
          name: loc.name,
          slug: loc.slug,
          distance_m: Math.round(loc.distance_m),
          pins_last_hour: pinsLastHour || 0,
          pins_today: pinsToday || 0,
          active_sessions: uniqueSessions.size,
          lat: loc.lat,
          lng: loc.lng,
          radius_m: loc.radius_m,
          btcmap_id: loc.btcmap_id,
          is_bitcoin_merchant: loc.is_bitcoin_merchant,
        };
      })
    );

    // Calculate totals
    const totalPinsLastHour = nearbyWithStats.reduce((sum, b) => sum + b.pins_last_hour, 0);

    // Find trending board (most active sessions)
    const trendingBoard = nearbyWithStats.length > 0
      ? nearbyWithStats.reduce((max, b) => b.active_sessions > max.active_sessions ? b : max)
      : null;

    const response: ProximityStatsResponse = {
      boards_within_mile: nearbyWithStats.length,
      total_pins_last_hour: totalPinsLastHour,
      trending_board: trendingBoard && trendingBoard.active_sessions > 0
        ? { name: trendingBoard.name, active_users: trendingBoard.active_sessions }
        : null,
      nearby_boards: nearbyWithStats.slice(0, 5), // Top 5 closest
      user_lat: lat,
      user_lng: lng,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Proximity stats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
