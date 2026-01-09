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

// PATCH /api/admin/locations/[id] - Update location name and/or radius
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
    const { name, radius_m, ghosts_enabled } = body;

    // Build update object
    const updates: Record<string, unknown> = {};

    // Handle name update
    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        return NextResponse.json({ error: 'Name cannot be empty' }, { status: 400 });
      }

      const trimmedName = name.trim();
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

    // Handle radius update
    if (radius_m !== undefined) {
      const radius = parseInt(radius_m, 10);
      if (isNaN(radius) || radius < 10 || radius > 5000) {
        return NextResponse.json({ error: 'Radius must be between 10 and 5000 meters' }, { status: 400 });
      }
      updates.radius_m = radius;
    }

    // Handle ghosts_enabled update
    if (ghosts_enabled !== undefined) {
      updates.ghosts_enabled = Boolean(ghosts_enabled);
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
