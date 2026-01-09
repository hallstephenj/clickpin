import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

export async function GET(
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

    // Fetch all pins for this location (including hidden)
    const { data: pins, error } = await supabaseAdmin
      .from('pins')
      .select('id, body, doodle_data, created_at, is_hidden, boost_score')
      .eq('location_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching pins:', error);
      return NextResponse.json({ error: 'Failed to fetch pins' }, { status: 500 });
    }

    // Get flag counts for each pin
    const pinsWithFlags = await Promise.all(
      (pins || []).map(async (pin) => {
        const { count } = await supabaseAdmin
          .from('pin_flags')
          .select('*', { count: 'exact', head: true })
          .eq('pin_id', pin.id);

        return {
          ...pin,
          flag_count: count || 0,
        };
      })
    );

    return NextResponse.json({ pins: pinsWithFlags });
  } catch (error) {
    console.error('Admin location pins error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
