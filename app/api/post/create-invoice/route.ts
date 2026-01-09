import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPresenceToken } from '@/lib/presence';
import { getLightningProvider, getPaymentAmount, getPaymentMemo } from '@/lib/lightning';
import { rateLimiters, checkRateLimit } from '@/lib/ratelimit';

// POST /api/post/create-invoice - Create invoice for a paid post (after free quota exceeded)
export async function POST(request: NextRequest) {
  // Rate limit: 10 requests per minute per IP
  const rateLimitResponse = await checkRateLimit(request, rateLimiters.invoice);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const body = await request.json();
    const { presence_token } = body;

    // Validate presence token
    const tokenResult = verifyPresenceToken(presence_token);
    if (!tokenResult.valid || !tokenResult.token) {
      return NextResponse.json({ error: tokenResult.error }, { status: 401 });
    }

    const { device_session_id, location_id } = tokenResult.token;

    // Get location name for memo
    const { data: location } = await supabaseAdmin
      .from('locations')
      .select('name')
      .eq('id', location_id)
      .single();

    // Create Lightning invoice
    const provider = getLightningProvider();
    const amountSats = getPaymentAmount('post');
    const memo = getPaymentMemo('post', { locationName: location?.name });

    const invoice = await provider.createInvoice(amountSats, memo);

    // Store post payment record
    const { error: insertError } = await supabaseAdmin.from('post_payments').insert({
      device_session_id,
      location_id,
      amount_sats: amountSats,
      provider: process.env.LIGHTNING_PROVIDER || 'dev',
      invoice_id: invoice.invoice_id,
      status: 'pending',
    });

    if (insertError) {
      console.error('Error creating post payment record:', insertError);
      return NextResponse.json({ error: 'Failed to create post payment invoice' }, { status: 500 });
    }

    return NextResponse.json({
      invoice_id: invoice.invoice_id,
      payment_request: invoice.payment_request,
      amount_sats: invoice.amount_sats,
      expires_at: invoice.expires_at.toISOString(),
    });
  } catch (error) {
    console.error('Post invoice error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
