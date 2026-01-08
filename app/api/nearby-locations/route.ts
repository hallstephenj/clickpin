import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// GET /api/nearby-locations?lat=xxx&lng=xxx - Get locations within ~200 miles
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const lat = parseFloat(searchParams.get('lat') || '');
    const lng = parseFloat(searchParams.get('lng') || '');

    // If no coordinates provided, return all locations
    if (isNaN(lat) || isNaN(lng)) {
      const { data: locations, error } = await supabaseAdmin
        .from('locations')
        .select('id, name, slug, lat, lng, radius_m, btcmap_id, is_bitcoin_merchant')
        .eq('is_active', true)
        .limit(100);

      if (error) {
        console.error('Error fetching locations:', error);
        return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
      }

      return NextResponse.json({ locations: locations || [] });
    }

    // ~200 miles in degrees (rough approximation)
    // 1 degree lat ≈ 69 miles, 1 degree lng varies but ~69 miles at mid-latitudes
    const radiusDegrees = 3; // roughly 200 miles

    const { data: locations, error } = await supabaseAdmin
      .from('locations')
      .select('id, name, slug, lat, lng, radius_m, btcmap_id, is_bitcoin_merchant')
      .eq('is_active', true)
      .gte('lat', lat - radiusDegrees)
      .lte('lat', lat + radiusDegrees)
      .gte('lng', lng - radiusDegrees)
      .lte('lng', lng + radiusDegrees)
      .limit(100);

    if (error) {
      console.error('Error fetching nearby locations:', error);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    return NextResponse.json({ locations: locations || [] });
  } catch (error) {
    console.error('Nearby locations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
