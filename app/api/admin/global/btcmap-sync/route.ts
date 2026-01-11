import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

interface BTCMapPlace {
  id: number;
  lat: number;
  lon: number;
  name: string;
  icon?: string;
  address?: string;
  website?: string;
  phone?: string;
  opening_hours?: string;
  osm_id?: string;
  verified_at?: string;
  updated_at?: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

// POST /api/admin/global/btcmap-sync - Sync existing BTCMap locations
export async function POST(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    // Get all existing BTCMap locations
    const { data: existingLocations, error: fetchError } = await supabaseAdmin
      .from('locations')
      .select('id, btcmap_id, name')
      .not('btcmap_id', 'is', null);

    if (fetchError) {
      console.error('Error fetching locations:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    if (!existingLocations || existingLocations.length === 0) {
      return NextResponse.json({
        success: true,
        synced_count: 0,
        message: 'No BTCMap locations to sync'
      });
    }

    let syncedCount = 0;
    const btcmapIds = existingLocations.map(loc => loc.btcmap_id);

    // Fetch updated data from BTCMap for each location
    for (const loc of existingLocations) {
      try {
        const response = await fetch(`https://api.btcmap.org/v4/places/${loc.btcmap_id}`);
        if (!response.ok) continue;

        const place: BTCMapPlace = await response.json();

        // Update the location with fresh data
        const { error: updateError } = await supabaseAdmin
          .from('locations')
          .update({
            name: place.name,
            lat: place.lat,
            lng: place.lon,
            address: place.address || null,
            website: place.website || null,
            phone: place.phone || null,
            opening_hours: place.opening_hours || null,
            btcmap_icon: place.icon || null,
            btcmap_verified_at: place.verified_at || null,
            btcmap_updated_at: place.updated_at || null,
            osm_id: place.osm_id || null,
          })
          .eq('btcmap_id', loc.btcmap_id);

        if (!updateError) {
          syncedCount++;
        }
      } catch (e) {
        console.error(`Error syncing BTCMap ID ${loc.btcmap_id}:`, e);
      }
    }

    return NextResponse.json({
      success: true,
      synced_count: syncedCount,
      total_btcmap_locations: existingLocations.length
    });
  } catch (error) {
    console.error('BTCMap sync error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
