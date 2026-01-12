import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { DEFAULT_FLAGS, FEATURE_FLAG_KEYS } from '@/lib/featureFlags';

// GET /api/admin/feature-flags - Get all flags with full details
export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { data: dbFlags, error } = await supabaseAdmin
      .from('feature_flags')
      .select('*')
      .order('key');

    if (error) {
      console.error('Error fetching feature flags:', error);
      return NextResponse.json({ error: 'Failed to fetch flags' }, { status: 500 });
    }

    // Create a map of existing flags
    const dbFlagMap = new Map(dbFlags?.map(f => [f.key, f]) || []);

    // Merge with all expected flags to ensure none are missing
    const flags = FEATURE_FLAG_KEYS.map(key => {
      const dbFlag = dbFlagMap.get(key);
      if (dbFlag) {
        return dbFlag;
      }
      // Return a default flag entry for missing flags
      return {
        key,
        enabled: DEFAULT_FLAGS[key as keyof typeof DEFAULT_FLAGS] ?? false,
        description: null,
        created_at: null,
      };
    });

    return NextResponse.json({ flags });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// PATCH /api/admin/feature-flags - Toggle a flag
export async function PATCH(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { key, enabled } = body;

    if (!key || typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'Key and enabled (boolean) required' }, { status: 400 });
    }

    // Validate the key is a known flag
    if (!FEATURE_FLAG_KEYS.includes(key as typeof FEATURE_FLAG_KEYS[number])) {
      return NextResponse.json({ error: 'Unknown feature flag key' }, { status: 400 });
    }

    // Upsert the flag (create if doesn't exist, update if it does)
    const { data: flag, error } = await supabaseAdmin
      .from('feature_flags')
      .upsert({ key, enabled }, { onConflict: 'key' })
      .select()
      .single();

    if (error) {
      console.error('Error updating feature flag:', error);
      return NextResponse.json({ error: 'Failed to update flag' }, { status: 500 });
    }

    return NextResponse.json({ flag });
  } catch (error) {
    console.error('Error updating feature flag:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
