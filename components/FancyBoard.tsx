'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { FancyPin, Location, FeatureFlags } from '@/types';
import { FancyBoardPin } from './FancyBoardPin';
import { FancyBoardComposeOverlay } from './FancyBoardComposeOverlay';
import { ComposeModal } from './ComposeModal';
import { PaymentModal } from './PaymentModal';
import { SponsorModal } from './SponsorModal';
import { config } from '@/lib/config';
import { getLocationLabel } from '@/lib/location-utils';
import { X } from '@phosphor-icons/react';

// Stacked notes icon with post count
function PostCountIndicator({ count }: { count: number }) {
  return (
    <div className="flex items-center gap-1.5 text-muted" title={`${count} posts`}>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="opacity-60">
        <rect x="4" y="2" width="10" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.4" />
        <rect x="2" y="4" width="10" height="11" rx="1" stroke="currentColor" strokeWidth="1.2" fill="var(--bg)" />
        <circle cx="7" cy="6" r="1" fill="currentColor" />
      </svg>
      <span className="text-xs font-mono">{count}</span>
    </div>
  );
}

interface FancyBoardProps {
  location: Location;
  pins: FancyPin[];
  hiddenPins: FancyPin[];
  presenceToken: string | null;
  sessionId: string | null;
  flags: FeatureFlags;
  onRefreshBoard?: () => Promise<void>;
  onRefreshLocation?: () => Promise<void>;
  postsRemaining: number;
}

// Board dimensions
const BOARD_MIN_HEIGHT = 600;

// Seeded random for consistent positions per pin
function seededRandom(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    const char = seed.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash % 1000) / 1000;
}

export function FancyBoard({
  location,
  pins,
  hiddenPins,
  presenceToken,
  sessionId,
  flags,
  onRefreshBoard,
  onRefreshLocation,
  postsRemaining,
}: FancyBoardProps) {
  const boardRef = useRef<HTMLDivElement>(null);
  const [composePosition, setComposePosition] = useState<{ x: number; y: number } | null>(null);
  const [digMode, setDigMode] = useState(false);
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [replyToId, setReplyToId] = useState<string | null>(null);
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

  // Generate random positions for pins without x, y (legacy pins)
  const pinsWithPositions = useMemo(() => {
    return pins.map((pin, index) => {
      if (pin.x !== null && pin.x !== undefined && pin.y !== null && pin.y !== undefined) {
        return pin;
      }
      // Generate consistent random position based on pin id
      const randX = seededRandom(pin.id + 'x');
      const randY = seededRandom(pin.id + 'y');
      const randRotation = seededRandom(pin.id + 'r');
      return {
        ...pin,
        x: 10 + randX * 80, // 10% to 90%
        y: 80 + randY * 400 + index * 20, // Stagger vertically
        rotation: flags.fancy_rotation ? (randRotation - 0.5) * 8 : 0, // -4 to +4
      };
    });
  }, [pins, flags.fancy_rotation]);

  // Calculate z-index for stacking
  const calculateZIndex = useCallback((pin: FancyPin, index: number) => {
    if (!flags.fancy_stacking) return 100 + index;

    const baseZ = pin.z_seed ?? (100 + index);
    const isBoosted = pin.boost_score > 0 && pin.boost_expires_at &&
      new Date(pin.boost_expires_at) > new Date();
    const boostLift = isBoosted ? 1000 : 0;
    const flagDrop = (pin.flag_count || 0) * -50;

    return Math.max(0, baseZ + boostLift + flagDrop);
  }, [flags.fancy_stacking]);

  // Handle board tap for tap-to-place
  const handleBoardClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    // Only handle clicks on the board background, not on pins
    if (e.target !== e.currentTarget && !(e.target as HTMLElement).classList.contains('fancy-board-surface')) {
      return;
    }

    if (!flags.fancy_tap_to_place || !boardRef.current) return;

    const rect = boardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = e.clientY - rect.top;

    setComposePosition({ x, y });
  }, [flags.fancy_tap_to_place]);

  // Handle dig mode
  const handleDig = useCallback(() => {
    if (!flags.fancy_dig_mode) return;
    setDigMode(true);
    // Auto-exit dig mode after 3 seconds
    setTimeout(() => setDigMode(false), 3000);
  }, [flags.fancy_dig_mode]);

  // Handlers
  const handleReply = (pinId: string) => {
    setReplyToId(pinId);
    setReplyModalOpen(true);
  };

  const handlePost = async (body: string, doodleData: string | null) => {
    if (!presenceToken) {
      throw new Error('Location not verified');
    }

    const endpoint = replyToId ? '/api/reply' : '/api/pin';
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

    if (response.status === 402 && data.requires_payment) {
      const invoiceResponse = await fetch('/api/post/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ presence_token: presenceToken }),
      });

      const invoiceData = await invoiceResponse.json();
      if (!invoiceResponse.ok) {
        throw new Error(invoiceData.error || 'Failed to create invoice');
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

    if (!response.ok) {
      throw new Error(data.error || 'Failed to post');
    }

    if (!replyToId && data.posts_remaining !== undefined) {
      setLocalPostsRemaining(data.posts_remaining);
    }

    await onRefreshBoard?.();
  };

  const handleDelete = async (pinId: string) => {
    if (!presenceToken) {
      setError('Location not verified');
      return;
    }

    const pin = pinsWithPositions.find(p => p.id === pinId);
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

      if (!invoiceResponse.ok) {
        setError(invoiceData.error || 'Failed to create invoice');
        return;
      }

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

    const response = await fetch('/api/pin', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_id: pinId, presence_token: presenceToken }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Failed to delete');
      return;
    }

    await onRefreshBoard?.();
  };

  const handleFlag = async (pinId: string) => {
    if (!presenceToken) {
      setError('Location not verified');
      return;
    }

    const response = await fetch('/api/flag', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_id: pinId, presence_token: presenceToken }),
    });

    if (!response.ok) {
      const data = await response.json();
      setError(data.error || 'Failed to flag');
      return;
    }

    await onRefreshBoard?.();
  };

  const handleBoost = async (pinId: string) => {
    if (!presenceToken) {
      setError('Location not verified');
      return;
    }

    const invoiceResponse = await fetch('/api/boost/create-invoice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin_id: pinId, presence_token: presenceToken }),
    });

    const invoiceData = await invoiceResponse.json();

    if (!invoiceResponse.ok) {
      setError(invoiceData.error || 'Failed to create invoice');
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
    if (paymentModal.type === 'delete' && paymentModal.pinId && paymentModal.invoiceId) {
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
        setError(data.error || 'Failed to delete after payment');
      }
    }

    setPaymentModal({ open: false, type: null });
    await onRefreshBoard?.();
  };

  return (
    <div className="fancy-board-container">
      {/* Header */}
      <header className="fancy-board-header">
        <div className="fancy-board-header-content">
          <div className="fancy-board-title-group">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="fancy-board-title">{location.name}</h1>
                <span className="live-dot" title="Live" />
              </div>
              {getLocationLabel(location) && (
                <p className="text-sm text-muted mt-0.5">{getLocationLabel(location)}</p>
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
          </div>

          <div className="fancy-board-actions">
            {/* Post count indicator */}
            <div className="flex items-center gap-1 mr-2" title={`${pinsWithPositions.length} posts`}>
              <PostCountIndicator count={pinsWithPositions.length} />
            </div>

            <button onClick={onRefreshLocation} className="btn" title="Refresh location">
              ↻
            </button>
            {!flags.fancy_tap_to_place && (
              <button
                onClick={() => setComposePosition({ x: 50, y: 150 })}
                className="btn btn-primary"
              >
                + post
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Error banner */}
      {error && (
        <div className="fancy-board-error">
          <span>{error}</span>
          <button onClick={() => setError(null)}><X size={16} /></button>
        </div>
      )}

      {/* Board surface */}
      <div
        ref={boardRef}
        className={`fancy-board-surface ${digMode ? 'dig-mode' : ''}`}
        style={{ minHeight: `${BOARD_MIN_HEIGHT}px` }}
        onClick={handleBoardClick}
      >
        {/* Texture overlay */}
        <div className="fancy-board-texture" />

        {/* Pins */}
        {pinsWithPositions.map((pin, index) => (
          <FancyBoardPin
            key={pin.id}
            pin={pin}
            flags={flags}
            zIndex={calculateZIndex(pin, index)}
            presenceToken={presenceToken}
            onReply={handleReply}
            onDelete={handleDelete}
            onFlag={handleFlag}
            onBoost={handleBoost}
            onDig={handleDig}
          />
        ))}

        {/* Empty state */}
        {pinsWithPositions.length === 0 && (
          <div className="fancy-board-empty">
            <p>no posts here yet</p>
            <p className="fancy-board-empty-hint">
              {flags.fancy_tap_to_place ? 'tap anywhere to be the first' : 'click + post to be the first'}
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="fancy-board-footer">
        <div className="px-8 flex flex-wrap justify-center gap-x-3 sm:gap-x-6 gap-y-2 text-xs text-faint">
          <a href={flags.PROXHOME_ADVANCED ? '/?view=nearby' : '/map'} className="hover:text-[var(--fg-muted)] transition-colors">nearby</a>
          <a href="/map" className="hover:text-[var(--fg-muted)] transition-colors">map</a>
          <a href="/leaderboard" className="hover:text-[var(--fg-muted)] transition-colors">leaderboard</a>
          <a href="/about" className="hover:text-[var(--fg-muted)] transition-colors">about</a>
          <a href="/terms" className="hover:text-[var(--fg-muted)] transition-colors">terms</a>
          <a href="/privacy" className="hover:text-[var(--fg-muted)] transition-colors">privacy</a>
        </div>
      </footer>

      {/* Tap-to-place compose overlay */}
      {composePosition && flags.fancy_tap_to_place && (
        <FancyBoardComposeOverlay
          position={composePosition}
          flags={flags}
          presenceToken={presenceToken}
          onClose={() => setComposePosition(null)}
          onPost={async () => {
            await onRefreshBoard?.();
            setLocalPostsRemaining(prev => Math.max(0, prev - 1));
          }}
          postsRemaining={localPostsRemaining}
        />
      )}

      {/* Fallback compose modal for non-tap-to-place or replies */}
      {(composePosition && !flags.fancy_tap_to_place) && (
        <ComposeModal
          isOpen={true}
          onClose={() => setComposePosition(null)}
          onSubmit={handlePost}
          replyToId={null}
          postsRemaining={localPostsRemaining}
        />
      )}

      {/* Reply modal */}
      <ComposeModal
        isOpen={replyModalOpen}
        onClose={() => {
          setReplyModalOpen(false);
          setReplyToId(null);
        }}
        onSubmit={handlePost}
        replyToId={replyToId}
        postsRemaining={localPostsRemaining}
      />

      {/* Payment modal */}
      <PaymentModal
        isOpen={paymentModal.open}
        onClose={() => setPaymentModal({ open: false, type: null })}
        onPaymentComplete={handlePaymentComplete}
        type={paymentModal.type}
        invoiceId={paymentModal.invoiceId}
        paymentRequest={paymentModal.paymentRequest}
        amountSats={paymentModal.amountSats}
      />

      {/* Sponsor modal */}
      <SponsorModal
        isOpen={sponsorModalOpen}
        onClose={() => setSponsorModalOpen(false)}
        onComplete={async () => {
          setSponsorModalOpen(false);
          await onRefreshBoard?.();
        }}
        presenceToken={presenceToken}
        locationName={location.name}
        locationId={location.id}
        currentSponsorAmount={location.sponsor_amount_sats || null}
      />
    </div>
  );
}
