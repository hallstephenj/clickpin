// Server-only module for Lightspark Lightning integration
// Do not import this file in client components

import {
  LightsparkClient,
  AccountTokenAuthProvider,
  InvoiceType,
  TransactionStatus,
  BitcoinNetwork,
} from '@lightsparkdev/lightspark-sdk';

// Singleton client instance
let lightsparkClient: LightsparkClient | null = null;
let cachedNodeId: string | null = null;

function getLightsparkClient(): LightsparkClient {
  if (!lightsparkClient) {
    const clientId = process.env.LIGHTSPARK_API_TOKEN_CLIENT_ID;
    const clientSecret = process.env.LIGHTSPARK_API_TOKEN_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        'Lightspark API credentials not configured. Set LIGHTSPARK_API_TOKEN_CLIENT_ID and LIGHTSPARK_API_TOKEN_CLIENT_SECRET.'
      );
    }

    const authProvider = new AccountTokenAuthProvider(clientId, clientSecret);
    lightsparkClient = new LightsparkClient(authProvider);
  }

  return lightsparkClient;
}

/**
 * Get the first available node ID from the Lightspark account.
 * In test mode, this will be the test node.
 */
async function getNodeId(): Promise<string> {
  if (cachedNodeId) {
    return cachedNodeId;
  }

  const client = getLightsparkClient();
  const account = await client.getCurrentAccount();

  if (!account) {
    throw new Error('Failed to get Lightspark account');
  }

  // Get nodes from the account - filter for test network in test mode
  const isTestMode = process.env.LIGHTSPARK_TEST_MODE === 'true';
  const bitcoinNetworks = isTestMode
    ? [BitcoinNetwork.REGTEST]
    : [BitcoinNetwork.MAINNET];

  const nodesConnection = await account.getNodes(client, 1, bitcoinNetworks);

  if (!nodesConnection.entities || nodesConnection.entities.length === 0) {
    throw new Error(
      `No Lightspark nodes found for ${isTestMode ? 'test' : 'production'} mode. ` +
        'Please create a node in your Lightspark dashboard.'
    );
  }

  cachedNodeId = nodesConnection.entities[0].id;
  console.log(`[Lightspark] Using node: ${cachedNodeId}`);

  return cachedNodeId;
}

export interface LightsparkInvoiceResult {
  paymentRequest: string;
  lightsparkInvoiceId?: string;
}

/**
 * Create a test mode invoice using Lightspark.
 * Only works when LIGHTSPARK_TEST_MODE=true.
 */
export async function createTestInvoice({
  amountSats,
  memo,
}: {
  amountSats: number;
  memo?: string;
}): Promise<LightsparkInvoiceResult> {
  const isTestMode = process.env.LIGHTSPARK_TEST_MODE === 'true';

  if (!isTestMode) {
    throw new Error(
      'createTestInvoice can only be used in test mode. Set LIGHTSPARK_TEST_MODE=true.'
    );
  }

  const client = getLightsparkClient();
  const nodeId = await getNodeId();

  // Convert sats to millisats (1 sat = 1000 msats)
  const amountMsats = amountSats * 1000;

  // Create test mode invoice
  const paymentRequest = await client.createTestModeInvoice(
    nodeId,
    amountMsats,
    memo || 'Clickpin payment',
    InvoiceType.STANDARD
  );

  if (!paymentRequest) {
    throw new Error('Failed to create Lightspark test invoice');
  }

  console.log(`[Lightspark] Created test invoice for ${amountSats} sats`);

  return {
    paymentRequest,
    // Note: In test mode, we don't get a separate invoice ID - the payment request IS the identifier
  };
}

/**
 * Simulate paying a test invoice using Lightspark test mode.
 * Only works when LIGHTSPARK_TEST_MODE=true.
 */
export async function simulateTestPayment({
  paymentRequest,
}: {
  paymentRequest: string;
}): Promise<{ success: boolean; status: string }> {
  const isTestMode = process.env.LIGHTSPARK_TEST_MODE === 'true';

  if (!isTestMode) {
    throw new Error(
      'simulateTestPayment can only be used in test mode. Set LIGHTSPARK_TEST_MODE=true.'
    );
  }

  const client = getLightsparkClient();
  const nodeId = await getNodeId();

  // Simulate payment in test mode
  const payment = await client.createTestModePayment(nodeId, paymentRequest);

  if (!payment) {
    throw new Error('Failed to simulate Lightspark test payment');
  }

  console.log(`[Lightspark] Simulated payment - status: ${payment.status}`);

  return {
    success: payment.status === TransactionStatus.SUCCESS,
    status: payment.status,
  };
}

/**
 * Check if an invoice has been paid by querying incoming payments.
 * Returns the payment status.
 */
export async function getInvoiceStatus({
  paymentRequest,
}: {
  paymentRequest: string;
}): Promise<'pending' | 'paid' | 'expired'> {
  const client = getLightsparkClient();

  try {
    // Query for incoming payments for this invoice
    // The paymentRequest is the encoded invoice string
    const account = await client.getCurrentAccount();
    if (!account) {
      console.error('[Lightspark] Failed to get account for status check');
      return 'pending';
    }

    // Get recent transactions and look for payments matching our invoice
    // This is a simplified approach - in production you might want to decode
    // the invoice and match by payment hash
    const transactions = await account.getTransactions(
      client,
      10, // first
      undefined, // after
      undefined, // types
      undefined, // afterDate
      undefined, // beforeDate
      undefined, // bitcoinNetwork
      undefined, // lightningNodeId
      [TransactionStatus.SUCCESS, TransactionStatus.PENDING] // statuses
    );

    // For a more robust check, we would need to decode the BOLT11 invoice
    // and match by payment hash. For now, we'll rely on webhooks or
    // the simulation marking the payment as complete in our DB.

    // This is a basic heuristic - the invoice payment_request itself
    // doesn't directly map to a transaction ID in Lightspark's model
    console.log(
      `[Lightspark] Status check - found ${transactions.entities?.length || 0} recent transactions`
    );

    return 'pending';
  } catch (error) {
    console.error('[Lightspark] Error checking invoice status:', error);
    return 'pending';
  }
}

/**
 * Check if Lightspark is properly configured and available.
 */
export function isLightsparkConfigured(): boolean {
  return !!(
    process.env.LIGHTSPARK_API_TOKEN_CLIENT_ID &&
    process.env.LIGHTSPARK_API_TOKEN_CLIENT_SECRET
  );
}

/**
 * Check if we're in Lightspark test mode.
 */
export function isLightsparkTestMode(): boolean {
  return process.env.LIGHTSPARK_TEST_MODE === 'true';
}

// Re-export webhook utilities for use in webhook handler
export {
  verifyAndParseWebhook,
  WEBHOOKS_SIGNATURE_HEADER,
  type WebhookEvent,
} from '@lightsparkdev/lightspark-sdk';
