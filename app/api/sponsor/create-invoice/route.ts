import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPresenceToken } from '@/lib/presence';
import { getLightningProvider, getPaymentAmount, getPaymentMemo } from '@/lib/lightning';

// POST /api/sponsor/create-invoice - Create invoice for sponsoring a location
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { presence_token, sponsor_label } = body;

    // Validate presence token
    const tokenResult = verifyPresenceToken(presence_token);
    if (!tokenResult.valid || !tokenResult.token) {
      return NextResponse.json({ error: tokenResult.error }, { status: 401 });
    }

    const { location_id } = tokenResult.token;

    // Validate sponsor label
    if (!sponsor_label || typeof sponsor_label !== 'string') {
      return NextResponse.json({ error: 'Sponsor label is required' }, { status: 400 });
    }

    if (sponsor_label.length > 50) {
      return NextResponse.json({ error: 'Sponsor label must be 50 characters or less' }, { status: 400 });
    }

    // Get location name for memo
    const { data: location } = await supabaseAdmin
      .from('locations')
      .select('name')
      .eq('id', location_id)
      .single();

    // Create Lightning invoice
    const provider = getLightningProvider();
    const amountSats = getPaymentAmount('sponsor');
    const memo = getPaymentMemo('sponsor', { locationName: location?.name });

    const invoice = await provider.createInvoice(amountSats, memo);

    // Store sponsorship record
    const { error: insertError } = await supabaseAdmin.from('location_sponsorships').insert({
      location_id,
      sponsor_label: sponsor_label.trim(),
      amount_sats: amountSats,
      provider: process.env.LIGHTNING_PROVIDER || 'dev',
      invoice_id: invoice.invoice_id,
      status: 'pending',
    });

    if (insertError) {
      console.error('Error creating sponsorship record:', insertError);
      return NextResponse.json({ error: 'Failed to create sponsorship invoice' }, { status: 500 });
    }

    return NextResponse.json({
      invoice_id: invoice.invoice_id,
      payment_request: invoice.payment_request,
      amount_sats: invoice.amount_sats,
      expires_at: invoice.expires_at.toISOString(),
    });
  } catch (error) {
    console.error('Sponsor invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
