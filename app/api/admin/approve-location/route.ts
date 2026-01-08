import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'clickpin-admin-2024';

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 50);
}

export async function POST(request: NextRequest) {
  // Check admin password
  const password = request.headers.get('X-Admin-Password');
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { lat, lng, name, request_ids } = await request.json();

    if (!lat || !lng || !name || !request_ids?.length) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Check if any of the requests marked this as a bitcoin merchant
    const { data: requests } = await supabaseAdmin
      .from('location_requests')
      .select('is_bitcoin_merchant')
      .in('id', request_ids);

    const isBitcoinMerchant = requests?.some(r => r.is_bitcoin_merchant) || false;

    // Generate unique slug
    let slug = generateSlug(name);
    let slugSuffix = 0;

    // Check for slug conflicts
    while (true) {
      const testSlug = slugSuffix === 0 ? slug : `${slug}-${slugSuffix}`;
      const { data: existing } = await supabaseAdmin
        .from('locations')
        .select('id')
        .eq('slug', testSlug)
        .single();

      if (!existing) {
        slug = testSlug;
        break;
      }
      slugSuffix++;
    }

    // Create the location
    const { data: location, error: locationError } = await supabaseAdmin
      .from('locations')
      .insert({
        slug,
        name: name.trim(),
        lat,
        lng,
        radius_m: 200, // Default radius
        is_bitcoin_merchant: isBitcoinMerchant,
      })
      .select()
      .single();

    if (locationError) {
      console.error('Error creating location:', locationError);
      return NextResponse.json({ error: 'Failed to create location' }, { status: 500 });
    }

    // Mark all requests as approved
    const { error: updateError } = await supabaseAdmin
      .from('location_requests')
      .update({
        status: 'approved',
        reviewed_at: new Date().toISOString(),
        admin_notes: `Created location: ${location.slug}`,
      })
      .in('id', request_ids);

    if (updateError) {
      console.error('Error updating requests:', updateError);
      // Location was created, so don't fail completely
    }

    return NextResponse.json({
      success: true,
      location: {
        id: location.id,
        slug: location.slug,
        name: location.name,
      },
    });
  } catch (error) {
    console.error('Approve location error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
