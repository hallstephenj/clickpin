import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// POST /api/location-request - Submit a request for a new location
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng, suggested_name, session_id } = body;

    // Validate inputs
    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return NextResponse.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    if (!suggested_name || typeof suggested_name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    if (suggested_name.length > 100) {
      return NextResponse.json({ error: 'Name too long' }, { status: 400 });
    }

    // Check for recent duplicate from same session (within last hour)
    if (session_id) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { data: existing } = await supabaseAdmin
        .from('location_requests')
        .select('id')
        .eq('device_session_id', session_id)
        .gte('created_at', oneHourAgo)
        .limit(1);

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: 'You already submitted a request recently. Please wait before submitting another.' },
          { status: 429 }
        );
      }
    }

    // Insert the request
    const { data, error } = await supabaseAdmin
      .from('location_requests')
      .insert({
        lat,
        lng,
        suggested_name: suggested_name.trim(),
        device_session_id: session_id || null,
        status: 'pending',
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating location request:', error);
      return NextResponse.json({ error: 'Failed to submit request' }, { status: 500 });
    }

    return NextResponse.json({ success: true, id: data.id });
  } catch (error) {
    console.error('Location request error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
