'use client';

import { useState, useMemo } from 'react';
import { Pin } from '@/types';
import { formatDistanceToNow } from 'date-fns';
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

  const timeAgo = formatDistanceToNow(new Date(pin.created_at), { addSuffix: false });
  const isBoosted = pin.boost_score > 0 && pin.boost_expires_at && new Date(pin.boost_expires_at) > new Date();
  const ageClass = useMemo(() => getAgeClass(pin.created_at), [pin.created_at]);

  const pinAge = Date.now() - new Date(pin.created_at).getTime();
  const canFreeDelete = pin.is_mine && pinAge < config.payment.freeDeleteWindowMs;

  const handleFlag = async () => {
    if (!presenceToken || flagging) return;
    setFlagging(true);
    await onFlag(pin.id);
    setFlagging(false);
  };

  const baseClasses = isReply ? 'paperweight-reply' : 'paperweight-pin';
  const ageClasses = !isReply ? `paperweight-age-${ageClass}` : '';
  const boostedClasses = isBoosted && !isReply ? 'paperweight-boosted' : '';

  return (
    <div className={isReply ? 'paperweight-replies' : ''}>
      <div className={`${baseClasses} ${ageClasses} ${boostedClasses}`}>
        {/* Boost indicator */}
        {isBoosted && !isReply && (
          <span className="paperweight-boost-tag">boosted</span>
        )}

        {/* Doodle */}
        {pin.doodle_data && (
          <div className="paperweight-doodle">
            <img
              src={pin.doodle_data}
              alt="doodle"
            />
          </div>
        )}

        {/* Body */}
        <p className="paperweight-body">{pin.body}</p>

        {/* Metadata row - pencil scribble style */}
        <div className="paperweight-meta">
          <span className="paperweight-time">{timeAgo}</span>

          {pin.is_mine && (
            <span className="paperweight-mine">you</span>
          )}

          {/* Actions - fade in on hover */}
          <div className="paperweight-actions">
            {!isReply && (
              <button onClick={() => onReply(pin.id)}>
                reply
              </button>
            )}

            {!pin.is_mine && (
              <button
                onClick={handleFlag}
                disabled={flagging}
                className="action-flag"
              >
                flag{pin.flag_count ? ` ${pin.flag_count}` : ''}
              </button>
            )}

            {!isReply && (
              <button
                onClick={() => onBoost(pin.id)}
                className="action-boost"
              >
                boost
              </button>
            )}

            {pin.is_mine && (
              <button
                onClick={() => onDelete(pin.id)}
                className="action-delete"
              >
                {canFreeDelete ? 'delete' : 'delete'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {!isReply && pin.replies && pin.replies.length > 0 && (
        <div className="paperweight-replies">
          <button
            onClick={() => setShowReplies(!showReplies)}
            className="paperweight-replies-toggle"
          >
            {showReplies ? '−' : '+'} {pin.replies.length} {pin.replies.length === 1 ? 'reply' : 'replies'}
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
