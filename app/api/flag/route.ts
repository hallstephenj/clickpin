import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPresenceToken } from '@/lib/presence';
import { config } from '@/lib/config';
import { rateLimiters, checkRateLimit } from '@/lib/ratelimit';

// POST /api/flag - Flag a pin
export async function POST(request: NextRequest) {
  // Rate limit: 20 flags per minute per IP
  const rateLimitResponse = await checkRateLimit(request, rateLimiters.flag);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { pin_id, presence_token } = body;

    // Validate presence token
    const tokenResult = verifyPresenceToken(presence_token);
    if (!tokenResult.valid || !tokenResult.token) {
      return NextResponse.json({ error: tokenResult.error }, { status: 401 });
    }

    const { device_session_id, location_id } = tokenResult.token;

    // Validate pin_id
    if (!pin_id) {
      return NextResponse.json({ error: 'Pin ID is required' }, { status: 400 });
    }

    // Get the pin
    const { data: pin, error: pinError } = await supabaseAdmin
      .from('pins')
      .select('id, location_id, device_session_id, deleted_at, is_hidden')
      .eq('id', pin_id)
      .single();

    if (pinError || !pin) {
      return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    }

    // Can't flag own pins
    if (pin.device_session_id === device_session_id) {
      return NextResponse.json({ error: 'You cannot flag your own pins' }, { status: 400 });
    }

    // Can't flag deleted or hidden pins
    if (pin.deleted_at || pin.is_hidden) {
      return NextResponse.json({ error: 'Cannot flag a deleted or hidden pin' }, { status: 400 });
    }

    // Check if already flagged by this device
    const { data: existingFlag } = await supabaseAdmin
      .from('pin_flags')
      .select('id')
      .eq('pin_id', pin_id)
      .eq('device_session_id', device_session_id)
      .single();

    if (existingFlag) {
      return NextResponse.json({ error: 'You have already flagged this pin' }, { status: 400 });
    }

    // Create flag
    const { error: insertError } = await supabaseAdmin.from('pin_flags').insert({
      pin_id,
      location_id: pin.location_id,
      device_session_id,
    });

    if (insertError) {
      // Check if it's a unique constraint violation
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'You have already flagged this pin' }, { status: 400 });
      }
      console.error('Error creating flag:', insertError);
      return NextResponse.json({ error: 'Failed to flag pin' }, { status: 500 });
    }

    // Count flags and hide if threshold reached (trigger does this, but we can also check here)
    const { count: flagCount } = await supabaseAdmin
      .from('pin_flags')
      .select('id', { count: 'exact', head: true })
      .eq('pin_id', pin_id);

    if (flagCount && flagCount >= config.moderation.flagThreshold) {
      await supabaseAdmin.from('pins').update({ is_hidden: true }).eq('id', pin_id);
    }

    return NextResponse.json({
      success: true,
      flag_count: flagCount || 1,
      is_hidden: (flagCount || 0) >= config.moderation.flagThreshold,
    });
  } catch (error) {
    console.error('Flag error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
