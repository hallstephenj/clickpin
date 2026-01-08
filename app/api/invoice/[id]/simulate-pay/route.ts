import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { applyPaymentEffects } from '@/app/api/lightning/webhook/route';
import { config } from '@/lib/config';

interface InvoiceRecord {
  id: string;
  invoice_id: string;
  status: string;
  payment_request?: string;
  amount_sats?: number;
  type: 'post' | 'boost' | 'delete' | 'sponsor';
  tableName: string;
}

// Helper to find invoice across all payment tables
async function findInvoiceWithPaymentRequest(invoiceId: string): Promise<InvoiceRecord | null> {
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

// POST /api/invoice/[id]/simulate-pay - Simulate payment in test/dev mode
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isProduction = process.env.NODE_ENV === 'production';
    const providerName = process.env.LIGHTNING_PROVIDER || 'dev';

    // Only allow simulation in dev mode or with dev provider
    if (isProduction && providerName !== 'dev' && !config.lightning.testModeEnabled) {
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
