'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { config } from '@/lib/config';
import { X, Lightning, CheckCircle } from '@phosphor-icons/react';

interface PaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaymentComplete: () => void;
  type: 'post' | 'boost' | 'delete' | null;
  invoiceId?: string;
  paymentRequest?: string;
  amountSats?: number;
}

export function PaymentModal({
  isOpen,
  onClose,
  onPaymentComplete,
  type,
  invoiceId,
  paymentRequest,
  amountSats,
}: PaymentModalProps) {
  const [status, setStatus] = useState<'pending' | 'checking' | 'paid' | 'error'>('pending');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setStatus('pending');
      setCopied(false);
      setError(null);
    }
  }, [isOpen]);

  // Poll for payment status
  const checkPaymentStatus = useCallback(async () => {
    if (!invoiceId || status === 'paid' || status === 'error') return;

    try {
      const response = await fetch(`/api/invoice/${invoiceId}/status`);
      const data = await response.json();

      if (data.status === 'paid') {
        setStatus('paid');
        setTimeout(() => {
          onPaymentComplete();
        }, 1000);
      }
    } catch (err) {
      console.error('Error checking payment status:', err);
    }
  }, [invoiceId, status, onPaymentComplete]);

  // Poll every 2 seconds while waiting for payment
  useEffect(() => {
    if (!isOpen || status !== 'pending' || !invoiceId) return;

    const interval = setInterval(checkPaymentStatus, 2000);
    return () => clearInterval(interval);
  }, [isOpen, status, invoiceId, checkPaymentStatus]);

  const handleCopy = async () => {
    if (paymentRequest) {
      await navigator.clipboard.writeText(paymentRequest);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSimulatePayment = async () => {
    if (!invoiceId) return;

    setStatus('checking');
    try {
      // Use the new simulate-pay endpoint which works for both DEV mode and Lightspark test mode
      const response = await fetch(`/api/invoice/${invoiceId}/simulate-pay`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await response.json();

      if (!response.ok) {
        // Fallback to old dev endpoint for backwards compatibility
        if (response.status === 404 && config.dev.enabled) {
          const devResponse = await fetch('/api/dev/mark-paid', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ invoice_id: invoiceId }),
          });
          const devData = await devResponse.json();
          if (!devResponse.ok) {
            throw new Error(devData.error || 'payment failed');
          }
        } else {
          throw new Error(data.error || 'payment failed');
        }
      }

      setStatus('paid');
      setTimeout(() => {
        onPaymentComplete();
      }, 1000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'payment failed');
      setStatus('error');
    }
  };

  // Check if test/simulation mode is available
  const canSimulatePayment = config.dev.enabled || config.lightning.testModeEnabled;

  if (!isOpen) return null;

  const getTitle = () => {
    switch (type) {
      case 'post': return 'pay to post';
      case 'boost': return 'boost post';
      case 'delete': return 'pay to delete';
      default: return 'payment';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="font-mono text-sm text-muted">{getTitle()}</span>
          <button
            onClick={onClose}
            className="text-muted hover:text-[var(--fg)] leading-none"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {status === 'paid' ? (
            <div className="py-8 text-center">
              <CheckCircle size={32} weight="fill" className="text-accent mx-auto mb-2" />
              <p className="font-mono text-sm">payment confirmed</p>
            </div>
          ) : (
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
                  {amountSats?.toLocaleString()} sats
                </div>
                <div className="text-xs text-faint mt-1 font-mono">
                  scan with Lightning wallet or use test wallet below
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

              {/* Test mode / DEV mode payment simulation */}
              {canSimulatePayment && (
                <div className="mt-6 pt-4 border-t border-[var(--border)]">
                  <div className="text-xs text-faint font-mono mb-2 text-center">
                    {config.lightning.provider === 'lightspark' ? 'test mode' : 'dev mode'}
                  </div>
                  <button
                    onClick={handleSimulatePayment}
                    disabled={status === 'checking'}
                    className="btn btn-primary w-full justify-center disabled:opacity-50"
                  >
                    {status === 'checking' ? 'processing...' : 'simulate payment'}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
