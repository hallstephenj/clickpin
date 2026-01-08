'use client';

import { useState, useMemo } from 'react';
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

export function PaperweightPin({
  pin,
  presenceToken,
  onReply,
  onDelete,
  onFlag,
  onBoost,
  isReply = false,
}: PaperweightPinProps) {
  const [showReplies, setShowReplies] = useState(true);
  const [flagging, setFlagging] = useState(false);

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
        <p className="paperweight-body">{pin.body}</p>

        {/* Metadata */}
        <div className="paperweight-meta">
          <span className="paperweight-time">{fuzzyTime}</span>
          {pin.is_mine && <span className="paperweight-mine">you</span>}
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
        </div>
      </div>
    );
  }

  // Main pin rendering
  const pinClasses = [
    'paperweight-pin',
    `paperweight-age-${ageClass}`,
    sizeClass,
    isBoosted ? 'paperweight-boosted' : '',
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

        {/* Body */}
        <p className="paperweight-body">{pin.body}</p>

        {/* Metadata - scribbled at bottom */}
        <div className="paperweight-meta">
          <span className="paperweight-time">{fuzzyTime}</span>
          {pin.is_mine && <span className="paperweight-mine">you</span>}
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
            {pin.is_mine && (
              <button onClick={() => onDelete(pin.id)} className="action-delete">
                delete
              </button>
            )}
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
