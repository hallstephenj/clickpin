import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getChargeInfo, isOpenNodeConfigured, mapOpenNodeStatus } from '@/lib/opennode';
import { applyPaymentEffects } from '@/app/api/lightning/webhook/route';

interface InvoiceRecord {
  id: string;
  invoice_id: string;
  status: string;
  payment_request?: string;
  amount_sats?: number;
  type: 'post' | 'boost' | 'delete' | 'sponsor';
}

// Helper to find invoice across all payment tables
async function findInvoice(invoiceId: string): Promise<InvoiceRecord | null> {
  // Check post_payments
  const { data: postPayment } = await supabaseAdmin
    .from('post_payments')
    .select('id, invoice_id, status, amount_sats')
    .eq('invoice_id', invoiceId)
    .single();

  if (postPayment) {
    return { ...postPayment, type: 'post' };
  }

  // Check pin_boosts
  const { data: boost } = await supabaseAdmin
    .from('pin_boosts')
    .select('id, invoice_id, status, amount_sats')
    .eq('invoice_id', invoiceId)
    .single();

  if (boost) {
    return { ...boost, type: 'boost' };
  }

  // Check pin_deletion_payments
  const { data: deletion } = await supabaseAdmin
    .from('pin_deletion_payments')
    .select('id, invoice_id, status, amount_sats')
    .eq('invoice_id', invoiceId)
    .single();

  if (deletion) {
    return { ...deletion, type: 'delete' };
  }

  // Check location_sponsorships
  const { data: sponsorship } = await supabaseAdmin
    .from('location_sponsorships')
    .select('id, invoice_id, status, amount_sats')
    .eq('invoice_id', invoiceId)
    .single();

  if (sponsorship) {
    return { ...sponsorship, type: 'sponsor' };
  }

  return null;
}

// GET /api/invoice/[id]/status - Get invoice payment status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: invoiceId } = await params;

    if (!invoiceId) {
      return NextResponse.json({ error: 'Invoice ID required' }, { status: 400 });
    }

    // Find invoice in our database
    const invoice = await findInvoice(invoiceId);

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Map internal status to API response
    // Internal statuses: 'pending' | 'paid' | 'expired' | 'used'
    let status: 'pending' | 'paid' | 'expired' = 'pending';

    if (invoice.status === 'paid' || invoice.status === 'used') {
      status = 'paid';
    } else if (invoice.status === 'expired') {
      status = 'expired';
    }

    // If still pending and using OpenNode, check OpenNode API directly
    // This handles the case where webhooks can't reach localhost
    const providerName = process.env.LIGHTNING_PROVIDER || 'dev';

    if (status === 'pending' && providerName === 'opennode' && isOpenNodeConfigured()) {
      try {
        const chargeInfo = await getChargeInfo({ chargeId: invoiceId });
        const openNodeStatus = mapOpenNodeStatus(chargeInfo.data.status);

        if (openNodeStatus === 'paid') {
          // Payment confirmed by OpenNode - apply effects
          console.log(`[Status] OpenNode reports paid for ${invoiceId}, applying effects`);
          await applyPaymentEffects(invoiceId);
          status = 'paid';
        } else if (openNodeStatus === 'expired') {
          status = 'expired';
        }
      } catch (error) {
        console.error('[Status] Error checking OpenNode:', error);
        // Continue with database status if OpenNode check fails
      }
    }

    return NextResponse.json({
      invoice_id: invoice.invoice_id,
      status,
      type: invoice.type,
      amount_sats: invoice.amount_sats,
    });
  } catch (error) {
    console.error('Invoice status error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
