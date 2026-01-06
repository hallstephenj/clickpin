import { v4 as uuidv4 } from 'uuid';
import { config } from './config';
import {
  createTestInvoice,
  simulateTestPayment,
  isLightsparkConfigured,
  isLightsparkTestMode,
} from './lightspark';
import {
  createInvoice as createLNbitsInvoice,
  checkInvoiceStatus as checkLNbitsInvoiceStatus,
  isLNbitsConfigured,
} from './lnbits';
import {
  createCharge as createOpenNodeCharge,
  getChargeInfo as getOpenNodeChargeInfo,
  isOpenNodeConfigured,
  mapOpenNodeStatus,
} from './opennode';

export interface LightningInvoice {
  invoice_id: string;
  payment_request: string;
  amount_sats: number;
  expires_at: Date;
  memo: string;
}

export interface LightningProvider {
  createInvoice(amountSats: number, memo: string): Promise<LightningInvoice>;
  checkPaymentStatus(invoiceId: string): Promise<'pending' | 'paid' | 'expired'>;
}

// DEV mode provider - simulates Lightning payments
class DevLightningProvider implements LightningProvider {
  async createInvoice(amountSats: number, memo: string): Promise<LightningInvoice> {
    const invoiceId = `dev_${uuidv4()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Generate a fake BOLT11-like invoice for display purposes
    const fakePaymentRequest = `lnbc${amountSats}n1dev${invoiceId.substring(0, 20)}`;

    return {
      invoice_id: invoiceId,
      payment_request: fakePaymentRequest,
      amount_sats: amountSats,
      expires_at: expiresAt,
      memo,
    };
  }

  async checkPaymentStatus(invoiceId: string): Promise<'pending' | 'paid' | 'expired'> {
    // In DEV mode, payments stay pending until manually marked paid
    // via /api/dev/mark-paid
    console.log(`[DEV] Checking payment status for invoice: ${invoiceId}`);
    return 'pending';
  }
}

// Strike provider placeholder
// To implement: https://docs.strike.me/api/
class StrikeLightningProvider implements LightningProvider {
  private apiKey: string;
  private baseUrl = 'https://api.strike.me/v1';

  constructor() {
    this.apiKey = process.env.STRIKE_API_KEY || '';
  }

  async createInvoice(amountSats: number, memo: string): Promise<LightningInvoice> {
    if (!this.apiKey) {
      throw new Error('Strike API key not configured');
    }

    // TODO: Implement actual Strike API integration
    // const response = await fetch(`${this.baseUrl}/invoices`, {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${this.apiKey}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify({
    //     correlationId: uuidv4(),
    //     description: memo,
    //     amount: { currency: 'BTC', amount: (amountSats / 100000000).toFixed(8) },
    //   }),
    // });

    throw new Error('Strike provider not yet implemented');
  }

  async checkPaymentStatus(invoiceId: string): Promise<'pending' | 'paid' | 'expired'> {
    if (!this.apiKey) {
      throw new Error('Strike API key not configured');
    }

    // TODO: Implement actual Strike API integration
    console.log(`Checking Strike payment status for: ${invoiceId}`);
    throw new Error('Strike provider not yet implemented');
  }
}

// LNbits provider - uses LNbits REST API for real Lightning payments
class LNbitsLightningProvider implements LightningProvider {
  async createInvoice(amountSats: number, memo: string): Promise<LightningInvoice> {
    if (!isLNbitsConfigured()) {
      throw new Error(
        'LNbits not configured. Set LNBITS_URL and LNBITS_API_KEY in your environment.'
      );
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Build webhook URL for payment notification
    // Support Railway, Vercel, or custom domain
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/lnbits` : undefined;

    const result = await createLNbitsInvoice({
      amountSats,
      memo,
      webhookUrl,
    });

    // Use payment_hash as invoice_id since LNbits uses it for status checks
    return {
      invoice_id: result.payment_hash,
      payment_request: result.payment_request,
      amount_sats: amountSats,
      expires_at: expiresAt,
      memo,
    };
  }

  async checkPaymentStatus(invoiceId: string): Promise<'pending' | 'paid' | 'expired'> {
    if (!isLNbitsConfigured()) {
      throw new Error(
        'LNbits not configured. Set LNBITS_URL and LNBITS_API_KEY in your environment.'
      );
    }

    try {
      // invoiceId is actually the payment_hash for LNbits
      const status = await checkLNbitsInvoiceStatus({ paymentHash: invoiceId });

      if (status.paid) {
        return 'paid';
      }

      // Check if expired based on details
      if (status.details?.expiry && status.details?.time) {
        const expiryTime = (status.details.time + status.details.expiry) * 1000;
        if (Date.now() > expiryTime) {
          return 'expired';
        }
      }

      return 'pending';
    } catch (error) {
      console.error('[LNbits] Error checking payment status:', error);
      return 'pending';
    }
  }
}

// OpenNode provider - uses OpenNode API for real Lightning payments
class OpenNodeLightningProvider implements LightningProvider {
  async createInvoice(amountSats: number, memo: string): Promise<LightningInvoice> {
    if (!isOpenNodeConfigured()) {
      throw new Error(
        'OpenNode not configured. Set OPENNODE_API_KEY in your environment.'
      );
    }

    // Build webhook URL for payment notification
    // Support Railway, Vercel, or custom domain
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ||
      (process.env.RAILWAY_PUBLIC_DOMAIN ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}` : null) ||
      (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
    const webhookUrl = baseUrl ? `${baseUrl}/api/webhooks/opennode` : undefined;

    const result = await createOpenNodeCharge({
      amountSats,
      memo,
      webhookUrl,
    });

    const expiresAt = new Date(result.data.lightning_invoice.expires_at * 1000);

    // Use OpenNode charge ID as invoice_id
    return {
      invoice_id: result.data.id,
      payment_request: result.data.lightning_invoice.payreq,
      amount_sats: amountSats,
      expires_at: expiresAt,
      memo,
    };
  }

  async checkPaymentStatus(invoiceId: string): Promise<'pending' | 'paid' | 'expired'> {
    if (!isOpenNodeConfigured()) {
      throw new Error(
        'OpenNode not configured. Set OPENNODE_API_KEY in your environment.'
      );
    }

    try {
      const chargeInfo = await getOpenNodeChargeInfo({ chargeId: invoiceId });
      return mapOpenNodeStatus(chargeInfo.data.status);
    } catch (error) {
      console.error('[OpenNode] Error checking payment status:', error);
      return 'pending';
    }
  }
}

// Lightspark provider - uses test mode for development
class LightsparkLightningProvider implements LightningProvider {
  async createInvoice(amountSats: number, memo: string): Promise<LightningInvoice> {
    if (!isLightsparkConfigured()) {
      throw new Error(
        'Lightspark not configured. Set LIGHTSPARK_API_TOKEN_CLIENT_ID and LIGHTSPARK_API_TOKEN_CLIENT_SECRET.'
      );
    }

    if (!isLightsparkTestMode()) {
      throw new Error(
        'Lightspark production mode not yet implemented. Use LIGHTSPARK_TEST_MODE=true.'
      );
    }

    const invoiceId = `ls_${uuidv4()}`;
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const result = await createTestInvoice({ amountSats, memo });

    return {
      invoice_id: invoiceId,
      payment_request: result.paymentRequest,
      amount_sats: amountSats,
      expires_at: expiresAt,
      memo,
    };
  }

  async checkPaymentStatus(invoiceId: string): Promise<'pending' | 'paid' | 'expired'> {
    // For Lightspark, payment status is tracked via webhooks or manual simulation
    // The actual status is stored in our database and updated by the webhook handler
    // or the simulate-pay endpoint
    console.log(`[Lightspark] Checking payment status for: ${invoiceId}`);
    return 'pending';
  }

  async simulatePayment(paymentRequest: string): Promise<boolean> {
    if (!isLightsparkTestMode()) {
      throw new Error('Payment simulation only available in test mode');
    }

    const result = await simulateTestPayment({ paymentRequest });
    return result.success;
  }
}

// Factory function to get the configured Lightning provider
export function getLightningProvider(): LightningProvider {
  const providerName = process.env.LIGHTNING_PROVIDER || 'dev';

  switch (providerName.toLowerCase()) {
    case 'opennode':
      return new OpenNodeLightningProvider();
    case 'lightspark':
      return new LightsparkLightningProvider();
    case 'strike':
      return new StrikeLightningProvider();
    case 'lnbits':
      return new LNbitsLightningProvider();
    case 'dev':
    default:
      if (!config.dev.enabled) {
        console.warn('Using DEV Lightning provider in production mode');
      }
      return new DevLightningProvider();
  }
}

// Get Lightspark provider specifically (for simulate-pay endpoint)
export function getLightsparkProvider(): LightsparkLightningProvider | null {
  const providerName = process.env.LIGHTNING_PROVIDER || 'dev';
  if (providerName.toLowerCase() === 'lightspark') {
    return new LightsparkLightningProvider();
  }
  return null;
}

// Helper to get amount for different payment types
export function getPaymentAmount(type: 'post' | 'boost' | 'delete' | 'sponsor'): number {
  switch (type) {
    case 'post':
      return config.payment.postPriceSats;
    case 'boost':
      return config.payment.boostPriceSats;
    case 'delete':
      return config.payment.deletePriceSats;
    case 'sponsor':
      return config.payment.sponsorPriceSats;
    default:
      throw new Error(`Unknown payment type: ${type}`);
  }
}

// Helper to generate memo for different payment types
export function getPaymentMemo(
  type: 'post' | 'boost' | 'delete' | 'sponsor',
  context?: { locationName?: string; pinId?: string }
): string {
  switch (type) {
    case 'post':
      return `Clickpin post at ${context?.locationName || 'location'}`;
    case 'boost':
      return `Boost pin ${context?.pinId?.substring(0, 8) || ''}`;
    case 'delete':
      return `Delete pin ${context?.pinId?.substring(0, 8) || ''}`;
    case 'sponsor':
      return `Sponsor ${context?.locationName || 'location'} on Clickpin`;
    default:
      return 'Clickpin payment';
  }
}
