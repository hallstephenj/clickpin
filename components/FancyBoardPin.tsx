'use client';

import { useState, useRef, useCallback, useMemo } from 'react';
import { FancyPin, FeatureFlags, PinTemplate, PinSize } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { config } from '@/lib/config';
import { Lightning } from '@phosphor-icons/react';

interface FancyBoardPinProps {
  pin: FancyPin;
  flags: FeatureFlags;
  zIndex: number;
  presenceToken: string | null;
  onReply: (pinId: string) => void;
  onDelete: (pinId: string) => void;
  onFlag: (pinId: string) => void;
  onBoost: (pinId: string) => void;
  onDig?: () => void;
}

// Size dimensions mapping
const SIZE_DIMENSIONS: Record<PinSize, { width: number; minHeight: number }> = {
  S: { width: 140, minHeight: 80 },
  M: { width: 200, minHeight: 120 },
  L: { width: 280, minHeight: 160 },
};

// Template colors
const TEMPLATE_STYLES: Record<PinTemplate, string> = {
  index: 'fancy-pin-template-index',
  sticky: 'fancy-pin-template-sticky',
  torn: 'fancy-pin-template-torn',
  receipt: 'fancy-pin-template-receipt',
};

export function FancyBoardPin({
  pin,
  flags,
  zIndex,
  presenceToken,
  onReply,
  onDelete,
  onFlag,
  onBoost,
  onDig,
}: FancyBoardPinProps) {
  const [expanded, setExpanded] = useState(false);
  const [flagging, setFlagging] = useState(false);
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // Derive properties based on flags
  const template: PinTemplate = flags.fancy_templates ? (pin.template || 'index') : 'index';
  const size: PinSize = flags.fancy_sizes ? (pin.size || 'M') : 'M';
  const rotation = flags.fancy_rotation ? (pin.rotation ?? 0) : 0;
  const dimensions = SIZE_DIMENSIONS[size];

  // Calculate age for aging effects
  const ageClass = useMemo(() => {
    if (!flags.fancy_aging) return '';
    const ageMs = Date.now() - new Date(pin.created_at).getTime();
    const ageHours = ageMs / (1000 * 60 * 60);
    if (ageHours < 1) return 'fancy-pin-age-fresh';
    if (ageHours < 24) return 'fancy-pin-age-recent';
    if (ageHours < 72) return 'fancy-pin-age-aged';
    return 'fancy-pin-age-vintage';
  }, [flags.fancy_aging, pin.created_at]);

  const timeAgo = formatDistanceToNow(new Date(pin.created_at), { addSuffix: false });
  const isBoosted = pin.boost_score > 0 && pin.boost_expires_at && new Date(pin.boost_expires_at) > new Date();
  const pinAge = Date.now() - new Date(pin.created_at).getTime();
  const canFreeDelete = pin.is_mine && pinAge < config.payment.freeDeleteWindowMs;

  // Long press handlers for dig mode
  const handlePointerDown = useCallback(() => {
    if (!flags.fancy_dig_mode || !onDig) return;
    longPressTimer.current = setTimeout(() => {
      onDig();
    }, 500);
  }, [flags.fancy_dig_mode, onDig]);

  const handlePointerUp = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleFlag = async () => {
    if (!presenceToken || flagging) return;
    setFlagging(true);
    await onFlag(pin.id);
    setFlagging(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  return (
    <div
      className={`
        fancy-pin
        ${TEMPLATE_STYLES[template]}
        fancy-pin-size-${size}
        ${ageClass}
        ${isBoosted ? 'fancy-pin-boosted' : ''}
        ${expanded ? 'fancy-pin-expanded' : ''}
      `}
      style={{
        position: 'absolute',
        left: `${pin.x ?? 50}%`,
        top: `${pin.y ?? 100}px`,
        width: `${dimensions.width}px`,
        minHeight: `${dimensions.minHeight}px`,
        transform: `translate(-50%, 0) rotate(${rotation}deg)`,
        zIndex: expanded ? 9999 : zIndex,
      }}
      onClick={handleClick}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Pushpin decoration */}
      <div className="fancy-pin-pushpin" />

      {/* Pin content */}
      <div className="fancy-pin-content">
        {/* Boost tag */}
        {isBoosted && (
          <div className="fancy-pin-boost-indicator">boosted</div>
        )}

        {/* Doodle */}
        {pin.doodle_data && (
          <div className="fancy-pin-doodle-wrapper">
            <img
              src={pin.doodle_data}
              alt="doodle"
              className="fancy-pin-doodle"
            />
          </div>
        )}

        {/* Body text */}
        <p className="fancy-pin-body">{pin.body}</p>
      </div>

      {/* Footer - shows on expanded */}
      {expanded && (
        <div className="fancy-pin-footer">
          <div className="fancy-pin-meta">
            <span className="fancy-pin-time">{timeAgo}</span>
            {pin.is_mine && <span className="fancy-pin-mine">you</span>}
          </div>
          <div className="fancy-pin-actions">
            <button onClick={(e) => { e.stopPropagation(); onReply(pin.id); }}>
              reply
            </button>
            {!pin.is_mine && (
              <button
                onClick={(e) => { e.stopPropagation(); handleFlag(); }}
                disabled={flagging}
                className="fancy-pin-action-flag"
              >
                flag{pin.flag_count ? ` (${pin.flag_count})` : ''}
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onBoost(pin.id); }}>
              boost
            </button>
            {pin.is_mine && (
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(pin.id); }}
                className="fancy-pin-action-delete"
              >
                delete{!canFreeDelete && <Lightning size={12} weight="fill" className="ml-0.5 inline" />}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Replies indicator */}
      {pin.replies && pin.replies.length > 0 && (
        <div className="fancy-pin-replies-count">
          {pin.replies.length} {pin.replies.length === 1 ? 'reply' : 'replies'}
        </div>
      )}
    </div>
  );
}
