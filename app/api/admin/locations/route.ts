import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
  // Check admin auth (supports both Supabase and legacy password)
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    // Fetch all locations with pin counts and merchant info
    const { data: locations, error } = await supabaseAdmin
      .from('locations')
      .select('id, slug, name, city, address, lat, lng, radius_m, ghosts_enabled, created_at, is_claimed, is_bitcoin_merchant, btcmap_id, merchant_settings, location_type')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching locations:', error);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    // Get pin counts for each location
    const locationsWithCounts = await Promise.all(
      (locations || []).map(async (loc) => {
        const { count } = await supabaseAdmin
          .from('pins')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', loc.id);

        return {
          ...loc,
          pin_count: count || 0,
        };
      })
    );

    return NextResponse.json({ locations: locationsWithCounts });
  } catch (error) {
    console.error('Admin locations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
