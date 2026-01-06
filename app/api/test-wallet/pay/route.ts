import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { applyPaymentEffects } from '@/app/api/lightning/webhook/route';
import { isLightsparkTestMode, simulateTestPayment } from '@/lib/lightspark';
import { isLNbitsConfigured } from '@/lib/lnbits';
import { isOpenNodeTestMode } from '@/lib/opennode';

// Helper to find invoice by payment_request across all payment tables
async function findInvoiceByPaymentRequest(paymentRequest: string): Promise<{
  invoice_id: string;
  type: string;
} | null> {
  // The payment tables don't store payment_request directly
  // But the invoice_id follows a pattern: ls_<uuid> for Lightspark, dev_<uuid> for dev
  // We need to search by invoice_id that was recently created

  // For Lightspark test mode, we search across all pending invoices
  // and check if any match the payment request pattern

  // First, let's get all pending invoices and check them
  // In a production system, you'd store the payment_request in the DB

  const tables = [
    { name: 'post_payments', type: 'post' },
    { name: 'pin_boosts', type: 'boost' },
    { name: 'pin_deletion_payments', type: 'delete' },
    { name: 'location_sponsorships', type: 'sponsor' },
  ];

  for (const table of tables) {
    const { data } = await supabaseAdmin
      .from(table.name)
      .select('invoice_id')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(10);

    if (data && data.length > 0) {
      // Return the most recent pending invoice
      // In test mode, we assume the user is paying the invoice they just created
      // A production system would store and match payment_request
      return {
        invoice_id: data[0].invoice_id,
        type: table.type,
      };
    }
  }

  return null;
}

// POST /api/test-wallet/pay - Simulate paying an invoice from test wallet
export async function POST(request: NextRequest) {
  try {
    // Security check: Only allow in test/dev mode
    const isTestMode = isLightsparkTestMode();
    const isDevMode = process.env.DEV_MODE === 'true';
    const isLightningTestMode = process.env.NEXT_PUBLIC_LIGHTNING_TEST_MODE === 'true';
    const isProduction = process.env.NODE_ENV === 'production';
    const providerName = process.env.LIGHTNING_PROVIDER || 'dev';

    // Allow test wallet in: dev mode, test mode, or non-production
    const allowTestWallet = isDevMode || isTestMode || isLightningTestMode || !isProduction || providerName === 'dev';

    if (!allowTestWallet) {
      return NextResponse.json(
        { error: 'Test wallet only available in test/dev mode' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { payment_request } = body;

    if (!payment_request) {
      return NextResponse.json(
        { error: 'Payment request required' },
        { status: 400 }
      );
    }

    // Validate it looks like a Lightning invoice
    const lower = payment_request.toLowerCase();
    if (!lower.startsWith('lnbc') && !lower.startsWith('lntb') && !lower.startsWith('lnbcrt')) {
      return NextResponse.json(
        { error: 'Invalid Lightning invoice format' },
        { status: 400 }
      );
    }

    // Find matching invoice in our database
    const invoice = await findInvoiceByPaymentRequest(payment_request);

    if (!invoice) {
      return NextResponse.json(
        { error: 'No pending invoice found. Make sure you have an unpaid invoice.' },
        { status: 404 }
      );
    }

    console.log(`[Test Wallet] Paying invoice: ${invoice.invoice_id} (${invoice.type})`);
    console.log(`[Test Wallet] Provider: ${providerName}, TestMode: ${isTestMode}, DevMode: ${isDevMode}`);

    // Provider-specific payment simulation
    if (providerName === 'lightspark' && isTestMode) {
      // Lightspark test mode: call their API to simulate the payment
      // This will make the payment show up in the Lightspark dashboard
      console.log(`[Test Wallet] Calling Lightspark createTestModePayment...`);
      try {
        const lightsparkResult = await simulateTestPayment({ paymentRequest: payment_request });
        console.log(`[Test Wallet] Lightspark payment result:`, lightsparkResult);

        if (!lightsparkResult.success) {
          console.warn(`[Test Wallet] Lightspark payment returned non-success status: ${lightsparkResult.status}`);
        }
      } catch (lightsparkError) {
        console.error(`[Test Wallet] Lightspark payment error:`, lightsparkError);
        // Continue anyway - we'll still mark it paid in our DB
      }
    } else if (providerName === 'opennode') {
      // OpenNode: Real Lightning payments
      // In test mode (dev API), we mark as paid directly for testing
      // In production, real payments are confirmed via webhook
      const openNodeTestMode = isOpenNodeTestMode();
      console.log(`[Test Wallet] OpenNode mode (test=${openNodeTestMode}) - marking invoice as paid directly`);
    } else if (providerName === 'lnbits') {
      // LNbits: Real Lightning payments - can't self-pay
      // In test mode, we just mark the invoice as paid directly
      // For real payments, users need to pay from an external wallet
      console.log(`[Test Wallet] LNbits mode - marking invoice as paid directly`);
      // Note: In production without test mode, this endpoint is disabled
      // Real payments will be confirmed via webhook when user pays from external wallet
    } else if (providerName === 'dev') {
      // Dev mode: Just mark as paid, no external integration
      console.log(`[Test Wallet] Dev mode - marking invoice as paid directly`);
    }

    // Apply payment effects (mark as paid in our database)
    const result = await applyPaymentEffects(invoice.invoice_id);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to process payment' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      type: result.type,
      invoice_id: invoice.invoice_id,
      message: `Payment of ${invoice.type} invoice successful`,
    });
  } catch (error) {
    console.error('Test wallet pay error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
