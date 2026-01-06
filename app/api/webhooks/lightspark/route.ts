import { NextRequest, NextResponse } from 'next/server';
import {
  verifyAndParseWebhook,
  WEBHOOKS_SIGNATURE_HEADER,
  type WebhookEvent,
} from '@/lib/lightspark';
import { applyPaymentEffects } from '@/app/api/lightning/webhook/route';
import { supabaseAdmin } from '@/lib/supabase';

// Force Node.js runtime for webhook processing
export const runtime = 'nodejs';

/**
 * Lightspark Webhook Event Types that we care about:
 * - PAYMENT_FINISHED: A payment to/from a node has completed
 * - NODE_STATUS: Node status changes
 *
 * See: https://docs.lightspark.com/api/webhooks
 */

// POST /api/webhooks/lightspark - Handle Lightspark webhook events
export async function POST(request: NextRequest) {
  try {
    const webhookSecret = process.env.LIGHTSPARK_WEBHOOK_SECRET;

    // Get raw body as Uint8Array for signature verification
    const bodyBuffer = await request.arrayBuffer();
    const bodyBytes = new Uint8Array(bodyBuffer);

    // Get signature from header
    const signature = request.headers.get(WEBHOOKS_SIGNATURE_HEADER);

    // Verify signature if webhook secret is configured
    let event: WebhookEvent | null = null;

    if (webhookSecret && signature) {
      try {
        event = await verifyAndParseWebhook(bodyBytes, signature, webhookSecret);
        console.log(`[Lightspark Webhook] Verified event: ${event.event_type}`);
      } catch (verifyError) {
        console.error('[Lightspark Webhook] Signature verification failed:', verifyError);
        return NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        );
      }
    } else if (webhookSecret && !signature) {
      // Secret configured but no signature provided
      console.warn('[Lightspark Webhook] Missing signature header');
      return NextResponse.json(
        { error: 'Missing webhook signature' },
        { status: 401 }
      );
    } else {
      // No webhook secret configured - parse body without verification
      // This is acceptable for test/development mode
      console.warn('[Lightspark Webhook] No webhook secret configured - skipping verification');
      const bodyText = new TextDecoder().decode(bodyBytes);
      const bodyJson = JSON.parse(bodyText);

      // Manually construct event object from raw payload
      event = {
        event_type: bodyJson.event_type,
        event_id: bodyJson.event_id || bodyJson.id,
        timestamp: new Date(bodyJson.timestamp || Date.now()),
        entity_id: bodyJson.entity_id || bodyJson.data?.id,
        wallet_id: bodyJson.wallet_id,
      };
    }

    if (!event) {
      return NextResponse.json({ error: 'Failed to parse webhook event' }, { status: 400 });
    }

    // Log the event for debugging
    console.log(`[Lightspark Webhook] Processing event:`, {
      type: event.event_type,
      entityId: event.entity_id,
      timestamp: event.timestamp,
    });

    // Handle different event types
    // Lightspark webhook event types are defined in the SDK
    // Common types: PAYMENT_FINISHED, NODE_STATUS, REMOTE_SIGNING, etc.
    const eventType = String(event.event_type);

    if (eventType === 'PAYMENT_FINISHED' || eventType.includes('PAYMENT')) {
      // A payment has been completed - this could be an incoming payment for one of our invoices
      // We need to find the corresponding invoice in our database

      // The entity_id should be the transaction/payment ID in Lightspark
      // We would need to query Lightspark to get the payment details and match to our invoice
      // For simplicity in test mode, we'll log and return success

      console.log(`[Lightspark Webhook] Payment event received for entity: ${event.entity_id}`);

      // TODO: In a production implementation:
      // 1. Query Lightspark API to get payment details using entity_id
      // 2. Extract the payment_request/invoice from the payment
      // 3. Find matching invoice in our database by payment_request
      // 4. Call applyPaymentEffects(invoiceId) to mark as paid

      // For now, acknowledge the webhook
      return NextResponse.json({
        success: true,
        message: 'Payment webhook received',
        event_type: eventType,
      });
    }

    // For other event types, just acknowledge
    console.log(`[Lightspark Webhook] Unhandled event type: ${eventType}`);

    return NextResponse.json({
      success: true,
      message: 'Webhook received',
      event_type: eventType,
    });
  } catch (error) {
    console.error('[Lightspark Webhook] Error processing webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// GET endpoint for webhook verification (some providers use this)
export async function GET(request: NextRequest) {
  // Return 200 OK for webhook endpoint verification
  return NextResponse.json({
    status: 'ok',
    provider: 'lightspark',
    message: 'Lightspark webhook endpoint ready',
  });
}
