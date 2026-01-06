import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const DEFAULT_ADMIN_PASSWORD = 'clickpin-admin-2024';

function verifyAdminPassword(request: NextRequest): boolean {
  const password = request.headers.get('X-Admin-Password');
  const adminPassword = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;
  return password === adminPassword;
}

// GET /api/admin/feature-flags - Get all flags with full details
export async function GET(request: NextRequest) {
  if (!verifyAdminPassword(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { data: flags, error } = await supabaseAdmin
      .from('feature_flags')
      .select('*')
      .order('key');

    if (error) {
      console.error('Error fetching feature flags:', error);
      return NextResponse.json({ error: 'Failed to fetch flags' }, { status: 500 });
    }

    return NextResponse.json({ flags });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/feature-flags - Toggle a flag
export async function PATCH(request: NextRequest) {
  if (!verifyAdminPassword(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { key, enabled } = body;

    if (!key || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Key and enabled (boolean) required' }, { status: 400 });
    }

    const { data: flag, error } = await supabaseAdmin
      .from('feature_flags')
      .update({ enabled })
      .eq('key', key)
      .select()
      .single();

    if (error) {
      console.error('Error updating feature flag:', error);
      return NextResponse.json({ error: 'Flag not found or update failed' }, { status: 404 });
    }

    return NextResponse.json({ flag });
  } catch (error) {
    console.error('Error updating feature flag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
