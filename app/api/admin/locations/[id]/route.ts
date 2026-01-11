import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

// Helper to generate slug from name
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

// GET /api/admin/locations/[id] - Get full location details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Fetch the location with all fields
    const { data: location, error } = await supabaseAdmin
      .from('locations')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    // Get pin count
    const { count: pinCount } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', id)
      .is('deleted_at', null);

    // Get seed count
    const { count: seedCount } = await supabaseAdmin
      .from('seed_plantings')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', id);

    // Get merchant claim info if claimed
    let merchantClaim = null;
    if (location.is_claimed) {
      const { data: claim } = await supabaseAdmin
        .from('merchant_claims')
        .select('*')
        .eq('location_id', id)
        .eq('status', 'verified')
        .single();
      merchantClaim = claim;
    }

    return NextResponse.json({
      location: {
        ...location,
        pin_count: pinCount || 0,
        seed_count: seedCount || 0,
        merchant_claim: merchantClaim,
      }
    });
  } catch (error) {
    console.error('Get location error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/locations/[id] - Update location (god mode - all fields)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin auth (supports both Supabase and legacy password)
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await request.json();

    // Build update object - support ALL editable fields
    const updates: Record<string, unknown> = {};

    // Basic info
    if (body.name !== undefined) {
      if (typeof body.name !== 'string' || body.name.trim().length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }

      const trimmedName = body.name.trim();
      const newSlug = generateSlug(trimmedName);

      if (!newSlug) {
        return NextResponse.json({ error: 'Invalid name' }, { status: 400 });
      }

      // Check if slug already exists for another location
      const { data: existingLocation } = await supabaseAdmin
        .from('locations')
        .select('id')
        .eq('slug', newSlug)
        .neq('id', id)
        .single();

      if (existingLocation) {
        return NextResponse.json(
          { error: 'A location with this name already exists' },
          { status: 409 }
        );
      }

      updates.name = trimmedName;
      updates.slug = newSlug;
    }

    if (body.city !== undefined) {
      updates.city = body.city?.trim() || null;
    }

    if (body.category !== undefined) {
      updates.category = body.category?.trim() || null;
    }

    // Coordinates
    if (body.lat !== undefined) {
      const lat = parseFloat(body.lat);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        return NextResponse.json({ error: 'Invalid latitude' }, { status: 400 });
      }
      updates.lat = lat;
    }

    if (body.lng !== undefined) {
      const lng = parseFloat(body.lng);
      if (isNaN(lng) || lng < -180 || lng > 180) {
        return NextResponse.json({ error: 'Invalid longitude' }, { status: 400 });
      }
      updates.lng = lng;
    }

    if (body.radius_m !== undefined) {
      const radius = parseInt(body.radius_m, 10);
      if (isNaN(radius) || radius < 10 || radius > 5000) {
        return NextResponse.json({ error: 'Radius must be between 10 and 5000 meters' }, { status: 400 });
      }
      updates.radius_m = radius;
    }

    // Status
    if (body.is_active !== undefined) {
      updates.is_active = Boolean(body.is_active);
    }

    if (body.ghosts_enabled !== undefined) {
      updates.ghosts_enabled = Boolean(body.ghosts_enabled);
    }

    // Location type
    if (body.location_type !== undefined) {
      const validTypes = ['bitcoin_merchant', 'merchant', 'community_space'];
      if (!validTypes.includes(body.location_type)) {
        return NextResponse.json({ error: 'Invalid location type' }, { status: 400 });
      }
      updates.location_type = body.location_type;
      updates.is_bitcoin_merchant = body.location_type === 'bitcoin_merchant';
    }

    // Merchant fields
    if (body.is_claimed !== undefined) {
      updates.is_claimed = Boolean(body.is_claimed);
    }

    if (body.merchant_settings !== undefined) {
      updates.merchant_settings = body.merchant_settings;
    }

    // BTCMap fields
    if (body.btcmap_id !== undefined) {
      updates.btcmap_id = body.btcmap_id ? parseInt(body.btcmap_id, 10) : null;
    }

    if (body.osm_id !== undefined) {
      updates.osm_id = body.osm_id?.trim() || null;
    }

    if (body.address !== undefined) {
      updates.address = body.address?.trim() || null;
    }

    if (body.phone !== undefined) {
      updates.phone = body.phone?.trim() || null;
    }

    if (body.website !== undefined) {
      updates.website = body.website?.trim() || null;
    }

    if (body.opening_hours !== undefined) {
      updates.opening_hours = body.opening_hours?.trim() || null;
    }

    // Ensure we have something to update
    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
    }

    // Update the location
    const { data: updatedLocation, error: updateError } = await supabaseAdmin
      .from('locations')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating location:', updateError);
      return NextResponse.json({ error: 'Failed to update location' }, { status: 500 });
    }

    return NextResponse.json({ success: true, location: updatedLocation });
  } catch (error) {
    console.error('Update location error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin auth (supports both Supabase and legacy password)
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Delete all pins at this location first
    const { error: pinsError } = await supabaseAdmin
      .from('pins')
      .delete()
      .eq('location_id', id);

    if (pinsError) {
      console.error('Error deleting pins:', pinsError);
      return NextResponse.json({ error: 'Failed to delete pins' }, { status: 500 });
    }

    // Delete the location
    const { error: locationError } = await supabaseAdmin
      .from('locations')
      .delete()
      .eq('id', id);

    if (locationError) {
      console.error('Error deleting location:', locationError);
      return NextResponse.json({ error: 'Failed to delete location' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete location error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
