# Lightspark Lightning Payments - Test Mode Setup

This document describes how to configure and test Lightspark Lightning payments in Clickpin.

## Overview

Clickpin supports multiple Lightning payment providers:
- `dev` - Development mode with simulated invoices (default)
- `lightspark` - Lightspark test mode for realistic Lightning integration testing

## Prerequisites

1. Create a Lightspark account at https://www.lightspark.com/
2. Access the Lightspark dashboard at https://app.lightspark.com/

## Getting Lightspark Test Credentials

1. Log in to your Lightspark dashboard
2. Navigate to **API Config** or **Settings > API Tokens**
3. Create a new API token for **Test Environment**
4. Copy the **Client ID** and **Client Secret**

For detailed instructions, see the [Lightspark Quickstart Guide](https://docs.lightspark.com/lightspark-sdk/getting-started).

## Environment Variables

Add the following to your `.env.local` file:

```bash
# Lightning Provider Configuration
LIGHTNING_PROVIDER=lightspark

# Lightspark API Credentials (Test Mode)
LIGHTSPARK_API_TOKEN_CLIENT_ID=your_client_id_here
LIGHTSPARK_API_TOKEN_CLIENT_SECRET=your_client_secret_here
LIGHTSPARK_TEST_MODE=true

# Optional: Webhook secret for signature verification
LIGHTSPARK_WEBHOOK_SECRET=your_webhook_secret_here

# Frontend flag to show simulate payment button
NEXT_PUBLIC_LIGHTNING_TEST_MODE=true
```

### Variable Descriptions

| Variable | Required | Description |
|----------|----------|-------------|
| `LIGHTNING_PROVIDER` | Yes | Set to `lightspark` to use Lightspark |
| `LIGHTSPARK_API_TOKEN_CLIENT_ID` | Yes | Your Lightspark API token client ID |
| `LIGHTSPARK_API_TOKEN_CLIENT_SECRET` | Yes | Your Lightspark API token client secret |
| `LIGHTSPARK_TEST_MODE` | Yes | Must be `true` for test mode |
| `LIGHTSPARK_WEBHOOK_SECRET` | No | Secret for webhook signature verification |
| `NEXT_PUBLIC_LIGHTNING_TEST_MODE` | No | Shows simulate button in UI when `true` |

## Testing the Integration

### 1. Start the Development Server

```bash
npm run dev
```

### 2. Create an Invoice

Trigger any payment action in the app:
- Exceed free post limit (3 posts/day at a location)
- Boost a pin
- Delete a pin after the grace period

The payment modal will display with a real Lightspark BOLT11 invoice.

### 3. Simulate Payment (Test Mode)

In test mode, a "Simulate Payment" button appears in the payment modal. Click it to simulate a successful payment without using real Bitcoin.

Alternatively, use the API directly:

```bash
# Get the invoice_id from the payment modal or API response
curl -X POST http://localhost:3000/api/invoice/{invoice_id}/simulate-pay
```

### 4. Verify Payment Status

Check the payment status:

```bash
curl http://localhost:3000/api/invoice/{invoice_id}/status
```

Response:
```json
{
  "invoice_id": "ls_abc123...",
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

### Simulate Payment (Test Mode Only)
```
POST /api/invoice/[id]/simulate-pay

Response:
{
  "success": true,
  "type": "post" | "boost" | "delete" | "sponsor",
  "message": "Payment for {type} invoice simulated successfully"
}
```

### Lightspark Webhook
```
POST /api/webhooks/lightspark

Headers:
  lightspark-signature: <signature>

Body: Lightspark webhook event payload
```

## Webhook Configuration (Optional)

To receive real-time payment notifications:

1. In your Lightspark dashboard, go to **Webhooks**
2. Add a new webhook endpoint: `https://your-domain.com/api/webhooks/lightspark`
3. Select events to subscribe to (e.g., `PAYMENT_FINISHED`)
4. Copy the webhook secret and add it to `LIGHTSPARK_WEBHOOK_SECRET`

## Switching Between Providers

### Use Dev Mode (Default)
```bash
LIGHTNING_PROVIDER=dev
DEV_MODE=true
```

### Use Lightspark Test Mode
```bash
LIGHTNING_PROVIDER=lightspark
LIGHTSPARK_API_TOKEN_CLIENT_ID=...
LIGHTSPARK_API_TOKEN_CLIENT_SECRET=...
LIGHTSPARK_TEST_MODE=true
```

## Troubleshooting

### "Lightspark API credentials not configured"
Ensure both `LIGHTSPARK_API_TOKEN_CLIENT_ID` and `LIGHTSPARK_API_TOKEN_CLIENT_SECRET` are set.

### "No Lightspark nodes found for test mode"
Your Lightspark account needs a test node. Create one in the Lightspark dashboard.

### "createTestInvoice can only be used in test mode"
Set `LIGHTSPARK_TEST_MODE=true` in your environment.

### Invoice creation fails
- Verify your API credentials are correct
- Ensure you're using test environment credentials (not production)
- Check the server logs for detailed error messages

### Simulate payment not appearing
- Ensure `NEXT_PUBLIC_LIGHTNING_TEST_MODE=true` is set
- Restart the dev server after changing env variables

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
        │               │ LightsparkProv  │
        │               │ createInvoice() │
        │               └────────┬────────┘
        │                        │
        │                        ▼
        │               ┌─────────────────┐
        │               │ Lightspark API  │
        │               │ (Test Mode)     │
        │               └─────────────────┘
        │
        ▼
┌─────────────────┐     ┌─────────────────┐
│ Simulate Button │────▶│ /api/invoice/   │
│                 │     │ simulate-pay    │
└─────────────────┘     └────────┬────────┘
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

- [Lightspark Quickstart](https://docs.lightspark.com/lightspark-sdk/getting-started)
- [create_test_mode_invoice](https://docs.lightspark.com/api/mutation/CreateTestModeInvoice)
- [create_test_mode_payment](https://docs.lightspark.com/api/mutation/CreateTestModePayment)
- [Lightspark Webhooks](https://docs.lightspark.com/api/webhooks)
