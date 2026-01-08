'use client';

import { useState } from 'react';

interface MerchantActionsProps {
  pinId: string;
  sessionId: string;
  isPinned: boolean;
  isHidden: boolean;
  onActionComplete: () => void;
}

export function MerchantActions({
  pinId,
  sessionId,
  isPinned,
  isHidden,
  onActionComplete,
}: MerchantActionsProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handlePin = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/merchant/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin_id: pinId,
          session_id: sessionId,
          action: isPinned ? 'unpin' : 'pin',
        }),
      });

      if (response.ok) {
        onActionComplete();
      }
    } catch (err) {
      console.error('Error toggling pin:', err);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  const handleHide = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/merchant/hide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pin_id: pinId,
          session_id: sessionId,
          action: isHidden ? 'unhide' : 'hide',
        }),
      });

      if (response.ok) {
        onActionComplete();
      }
    } catch (err) {
      console.error('Error toggling hide:', err);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="text-xs text-accent hover:underline font-mono"
        title="Merchant actions"
      >
        mod
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />

          {/* Dropdown */}
          <div className="absolute right-0 top-6 z-50 bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] shadow-lg min-w-[120px]">
            <button
              onClick={handlePin}
              disabled={loading}
              className="w-full px-3 py-2 text-left text-xs font-mono hover:bg-[var(--bg-alt)] disabled:opacity-50"
            >
              {loading ? '...' : isPinned ? 'unpin' : 'pin to top'}
            </button>
            <button
              onClick={handleHide}
              disabled={loading}
              className="w-full px-3 py-2 text-left text-xs font-mono hover:bg-[var(--bg-alt)] text-danger disabled:opacity-50"
            >
              {loading ? '...' : isHidden ? 'unhide' : 'hide post'}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
