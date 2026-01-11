'use client';

import { useState, useEffect, useCallback } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { config } from '@/lib/config';
import { X, Lightning, CheckCircle } from '@phosphor-icons/react';

interface SponsorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
  presenceToken: string | null;
  locationName: string;
  locationId: string;
  currentSponsorAmount: number | null;
}

type Step = 'label' | 'payment' | 'complete' | 'queue';

interface QueueItem {
  id: string;
  sponsor_label: string;
  amount_sats: number;
  is_current: boolean;
  is_active: boolean;
  remaining_hours: number;
  starts_in_hours: number;
  position: number;
}

interface QueueData {
  current: QueueItem | null;
  pending: QueueItem[];
  total_in_queue: number;
}

export function SponsorModal({
  isOpen,
  onClose,
  onComplete,
  presenceToken,
  locationName,
  locationId,
  currentSponsorAmount,
}: SponsorModalProps) {
  const [step, setStep] = useState<Step>('label');
  const [sponsorLabel, setSponsorLabel] = useState('');
  const [sponsorUrl, setSponsorUrl] = useState('');
  const [bidAmount, setBidAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Payment state
  const [invoiceId, setInvoiceId] = useState<string | null>(null);
  const [paymentRequest, setPaymentRequest] = useState<string | null>(null);
  const [amountSats, setAmountSats] = useState<number | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'checking' | 'paid'>('pending');

  // Queue state
  const [queueData, setQueueData] = useState<QueueData | null>(null);
  const [queueLoading, setQueueLoading] = useState(false);

  // Calculate minimum bid
  const minimumBid = currentSponsorAmount
    ? currentSponsorAmount + 1
    : config.payment.sponsorPriceSats;

  // Reset state when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setStep('label');
      setSponsorLabel('');
      setSponsorUrl('');
      setBidAmount(minimumBid.toString());
      setError(null);
      setLoading(false);
      setInvoiceId(null);
      setPaymentRequest(null);
      setAmountSats(null);
      setPaymentStatus('pending');
      setCopied(false);
      setQueueData(null);
    }
  }, [isOpen, minimumBid]);

  // Fetch queue data
  const fetchQueue = useCallback(async () => {
    if (!presenceToken) return;

    setQueueLoading(true);
    try {
      const response = await fetch(
        `/api/sponsor/queue?presence_token=${encodeURIComponent(presenceToken)}`
      );
      const data = await response.json();

      if (response.ok) {
        setQueueData(data);
      }
    } catch (err) {
      console.error('Failed to fetch queue:', err);
    } finally {
      setQueueLoading(false);
    }
  }, [presenceToken]);

  const handleViewQueue = () => {
    fetchQueue();
    setStep('queue');
  };

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

    // Validate URL if provided
    const trimmedUrl = sponsorUrl.trim();
    if (trimmedUrl && !trimmedUrl.match(/^https?:\/\/.+/)) {
      setError('URL must start with http:// or https://');
      return;
    }

    const amount = parseInt(bidAmount, 10);
    if (isNaN(amount) || amount < minimumBid) {
      setError(`Amount must be at least ${minimumBid} sats`);
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
          sponsor_url: trimmedUrl || null,
          amount_sats: amount,
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
            className="text-muted hover:text-[var(--fg)] leading-none"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {step === 'label' && (
            <>
              <p className="text-sm text-muted mb-4">
                Put your name on <strong>{locationName}</strong>. Sponsorships last indefinitely
                until someone outbids you.
              </p>

              {/* Current sponsor info */}
              {currentSponsorAmount && (
                <div className="mb-4 p-3 bg-[var(--bg-alt)] border border-[var(--border)] text-sm">
                  <div className="text-faint font-mono text-xs mb-1">current sponsor paid</div>
                  <div className="text-accent font-bold">{currentSponsorAmount.toLocaleString()} sats</div>
                  <div className="text-xs text-faint mt-1">
                    to become the new sponsor, bid at least {minimumBid.toLocaleString()} sats
                  </div>
                </div>
              )}

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

              <div className="mb-4">
                <label className="block text-xs text-faint font-mono mb-1">
                  link (optional)
                </label>
                <input
                  type="url"
                  value={sponsorUrl}
                  onChange={(e) => setSponsorUrl(e.target.value)}
                  placeholder="https://your-website.com"
                  className="w-full p-2 text-sm bg-[var(--bg-alt)] border border-[var(--border)] focus:border-[var(--accent)] outline-none"
                />
                <div className="text-xs text-faint font-mono mt-1">
                  your name will link here
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs text-faint font-mono mb-1">
                  your bid (minimum {minimumBid.toLocaleString()} sats)
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(e) => setBidAmount(e.target.value)}
                    min={minimumBid}
                    className="w-full p-2 text-sm bg-[var(--bg-alt)] border border-[var(--border)] focus:border-[var(--accent)] outline-none font-mono"
                  />
                  <span className="text-sm text-muted font-mono">sats</span>
                </div>
              </div>

              {error && (
                <p className="text-xs text-danger font-mono mb-3">{error}</p>
              )}

              <button
                onClick={handleCreateInvoice}
                disabled={loading || !sponsorLabel.trim() || !bidAmount}
                className="btn btn-primary w-full justify-center disabled:opacity-50"
              >
                {loading ? (
                  <span className="loading-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </span>
                ) : `pay ${parseInt(bidAmount || '0', 10).toLocaleString()} sats`}
              </button>

              <p className="text-xs text-faint font-mono mt-3 text-center">
                {currentSponsorAmount
                  ? "activates after current sponsor's 24-hour window"
                  : "activates immediately"}
              </p>

              <button
                onClick={handleViewQueue}
                className="w-full mt-3 text-xs text-faint hover:text-accent font-mono transition-colors"
              >
                view queue →
              </button>
            </>
          )}

          {step === 'queue' && (
            <div>
              <p className="text-sm text-muted mb-4">
                Sponsorship queue for <strong>{locationName}</strong>
              </p>

              {queueLoading ? (
                <div className="py-8 text-center text-muted">
                  <span className="loading-dots">
                    <span className="dot" />
                    <span className="dot" />
                    <span className="dot" />
                  </span>
                </div>
              ) : queueData ? (
                <div className="space-y-3">
                  {/* Current sponsor */}
                  {queueData.current ? (
                    <div className="p-3 bg-[var(--bg-alt)] border border-[var(--accent)] text-sm">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-accent font-mono">current sponsor</span>
                        <span className="text-xs text-faint font-mono">
                          {queueData.current.remaining_hours > 0
                            ? `${queueData.current.remaining_hours}h left`
                            : 'can be outbid'}
                        </span>
                      </div>
                      <div className="font-medium">{queueData.current.sponsor_label}</div>
                      <div className="text-xs text-muted font-mono">
                        {queueData.current.amount_sats.toLocaleString()} sats
                      </div>
                    </div>
                  ) : (
                    <div className="p-3 bg-[var(--bg-alt)] border border-[var(--border)] text-sm text-center text-muted">
                      no current sponsor
                    </div>
                  )}

                  {/* Pending sponsors */}
                  {queueData.pending.length > 0 && (
                    <div>
                      <div className="text-xs text-faint font-mono mb-2">waiting in queue</div>
                      <div className="space-y-2">
                        {queueData.pending.map((item, index) => (
                          <div
                            key={item.id}
                            className="p-3 bg-[var(--bg-alt)] border border-[var(--border)] text-sm"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs text-muted font-mono">#{index + 1} in queue</span>
                              <span className="text-xs text-faint font-mono">
                                starts in ~{item.starts_in_hours}h
                              </span>
                            </div>
                            <div className="font-medium">{item.sponsor_label}</div>
                            <div className="text-xs text-muted font-mono">
                              {item.amount_sats.toLocaleString()} sats
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Empty queue message */}
                  {!queueData.current && queueData.pending.length === 0 && (
                    <p className="text-sm text-muted text-center py-4">
                      No sponsorships yet. Be the first!
                    </p>
                  )}

                  {/* Explanation */}
                  <div className="text-xs text-faint font-mono mt-4 p-3 bg-[var(--bg-alt)] border border-[var(--border)]">
                    <p className="mb-1">how it works:</p>
                    <ul className="space-y-1 ml-2">
                      <li>• each sponsor gets at least 24 hours</li>
                      <li>• outbid by paying 1+ sat more</li>
                      <li>• your turn starts when previous sponsor's 24h ends</li>
                    </ul>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-muted text-center py-4">
                  Failed to load queue
                </p>
              )}

              <button
                onClick={() => setStep('label')}
                className="btn w-full justify-center mt-4"
              >
                ← back
              </button>
            </div>
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
                <div className="text-accent text-2xl font-mono font-bold flex items-center justify-center gap-1">
                  <Lightning size={24} weight="fill" />
                  {amountSats?.toLocaleString()} sats
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
                  <a
                    href={`lightning:${paymentRequest}`}
                    className="btn w-full mt-2 justify-center text-xs"
                  >
                    <Lightning size={14} weight="fill" className="mr-1" />
                    open in wallet
                  </a>
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
              <CheckCircle size={32} weight="fill" className="text-accent mx-auto mb-2" />
              <p className="font-mono text-sm">payment received!</p>
              <p className="text-xs text-faint mt-2">
                {currentSponsorAmount
                  ? `"${sponsorLabel}" will appear after current sponsor's 24hr window`
                  : `"${sponsorLabel}" is now live!`}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
