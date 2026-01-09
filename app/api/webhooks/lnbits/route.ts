import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature } from '@/lib/lnbits';
import { applyPaymentEffects } from '@/app/api/lightning/webhook/route';

// Force Node.js runtime for webhook processing
export const runtime = 'nodejs';

/**
 * LNbits Webhook Handler
 *
 * LNbits sends a POST request to the webhook URL when a payment is received.
 * The payload includes payment details that we use to find and process the
 * corresponding invoice in our database.
 *
 * Webhook payload structure:
 * {
 *   payment_hash: string,
 *   payment_request: string, // BOLT11 invoice
 *   amount: number,
 *   memo: string,
 *   checking_id: string,
 *   pending: boolean,
 *   time: number
 * }
 */

interface LNbitsWebhookPayload {
  payment_hash: string;
  payment_request?: string;
  amount?: number;
  memo?: string;
  checking_id?: string;
  pending?: boolean;
  time?: number;
}

// POST /api/webhooks/lnbits - Handle LNbits payment webhook
export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const bodyText = await request.text();

    // SECURITY: Webhook signature verification is MANDATORY
    const webhookSecret = process.env.LNBITS_WEBHOOK_SECRET;
    const signature = request.headers.get('x-lnbits-signature') ||
                     request.headers.get('x-webhook-signature');

    if (!webhookSecret) {
      console.error('[LNbits Webhook] SECURITY: LNBITS_WEBHOOK_SECRET not configured - rejecting request');
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 503 }
      );
    }

    if (!signature) {
      console.warn('[LNbits Webhook] Missing signature header');
      return NextResponse.json(
        { error: 'Missing webhook signature' },
        { status: 401 }
      );
    }

    if (!verifyWebhookSignature(bodyText, signature)) {
      console.error('[LNbits Webhook] Signature verification failed');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    // Parse the webhook payload
    let payload: LNbitsWebhookPayload;
    try {
      payload = JSON.parse(bodyText);
    } catch {
      console.error('[LNbits Webhook] Failed to parse JSON payload');
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    // Log the webhook for debugging
    console.log('[LNbits Webhook] Received:', {
      payment_hash: payload.payment_hash,
      amount: payload.amount,
      memo: payload.memo,
      pending: payload.pending,
    });

    // Validate required fields
    if (!payload.payment_hash) {
      console.error('[LNbits Webhook] Missing payment_hash');
      return NextResponse.json(
        { error: 'Missing payment_hash' },
        { status: 400 }
      );
    }

    // If payment is still pending, acknowledge but don't process
    if (payload.pending === true) {
      console.log('[LNbits Webhook] Payment still pending, ignoring');
      return NextResponse.json({
        success: true,
        message: 'Payment pending, waiting for confirmation',
      });
    }

    // The payment_hash is used as the invoice_id in our system
    // (see LNbitsLightningProvider.createInvoice in lightning.ts)
    const invoiceId = payload.payment_hash;

    console.log(`[LNbits Webhook] Processing paid invoice: ${invoiceId}`);

    // Apply payment effects (mark as paid, apply boost, etc.)
    const result = await applyPaymentEffects(invoiceId);

    if (result.success) {
      console.log(`[LNbits Webhook] Successfully processed ${result.type} payment`);
      return NextResponse.json({
        success: true,
        message: `Payment processed: ${result.type}`,
        type: result.type,
      });
    } else {
      // Invoice not found or already processed - this is not an error
      // (could be a duplicate webhook or an invoice we don't track)
      console.log(`[LNbits Webhook] No pending invoice found for: ${invoiceId}`);
      return NextResponse.json({
        success: true,
        message: result.error || 'Invoice not found or already processed',
      });
    }
  } catch (error) {
    console.error('[LNbits Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for webhook verification
export async function GET(request: NextRequest) {
  // Check for token verification (LNbits sometimes sends token in query params)
  const { searchParams } = new URL(request.url);
  const token = searchParams.get('token');

  const expectedToken = process.env.LNBITS_WEBHOOK_SECRET;

  // If a token is provided and matches, this confirms webhook URL is valid
  if (token && expectedToken && token === expectedToken) {
    return NextResponse.json({
      status: 'ok',
      verified: true,
      provider: 'lnbits',
    });
  }

  // Return basic status without verification
  return NextResponse.json({
    status: 'ok',
    provider: 'lnbits',
    message: 'LNbits webhook endpoint ready',
  });
}
