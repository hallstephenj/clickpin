'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Lightning, CheckCircle } from '@phosphor-icons/react';
import { config } from '@/lib/config';

interface ClaimModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClaimComplete: () => void;
  locationId: string;
  locationName: string;
  sessionId: string;
  isBitcoinMerchant?: boolean;
}

type ClaimStep = 'start' | 'invoice' | 'paid' | 'error';

export function ClaimModal({
  isOpen,
  onClose,
  onClaimComplete,
  locationId,
  locationName,
  sessionId,
  isBitcoinMerchant = true,
}: ClaimModalProps) {
  const [step, setStep] = useState<ClaimStep>('start');
  const [claimCode, setClaimCode] = useState<string>('');
  const [invoiceId, setInvoiceId] = useState<string>('');
  const [paymentRequest, setPaymentRequest] = useState<string>('');
  const [amountSats, setAmountSats] = useState<number>(0);
  const [expiresAt, setExpiresAt] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStep('start');
      setClaimCode('');
      setInvoiceId('');
      setPaymentRequest('');
      setAmountSats(0);
      setExpiresAt('');
      setError(null);
      setLoading(false);
      setCopied(false);
    }
  }, [isOpen]);

  // Start claim flow
  const handleStartClaim = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/merchant/claim/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location_id: locationId, session_id: sessionId }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to start claim');
      }

      setClaimCode(data.claim_code);
      setAmountSats(data.amount_sats);

      // Now generate the Lightning invoice
      await generateInvoice(data.claim_code);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start claim');
      setStep('error');
    } finally {
      setLoading(false);
    }
  };

  // Generate Lightning invoice
  const generateInvoice = async (code: string) => {
    try {
      const response = await fetch('/api/merchant/claim/lightning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          session_id: sessionId,
          claim_code: code,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate invoice');
      }

      setInvoiceId(data.invoice_id);
      setPaymentRequest(data.payment_request);
      setAmountSats(data.amount_sats);
      setExpiresAt(data.expires_at);
      setStep('invoice');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate invoice');
      setStep('error');
    }
  };

  // Poll for payment status
  const checkPaymentStatus = useCallback(async () => {
    if (!invoiceId || step !== 'invoice') return;

    try {
      const response = await fetch(
        `/api/merchant/claim/status?location_id=${locationId}&session_id=${sessionId}`
      );
      const data = await response.json();

      if (data.status === 'claimed' && data.is_owner) {
        setStep('paid');
        setTimeout(() => {
          onClaimComplete();
        }, 2000);
      }
    } catch (err) {
      console.error('Error checking claim status:', err);
    }
  }, [invoiceId, step, locationId, sessionId, onClaimComplete]);

  // Poll every 2 seconds while waiting for payment
  useEffect(() => {
    if (!isOpen || step !== 'invoice' || !invoiceId) return;

    const interval = setInterval(checkPaymentStatus, 2000);
    return () => clearInterval(interval);
  }, [isOpen, step, invoiceId, checkPaymentStatus]);

  const handleCopy = async () => {
    if (paymentRequest) {
      await navigator.clipboard.writeText(paymentRequest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSimulatePayment = async () => {
    if (!invoiceId) return;

    setLoading(true);
    try {
      const response = await fetch(`/api/invoice/${invoiceId}/simulate-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Payment failed');
      }

      // Check status to trigger verification
      await checkPaymentStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payment failed');
    } finally {
      setLoading(false);
    }
  };

  const canSimulatePayment = config.dev.enabled || config.lightning.testModeEnabled;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="font-mono text-sm text-muted">claim business</span>
          <button
            onClick={onClose}
            className="text-muted hover:text-[var(--fg)] leading-none"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {step === 'start' && (
            <>
              <div className="mb-4">
                <h3 className="font-mono text-sm font-bold mb-2">{locationName}</h3>
                <p className="text-xs text-muted font-mono leading-relaxed">
                  Verify ownership of this business by making a Lightning payment.
                  Once verified, you can customize your board and moderate posts.
                </p>
              </div>

              {/* Warning for non-bitcoin merchants */}
              {!isBitcoinMerchant && (
                <div className="bg-amber-500/10 border border-amber-500/30 p-3 mb-4">
                  <p className="text-xs text-amber-600 dark:text-amber-400 font-mono leading-relaxed">
                    <strong>Note:</strong> By claiming this location, you are confirming that this business accepts Bitcoin.
                    This location will be listed as a Bitcoin-accepting merchant.
                  </p>
                </div>
              )}

              <div className="bg-[var(--bg-alt)] p-3 mb-4">
                <div className="text-accent text-xl font-mono font-bold text-center flex items-center justify-center gap-1">
                  <Lightning size={20} weight="fill" />
                  {config.merchant.claimPriceSats.toLocaleString()} sats
                </div>
                <div className="text-xs text-faint font-mono text-center mt-1">
                  one-time verification fee
                </div>
              </div>

              {error && (
                <p className="text-xs text-danger font-mono mb-4">{error}</p>
              )}

              <button
                onClick={handleStartClaim}
                disabled={loading}
                className="btn btn-primary w-full justify-center disabled:opacity-50"
              >
                {loading ? 'loading...' : 'start verification'}
              </button>
            </>
          )}

          {step === 'invoice' && (
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
                <div className="text-accent text-2xl font-mono font-bold flex items-center justify-center gap-1">
                  <Lightning size={24} weight="fill" />
                  {amountSats.toLocaleString()} sats
                </div>
                <div className="text-xs text-faint mt-1 font-mono">
                  scan with Lightning wallet
                </div>
              </div>

              {/* Claim code display */}
              <div className="bg-[var(--bg-alt)] p-2 mb-3 text-center">
                <div className="text-xs text-muted font-mono">claim code</div>
                <div className="text-sm font-mono font-bold">{claimCode}</div>
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
                    dev/test mode
                  </div>
                  <button
                    onClick={handleSimulatePayment}
                    disabled={loading}
                    className="btn btn-primary w-full justify-center disabled:opacity-50"
                  >
                    {loading ? 'processing...' : 'simulate payment'}
                  </button>
                </div>
              )}
            </>
          )}

          {step === 'paid' && (
            <div className="py-8 text-center">
              <CheckCircle size={32} weight="fill" className="text-accent mx-auto mb-2" />
              <p className="font-mono text-sm font-bold mb-1">verified!</p>
              <p className="font-mono text-xs text-muted">
                you now own this board
              </p>
            </div>
          )}

          {step === 'error' && (
            <div className="py-4">
              <p className="text-xs text-danger font-mono mb-4 text-center">{error}</p>
              <button
                onClick={() => setStep('start')}
                className="btn w-full justify-center"
              >
                try again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
