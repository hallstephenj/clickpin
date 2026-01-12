'use client';

import { useState } from 'react';
import { Pin } from '@/types';
import { formatDistanceToNow } from 'date-fns';
import { config } from '@/lib/config';
import { Lightning } from '@phosphor-icons/react';

interface PinCardProps {
  pin: Pin;
  presenceToken: string | null;
  onReply: (pinId: string) => void;
  onDelete: (pinId: string) => void;
  onFlag: (pinId: string) => void;
  onBoost: (pinId: string) => void;
  isReply?: boolean;
  index?: number;
}

export function PinCard({
  pin,
  presenceToken,
  onReply,
  onDelete,
  onFlag,
  onBoost,
  isReply = false,
  index = 0,
}: PinCardProps) {
  const [showReplies, setShowReplies] = useState(true);
  const [flagging, setFlagging] = useState(false);

  const timeAgo = formatDistanceToNow(new Date(pin.created_at), { addSuffix: false });
  const isBoosted = pin.boost_score > 0 && pin.boost_expires_at && new Date(pin.boost_expires_at) > new Date();

  const pinAge = Date.now() - new Date(pin.created_at).getTime();
  const canFreeDelete = pin.is_mine && pinAge < config.payment.freeDeleteWindowMs;

  const handleFlag = async () => {
    if (!presenceToken || flagging) return;
    setFlagging(true);
    await onFlag(pin.id);
    setFlagging(false);
  };

  return (
    <div className={`${isReply ? 'ml-6 pl-4 border-l border-[var(--border)]' : ''}`}>
      <div className="py-2">
        {/* Main content row */}
        <div className="flex gap-2">
          {/* Index number for top-level posts */}
          {!isReply && (
            <span className="text-faint font-mono text-xs w-5 flex-shrink-0 pt-0.5">
              {index + 1}.
            </span>
          )}

          <div className="flex-1 min-w-0">
            {/* Boost tag */}
            {isBoosted && (
              <span className="tag tag-boost mr-2 inline-flex items-center gap-1">
                <Lightning size={12} weight="fill" /> boosted
              </span>
            )}

            {/* Pin body */}
            <p className="text-[var(--fg)] break-words whitespace-pre-wrap">
              {pin.body}
            </p>

            {/* Doodle */}
            {pin.doodle_data && (
              <div className="mt-2 inline-block border border-[var(--border)]">
                <img
                  src={pin.doodle_data}
                  alt="doodle"
                  className="max-w-[200px] max-h-[150px] object-contain"
                />
              </div>
            )}

            {/* Metadata row */}
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
              {/* Author nym */}
              <span className="font-mono text-faint">
                @{pin.author_nym || 'anon'}
              </span>

              <span>•</span>
              <span className="font-mono">{timeAgo}</span>

              {pin.is_mine && (
                <span className="text-accent">• you</span>
              )}

              {!isReply && (
                <>
                  <span>•</span>
                  <button
                    onClick={() => onReply(pin.id)}
                    className="hover:text-[var(--fg)] hover:underline"
                  >
                    reply
                  </button>
                </>
              )}

              {!pin.is_mine && (
                <>
                  <span>•</span>
                  <button
                    onClick={handleFlag}
                    disabled={flagging}
                    className="hover:text-[var(--danger)] hover:underline disabled:opacity-50"
                  >
                    flag{pin.flag_count ? ` (${pin.flag_count})` : ''}
                  </button>
                </>
              )}

              {!isReply && (
                <>
                  <span>•</span>
                  <button
                    onClick={() => onBoost(pin.id)}
                    className="hover:text-[var(--accent)] hover:underline"
                  >
                    boost
                  </button>
                </>
              )}

              {pin.is_mine && (
                <>
                  <span>•</span>
                  <button
                    onClick={() => onDelete(pin.id)}
                    className="hover:text-[var(--danger)] hover:underline inline-flex items-center gap-0.5"
                  >
                    delete{!canFreeDelete && <Lightning size={12} weight="fill" />}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Replies */}
        {!isReply && pin.replies && pin.replies.length > 0 && (
          <div className="mt-2 ml-5">
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="text-xs text-muted hover:text-[var(--fg)] hover:underline"
            >
              [{showReplies ? '−' : '+'}] {pin.replies.length} {pin.replies.length === 1 ? 'reply' : 'replies'}
            </button>

            {showReplies && (
              <div className="mt-1">
                {pin.replies.map((reply, i) => (
                  <PinCard
                    key={reply.id}
                    pin={reply}
                    presenceToken={presenceToken}
                    onReply={onReply}
                    onDelete={onDelete}
                    onFlag={onFlag}
                    onBoost={onBoost}
                    isReply
                    index={i}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {!isReply && <div className="border-b border-[var(--border)]" />}
    </div>
  );
}
