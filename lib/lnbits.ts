// Server-only module for LNbits Lightning integration
// Do not import this file in client components
//
// LNbits is an open-source Lightning wallet system that provides a simple REST API
// for creating invoices and managing payments. It can run on top of your own
// Lightning node or use custodial backends.
//
// API Documentation: https://github.com/lnbits/lnbits

export interface LNbitsInvoiceResponse {
  payment_hash: string;
  payment_request: string; // BOLT11 invoice
  checking_id: string;
  lnurl_response?: string;
}

export interface LNbitsPaymentStatus {
  paid: boolean;
  preimage?: string;
  details?: {
    pending: boolean;
    amount: number;
    fee: number;
    memo: string;
    time: number;
    bolt11: string;
    payment_hash: string;
    expiry: number;
  };
}

/**
 * Get the configured LNbits base URL
 */
function getLNbitsUrl(): string {
  const url = process.env.LNBITS_URL || 'https://legend.lnbits.com';
  // Remove trailing slash if present
  return url.replace(/\/$/, '');
}

/**
 * Get the LNbits API key (Admin or Invoice key)
 */
function getLNbitsApiKey(): string {
  const apiKey = process.env.LNBITS_API_KEY;
  if (!apiKey) {
    throw new Error(
      'LNbits API key not configured. Set LNBITS_API_KEY in your environment.'
    );
  }
  return apiKey;
}

/**
 * Check if LNbits is properly configured
 */
export function isLNbitsConfigured(): boolean {
  return !!(process.env.LNBITS_API_KEY && process.env.LNBITS_URL);
}

/**
 * Create a Lightning invoice using LNbits API
 *
 * @param amountSats - Amount in satoshis
 * @param memo - Description for the invoice
 * @param webhookUrl - Optional webhook URL to receive payment notification
 * @returns Invoice details including payment_request (BOLT11) and payment_hash
 */
export async function createInvoice({
  amountSats,
  memo,
  webhookUrl,
}: {
  amountSats: number;
  memo?: string;
  webhookUrl?: string;
}): Promise<LNbitsInvoiceResponse> {
  const baseUrl = getLNbitsUrl();
  const apiKey = getLNbitsApiKey();

  const payload: Record<string, unknown> = {
    out: false, // false = incoming invoice (receive payment)
    amount: amountSats,
    memo: memo || 'Clickpin payment',
    unit: 'sat',
  };

  // Add webhook if provided
  if (webhookUrl) {
    payload.webhook = webhookUrl;
  }

  console.log(`[LNbits] Creating invoice for ${amountSats} sats at ${baseUrl}`);

  const response = await fetch(`${baseUrl}/api/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LNbits] Invoice creation failed: ${response.status} - ${errorText}`);
    throw new Error(`LNbits invoice creation failed: ${response.status}`);
  }

  const data: LNbitsInvoiceResponse = await response.json();

  console.log(`[LNbits] Created invoice with payment_hash: ${data.payment_hash}`);

  return data;
}

/**
 * Check if an invoice has been paid
 *
 * @param paymentHash - The payment hash from invoice creation
 * @returns Payment status with paid boolean
 */
export async function checkInvoiceStatus({
  paymentHash,
}: {
  paymentHash: string;
}): Promise<LNbitsPaymentStatus> {
  const baseUrl = getLNbitsUrl();
  const apiKey = getLNbitsApiKey();

  const response = await fetch(`${baseUrl}/api/v1/payments/${paymentHash}`, {
    method: 'GET',
    headers: {
      'X-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LNbits] Status check failed: ${response.status} - ${errorText}`);
    throw new Error(`LNbits status check failed: ${response.status}`);
  }

  const data: LNbitsPaymentStatus = await response.json();

  return data;
}

/**
 * Decode a BOLT11 invoice to get its details
 *
 * @param bolt11 - The BOLT11 invoice string
 * @returns Decoded invoice details
 */
export async function decodeInvoice(bolt11: string): Promise<{
  payment_hash: string;
  amount_msat: number;
  description: string;
  expiry: number;
  timestamp: number;
}> {
  const baseUrl = getLNbitsUrl();
  const apiKey = getLNbitsApiKey();

  const response = await fetch(`${baseUrl}/api/v1/payments/decode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({ data: bolt11 }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LNbits] Invoice decode failed: ${response.status} - ${errorText}`);
    throw new Error(`LNbits invoice decode failed: ${response.status}`);
  }

  return response.json();
}

/**
 * Pay a Lightning invoice (for testing - pays from your LNbits wallet)
 * WARNING: This actually sends sats from your wallet!
 *
 * @param bolt11 - The BOLT11 invoice to pay
 * @returns Payment result
 */
export async function payInvoice({
  bolt11,
}: {
  bolt11: string;
}): Promise<{
  payment_hash: string;
  checking_id: string;
}> {
  const baseUrl = getLNbitsUrl();
  const apiKey = getLNbitsApiKey();

  console.log(`[LNbits] Paying invoice...`);

  const response = await fetch(`${baseUrl}/api/v1/payments`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Api-Key': apiKey,
    },
    body: JSON.stringify({
      out: true, // true = outgoing payment (send payment)
      bolt11,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`[LNbits] Payment failed: ${response.status} - ${errorText}`);
    throw new Error(`LNbits payment failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();
  console.log(`[LNbits] Payment sent, hash: ${data.payment_hash}`);

  return data;
}

/**
 * Get wallet balance
 *
 * @returns Wallet balance in sats
 */
export async function getWalletBalance(): Promise<{
  balance: number; // in millisatoshis
  balanceSats: number;
}> {
  const baseUrl = getLNbitsUrl();
  const apiKey = getLNbitsApiKey();

  const response = await fetch(`${baseUrl}/api/v1/wallet`, {
    method: 'GET',
    headers: {
      'X-Api-Key': apiKey,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LNbits wallet check failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return {
    balance: data.balance,
    balanceSats: Math.floor(data.balance / 1000),
  };
}

/**
 * Verify a webhook signature from LNbits (if configured)
 * Note: LNbits webhook signatures depend on your setup
 *
 * @param payload - The webhook payload
 * @param signature - The signature from headers
 * @returns Whether the signature is valid
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string
): boolean {
  const secret = process.env.LNBITS_WEBHOOK_SECRET;

  if (!secret) {
    // No secret configured, skip verification
    console.warn('[LNbits] No webhook secret configured, skipping verification');
    return true;
  }

  // LNbits webhook verification depends on how you configure it
  // By default, you can pass a token in the webhook URL query params
  // For more secure setups, implement HMAC verification here
  // TODO: Implement proper HMAC verification if LNbits supports it

  return signature === secret;
}
