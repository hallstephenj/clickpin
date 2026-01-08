import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const pinId = searchParams.get('id');

    if (!pinId) {
      return NextResponse.json({ error: 'Pin ID required' }, { status: 400 });
    }

    // Check if SHARENOTES is enabled
    const flags = await getFeatureFlags();
    if (!flags.SHARENOTES) {
      return NextResponse.json({ error: 'Sharing is not enabled' }, { status: 403 });
    }

    // Fetch the pin with location info
    const { data: pin, error: pinError } = await supabaseAdmin
      .from('pins')
      .select(`
        id,
        body,
        doodle_data,
        badge,
        created_at,
        deleted_at,
        is_hidden,
        location_id,
        locations (
          id,
          name,
          city,
          slug,
          lat,
          lng
        )
      `)
      .eq('id', pinId)
      .is('parent_pin_id', null) // Only top-level pins can be shared
      .single();

    if (pinError || !pin) {
      return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    }

    // Check if pin is deleted or hidden
    const isRemoved = pin.deleted_at !== null || pin.is_hidden;

    // Get reply count for this pin
    const { count: replyCount } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('parent_pin_id', pinId)
      .is('deleted_at', null)
      .eq('is_hidden', false);

    // Get total pin count at this location (excluding deleted/hidden)
    const { count: locationPinCount } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', pin.location_id)
      .is('parent_pin_id', null)
      .is('deleted_at', null)
      .eq('is_hidden', false);

    const location = pin.locations as {
      id: string;
      name: string;
      city: string | null;
      slug: string;
      lat: number;
      lng: number;
    };

    return NextResponse.json({
      pin: isRemoved ? null : {
        id: pin.id,
        body: pin.body,
        doodle_data: pin.doodle_data,
        badge: pin.badge,
        created_at: pin.created_at,
      },
      isRemoved,
      replyCount: replyCount || 0,
      location: {
        id: location.id,
        name: location.name,
        city: location.city,
        slug: location.slug,
        lat: location.lat,
        lng: location.lng,
      },
      locationPinCount: locationPinCount || 0,
    });
  } catch (error) {
    console.error('Public pin fetch error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
