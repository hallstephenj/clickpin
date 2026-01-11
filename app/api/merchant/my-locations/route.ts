import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { createSupabaseServerClient } from '@/lib/supabase-server';
import { getFeatureFlags } from '@/lib/featureFlags';

/**
 * GET /api/merchant/my-locations
 * Returns all locations claimed by the authenticated user
 */
export async function GET() {
  try {
    // Check if MERCHANTS feature is enabled
    const flags = await getFeatureFlags();
    if (!flags.MERCHANTS) {
      return NextResponse.json(
        { error: 'Merchant features are not enabled' },
        { status: 403 }
      );
    }

    // Get authenticated user
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Get all verified claims for this user
    const { data: claims, error: claimsError } = await supabaseAdmin
      .from('merchant_claims')
      .select('id, location_id, claimed_at')
      .eq('user_id', user.id)
      .eq('status', 'verified')
      .order('claimed_at', { ascending: false });

    if (claimsError) {
      console.error('Error fetching claims:', claimsError);
      return NextResponse.json(
        { error: 'Failed to fetch claims' },
        { status: 500 }
      );
    }

    if (!claims || claims.length === 0) {
      return NextResponse.json({ locations: [] });
    }

    // Get location details for each claim
    const locationIds = claims.map(c => c.location_id);
    const { data: locations, error: locationsError } = await supabaseAdmin
      .from('locations')
      .select('id, name, slug, city, address')
      .in('id', locationIds);

    if (locationsError) {
      console.error('Error fetching locations:', locationsError);
      return NextResponse.json(
        { error: 'Failed to fetch locations' },
        { status: 500 }
      );
    }

    // Combine claims with location data
    const result = claims.map(claim => {
      const location = locations?.find(l => l.id === claim.location_id);
      return {
        id: location?.id || claim.location_id,
        name: location?.name || 'Unknown Location',
        slug: location?.slug || '',
        city: location?.city || null,
        address: location?.address || null,
        claimed_at: claim.claimed_at,
      };
    }).filter(l => l.slug); // Filter out any without slugs

    return NextResponse.json({ locations: result });
  } catch (error) {
    console.error('Error in my-locations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
