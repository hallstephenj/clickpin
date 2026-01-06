'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { config } from '@/lib/config';

interface SponsorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  presenceToken: string | null;
  locationName: string;
}

type Step = 'label' | 'payment' | 'complete';

export function SponsorModal({
  isOpen,
  onClose,
  onComplete,
  presenceToken,
  locationName,
}: SponsorModalProps) {
  const [step, setStep] = useState<Step>('label');
  const [sponsorLabel, setSponsorLabel] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Payment state
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<string | null>(null);
  const [amountSats, setAmountSats] = useState<number | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'paid'>('pending');

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('label');
      setSponsorLabel('');
      setError(null);
      setLoading(false);
      setInvoiceId(null);
      setPaymentRequest(null);
      setAmountSats(null);
      setPaymentStatus('pending');
      setCopied(false);
    }
  }, [isOpen]);

  // Poll for payment status
  const checkPaymentStatus = useCallback(async () => {
    if (!invoiceId || paymentStatus === 'paid') return;

    try {
      const response = await fetch(`/api/invoice/${invoiceId}/status`);
      const data = await response.json();

      if (data.status === 'paid') {
        setPaymentStatus('paid');
        setStep('complete');
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    } catch (err) {
      console.error('Error checking payment status:', err);
    }
  }, [invoiceId, paymentStatus, onComplete]);

  // Poll every 2 seconds while waiting for payment
  useEffect(() => {
    if (!isOpen || step !== 'payment' || paymentStatus !== 'pending' || !invoiceId) return;

    const interval = setInterval(checkPaymentStatus, 2000);
    return () => clearInterval(interval);
  }, [isOpen, step, paymentStatus, invoiceId, checkPaymentStatus]);

  const handleCreateInvoice = async () => {
    if (!presenceToken) {
      setError('Location not verified');
      return;
    }

    if (!sponsorLabel.trim()) {
      setError('Please enter a sponsor name');
      return;
    }

    if (sponsorLabel.length > 50) {
      setError('Sponsor name must be 50 characters or less');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/sponsor/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          presence_token: presenceToken,
          sponsor_label: sponsorLabel.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create invoice');
      }

      setInvoiceId(data.invoice_id);
      setPaymentRequest(data.payment_request);
      setAmountSats(data.amount_sats);
      setStep('payment');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create invoice');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = async () => {
    if (paymentRequest) {
      await navigator.clipboard.writeText(paymentRequest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSimulatePayment = async () => {
    if (!invoiceId) return;

    setPaymentStatus('checking');
    try {
      const response = await fetch(`/api/invoice/${invoiceId}/simulate-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Payment failed');
      }

      setPaymentStatus('paid');
      setStep('complete');
      setTimeout(() => {
        onComplete();
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
      setPaymentStatus('pending');
    }
  };

  const canSimulatePayment = config.dev.enabled || config.lightning.testModeEnabled;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="font-mono text-sm text-muted">sponsor this board</span>
          <button
            onClick={onClose}
            className="text-muted hover:text-[var(--fg)] text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          {step === 'label' && (
            <>
              <p className="text-sm text-muted mb-4">
                Put your name on <strong>{locationName}</strong> for {config.payment.sponsorDurationDays} days.
                Your name will appear at the top of the board.
              </p>

              <div className="mb-4">
                <label className="block text-xs text-faint font-mono mb-1">
                  sponsor name (max 50 chars)
                </label>
                <input
                  type="text"
                  value={sponsorLabel}
                  onChange={(e) => setSponsorLabel(e.target.value)}
                  maxLength={50}
                  placeholder="your name or brand"
                  className="w-full p-2 text-sm bg-[var(--bg-alt)] border border-[var(--border)] focus:border-[var(--accent)] outline-none"
                  autoFocus
                />
                <div className="text-xs text-faint font-mono mt-1 text-right">
                  {sponsorLabel.length}/50
                </div>
              </div>

              {error && (
                <p className="text-xs text-danger font-mono mb-3">{error}</p>
              )}

              <button
                onClick={handleCreateInvoice}
                disabled={loading || !sponsorLabel.trim()}
                className="btn btn-primary w-full justify-center disabled:opacity-50"
              >
                {loading ? 'creating invoice...' : `continue • ${config.payment.sponsorPriceSats} sats`}
              </button>
            </>
          )}

          {step === 'payment' && (
            <>
              {/* QR Code */}
              {paymentRequest && (
                <div className="flex justify-center py-4 bg-white rounded">
                  <QRCodeSVG
                    value={paymentRequest.toUpperCase()}
                    size={180}
                    level="M"
                    includeMargin={true}
                  />
                </div>
              )}

              {/* Amount */}
              <div className="text-center py-4">
                <div className="text-accent text-2xl font-mono font-bold">
                  ⚡ {amountSats?.toLocaleString()} sats
                </div>
                <div className="text-xs text-faint mt-1 font-mono">
                  sponsoring as "{sponsorLabel}"
                </div>
              </div>

              {/* Invoice */}
              {paymentRequest && (
                <div className="mt-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={paymentRequest}
                      readOnly
                      className="flex-1 p-2 text-xs font-mono bg-[var(--bg-alt)] truncate"
                    />
                    <button onClick={handleCopy} className="btn text-xs">
                      {copied ? 'copied' : 'copy'}
                    </button>
                  </div>
                </div>
              )}

              {/* Test Wallet Link */}
              {canSimulatePayment && (
                <div className="mt-3 text-center">
                  <a
                    href="/test-wallet"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-accent hover:underline font-mono"
                  >
                    open test wallet in new tab →
                  </a>
                </div>
              )}

              {/* Error */}
              {error && (
                <p className="mt-3 text-xs text-danger font-mono">{error}</p>
              )}

              {/* Test mode payment simulation */}
              {canSimulatePayment && (
                <div className="mt-6 pt-4 border-t border-[var(--border)]">
                  <div className="text-xs text-faint font-mono mb-2 text-center">
                    {config.lightning.provider === 'lightspark' ? 'test mode' : 'dev mode'}
                  </div>
                  <button
                    onClick={handleSimulatePayment}
                    disabled={paymentStatus === 'checking'}
                    className="btn btn-primary w-full justify-center disabled:opacity-50"
                  >
                    {paymentStatus === 'checking' ? 'processing...' : 'simulate payment'}
                  </button>
                </div>
              )}

              {/* Back button */}
              <button
                onClick={() => setStep('label')}
                className="btn w-full justify-center mt-3"
              >
                ← back
              </button>
            </>
          )}

          {step === 'complete' && (
            <div className="py-8 text-center">
              <div className="text-accent text-2xl mb-2">✓</div>
              <p className="font-mono text-sm">you're now sponsoring this board!</p>
              <p className="text-xs text-faint mt-2">"{sponsorLabel}" will appear for {config.payment.sponsorDurationDays} days</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
