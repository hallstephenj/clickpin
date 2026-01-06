# LNbits Lightning Payments Setup

This document describes how to configure and use LNbits for Lightning payments in Clickpin.

## Overview

LNbits is an open-source Lightning wallet system that provides a simple REST API for creating invoices and managing payments. It can run on top of your own Lightning node or use custodial backends.

Clickpin supports multiple Lightning payment providers:
- `dev` - Development mode with simulated invoices (default)
- `lnbits` - LNbits for real Lightning payments
- `lightspark` - Lightspark test mode

## Prerequisites

1. Access to an LNbits instance:
   - **Demo/Testing**: Use https://legend.lnbits.com (demo server, may reset periodically)
   - **Production**: Run your own LNbits instance or use a trusted provider

2. An LNbits wallet with some satoshis for receiving payments

## Getting LNbits API Key

1. Go to your LNbits instance (e.g., https://legend.lnbits.com)
2. Create or access your wallet
3. Click on **API Info** in the wallet view
4. Copy your **Admin key** or **Invoice/read key**
   - **Admin key**: Can create invoices and check status (recommended)
   - **Invoice/read key**: Can only create invoices and read wallet data

## Environment Variables

Add the following to your `.env.local` file:

```bash
# Lightning Provider Configuration
LIGHTNING_PROVIDER=lnbits

# LNbits Configuration
LNBITS_URL=https://legend.lnbits.com
LNBITS_API_KEY=your_admin_or_invoice_key_here

# Optional: Webhook secret for signature verification
LNBITS_WEBHOOK_SECRET=your_secret_here

# Frontend flag to show test payment button
NEXT_PUBLIC_LIGHTNING_TEST_MODE=true
```

### Variable Descriptions

| Variable | Required | Description |
|----------|----------|-------------|
| `LIGHTNING_PROVIDER` | Yes | Set to `lnbits` to use LNbits |
| `LNBITS_URL` | Yes | Your LNbits instance URL |
| `LNBITS_API_KEY` | Yes | Admin or Invoice key from LNbits |
| `LNBITS_WEBHOOK_SECRET` | No | Secret for webhook signature verification |
| `NEXT_PUBLIC_LIGHTNING_TEST_MODE` | No | Shows test payment button in UI when `true` |

## How It Works

### Invoice Creation Flow

1. User triggers a payment action (post, boost, delete, sponsor)
2. App calls LNbits API to create a BOLT11 invoice
3. Invoice is stored in Supabase with status `pending`
4. User is shown QR code and payment request

### Payment Confirmation Flow

**Option 1: Webhook (Recommended)**
1. User pays invoice from external Lightning wallet
2. LNbits sends webhook to `/api/webhooks/lnbits`
3. App verifies webhook and marks invoice as paid
4. Payment effects are applied (boost, sponsor, etc.)

**Option 2: Polling**
1. User pays invoice from external Lightning wallet
2. App polls `/api/invoice/[id]/status` every 2 seconds
3. Status endpoint checks LNbits API for payment status
4. When paid, effects are applied

**Option 3: Test Mode**
1. User clicks "Test Payment" button (dev/test mode only)
2. App directly marks invoice as paid in database
3. Payment effects are applied

## Testing the Integration

### 1. Get Demo Wallet (Optional)

For testing, create a wallet at https://legend.lnbits.com:
1. Visit the URL - a new wallet is created automatically
2. Copy the Admin key from API Info
3. Fund the wallet via the demo faucet or by receiving payments

### 2. Configure Environment

```bash
LIGHTNING_PROVIDER=lnbits
LNBITS_URL=https://legend.lnbits.com
LNBITS_API_KEY=your_admin_key
DEV_MODE=true
NEXT_PUBLIC_LIGHTNING_TEST_MODE=true
```

### 3. Start the Development Server

```bash
npm run dev
```

### 4. Create an Invoice

Trigger any payment action in the app:
- Exceed free post limit (3 posts/day at a location)
- Boost a pin
- Delete a pin after the grace period

The payment modal will display a real BOLT11 invoice with QR code.

### 5. Pay the Invoice

**Real Payment:**
Scan the QR code with any Lightning wallet (Phoenix, Muun, Wallet of Satoshi, etc.) and pay.

**Test Mode:**
Click the "Test Payment" button to simulate payment without using real sats.

### 6. Verify Payment Status

```bash
curl http://localhost:3000/api/invoice/{invoice_id}/status
```

Response:
```json
{
  "invoice_id": "abc123...",
  "status": "paid",
  "type": "post",
  "amount_sats": 100
}
```

## API Endpoints

### Invoice Status
```
GET /api/invoice/[id]/status

Response:
{
  "invoice_id": string,
  "status": "pending" | "paid" | "expired",
  "type": "post" | "boost" | "delete" | "sponsor",
  "amount_sats": number
}
```

### Test Payment (Dev Mode Only)
```
POST /api/test-wallet/pay

Body:
{
  "payment_request": "lnbc100n1..."
}

Response:
{
  "success": true,
  "type": "post",
  "invoice_id": "abc123...",
  "message": "Payment of post invoice successful"
}
```

### LNbits Webhook
```
POST /api/webhooks/lnbits

Headers:
  x-lnbits-signature: <signature> (optional)

Body: LNbits payment notification payload
```

## Webhook Configuration

LNbits can send webhooks when invoices are paid. The webhook URL is automatically included when creating invoices (if `NEXT_PUBLIC_APP_URL` or `VERCEL_URL` is set).

For manual configuration or local development with ngrok:

1. Set your public URL: `NEXT_PUBLIC_APP_URL=https://your-domain.com`
2. Optionally set a webhook secret: `LNBITS_WEBHOOK_SECRET=your_secret`

## Switching Between Providers

### Use Dev Mode (Default)
```bash
LIGHTNING_PROVIDER=dev
DEV_MODE=true
```

### Use LNbits
```bash
LIGHTNING_PROVIDER=lnbits
LNBITS_URL=https://legend.lnbits.com
LNBITS_API_KEY=your_api_key
```

### Use Lightspark Test Mode
```bash
LIGHTNING_PROVIDER=lightspark
LIGHTSPARK_API_TOKEN_CLIENT_ID=...
LIGHTSPARK_API_TOKEN_CLIENT_SECRET=...
LIGHTSPARK_TEST_MODE=true
```

## Troubleshooting

### "LNbits not configured"
Ensure both `LNBITS_URL` and `LNBITS_API_KEY` are set in your environment.

### "LNbits invoice creation failed: 401"
Your API key is invalid or expired. Generate a new one from your LNbits wallet.

### "LNbits invoice creation failed: 500"
The LNbits server may be down. Check if you can access the LNbits URL in your browser.

### Invoice not showing as paid
- Verify the payment was successful in your Lightning wallet
- Check if webhook is configured correctly
- Try refreshing the page (triggers status polling)

### legend.lnbits.com wallet reset
The demo server at legend.lnbits.com may reset periodically. For production:
- Run your own LNbits instance
- Use a trusted hosted LNbits provider
- Consider using your main Lightning node

## Payment Prices

Default payment amounts (configurable via env vars):

| Action | Default | Env Variable |
|--------|---------|--------------|
| Post (after free quota) | 100 sats | `POST_PRICE_SATS` |
| Boost | 500 sats | `BOOST_PRICE_SATS` |
| Delete (after grace period) | 200 sats | `DELETE_PRICE_SATS` |
| Sponsor | 10,000 sats | `SPONSOR_PRICE_SATS` |

## Architecture

```
┌─────────────────┐     ┌─────────────────┐
│  PaymentModal   │────▶│  /api/invoice/  │
│  (Frontend)     │     │  create-invoice │
└─────────────────┘     └────────┬────────┘
        │                        │
        │                        ▼
        │               ┌─────────────────┐
        │               │ LNbitsProvider  │
        │               │ createInvoice() │
        │               └────────┬────────┘
        │                        │
        │                        ▼
        │               ┌─────────────────┐
        │               │  LNbits API     │
        │               │  POST /payments │
        │               └─────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────┐
│  QR Code +      │     │ External        │
│  Lightning Link │────▶│ Lightning       │
└─────────────────┘     │ Wallet          │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ LNbits Webhook  │
                        │ /api/webhooks/  │
                        │ lnbits          │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ applyPayment    │
                        │ Effects()       │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ Update DB:      │
                        │ status='paid'   │
                        └─────────────────┘
```

## References

- [LNbits GitHub](https://github.com/lnbits/lnbits)
- [LNbits API Docs](https://legend.lnbits.com/docs)
- [BOLT11 Invoice Specification](https://github.com/lightning/bolts/blob/master/11-payment-encoding.md)
