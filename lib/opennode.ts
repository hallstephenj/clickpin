// Server-only module for OpenNode Lightning integration
// Do not import this file in client components
//
// OpenNode is a Bitcoin payment processor that provides Lightning Network
// and on-chain payment capabilities via a simple REST API.
//
// API Documentation: https://developers.opennode.com/docs

import crypto from 'crypto';

export interface OpenNodeChargeResponse {
  data: {
    id: string;
    status: 'unpaid' | 'paid' | 'processing' | 'expired' | 'underpaid' | 'refunded';
    amount: number; // in satoshis
    currency: string;
    source_fiat_value?: number;
    created_at: number;
    address?: string;
    hosted_checkout_url: string;
    chain_invoice?: {
      address: string;
    };
    lightning_invoice: {
      expires_at: number;
      payreq: string; // BOLT11 invoice
    };
    uri: string;
    metadata?: Record<string, string>;
    description?: string;
    order_id?: string;
    callback_url?: string;
    success_url?: string;
  };
}

export interface OpenNodeChargeInfo {
  data: {
    id: string;
    status: 'unpaid' | 'paid' | 'processing' | 'expired' | 'underpaid' | 'refunded';
    amount: number;
    description?: string;
    created_at: number;
    lightning_invoice?: {
      expires_at: number;
      payreq: string;
    };
  };
}

export interface OpenNodeWebhookPayload {
  id: string;
  callback_url?: string;
  success_url?: string;
  status: 'unpaid' | 'paid' | 'processing' | 'expired' | 'underpaid' | 'refunded';
  order_id?: string;
  description?: string;
  price: number; // in satoshis
  fee?: number;
  auto_settle?: boolean;
  hashed_order: string;
}

/**
 * Get the OpenNode API base URL
 */
function getOpenNodeUrl(): string {
  // Use dev API for testing, production API for real payments
  const isTestMode = process.env.OPENNODE_TEST_MODE === 'true';
  return isTestMode
    ? 'https://dev-api.opennode.co'
    : 'https://api.opennode.com';
}

/**
 * Get the OpenNode API key
 */
function getOpenNodeApiKey(): string {
  const apiKey = process.env.OPENNODE_API_KEY;
  if (!apiKey) {
    throw new Error(
      'OpenNode API key not configured. Set OPENNODE_API_KEY in your environment.'
    );
  }
  return apiKey;
}

/**
 * Check if OpenNode is properly configured
 */
export function isOpenNodeConfigured(): boolean {
  return !!process.env.OPENNODE_API_KEY;
}

/**
 * Check if OpenNode is in test mode
 */
export function isOpenNodeTestMode(): boolean {
  return process.env.OPENNODE_TEST_MODE === 'true';
}

/**
 * Create a Lightning charge using OpenNode API
 *
 * @param amountSats - Amount in satoshis
 * @param memo - Description for the charge
 * @param webhookUrl - Optional webhook URL for payment notification
 * @param orderId - Optional order ID for tracking
 * @returns Charge details including lightning_invoice.payreq (BOLT11)
 */
export async function createCharge({
  amountSats,
  memo,
  webhookUrl,
  orderId,
}: {
  amountSats: number;
  memo?: string;
  webhookUrl?: string;
  orderId?: string;
}): Promise<OpenNodeChargeResponse> {
  const baseUrl = getOpenNodeUrl();
  const apiKey = getOpenNodeApiKey();

  const payload: Record<string, unknown> = {
    amount: amountSats,
    currency: 'BTC', // Specify BTC to use satoshi amount directly
    description: memo || 'Clickpin payment',
    auto_settle: false, // Keep as Bitcoin
  };

  if (webhookUrl) {
    payload.callback_url = webhookUrl;
  }

  if (orderId) {
    payload.order_id = orderId;
  }

  console.log(`[OpenNode] Creating charge for ${amountSats} sats at ${baseUrl}`);

  const response = await fetch(`${baseUrl}/v1/charges`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[OpenNode] Charge creation failed: ${response.status} - ${errorText}`);
    throw new Error(`OpenNode charge creation failed: ${response.status}`);
  }

  const data: OpenNodeChargeResponse = await response.json();

  console.log(`[OpenNode] Created charge with id: ${data.data.id}`);

  return data;
}

/**
 * Get charge information / check payment status
 *
 * @param chargeId - The charge ID from charge creation
 * @returns Charge information with current status
 */
export async function getChargeInfo({
  chargeId,
}: {
  chargeId: string;
}): Promise<OpenNodeChargeInfo> {
  const baseUrl = getOpenNodeUrl();
  const apiKey = getOpenNodeApiKey();

  const response = await fetch(`${baseUrl}/v2/charge/${chargeId}`, {
    method: 'GET',
    headers: {
      'Authorization': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[OpenNode] Get charge info failed: ${response.status} - ${errorText}`);
    throw new Error(`OpenNode get charge info failed: ${response.status}`);
  }

  const data: OpenNodeChargeInfo = await response.json();

  return data;
}

/**
 * Verify webhook signature from OpenNode
 *
 * OpenNode signs all charge events with a hashed_order field.
 * Compute HMAC-SHA256(charge_id, api_key) and compare to hashed_order.
 *
 * @param chargeId - The charge ID from the webhook payload
 * @param hashedOrder - The hashed_order field from the webhook
 * @returns Whether the signature is valid
 */
export function verifyWebhookSignature(
  chargeId: string,
  hashedOrder: string
): boolean {
  const apiKey = getOpenNodeApiKey();

  const calculated = crypto
    .createHmac('sha256', apiKey)
    .update(chargeId)
    .digest('hex');

  const isValid = calculated === hashedOrder;

  if (!isValid) {
    console.warn('[OpenNode] Webhook signature verification failed');
    console.warn(`[OpenNode] Expected: ${calculated}, Received: ${hashedOrder}`);
  }

  return isValid;
}

/**
 * Map OpenNode status to our internal status
 */
export function mapOpenNodeStatus(
  status: OpenNodeChargeResponse['data']['status']
): 'pending' | 'paid' | 'expired' {
  switch (status) {
    case 'paid':
      return 'paid';
    case 'expired':
      return 'expired';
    case 'unpaid':
    case 'processing':
    case 'underpaid':
    case 'refunded':
    default:
      return 'pending';
  }
}
