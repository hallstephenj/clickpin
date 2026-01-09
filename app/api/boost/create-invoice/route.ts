import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPresenceToken } from '@/lib/presence';
import { getLightningProvider, getPaymentAmount, getPaymentMemo } from '@/lib/lightning';
import { rateLimiters, checkRateLimit } from '@/lib/ratelimit';

// POST /api/boost/create-invoice - Create invoice for boosting a pin
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
      .select('id, location_id, deleted_at, is_hidden')
      .eq('id', pin_id)
      .single();

    if (pinError || !pin) {
      return NextResponse.json({ error: 'Pin not found' }, { status: 404 });
    }

    if (pin.deleted_at || pin.is_hidden) {
      return NextResponse.json({ error: 'Cannot boost a deleted or hidden pin' }, { status: 400 });
    }

    // Create Lightning invoice
    const provider = getLightningProvider();
    const amountSats = getPaymentAmount('boost');
    const memo = getPaymentMemo('boost', { pinId: pin_id });

    const invoice = await provider.createInvoice(amountSats, memo);

    // Store boost payment record
    const { error: insertError } = await supabaseAdmin.from('pin_boosts').insert({
      pin_id,
      device_session_id,
      amount_sats: amountSats,
      provider: process.env.LIGHTNING_PROVIDER || 'dev',
      invoice_id: invoice.invoice_id,
      status: 'pending',
    });

    if (insertError) {
      console.error('Error creating boost record:', insertError);
      return NextResponse.json({ error: 'Failed to create boost invoice' }, { status: 500 });
    }

    return NextResponse.json({
      invoice_id: invoice.invoice_id,
      payment_request: invoice.payment_request,
      amount_sats: invoice.amount_sats,
      expires_at: invoice.expires_at.toISOString(),
    });
  } catch (error) {
    console.error('Boost invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
