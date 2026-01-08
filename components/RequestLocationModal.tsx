'use client';

import { useState } from 'react';

interface RequestLocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  lat: number;
  lng: number;
  sessionId: string | null;
}

export function RequestLocationModal({
  isOpen,
  onClose,
  lat,
  lng,
  sessionId,
}: RequestLocationModalProps) {
  const [name, setName] = useState('');
  const [isBitcoinMerchant, setIsBitcoinMerchant] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Round coordinates for display (rough location)
  const roughLat = lat.toFixed(4);
  const roughLng = lng.toFixed(4);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError('please enter a name');
      return;
    }

    if (name.length > 100) {
      setError('name too long (max 100 chars)');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/location-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat,
          lng,
          suggested_name: name.trim(),
          session_id: sessionId,
          is_bitcoin_merchant: isBitcoinMerchant,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'failed to submit');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to submit');
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setIsBitcoinMerchant(false);
    setSubmitted(false);
    setError(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="font-mono text-sm text-muted">request new location</span>
          <button
            onClick={handleClose}
            className="text-muted hover:text-[var(--fg)] text-lg leading-none"
          >
            ×
          </button>
        </div>

        <div className="p-4">
          {submitted ? (
            <div className="py-6 text-center">
              <div className="text-[#f7931a] text-2xl mb-2">✓</div>
              <p className="font-mono text-sm mb-2">request submitted</p>
              <p className="text-xs text-muted">
                we'll review your suggestion and may add this location soon.
              </p>
              <button onClick={handleClose} className="btn mt-4">
                close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              {/* Coordinates display */}
              <div className="mb-4 p-3 bg-[var(--bg-alt)] border border-[var(--border)]">
                <div className="text-xs text-muted font-mono mb-1">coordinates (approximate)</div>
                <div className="font-mono text-sm">
                  {roughLat}, {roughLng}
                </div>
              </div>

              {/* Name input */}
              <div className="mb-4">
                <label className="block text-xs text-muted font-mono mb-1">
                  what would you call this location?
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Central Park, Joe's Coffee, City Hall"
                  className="w-full p-2 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm"
                  maxLength={100}
                  autoFocus
                />
                <div className="text-xs text-faint font-mono mt-1 text-right">
                  {name.length}/100
                </div>
              </div>

              {/* Bitcoin merchant checkbox */}
              <label className="flex items-center gap-3 mb-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isBitcoinMerchant}
                  onChange={(e) => setIsBitcoinMerchant(e.target.checked)}
                  className="w-4 h-4 accent-[#f7931a]"
                />
                <span className="text-sm font-mono">
                  this is a bitcoin merchant <span className="text-[#f7931a]">⚡</span>
                </span>
              </label>

              {/* Error */}
              {error && (
                <p className="mb-4 text-xs text-danger font-mono">{error}</p>
              )}

              {/* Actions */}
              <div className="flex justify-end gap-2">
                <button type="button" onClick={handleClose} className="btn">
                  cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting || !name.trim()}
                  className="btn btn-primary disabled:opacity-50"
                >
                  {submitting ? 'submitting...' : 'submit request'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
