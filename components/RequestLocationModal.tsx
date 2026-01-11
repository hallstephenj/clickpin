'use client';

import { useState } from 'react';
import { X, Lightning, CheckCircle, Storefront, UsersThree } from '@phosphor-icons/react';
import type { LocationType } from '@/types';

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
  const [locationType, setLocationType] = useState<LocationType>('merchant');
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
          location_type: locationType,
          // Legacy field for backwards compatibility
          is_bitcoin_merchant: locationType === 'bitcoin_merchant',
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
    setLocationType('merchant');
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
            className="text-muted hover:text-[var(--fg)] leading-none"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          {submitted ? (
            <div className="py-6 text-center">
              <CheckCircle size={32} weight="fill" className="text-[#f7931a] mx-auto mb-2" />
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

              {/* Location type selector */}
              <div className="mb-4">
                <label className="block text-xs text-muted font-mono mb-2">
                  what type of location is this?
                </label>
                <div className="space-y-2">
                  <label className={`flex items-center gap-2 p-2 border cursor-pointer transition-colors ${
                    locationType === 'merchant'
                      ? 'border-gray-500 bg-gray-50 dark:bg-gray-900'
                      : 'border-[var(--border)]'
                  }`}>
                    <input
                      type="radio"
                      name="location_type"
                      value="merchant"
                      checked={locationType === 'merchant'}
                      onChange={() => setLocationType('merchant')}
                      className="w-4 h-4 m-0 p-0 !w-4"
                    />
                    <Storefront size={16} className="text-gray-500" />
                    <span className="text-sm font-mono">business (doesn't accept bitcoin)</span>
                  </label>
                  <label className={`flex items-center gap-2 p-2 border cursor-pointer transition-colors ${
                    locationType === 'bitcoin_merchant'
                      ? 'border-[#f7931a] bg-orange-50 dark:bg-orange-950'
                      : 'border-[var(--border)]'
                  }`}>
                    <input
                      type="radio"
                      name="location_type"
                      value="bitcoin_merchant"
                      checked={locationType === 'bitcoin_merchant'}
                      onChange={() => setLocationType('bitcoin_merchant')}
                      className="w-4 h-4 m-0 p-0 !w-4 accent-[#f7931a]"
                    />
                    <Lightning size={16} weight="fill" className="text-[#f7931a]" />
                    <span className="text-sm font-mono">business (accepts bitcoin)</span>
                  </label>
                  <label className={`flex items-center gap-2 p-2 border cursor-pointer transition-colors ${
                    locationType === 'community_space'
                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                      : 'border-[var(--border)]'
                  }`}>
                    <input
                      type="radio"
                      name="location_type"
                      value="community_space"
                      checked={locationType === 'community_space'}
                      onChange={() => setLocationType('community_space')}
                      className="w-4 h-4 m-0 p-0 !w-4 accent-blue-500"
                    />
                    <UsersThree size={16} className="text-blue-500" />
                    <span className="text-sm font-mono">community space</span>
                  </label>
                </div>
              </div>

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
