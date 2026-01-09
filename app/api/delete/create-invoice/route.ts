import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPresenceToken } from '@/lib/presence';
import { getLightningProvider, getPaymentAmount, getPaymentMemo } from '@/lib/lightning';
import { config } from '@/lib/config';
import { rateLimiters, checkRateLimit } from '@/lib/ratelimit';

// POST /api/delete/create-invoice - Create invoice for deleting a pin after grace window
export async function POST(request: NextRequest) {
  const rateLimitResponse = await checkRateLimit(request, rateLimiters.invoice);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { pin_id, presence_token } = body;

    // Validate presence token
    const tokenResult = verifyPresenceToken(presence_token);
    if (!tokenResult.valid || !tokenResult.token) {
      return NextResponse.json({ error: tokenResult.error }, { status: 401 });
    }

    const { device_session_id } = tokenResult.token;

    // Validate pin_id
    if (!pin_id) {
      return NextResponse.json({ error: 'Pin ID is required' }, { status: 400 });
    }

    // Get the pin
    const { data: pin, error: pinError } = await supabaseAdmin
      .from('pins')
      .select('id, device_session_id, created_at, deleted_at')
      .eq('id', pin_id)
      .single();

    if (pinError || !pin) {
      return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    }

    // Verify ownership
    if (pin.device_session_id !== device_session_id) {
      return NextResponse.json({ error: 'You can only delete your own pins' }, { status: 403 });
    }

    if (pin.deleted_at) {
      return NextResponse.json({ error: 'Pin already deleted' }, { status: 400 });
    }

    // Check if within free delete window
    const pinAge = Date.now() - new Date(pin.created_at).getTime();
    if (pinAge < config.payment.freeDeleteWindowMs) {
      return NextResponse.json(
        {
          error: 'Pin is still within free delete window',
          free_delete: true,
          window_remaining_ms: config.payment.freeDeleteWindowMs - pinAge,
        },
        { status: 400 }
      );
    }

    // Create Lightning invoice
    const provider = getLightningProvider();
    const amountSats = getPaymentAmount('delete');
    const memo = getPaymentMemo('delete', { pinId: pin_id });

    const invoice = await provider.createInvoice(amountSats, memo);

    // Store deletion payment record
    const { error: insertError } = await supabaseAdmin.from('pin_deletion_payments').insert({
      pin_id,
      device_session_id,
      amount_sats: amountSats,
      provider: process.env.LIGHTNING_PROVIDER || 'dev',
      invoice_id: invoice.invoice_id,
      status: 'pending',
    });

    if (insertError) {
      console.error('Error creating deletion payment record:', insertError);
      return NextResponse.json({ error: 'Failed to create deletion invoice' }, { status: 500 });
    }

    return NextResponse.json({
      invoice_id: invoice.invoice_id,
      payment_request: invoice.payment_request,
      amount_sats: invoice.amount_sats,
      expires_at: invoice.expires_at.toISOString(),
    });
  } catch (error) {
    console.error('Delete invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
