import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { config } from '@/lib/config';
import { verifyMerchantClaim } from '@/lib/merchant';

import crypto from 'crypto';

// Verify webhook signature using HMAC-SHA256
function verifySignature(payload: string, signature: string, secret: string): boolean {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

// POST /api/lightning/webhook - Handle payment confirmations from Lightning provider
export async function POST(request: NextRequest) {
  try {
    // SECURITY: Webhook signature verification is MANDATORY in production
    const webhookSecret = process.env.LIGHTNING_WEBHOOK_SECRET;

    if (!webhookSecret) {
      console.error('[Lightning Webhook] SECURITY: LIGHTNING_WEBHOOK_SECRET not configured - rejecting request');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 503 }
      );
    }

    const signature = request.headers.get('x-webhook-signature');
    if (!signature) {
      console.warn('[Lightning Webhook] Missing signature header');
      return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });
    }

    // Get raw body for signature verification
    const bodyText = await request.text();

    if (!verifySignature(bodyText, signature, webhookSecret)) {
      console.error('[Lightning Webhook] Signature verification failed');
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const body = JSON.parse(bodyText);
    const { invoice_id, status } = body;

    if (!invoice_id) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    if (status !== 'paid') {
      // Only process paid invoices
      return NextResponse.json({ success: true, message: 'Status noted' });
    }

    // Apply payment effects
    const result = await applyPaymentEffects(invoice_id);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Lightning webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Shared function to apply payment effects (used by webhook and dev endpoint)
export async function applyPaymentEffects(
  invoiceId: string
): Promise<{ success: boolean; type?: string; error?: string }> {
  const now = new Date().toISOString();

  // Check pin boosts
  const { data: boost } = await supabaseAdmin
    .from('pin_boosts')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('status', 'pending')
    .single();

  if (boost) {
    // Mark boost as paid
    await supabaseAdmin
      .from('pin_boosts')
      .update({ status: 'paid', paid_at: now })
      .eq('id', boost.id);

    // Update pin with boost
    const boostExpiresAt = new Date(
      Date.now() + config.payment.boostDurationHours * 60 * 60 * 1000
    ).toISOString();

    await supabaseAdmin
      .from('pins')
      .update({
        boost_score: boost.amount_sats,
        boost_expires_at: boostExpiresAt,
      })
      .eq('id', boost.pin_id);

    return { success: true, type: 'boost' };
  }

  // Check location sponsorships
  const { data: sponsorship } = await supabaseAdmin
    .from('location_sponsorships')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('status', 'pending')
    .single();

  if (sponsorship) {
    // Find current active sponsor for this location
    const { data: currentSponsor } = await supabaseAdmin
      .from('location_sponsorships')
      .select('active_at')
      .eq('location_id', sponsorship.location_id)
      .in('status', ['paid', 'active'])
      .lte('active_at', now)
      .order('active_at', { ascending: false })
      .limit(1)
      .single();

    let activeAt: string;

    if (currentSponsor?.active_at) {
      // Current sponsor's guaranteed 24-hour window ends at:
      const currentSponsorExpiresAt = new Date(
        new Date(currentSponsor.active_at).getTime() + 24 * 60 * 60 * 1000
      );

      if (currentSponsorExpiresAt <= new Date()) {
        // Current sponsor has had 24+ hours, new sponsor activates immediately
        activeAt = now;
      } else {
        // Current sponsor still in their 24-hour window, activate when it ends
        activeAt = currentSponsorExpiresAt.toISOString();
      }
    } else {
      // No current sponsor, activate immediately
      activeAt = now;
    }

    await supabaseAdmin
      .from('location_sponsorships')
      .update({
        status: 'paid',
        paid_at: now,
        active_at: activeAt,
      })
      .eq('id', sponsorship.id);

    return { success: true, type: 'sponsor' };
  }

  // Check pin deletion payments
  const { data: deletion } = await supabaseAdmin
    .from('pin_deletion_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('status', 'pending')
    .single();

  if (deletion) {
    await supabaseAdmin
      .from('pin_deletion_payments')
      .update({ status: 'paid', paid_at: now })
      .eq('id', deletion.id);

    // Note: Deletion is applied when user calls DELETE /api/pin with the invoice_id
    return { success: true, type: 'delete' };
  }

  // Check post payments
  const { data: postPayment } = await supabaseAdmin
    .from('post_payments')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('status', 'pending')
    .single();

  if (postPayment) {
    await supabaseAdmin
      .from('post_payments')
      .update({ status: 'paid', paid_at: now })
      .eq('id', postPayment.id);

    return { success: true, type: 'post' };
  }

  // Check merchant claims
  const verifiedClaim = await verifyMerchantClaim(invoiceId);
  if (verifiedClaim) {
    return { success: true, type: 'merchant_claim' };
  }

  return { success: false, error: 'Invoice not found or already processed' };
}
