import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPresenceToken } from '@/lib/presence';
import { config } from '@/lib/config';
import { v4 as uuidv4 } from 'uuid';

// POST /api/reply - Create a reply to a pin
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { body: replyBody, parent_pin_id, presence_token } = body;

    // Validate presence token
    const tokenResult = verifyPresenceToken(presence_token);
    if (!tokenResult.valid || !tokenResult.token) {
      return NextResponse.json({ error: tokenResult.error }, { status: 401 });
    }

    const { device_session_id, location_id } = tokenResult.token;

    // Validate reply body
    if (!replyBody || typeof replyBody !== 'string') {
      return NextResponse.json({ error: 'Reply body is required' }, { status: 400 });
    }

    if (replyBody.length > config.pin.maxBodyLength) {
      return NextResponse.json(
        { error: `Reply body exceeds maximum length of ${config.pin.maxBodyLength} characters` },
        { status: 400 }
      );
    }

    // Validate parent pin exists and is in the same location
    if (!parent_pin_id) {
      return NextResponse.json({ error: 'Parent pin ID is required for replies' }, { status: 400 });
    }

    const { data: parentPin, error: parentError } = await supabaseAdmin
      .from('pins')
      .select('id, location_id, deleted_at, is_hidden')
      .eq('id', parent_pin_id)
      .single();

    if (parentError || !parentPin) {
      return NextResponse.json({ error: 'Parent pin not found' }, { status: 404 });
    }

    if (parentPin.location_id !== location_id) {
      return NextResponse.json({ error: 'Parent pin is not at your current location' }, { status: 400 });
    }

    if (parentPin.deleted_at || parentPin.is_hidden) {
      return NextResponse.json({ error: 'Cannot reply to a deleted or hidden pin' }, { status: 400 });
    }

    // Check cooldown for replies (shorter than main posts)
    const replyCooldownMs = Math.floor(config.rateLimit.cooldownMs / 2); // 1 minute for replies
    const { data: recentReply } = await supabaseAdmin
      .from('pins')
      .select('created_at')
      .eq('device_session_id', device_session_id)
      .not('parent_pin_id', 'is', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentReply) {
      const timeSinceLastReply = Date.now() - new Date(recentReply.created_at).getTime();
      if (timeSinceLastReply < replyCooldownMs) {
        const waitSeconds = Math.ceil((replyCooldownMs - timeSinceLastReply) / 1000);
        return NextResponse.json(
          { error: `Please wait ${waitSeconds} seconds before replying again` },
          { status: 429 }
        );
      }
    }

    // Create the reply (replies don't count against post quota)
    const replyId = uuidv4();
    const { data: newReply, error: insertError } = await supabaseAdmin
      .from('pins')
      .insert({
        id: replyId,
        location_id,
        parent_pin_id,
        device_session_id,
        body: replyBody.trim(),
        doodle_data: null, // Replies don't support doodles
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating reply:', insertError);
      return NextResponse.json({ error: 'Failed to create reply' }, { status: 500 });
    }

    return NextResponse.json({
      reply: { ...newReply, is_mine: true, flag_count: 0 },
    });
  } catch (error) {
    console.error('Reply creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
