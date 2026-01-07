import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { config } from '@/lib/config';

// POST /api/lightning/webhook - Handle payment confirmations from Lightning provider
export async function POST(request: NextRequest) {
  try {
    // In production, validate webhook signature from Lightning provider
    const webhookSecret = process.env.LIGHTNING_WEBHOOK_SECRET;

    if (webhookSecret) {
      const signature = request.headers.get('x-webhook-signature');
      // TODO: Implement signature verification based on provider
      if (!signature) {
        return NextResponse.json({ error: 'Missing webhook signature' }, { status: 401 });
      }
    }

    const body = await request.json();
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
    // Sponsorship becomes active 24 hours after payment
    const activeAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

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

  return { success: false, error: 'Invoice not found or already processed' };
}
