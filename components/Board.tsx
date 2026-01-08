'use client';

import { useState } from 'react';
import { Pin, Location, FancyPin } from '@/types';
import { PinCard } from './PinCard';
import { PaperweightPin } from './PaperweightPin';
import { ComposeModal } from './ComposeModal';
import { PaymentModal } from './PaymentModal';
import { SponsorModal } from './SponsorModal';
import { FancyBoard } from './FancyBoard';
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlags';
import { isFancyBoardActive } from '@/lib/featureFlags';
import { config } from '@/lib/config';

// Stacked notes icon with post count
function PostCountIndicator({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5 text-muted" title={`${count} posts`}>
      {/* Stacked notes icon */}
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60">
        {/* Back note */}
        <rect x="4" y="2" width="10" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.4" />
        {/* Front note */}
        <rect x="2" y="4" width="10" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" fill="var(--bg)" />
        {/* Pin dot */}
        <circle cx="7" cy="6" r="1" fill="currentColor" />
      </svg>
      <span className="text-xs font-mono">{count}</span>
    </div>
  );
}

interface BoardProps {
  location: Location;
  pins: Pin[];
  hiddenPins: Pin[];
  presenceToken: string | null;
  sessionId: string | null;
  onRefreshBoard: () => Promise<void>;
  onRefreshLocation: () => Promise<void>;
  postsRemaining: number;
}

export function Board({
  location,
  pins,
  hiddenPins,
  presenceToken,
  sessionId,
  onRefreshBoard,
  onRefreshLocation,
  postsRemaining,
}: BoardProps) {
  const { flags, loading: flagsLoading } = useFeatureFlags();
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [paymentModal, setPaymentModal] = useState<{
    open: boolean;
    type: 'post' | 'boost' | 'delete' | null;
    pinId?: string;
    invoiceId?: string;
    paymentRequest?: string;
    amountSats?: number;
  }>({ open: false, type: null });
  const [error, setError] = useState<string | null>(null);
  const [localPostsRemaining, setLocalPostsRemaining] = useState(postsRemaining);
  const [sponsorModalOpen, setSponsorModalOpen] = useState(false);

  const handleOpenCompose = (replyId: string | null = null) => {
    setReplyToId(replyId);
    setComposeOpen(true);
  };

  const handlePost = async (body: string, doodleData: string | null) => {
    if (!presenceToken) {
      throw new Error('Location not verified. Please refresh your location.');
    }

    const isReply = Boolean(replyToId);
    const endpoint = isReply ? '/api/reply' : '/api/pin';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body,
        doodle_data: doodleData,
        presence_token: presenceToken,
        parent_pin_id: replyToId,
      }),
    });

    const data = await response.json();

    if (response.status === 402) {
      if (data.requires_payment) {
        const invoiceResponse = await fetch('/api/post/create-invoice', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ presence_token: presenceToken }),
        });

        const invoiceData = await invoiceResponse.json();

        if (!invoiceResponse.ok) {
          throw new Error(invoiceData.error || 'Failed to create payment invoice');
        }

        setPaymentModal({
          open: true,
          type: 'post',
          invoiceId: invoiceData.invoice_id,
          paymentRequest: invoiceData.payment_request,
          amountSats: invoiceData.amount_sats,
        });
        return;
      }
      throw new Error(data.error || 'Payment required');
    }

    if (!response.ok) {
      throw new Error(data.error || 'Failed to post');
    }

    if (!isReply && data.posts_remaining !== undefined) {
      setLocalPostsRemaining(data.posts_remaining);
    }

    await onRefreshBoard();
  };

  const handleDelete = async (pinId: string) => {
    if (!presenceToken) {
      setError('Location not verified. Please refresh your location.');
      return;
    }

    const pin = pins.find(p => p.id === pinId) || pins.flatMap(p => p.replies || []).find(r => r.id === pinId);
    if (!pin) return;

    const pinAge = Date.now() - new Date(pin.created_at).getTime();
    const canFreeDelete = pinAge < config.payment.freeDeleteWindowMs;

    if (!canFreeDelete) {
      const invoiceResponse = await fetch('/api/delete/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin_id: pinId, presence_token: presenceToken }),
      });

      const invoiceData = await invoiceResponse.json();

      if (invoiceData.free_delete) {
        // Actually still in window
      } else if (!invoiceResponse.ok) {
        setError(invoiceData.error || 'Failed to create deletion invoice');
        return;
      } else {
        setPaymentModal({
          open: true,
          type: 'delete',
          pinId,
          invoiceId: invoiceData.invoice_id,
          paymentRequest: invoiceData.payment_request,
          amountSats: invoiceData.amount_sats,
        });
        return;
      }
    }

    const response = await fetch('/api/pin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_id: pinId, presence_token: presenceToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || 'Failed to delete pin');
      return;
    }

    await onRefreshBoard();
  };

  const handleFlag = async (pinId: string) => {
    if (!presenceToken) {
      setError('Location not verified. Please refresh your location.');
      return;
    }

    const response = await fetch('/api/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_id: pinId, presence_token: presenceToken }),
    });

    const data = await response.json();

    if (!response.ok) {
      setError(data.error || 'Failed to flag pin');
      return;
    }

    await onRefreshBoard();
  };

  const handleBoost = async (pinId: string) => {
    if (!presenceToken) {
      setError('Location not verified. Please refresh your location.');
      return;
    }

    const invoiceResponse = await fetch('/api/boost/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_id: pinId, presence_token: presenceToken }),
    });

    const invoiceData = await invoiceResponse.json();

    if (!invoiceResponse.ok) {
      setError(invoiceData.error || 'Failed to create boost invoice');
      return;
    }

    setPaymentModal({
      open: true,
      type: 'boost',
      pinId,
      invoiceId: invoiceData.invoice_id,
      paymentRequest: invoiceData.payment_request,
      amountSats: invoiceData.amount_sats,
    });
  };

  const handlePaymentComplete = async () => {
    // For deletion payments, we need to actually delete the pin after payment
    if (paymentModal.type === 'delete' && paymentModal.pinId && paymentModal.invoiceId) {
      try {
        const response = await fetch('/api/pin', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            pin_id: paymentModal.pinId,
            payment_invoice_id: paymentModal.invoiceId,
            presence_token: presenceToken,
          }),
        });

        if (!response.ok) {
          const data = await response.json();
          setError(data.error || 'Failed to delete pin after payment');
        }
      } catch (err) {
        console.error('Error deleting pin after payment:', err);
        setError('Failed to delete pin after payment');
      }
    }

    setPaymentModal({ open: false, type: null });
    await onRefreshBoard();
  };

  // Route to FancyBoard if feature flag is enabled
  if (!flagsLoading && isFancyBoardActive(flags)) {
    return (
      <FancyBoard
        location={location}
        pins={pins as FancyPin[]}
        hiddenPins={hiddenPins as FancyPin[]}
        presenceToken={presenceToken}
        sessionId={sessionId}
        flags={flags}
        onRefreshBoard={onRefreshBoard}
        onRefreshLocation={onRefreshLocation}
        postsRemaining={postsRemaining}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] pb-16">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-start justify-between">
            {/* Left: Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg text-[var(--fg)] truncate">{location.name}</h1>
                <span className="live-dot" title="Live" />
              </div>
              {location.city && (
                <p className="text-sm text-muted mt-0.5">{location.city}</p>
              )}

              {/* Sponsorship row */}
              <div className="mt-2 text-xs">
                {location.sponsor_label && (
                  <div className="text-muted">
                    sponsored by{' '}
                    {location.sponsor_url ? (
                      <a
                        href={location.sponsor_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-accent hover:underline"
                      >
                        {location.sponsor_label}
                      </a>
                    ) : (
                      <span className="text-accent">{location.sponsor_label}</span>
                    )}
                  </div>
                )}
                <button
                  onClick={() => setSponsorModalOpen(true)}
                  className="text-faint hover:text-accent transition-colors mt-0.5"
                >
                  sponsor this board →
                </button>
              </div>
            </div>

            {/* Right: Actions + post count */}
            <div className="flex items-center gap-3 ml-4">
              {/* Post count indicator */}
              <div className="flex items-center gap-1" title={`${pins.length} posts`}>
                <PostCountIndicator count={pins.length} />
              </div>

              <button
                onClick={onRefreshLocation}
                className="btn"
                title="Refresh location"
              >
                ↻
              </button>
              <button
                onClick={() => handleOpenCompose(null)}
                className="btn btn-primary"
              >
                + post
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="max-w-2xl mx-auto px-4 py-2">
          <div className="bg-[var(--bg-alt)] border border-[var(--danger)] text-[var(--danger)] px-3 py-2 text-sm flex justify-between items-center">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="hover:text-[var(--fg)]">×</button>
          </div>
        </div>
      )}

      {/* Posts feed */}
      <main className="max-w-2xl mx-auto px-4 py-2">
        {pins.length === 0 && hiddenPins.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-muted mb-4">no posts here yet</p>
            <button
              onClick={() => handleOpenCompose(null)}
              className="btn btn-primary"
            >
              be the first to post
            </button>
          </div>
        ) : (
          <div>
            {pins.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-muted">no visible posts</p>
              </div>
            ) : flags.PAPERWEIGHT ? (
              <div className="paperweight-feed">
                {pins.map((pin) => (
                  <PaperweightPin
                    key={pin.id}
                    pin={pin}
                    presenceToken={presenceToken}
                    onReply={handleOpenCompose}
                    onDelete={handleDelete}
                    onFlag={handleFlag}
                    onBoost={handleBoost}
                  />
                ))}
              </div>
            ) : (
              pins.map((pin, index) => (
                <PinCard
                  key={pin.id}
                  pin={pin}
                  presenceToken={presenceToken}
                  onReply={handleOpenCompose}
                  onDelete={handleDelete}
                  onFlag={handleFlag}
                  onBoost={handleBoost}
                  index={index}
                />
              ))
            )}

            {/* Hidden posts collapsible section */}
            {hiddenPins.length > 0 && (
              <div className="mt-6 border-t border-[var(--border)] pt-4">
                <button
                  onClick={() => setShowHidden(!showHidden)}
                  className="text-sm text-muted hover:text-[var(--fg)] font-mono flex items-center gap-1 mb-3"
                >
                  <span>{showHidden ? '↑' : '↓'}</span>
                  <span>hidden posts ({hiddenPins.length})</span>
                </button>
                {showHidden && (
                  <div className="pl-4 border-l-2 border-[var(--border)]">
                    {flags.PAPERWEIGHT ? (
                      <div className="paperweight-feed opacity-60">
                        {hiddenPins.map((pin) => (
                          <PaperweightPin
                            key={pin.id}
                            pin={pin}
                            presenceToken={presenceToken}
                            onReply={handleOpenCompose}
                            onDelete={handleDelete}
                            onFlag={handleFlag}
                            onBoost={handleBoost}
                          />
                        ))}
                      </div>
                    ) : (
                      hiddenPins.map((pin, index) => (
                        <div key={pin.id} className="opacity-60">
                          <PinCard
                            pin={pin}
                            presenceToken={presenceToken}
                            onReply={handleOpenCompose}
                            onDelete={handleDelete}
                            onFlag={handleFlag}
                            onBoost={handleBoost}
                            index={pins.length + index}
                          />
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-center gap-6 text-xs text-faint">
          <a href="/map" className="hover:text-[var(--fg-muted)] transition-colors">nearby</a>
          <a href="/about" className="hover:text-[var(--fg-muted)] transition-colors">about</a>
          <a href="/terms" className="hover:text-[var(--fg-muted)] transition-colors">terms</a>
          <a href="/privacy" className="hover:text-[var(--fg-muted)] transition-colors">privacy</a>
        </div>
      </footer>

      {/* Modals */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => {
          setComposeOpen(false);
          setReplyToId(null);
        }}
        onSubmit={handlePost}
        replyToId={replyToId}
        postsRemaining={localPostsRemaining}
      />

      <PaymentModal
        isOpen={paymentModal.open}
        onClose={() => setPaymentModal({ open: false, type: null })}
        onPaymentComplete={handlePaymentComplete}
        type={paymentModal.type}
        invoiceId={paymentModal.invoiceId}
        paymentRequest={paymentModal.paymentRequest}
        amountSats={paymentModal.amountSats}
      />

      <SponsorModal
        isOpen={sponsorModalOpen}
        onClose={() => setSponsorModalOpen(false)}
        onComplete={async () => {
          setSponsorModalOpen(false);
          await onRefreshBoard();
        }}
        presenceToken={presenceToken}
        locationName={location.name}
        locationId={location.id}
        currentSponsorAmount={location.sponsor_amount_sats || null}
      />
    </div>
  );
}
