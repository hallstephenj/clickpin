'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import Link from 'next/link';
import { Lightning, CheckCircle } from '@phosphor-icons/react';

export default function TestWalletPage() {
  const [invoice, setInvoice] = useState('');
  const [status, setStatus] = useState<'idle' | 'decoding' | 'paying' | 'paid' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [invoiceDetails, setInvoiceDetails] = useState<{
    amount?: number;
    memo?: string;
  } | null>(null);

  // Simple BOLT11 decoder (extracts amount from invoice)
  const decodeInvoice = (bolt11: string) => {
    try {
      const lower = bolt11.toLowerCase();
      if (!lower.startsWith('lnbc') && !lower.startsWith('lntb') && !lower.startsWith('lnbcrt')) {
        throw new Error('Invalid Lightning invoice');
      }

      // Extract amount from invoice prefix
      // Format: lnbc<amount><multiplier>1...
      // Multipliers: m = milli (0.001), u = micro (0.000001), n = nano, p = pico
      const amountMatch = lower.match(/^ln(?:bc|tb|bcrt)(\d+)([munp])?1/);

      let amountSats = 0;
      if (amountMatch) {
        const num = parseInt(amountMatch[1], 10);
        const multiplier = amountMatch[2];

        // Convert to satoshis (1 BTC = 100,000,000 sats)
        switch (multiplier) {
          case 'm': amountSats = num * 100000; break; // milli-BTC
          case 'u': amountSats = num * 100; break; // micro-BTC
          case 'n': amountSats = num / 10; break; // nano-BTC
          case 'p': amountSats = num / 10000; break; // pico-BTC
          default: amountSats = num * 100000000; break; // BTC
        }
      }

      return { amount: Math.round(amountSats) };
    } catch {
      return null;
    }
  };

  const handleInvoiceChange = (value: string) => {
    setInvoice(value.trim());
    setError(null);
    setStatus('idle');

    if (value.trim()) {
      const details = decodeInvoice(value.trim());
      setInvoiceDetails(details);
    } else {
      setInvoiceDetails(null);
    }
  };

  const handlePay = async () => {
    if (!invoice) return;

    setStatus('paying');
    setError(null);

    try {
      // Call the simulate payment endpoint
      // We need to find the invoice_id from our database that matches this payment_request
      // For now, we'll use a special endpoint that accepts payment_request
      const response = await fetch('/api/test-wallet/pay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_request: invoice }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed');
      }

      setStatus('paid');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setStatus('error');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      handleInvoiceChange(text);
    } catch {
      setError('Failed to read clipboard');
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1 inline-flex items-center gap-1">
            <Lightning size={24} weight="fill" className="text-accent" /> Test Wallet
          </h1>
          <p className="text-muted text-sm font-mono">
            Simulate paying Lightning invoices
          </p>
          <p className="text-faint text-xs font-mono mt-1">
            (dev/test mode only)
          </p>
        </div>

        {/* Wallet Card */}
        <div className="border border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a]">
          {/* Balance Header */}
          <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-alt)]">
            <div className="text-xs text-muted font-mono mb-1">test balance</div>
            <div className="text-2xl font-mono font-bold text-accent">
              ∞ sats
            </div>
          </div>

          <div className="p-4">
            {status === 'paid' ? (
              <div className="py-8 text-center">
                <CheckCircle size={48} weight="fill" className="text-accent mb-2 mx-auto" />
                <p className="font-mono text-lg mb-2">Payment Sent!</p>
                <p className="text-muted text-sm font-mono">
                  {invoiceDetails?.amount?.toLocaleString()} sats
                </p>
                <button
                  onClick={() => {
                    setStatus('idle');
                    setInvoice('');
                    setInvoiceDetails(null);
                  }}
                  className="btn mt-4"
                >
                  Pay Another
                </button>
              </div>
            ) : (
              <>
                {/* Invoice Input */}
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs text-muted font-mono">
                      paste invoice
                    </label>
                    <button
                      onClick={handlePaste}
                      className="btn text-xs"
                    >
                      paste
                    </button>
                  </div>
                  <textarea
                    value={invoice}
                    onChange={(e) => handleInvoiceChange(e.target.value)}
                    placeholder="lnbc..."
                    className="w-full p-3 text-xs font-mono bg-[var(--bg-alt)] border border-[var(--border)] min-h-[100px] resize-none"
                  />
                </div>

                {/* Invoice Preview */}
                {invoice && invoiceDetails && (
                  <div className="mb-4 p-4 bg-[var(--bg-alt)] border border-[var(--border)]">
                    <div className="flex justify-center mb-3">
                      <QRCodeSVG
                        value={invoice.toUpperCase()}
                        size={120}
                        level="M"
                        includeMargin={true}
                        bgColor="transparent"
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-mono font-bold text-accent inline-flex items-center justify-center gap-1">
                        <Lightning size={20} weight="fill" /> {invoiceDetails.amount?.toLocaleString() || '?'} sats
                      </div>
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="mb-4 p-3 border border-[var(--danger)] text-danger text-sm font-mono">
                    {error}
                  </div>
                )}

                {/* Pay Button */}
                <button
                  onClick={handlePay}
                  disabled={!invoice || status === 'paying'}
                  className="btn btn-primary w-full justify-center text-lg py-3 disabled:opacity-50"
                >
                  {status === 'paying' ? (
                    'Sending...'
                  ) : (
                    <>Pay {invoiceDetails?.amount ? `${invoiceDetails.amount.toLocaleString()} sats` : ''}</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-faint font-mono">
          <Link href="/" className="hover:text-accent">
            ← back to clickpin
          </Link>
          <span className="mx-2">•</span>
          <span>test mode simulation</span>
        </div>
      </div>
    </div>
  );
}
