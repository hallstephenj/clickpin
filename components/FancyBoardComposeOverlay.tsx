'use client';

import { useState, useRef, useEffect } from 'react';
import { FeatureFlags, PinTemplate, PinSize } from '@/types';
import { config } from '@/lib/config';

interface FancyBoardComposeOverlayProps {
  position: { x: number; y: number };
  flags: FeatureFlags;
  presenceToken: string | null;
  onClose: () => void;
  onPost: () => Promise<void>;
  postsRemaining: number;
}

const TEMPLATES: { key: PinTemplate; label: string }[] = [
  { key: 'index', label: 'card' },
  { key: 'sticky', label: 'sticky' },
  { key: 'torn', label: 'torn' },
  { key: 'receipt', label: 'receipt' },
];

const SIZES: { key: PinSize; label: string }[] = [
  { key: 'S', label: 'S' },
  { key: 'M', label: 'M' },
  { key: 'L', label: 'L' },
];

export function FancyBoardComposeOverlay({
  position,
  flags,
  presenceToken,
  onClose,
  onPost,
  postsRemaining,
}: FancyBoardComposeOverlayProps) {
  const [body, setBody] = useState('');
  const [template, setTemplate] = useState<PinTemplate>('index');
  const [size, setSize] = useState<PinSize>('M');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Generate random rotation within -4 to +4 degrees
  const generateRotation = () => {
    if (!flags.fancy_rotation) return null;
    const snappedValues = [-4, -3, -2, -1, 0, 1, 2, 3, 4];
    return snappedValues[Math.floor(Math.random() * snappedValues.length)];
  };

  // Generate z_seed for stacking
  const generateZSeed = () => {
    if (!flags.fancy_stacking) return null;
    return Date.now(); // Use timestamp as z_seed for natural stacking
  };

  // Determine size based on content if sizes enabled
  const determineSize = (): PinSize | null => {
    if (!flags.fancy_sizes) return null;
    return size;
  };

  const handleSubmit = async () => {
    if (!body.trim() || !presenceToken) return;

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          body: body.trim(),
          presence_token: presenceToken,
          // Fancy board fields
          x: position.x,
          y: position.y,
          rotation: generateRotation(),
          template: flags.fancy_templates ? template : null,
          size: determineSize(),
          z_seed: generateZSeed(),
        }),
      });

      if (response.status === 402) {
        const data = await response.json();
        setError(data.error || 'Payment required');
        return;
      }

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to post');
      }

      await onPost();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      handleSubmit();
    }
  };

  return (
    <div
      className="fancy-compose-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className="fancy-compose-card"
        style={{
          position: 'absolute',
          left: `${Math.min(Math.max(position.x, 15), 85)}%`,
          top: `${Math.max(position.y, 50)}px`,
          transform: 'translate(-50%, -20px)',
        }}
      >
        {/* Ghost pin indicator */}
        <div className="fancy-compose-ghost">
          <div className="fancy-compose-ghost-pin" />
        </div>

        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="drop a note..."
          maxLength={config.pin.maxBodyLength}
          className="fancy-compose-textarea"
        />

        <div className="fancy-compose-char-count">
          {body.length}/{config.pin.maxBodyLength}
        </div>

        {/* Template selector */}
        {flags.fancy_templates && (
          <div className="fancy-compose-option-row">
            <span className="fancy-compose-option-label">style:</span>
            <div className="fancy-compose-options">
              {TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTemplate(t.key)}
                  className={`fancy-option-btn ${template === t.key ? 'active' : ''}`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Size selector */}
        {flags.fancy_sizes && (
          <div className="fancy-compose-option-row">
            <span className="fancy-compose-option-label">size:</span>
            <div className="fancy-compose-options">
              {SIZES.map((s) => (
                <button
                  key={s.key}
                  onClick={() => setSize(s.key)}
                  className={`fancy-option-btn ${size === s.key ? 'active' : ''}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="fancy-compose-error">{error}</div>
        )}

        <div className="fancy-compose-footer">
          <span className="fancy-compose-remaining">
            {postsRemaining} free {postsRemaining === 1 ? 'post' : 'posts'} left
          </span>
          <div className="fancy-compose-actions">
            <button
              onClick={onClose}
              disabled={submitting}
              className="fancy-compose-cancel"
            >
              cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting || !body.trim()}
              className="fancy-compose-submit min-w-[70px]"
            >
              {submitting ? <span className="loading-dots" /> : 'pin it'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
