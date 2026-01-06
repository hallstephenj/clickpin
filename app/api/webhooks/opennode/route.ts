import { NextRequest, NextResponse } from 'next/server';
import { verifyWebhookSignature, OpenNodeWebhookPayload } from '@/lib/opennode';
import { applyPaymentEffects } from '@/app/api/lightning/webhook/route';

// Force Node.js runtime for webhook processing
export const runtime = 'nodejs';

/**
 * OpenNode Webhook Handler
 *
 * OpenNode sends a POST request to the callback_url when a charge status changes.
 * The payload is sent as application/x-www-form-urlencoded.
 *
 * Webhook payload fields:
 * - id: Charge identifier
 * - status: Current charge state (unpaid, paid, processing, expired, underpaid, refunded)
 * - hashed_order: HMAC-SHA256 signature for validation
 * - price: Amount in satoshis
 * - order_id: Merchant order reference (if provided)
 * - description: Charge description
 *
 * See: https://developers.opennode.com/docs/charges-webhooks
 */

// POST /api/webhooks/opennode - Handle OpenNode payment webhook
export async function POST(request: NextRequest) {
  try {
    // OpenNode sends webhooks as application/x-www-form-urlencoded
    const contentType = request.headers.get('content-type') || '';

    let payload: OpenNodeWebhookPayload;

    if (contentType.includes('application/x-www-form-urlencoded')) {
      const formData = await request.formData();
      payload = {
        id: formData.get('id') as string,
        status: formData.get('status') as OpenNodeWebhookPayload['status'],
        hashed_order: formData.get('hashed_order') as string,
        price: parseInt(formData.get('price') as string, 10),
        order_id: formData.get('order_id') as string | undefined,
        description: formData.get('description') as string | undefined,
        callback_url: formData.get('callback_url') as string | undefined,
        success_url: formData.get('success_url') as string | undefined,
        fee: formData.get('fee') ? parseInt(formData.get('fee') as string, 10) : undefined,
        auto_settle: formData.get('auto_settle') === 'true',
      };
    } else if (contentType.includes('application/json')) {
      // Also support JSON in case OpenNode changes or for testing
      payload = await request.json();
    } else {
      console.error('[OpenNode Webhook] Unsupported content type:', contentType);
      return NextResponse.json(
        { error: 'Unsupported content type' },
        { status: 400 }
      );
    }

    // Log the webhook for debugging
    console.log('[OpenNode Webhook] Received:', {
      id: payload.id,
      status: payload.status,
      price: payload.price,
      order_id: payload.order_id,
    });

    // Validate required fields
    if (!payload.id || !payload.hashed_order) {
      console.error('[OpenNode Webhook] Missing required fields');
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify webhook signature
    if (!verifyWebhookSignature(payload.id, payload.hashed_order)) {
      console.error('[OpenNode Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    console.log('[OpenNode Webhook] Signature verified');

    // Only process paid status
    if (payload.status !== 'paid') {
      console.log(`[OpenNode Webhook] Status is ${payload.status}, not processing`);
      return NextResponse.json({
        success: true,
        message: `Status ${payload.status} acknowledged`,
      });
    }

    // The charge ID is used as the invoice_id in our system
    const invoiceId = payload.id;

    console.log(`[OpenNode Webhook] Processing paid charge: ${invoiceId}`);

    // Apply payment effects (mark as paid, apply boost, etc.)
    const result = await applyPaymentEffects(invoiceId);

    if (result.success) {
      console.log(`[OpenNode Webhook] Successfully processed ${result.type} payment`);
      return NextResponse.json({
        success: true,
        message: `Payment processed: ${result.type}`,
        type: result.type,
      });
    } else {
      // Invoice not found or already processed
      console.log(`[OpenNode Webhook] No pending invoice found for: ${invoiceId}`);
      return NextResponse.json({
        success: true,
        message: result.error || 'Invoice not found or already processed',
      });
    }
  } catch (error) {
    console.error('[OpenNode Webhook] Error processing webhook:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// GET endpoint for webhook verification
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'ok',
    provider: 'opennode',
    message: 'OpenNode webhook endpoint ready',
  });
}
