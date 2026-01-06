import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'clickpin-admin-2024';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin password
  const password = request.headers.get('X-Admin-Password');
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
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
