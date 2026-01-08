'use client';

import { useState, useRef, useEffect } from 'react';
import { config } from '@/lib/config';
import { BADGE_OPTIONS, BadgeType } from '@/types';
import { X, Lightning } from '@phosphor-icons/react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (body: string, doodleData: string | null, badge: string | null) => Promise<void>;
  replyToId?: string | null;
  postsRemaining?: number;
  badgesEnabled?: boolean;
}

export function ComposeModal({
  isOpen,
  onClose,
  onSubmit,
  replyToId,
  postsRemaining,
  badgesEnabled = false,
}: ComposeModalProps) {
  const [body, setBody] = useState('');
  const [doodleData, setDoodleData] = useState<string | null>(null);
  const [showDoodle, setShowDoodle] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedBadge, setSelectedBadge] = useState<BadgeType | ''>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const contextRef = useRef<CanvasRenderingContext2D | null>(null);

  const maxLength = config.pin.maxBodyLength;
  const charCount = body.length;
  const isReply = Boolean(replyToId);

  useEffect(() => {
    if (showDoodle && canvasRef.current) {
      const canvas = canvasRef.current;
      canvas.width = 280;
      canvas.height = 180;

      const context = canvas.getContext('2d');
      if (context) {
        context.strokeStyle = '#f7931a';
        context.lineWidth = 2;
        context.lineCap = 'round';
        context.lineJoin = 'round';
        context.fillStyle = '#0a0a0a';
        context.fillRect(0, 0, canvas.width, canvas.height);
        contextRef.current = context;
      }
    }
  }, [showDoodle]);

  useEffect(() => {
    if (isOpen) {
      setBody('');
      setDoodleData(null);
      setShowDoodle(false);
      setError(null);
      setSelectedBadge('');
    }
  }, [isOpen]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!contextRef.current) return;

    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;

    if ('touches' in e) {
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    contextRef.current.beginPath();
    contextRef.current.moveTo(x, y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !contextRef.current) return;

    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    let x: number, y: number;

    if ('touches' in e) {
      e.preventDefault();
      x = e.touches[0].clientX - rect.left;
      y = e.touches[0].clientY - rect.top;
    } else {
      x = e.clientX - rect.left;
      y = e.clientY - rect.top;
    }

    contextRef.current.lineTo(x, y);
    contextRef.current.stroke();
  };

  const stopDrawing = () => {
    if (contextRef.current) {
      contextRef.current.closePath();
    }
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    if (contextRef.current && canvasRef.current) {
      contextRef.current.fillStyle = '#0a0a0a';
      contextRef.current.fillRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!body.trim()) {
      setError('enter some text');
      return;
    }

    if (body.length > maxLength) {
      setError(`exceeds ${maxLength} char limit`);
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const finalDoodle = showDoodle ? canvasRef.current?.toDataURL('image/png', 0.8) || null : null;
      const finalBadge = selectedBadge || null;
      await onSubmit(body.trim(), finalDoodle, finalBadge);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to post');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="font-mono text-sm text-muted">
            {isReply ? 'reply' : 'new post'}
          </span>
          <button
            onClick={onClose}
            className="text-muted hover:text-[var(--fg)] leading-none"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4">
          {/* Text input */}
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={isReply ? "write a reply..." : "what's happening here?"}
            className="w-full h-28 p-3 bg-[var(--bg-alt)] border border-[var(--border)] focus:border-[var(--accent)] resize-none font-mono text-sm"
            maxLength={maxLength + 10}
            autoFocus
          />

          {/* Char count */}
          <div className="flex justify-between items-center mt-2 text-xs font-mono">
            <span className={charCount > maxLength ? 'text-danger' : 'text-muted'}>
              {charCount}/{maxLength}
            </span>
            {!isReply && postsRemaining !== undefined && (
              <span className="text-faint inline-flex items-center gap-1">
                {postsRemaining > 0 ? `${postsRemaining} free` : (<>paid post <Lightning size={12} weight="fill" /></>)}
              </span>
            )}
          </div>

          {/* Badge dropdown - only for new posts, not replies */}
          {!isReply && badgesEnabled && (
            <div className="mt-4">
              <label className="block text-xs text-muted font-mono mb-1">
                add label (optional)
              </label>
              <select
                value={selectedBadge}
                onChange={(e) => setSelectedBadge(e.target.value as BadgeType | '')}
                className="w-full p-2 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm text-[var(--fg)]"
              >
                <option value="">none</option>
                {BADGE_OPTIONS.map((badge) => (
                  <option key={badge} value={badge}>
                    {badge}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Doodle section */}
          {!isReply && (
            <div className="mt-4">
              {!showDoodle ? (
                <button
                  type="button"
                  onClick={() => setShowDoodle(true)}
                  className="text-xs text-muted hover:text-accent font-mono"
                >
                  [+ add doodle]
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-muted">doodle</span>
                    <div className="flex gap-3">
                      <button
                        type="button"
                        onClick={clearCanvas}
                        className="text-muted hover:text-[var(--fg)]"
                      >
                        [clear]
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowDoodle(false)}
                        className="text-danger"
                      >
                        [remove]
                      </button>
                    </div>
                  </div>
                  <canvas
                    ref={canvasRef}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseLeave={stopDrawing}
                    onTouchStart={startDrawing}
                    onTouchMove={draw}
                    onTouchEnd={stopDrawing}
                    className="border border-[var(--border)] cursor-crosshair touch-none w-full"
                    style={{ aspectRatio: '14/9' }}
                  />
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <p className="mt-3 text-xs text-danger font-mono">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 mt-4">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="btn"
            >
              cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !body.trim() || charCount > maxLength}
              className="btn btn-primary disabled:opacity-50"
            >
              {submitting ? (
                <span className="loading-dots">
                  <span className="dot" />
                  <span className="dot" />
                  <span className="dot" />
                </span>
              ) : isReply ? 'reply' : 'post'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
