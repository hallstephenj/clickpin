import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPresenceToken } from '@/lib/presence';
import { getLightningProvider, getPaymentMemo } from '@/lib/lightning';
import { config } from '@/lib/config';

// Helper to get current active sponsor for a location
async function getCurrentSponsor(locationId: string) {
  const now = new Date().toISOString();

  const { data: sponsorship } = await supabaseAdmin
    .from('location_sponsorships')
    .select('sponsor_label, amount_sats, active_at')
    .eq('location_id', locationId)
    .in('status', ['paid', 'active'])
    .lte('active_at', now)
    .order('active_at', { ascending: false })
    .limit(1)
    .single();

  return sponsorship;
}

// POST /api/sponsor/create-invoice - Create invoice for sponsoring a location
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { presence_token, sponsor_label, sponsor_url, amount_sats } = body;

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

    // Validate amount
    if (!amount_sats || typeof amount_sats !== 'number' || amount_sats < 1) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    // Get current sponsor to determine minimum bid
    const currentSponsor = await getCurrentSponsor(location_id);
    const minimumAmount = currentSponsor
      ? currentSponsor.amount_sats + 1
      : config.payment.sponsorPriceSats;

    if (amount_sats < minimumAmount) {
      return NextResponse.json({
        error: currentSponsor
          ? `Amount must be at least ${minimumAmount} sats (current sponsor paid ${currentSponsor.amount_sats} sats)`
          : `Amount must be at least ${minimumAmount} sats`,
        minimum_amount: minimumAmount,
        current_sponsor_amount: currentSponsor?.amount_sats || null,
      }, { status: 400 });
    }

    // Get location name for memo
    const { data: location } = await supabaseAdmin
      .from('locations')
      .select('name')
      .eq('id', location_id)
      .single();

    // Create Lightning invoice
    const provider = getLightningProvider();
    const memo = getPaymentMemo('sponsor', { locationName: location?.name });

    const invoice = await provider.createInvoice(amount_sats, memo);

    // Store sponsorship record
    const { error: insertError } = await supabaseAdmin.from('location_sponsorships').insert({
      location_id,
      sponsor_label: sponsor_label.trim(),
      sponsor_url: sponsor_url || null,
      amount_sats: amount_sats,
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

// GET /api/sponsor/create-invoice - Get current sponsor info for a location
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const locationId = searchParams.get('location_id');

    if (!locationId) {
      return NextResponse.json({ error: 'location_id is required' }, { status: 400 });
    }

    const currentSponsor = await getCurrentSponsor(locationId);
    const minimumAmount = currentSponsor
      ? currentSponsor.amount_sats + 1
      : config.payment.sponsorPriceSats;

    return NextResponse.json({
      current_sponsor: currentSponsor ? {
        label: currentSponsor.sponsor_label,
        amount_sats: currentSponsor.amount_sats,
      } : null,
      minimum_amount: minimumAmount,
      base_amount: config.payment.sponsorPriceSats,
    });
  } catch (error) {
    console.error('Get sponsor info error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
