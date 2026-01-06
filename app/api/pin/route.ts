import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPresenceToken } from '@/lib/presence';
import { config } from '@/lib/config';
import { v4 as uuidv4 } from 'uuid';

// POST /api/pin - Create a new pin
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      body: pinBody,
      doodle_data,
      presence_token,
      payment_invoice_id,
      // Fancy board fields (optional)
      x,
      y,
      rotation,
      template,
      size,
      z_seed,
    } = body;

    // Validate presence token
    const tokenResult = verifyPresenceToken(presence_token);
    if (!tokenResult.valid || !tokenResult.token) {
      return NextResponse.json({ error: tokenResult.error }, { status: 401 });
    }

    const { device_session_id, location_id } = tokenResult.token;

    // Validate pin body
    if (!pinBody || typeof pinBody !== 'string') {
      return NextResponse.json({ error: 'Pin body is required' }, { status: 400 });
    }

    if (pinBody.length > config.pin.maxBodyLength) {
      return NextResponse.json(
        { error: `Pin body exceeds maximum length of ${config.pin.maxBodyLength} characters` },
        { status: 400 }
      );
    }

    // Validate doodle size if present
    if (doodle_data && doodle_data.length > config.pin.maxDoodleSize) {
      return NextResponse.json(
        { error: `Doodle data exceeds maximum size of ${config.pin.maxDoodleSize} bytes` },
        { status: 400 }
      );
    }

    // Check cooldown - find most recent pin from this device at this location
    const { data: recentPin } = await supabaseAdmin
      .from('pins')
      .select('created_at')
      .eq('device_session_id', device_session_id)
      .eq('location_id', location_id)
      .is('parent_pin_id', null) // Only check top-level pins for cooldown
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (recentPin) {
      const timeSinceLastPin = Date.now() - new Date(recentPin.created_at).getTime();
      if (timeSinceLastPin < config.rateLimit.cooldownMs) {
        const waitSeconds = Math.ceil((config.rateLimit.cooldownMs - timeSinceLastPin) / 1000);
        return NextResponse.json(
          { error: `Please wait ${waitSeconds} seconds before posting again` },
          { status: 429 }
        );
      }
    }

    // Check quota
    const today = new Date().toISOString().split('T')[0];
    const { data: quota } = await supabaseAdmin
      .from('post_quota_ledger')
      .select('free_posts_used, paid_posts_used')
      .eq('device_session_id', device_session_id)
      .eq('location_id', location_id)
      .eq('date', today)
      .single();

    const freePostsUsed = quota?.free_posts_used || 0;
    const quotaExceeded = freePostsUsed >= config.rateLimit.freePostsPerLocationPerDay;

    // If quota exceeded, require payment
    if (quotaExceeded) {
      if (!payment_invoice_id) {
        return NextResponse.json(
          {
            error: 'Daily free post limit reached',
            requires_payment: true,
            posts_used: freePostsUsed,
            posts_limit: config.rateLimit.freePostsPerLocationPerDay,
          },
          { status: 402 }
        );
      }

      // Verify payment
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from('post_payments')
        .select('*')
        .eq('invoice_id', payment_invoice_id)
        .eq('device_session_id', device_session_id)
        .eq('location_id', location_id)
        .eq('status', 'paid')
        .single();

      if (paymentError || !payment) {
        return NextResponse.json({ error: 'Invalid or unpaid payment invoice' }, { status: 402 });
      }

      // Mark payment as used
      await supabaseAdmin
        .from('post_payments')
        .update({ status: 'used', used_at: new Date().toISOString() })
        .eq('id', payment.id);
    }

    // Create the pin
    const pinId = uuidv4();
    const { data: newPin, error: insertError } = await supabaseAdmin
      .from('pins')
      .insert({
        id: pinId,
        location_id,
        device_session_id,
        body: pinBody.trim(),
        doodle_data: doodle_data || null,
        // Fancy board fields (all nullable)
        x: x ?? null,
        y: y ?? null,
        rotation: rotation ?? null,
        template: template ?? null,
        size: size ?? null,
        z_seed: z_seed ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating pin:', insertError);
      return NextResponse.json({ error: 'Failed to create pin' }, { status: 500 });
    }

    // Update quota ledger
    if (quotaExceeded) {
      // Paid post
      await supabaseAdmin
        .from('post_quota_ledger')
        .upsert({
          device_session_id,
          location_id,
          date: today,
          free_posts_used: freePostsUsed,
          paid_posts_used: (quota?.paid_posts_used || 0) + 1,
        });
    } else {
      // Free post
      await supabaseAdmin
        .from('post_quota_ledger')
        .upsert({
          device_session_id,
          location_id,
          date: today,
          free_posts_used: freePostsUsed + 1,
          paid_posts_used: quota?.paid_posts_used || 0,
        });
    }

    return NextResponse.json({
      pin: { ...newPin, is_mine: true, replies: [], flag_count: 0 },
      posts_remaining: quotaExceeded ? 0 : config.rateLimit.freePostsPerLocationPerDay - freePostsUsed - 1,
    });
  } catch (error) {
    console.error('Pin creation error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE /api/pin - Delete a pin
export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json();
    const { pin_id, presence_token, payment_invoice_id } = body;

    // Validate presence token
    const tokenResult = verifyPresenceToken(presence_token);
    if (!tokenResult.valid || !tokenResult.token) {
      return NextResponse.json({ error: tokenResult.error }, { status: 401 });
    }

    const { device_session_id } = tokenResult.token;

    // Get the pin
    const { data: pin, error: pinError } = await supabaseAdmin
      .from('pins')
      .select('*')
      .eq('id', pin_id)
      .single();

    if (pinError || !pin) {
      return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    }

    // Verify ownership
    if (pin.device_session_id !== device_session_id) {
      return NextResponse.json({ error: 'You can only delete your own pins' }, { status: 403 });
    }

    // Check if already deleted
    if (pin.deleted_at) {
      return NextResponse.json({ error: 'Pin already deleted' }, { status: 400 });
    }

    // Check if within free delete window
    const pinAge = Date.now() - new Date(pin.created_at).getTime();
    const withinFreeWindow = pinAge < config.payment.freeDeleteWindowMs;

    if (!withinFreeWindow) {
      // Require payment for deletion after grace window
      if (!payment_invoice_id) {
        return NextResponse.json(
          {
            error: 'Paid deletion required after grace window',
            requires_payment: true,
            price_sats: config.payment.deletePriceSats,
          },
          { status: 402 }
        );
      }

      // Verify payment
      const { data: payment, error: paymentError } = await supabaseAdmin
        .from('pin_deletion_payments')
        .select('*')
        .eq('invoice_id', payment_invoice_id)
        .eq('pin_id', pin_id)
        .eq('device_session_id', device_session_id)
        .eq('status', 'paid')
        .single();

      if (paymentError || !payment) {
        return NextResponse.json({ error: 'Invalid or unpaid deletion payment' }, { status: 402 });
      }
    }

    // Soft delete the pin
    const { error: deleteError } = await supabaseAdmin
      .from('pins')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', pin_id);

    if (deleteError) {
      console.error('Error deleting pin:', deleteError);
      return NextResponse.json({ error: 'Failed to delete pin' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Pin deletion error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
