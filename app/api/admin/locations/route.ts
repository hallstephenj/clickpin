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
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || '';
    const source = searchParams.get('source') || 'all'; // 'all', 'btcmap', 'manual'
    const offset = (page - 1) * limit;

    // Build query
    let query = supabaseAdmin
      .from('locations')
      .select('id, slug, name, city, address, lat, lng, radius_m, created_at, is_claimed, is_bitcoin_merchant, btcmap_id, merchant_settings, location_type', { count: 'exact' });

    // Add source filter
    if (source === 'btcmap') {
      query = query.not('btcmap_id', 'is', null);
    } else if (source === 'manual') {
      query = query.is('btcmap_id', null);
    }

    // Add search filter if provided
    if (search) {
      query = query.or(`name.ilike.%${search}%,city.ilike.%${search}%,address.ilike.%${search}%`);
    }

    // Add pagination and ordering
    const { data: locations, error, count: totalCount } = await query
      .order('name', { ascending: true })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching locations:', error);
      return NextResponse.json({ error: 'Failed to fetch locations' }, { status: 500 });
    }

    // Skip pin counts on list view for performance - show on detail view instead
    const locationsWithCounts = (locations || []).map(loc => ({
      ...loc,
      pin_count: null, // Loaded on demand when viewing location details
    }));

    return NextResponse.json({
      locations: locationsWithCounts,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit),
      }
    });
  } catch (error) {
    console.error('Admin locations error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
