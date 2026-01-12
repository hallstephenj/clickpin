'use client';

import { useState, useMemo, ReactNode } from 'react';
import { Plant } from '@phosphor-icons/react';
import { Pin } from '@/types';
import { config } from '@/lib/config';

interface PaperweightPinProps {
  pin: Pin;
  presenceToken: string | null;
  onReply: (pinId: string) => void;
  onDelete: (pinId: string) => void;
  onFlag: (pinId: string) => void;
  onBoost: (pinId: string) => void;
  isReply?: boolean;
  shareEnabled?: boolean;
}

type AgeClass = 'fresh' | 'recent' | 'aged' | 'vintage';

function getAgeClass(createdAt: string): AgeClass {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const minutes = ageMs / (1000 * 60);

  if (minutes < 5) return 'fresh';
  if (minutes < 30) return 'recent';
  if (minutes < 120) return 'aged';
  return 'vintage';
}

// Fuzzy, human timestamps - "remembered, not measured"
function getFuzzyTime(createdAt: string): string {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const minutes = ageMs / (1000 * 60);
  const hours = minutes / 60;

  if (minutes < 2) return 'just now';
  if (minutes < 5) return 'moments ago';
  if (minutes < 15) return 'a few minutes';
  if (minutes < 45) return 'half an hour or so';
  if (minutes < 90) return 'about an hour';
  if (hours < 3) return 'a couple hours';
  if (hours < 6) return 'a few hours';
  if (hours < 12) return 'earlier today';
  if (hours < 24) return 'today';
  if (hours < 48) return 'yesterday';
  return 'a while back';
}

// Size class based on content length
function getSizeClass(body: string): string {
  const length = body.length;
  if (length < 60) return 'pw-short';
  if (length > 200) return 'pw-long';
  return '';
}

// Convert URLs in text to clickable links
function linkifyText(text: string): ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s<]+[^\s<.,;:!?)}\]"'])/gi;
  const parts = text.split(urlRegex);

  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      // Reset regex lastIndex since we're reusing it
      urlRegex.lastIndex = 0;
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent hover:underline break-all"
          onClick={(e) => e.stopPropagation()}
        >
          {part}
        </a>
      );
    }
    return part;
  });
}

export function PaperweightPin({
  pin,
  presenceToken,
  onReply,
  onDelete,
  onFlag,
  onBoost,
  isReply = false,
  shareEnabled = false,
}: PaperweightPinProps) {
  const [showReplies, setShowReplies] = useState(true);
  const [flagging, setFlagging] = useState(false);
  const [shareState, setShareState] = useState<'idle' | 'copied'>('idle');

  const fuzzyTime = useMemo(() => getFuzzyTime(pin.created_at), [pin.created_at]);
  const isBoosted = pin.boost_score > 0 && pin.boost_expires_at && new Date(pin.boost_expires_at) > new Date();
  const ageClass = useMemo(() => getAgeClass(pin.created_at), [pin.created_at]);
  const sizeClass = useMemo(() => getSizeClass(pin.body), [pin.body]);

  const pinAge = Date.now() - new Date(pin.created_at).getTime();
  const canFreeDelete = pin.is_mine && pinAge < config.payment.freeDeleteWindowMs;

  const handleFlag = async () => {
    if (!presenceToken || flagging) return;
    setFlagging(true);
    await onFlag(pin.id);
    setFlagging(false);
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/p/${pin.id}`;
    const shareData = {
      title: 'clickpin',
      text: pin.body.length > 100 ? pin.body.slice(0, 100) + '...' : pin.body,
      url: shareUrl,
    };

    // Try native share sheet on mobile
    if (navigator.share && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)) {
      try {
        await navigator.share(shareData);
        return;
      } catch (err) {
        // User cancelled or share failed, fall back to copy
        if ((err as Error).name === 'AbortError') return;
      }
    }

    // Fall back to clipboard copy
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareState('copied');
      setTimeout(() => setShareState('idle'), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Reply rendering
  if (isReply) {
    return (
      <div className="paperweight-reply">
        {/* Doodle */}
        {pin.doodle_data && (
          <div className="paperweight-doodle">
            <img src={pin.doodle_data} alt="" />
          </div>
        )}

        {/* Body */}
        <p className="paperweight-body">{linkifyText(pin.body)}</p>

        {/* Metadata - actions left, timestamp right */}
        <div className="paperweight-meta">
          <div className="paperweight-actions">
            {!pin.is_mine && (
              <button
                onClick={handleFlag}
                disabled={flagging}
                className="action-flag"
              >
                flag
              </button>
            )}
            {pin.is_mine && (
              <button onClick={() => onDelete(pin.id)} className="action-delete">
                delete
              </button>
            )}
          </div>
          <div className="paperweight-time-group">
            <span className="paperweight-nym">@{pin.author_nym || 'anon'}</span>
            {pin.is_mine && <span className="paperweight-mine">you</span>}
            <span className="paperweight-time">{fuzzyTime}</span>
          </div>
        </div>
      </div>
    );
  }

  // Main pin rendering
  const isSeedPost = pin.badge?.startsWith('Seed');
  const seedOutcome = isSeedPost ? (pin.badge?.split(':')[1] || 'neutral').trim().toLowerCase() : null;
  const pinClasses = [
    'paperweight-pin',
    `paperweight-age-${ageClass}`,
    sizeClass,
    isBoosted ? 'paperweight-boosted' : '',
    isSeedPost ? `paperweight-seed paperweight-seed-${seedOutcome}` : '',
  ].filter(Boolean).join(' ');

  return (
    <div>
      <div className={pinClasses}>
        {/* Pushpin for boosted */}
        {isBoosted && <div className="paperweight-pushpin" />}

        {/* Doodle - bleeds to edge, overlaps text */}
        {pin.doodle_data && (
          <div className="paperweight-doodle">
            <img src={pin.doodle_data} alt="" />
          </div>
        )}

        {/* Body - with optional badge at start */}
        <p className="paperweight-body">
          {isSeedPost ? (
            <span className={`paperweight-badge paperweight-badge-seed paperweight-badge-seed-${seedOutcome}`}>
              <Plant size={14} weight="fill" />
              seed
            </span>
          ) : (
            pin.badge && <span className="paperweight-badge">{pin.badge}</span>
          )}
          {linkifyText(pin.body)}
        </p>

        {/* Metadata - actions left, timestamp right */}
        <div className="paperweight-meta">
          <div className="paperweight-actions">
            <button onClick={() => onReply(pin.id)}>reply</button>
            {!pin.is_mine && (
              <button
                onClick={handleFlag}
                disabled={flagging}
                className="action-flag"
              >
                flag{pin.flag_count ? ` ${pin.flag_count}` : ''}
              </button>
            )}
            <button onClick={() => onBoost(pin.id)} className="action-boost">
              boost
            </button>
            {shareEnabled && (
              <button onClick={handleShare} className="action-share">
                {shareState === 'copied' ? 'copied!' : 'share'}
              </button>
            )}
            {pin.is_mine && (
              <button onClick={() => onDelete(pin.id)} className="action-delete">
                delete
              </button>
            )}
          </div>
          <div className="paperweight-time-group">
            <span className="paperweight-nym">@{pin.author_nym || 'anon'}</span>
            {pin.is_mine && <span className="paperweight-mine">you</span>}
            <span className="paperweight-time">{fuzzyTime}</span>
          </div>
        </div>
      </div>

      {/* Replies - attached scraps */}
      {pin.replies && pin.replies.length > 0 && (
        <div className="paperweight-replies-container">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="paperweight-replies-toggle"
          >
            {showReplies ? '−' : '+'} {pin.replies.length} {pin.replies.length === 1 ? 'scrap' : 'scraps'}
          </button>

          {showReplies && (
            <div>
              {pin.replies.map((reply) => (
                <PaperweightPin
                  key={reply.id}
                  pin={reply}
                  presenceToken={presenceToken}
                  onReply={onReply}
                  onDelete={onDelete}
                  onFlag={onFlag}
                  onBoost={onBoost}
                  isReply
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
