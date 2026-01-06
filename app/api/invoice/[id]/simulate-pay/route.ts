import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { applyPaymentEffects } from '@/app/api/lightning/webhook/route';
import { simulateTestPayment, isLightsparkTestMode } from '@/lib/lightspark';

interface InvoiceRecord {
  id: string;
  invoice_id: string;
  status: string;
  payment_request?: string;
  amount_sats?: number;
  type: 'post' | 'boost' | 'delete' | 'sponsor';
  tableName: string;
}

// Helper to find invoice across all payment tables and get payment_request
async function findInvoiceWithPaymentRequest(invoiceId: string): Promise<InvoiceRecord | null> {
  // We need to find the payment_request that was stored when the invoice was created
  // Since the payment_request isn't stored in these tables, we need a different approach
  // For Lightspark, the invoice_id format is ls_<uuid> and we can look it up

  // Check post_payments
  const { data: postPayment } = await supabaseAdmin
    .from('post_payments')
    .select('id, invoice_id, status, amount_sats')
    .eq('invoice_id', invoiceId)
    .single();

  if (postPayment) {
    return { ...postPayment, type: 'post', tableName: 'post_payments' };
  }

  // Check pin_boosts
  const { data: boost } = await supabaseAdmin
    .from('pin_boosts')
    .select('id, invoice_id, status, amount_sats')
    .eq('invoice_id', invoiceId)
    .single();

  if (boost) {
    return { ...boost, type: 'boost', tableName: 'pin_boosts' };
  }

  // Check pin_deletion_payments
  const { data: deletion } = await supabaseAdmin
    .from('pin_deletion_payments')
    .select('id, invoice_id, status, amount_sats')
    .eq('invoice_id', invoiceId)
    .single();

  if (deletion) {
    return { ...deletion, type: 'delete', tableName: 'pin_deletion_payments' };
  }

  // Check location_sponsorships
  const { data: sponsorship } = await supabaseAdmin
    .from('location_sponsorships')
    .select('id, invoice_id, status, amount_sats')
    .eq('invoice_id', invoiceId)
    .single();

  if (sponsorship) {
    return { ...sponsorship, type: 'sponsor', tableName: 'location_sponsorships' };
  }

  return null;
}

// POST /api/invoice/[id]/simulate-pay - Simulate payment in test mode
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Security check: Only allow in test mode or non-production
    const isTestMode = isLightsparkTestMode();
    const isProduction = process.env.NODE_ENV === 'production';
    const providerName = process.env.LIGHTNING_PROVIDER || 'dev';

    // For DEV provider, use existing dev/mark-paid endpoint behavior
    // For Lightspark, only allow if in test mode
    if (providerName === 'lightspark' && !isTestMode) {
      return NextResponse.json(
        { error: 'Payment simulation only available in Lightspark test mode' },
        { status: 403 }
      );
    }

    // In production with non-dev providers, don't allow simulation
    if (isProduction && providerName !== 'dev' && !isTestMode) {
      return NextResponse.json(
        { error: 'Payment simulation not available in production' },
        { status: 403 }
      );
    }

    const { id: invoiceId } = await params;

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    // Find the invoice
    const invoice = await findInvoiceWithPaymentRequest(invoiceId);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    if (invoice.status !== 'pending') {
      return NextResponse.json(
        { error: `Invoice already ${invoice.status}` },
        { status: 400 }
      );
    }

    // For Lightspark provider, we would ideally call the Lightspark test payment API
    // However, we need the payment_request which isn't stored in our current schema
    // For now, we'll just mark the payment as complete using applyPaymentEffects
    //
    // In a production setup, you would:
    // 1. Store payment_request in the payment tables
    // 2. Call simulateTestPayment({ paymentRequest }) here
    // 3. Wait for webhook or poll for confirmation
    //
    // For this implementation, we'll directly apply payment effects since
    // the test mode simulation is primarily for development/testing flow

    if (providerName === 'lightspark' && isTestMode) {
      console.log(`[Lightspark] Simulating payment for invoice: ${invoiceId}`);
      // Note: To properly simulate via Lightspark API, we'd need to store and retrieve
      // the payment_request. For now, we mark as paid directly.
      //
      // If payment_request was available:
      // const result = await simulateTestPayment({ paymentRequest: invoice.payment_request });
      // if (!result.success) {
      //   return NextResponse.json({ error: 'Payment simulation failed' }, { status: 500 });
      // }
    }

    // Apply payment effects (same as webhook/dev mark-paid)
    const result = await applyPaymentEffects(invoiceId);

    if (!result.success) {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      type: result.type,
      message: `Payment for ${result.type} invoice simulated successfully`,
    });
  } catch (error) {
    console.error('Simulate payment error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
