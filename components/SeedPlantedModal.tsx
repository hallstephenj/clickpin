'use client';

import { useState } from 'react';
import { X, Smiley, SmileyMeh, SmileySad, Lightning } from '@phosphor-icons/react';
import type { SeedOutcome } from '@/types';
import { SproutReportModal } from './sprout/SproutReportModal';

interface SeedPlantedModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPlant: (outcome: SeedOutcome, commentary?: string) => Promise<void>;
  onSproutSubmit?: (data: {
    photo: string;
    payment_type: 'lightning' | 'onchain' | 'both' | 'unknown';
    context?: string;
  }) => Promise<void>;
  locationName?: string;
  sproutEnabled?: boolean;
}

const OUTCOME_OPTIONS: {
  value: SeedOutcome;
  icon: typeof Smiley;
  label: string;
  description: string;
  color: string;
}[] = [
  {
    value: 'positive',
    icon: Smiley,
    label: 'positive',
    description: 'they seemed interested',
    color: 'text-green-600',
  },
  {
    value: 'neutral',
    icon: SmileyMeh,
    label: 'neutral',
    description: 'they listened but no commitment',
    color: 'text-yellow-600',
  },
  {
    value: 'negative',
    icon: SmileySad,
    label: 'not interested',
    description: 'not interested right now',
    color: 'text-red-500',
  },
];

type Step = 'outcome' | 'commentary';

export function SeedPlantedModal({
  isOpen,
  onClose,
  onPlant,
  onSproutSubmit,
  locationName = 'this location',
  sproutEnabled = false,
}: SeedPlantedModalProps) {
  const [step, setStep] = useState<Step>('outcome');
  const [selectedOutcome, setSelectedOutcome] = useState<SeedOutcome | null>(null);
  const [commentary, setCommentary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSproutModal, setShowSproutModal] = useState(false);

  const MAX_COMMENTARY = 280;

  const handleOutcomeSelect = (outcome: SeedOutcome) => {
    setSelectedOutcome(outcome);
    setStep('commentary');
  };

  const handleSubmit = async () => {
    if (!selectedOutcome) return;

    setLoading(true);
    setError(null);

    try {
      await onPlant(selectedOutcome, commentary.trim() || undefined);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to plant seed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep('outcome');
    setSelectedOutcome(null);
    setCommentary('');
    setError(null);
    setShowSproutModal(false);
    onClose();
  };

  const handleBack = () => {
    if (step === 'commentary') {
      setStep('outcome');
    }
  };

  const handleSproutSelect = () => {
    setShowSproutModal(true);
  };

  const handleSproutClose = () => {
    setShowSproutModal(false);
  };

  const handleSproutSubmit = async (data: {
    photo: string;
    payment_type: 'lightning' | 'onchain' | 'both' | 'unknown';
    context?: string;
  }) => {
    if (onSproutSubmit) {
      await onSproutSubmit(data);
    }
    handleClose();
  };

  if (!isOpen) return null;

  // Show sprout modal if selected
  if (showSproutModal && onSproutSubmit) {
    return (
      <SproutReportModal
        isOpen={true}
        onClose={handleSproutClose}
        onSubmit={handleSproutSubmit}
        locationName={locationName}
      />
    );
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="font-mono text-sm text-muted">plant a seed</span>
          <button onClick={handleClose} className="text-muted hover:text-[var(--fg)] leading-none">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Step: Outcome selection */}
          {step === 'outcome' && (
            <>
              <p className="text-xs text-muted font-mono mb-3">how did the conversation go?</p>
              <div className="space-y-2">
                {OUTCOME_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => handleOutcomeSelect(option.value)}
                      className="w-full p-3 border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-3 text-left transition-colors"
                    >
                      <Icon size={20} weight="fill" className={`flex-shrink-0 ${option.color}`} />
                      <div>
                        <div className="font-mono text-sm text-[var(--fg)]">{option.label}</div>
                        <div className="text-xs text-muted">{option.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Sprout section */}
              {sproutEnabled && onSproutSubmit && (
                <div className="mt-4 pt-4 border-t border-[var(--border)]">
                  <button
                    onClick={handleSproutSelect}
                    className="w-full p-3 border border-orange-400/50 hover:border-orange-400 bg-orange-50/50 dark:bg-orange-900/10 flex items-center gap-3 text-left transition-colors"
                  >
                    <Lightning size={20} weight="fill" className="text-orange-500 flex-shrink-0" />
                    <div className="flex-1">
                      <div className="font-mono text-sm text-[var(--fg)] flex items-center gap-2">
                        report seed sprout
                        <span className="text-[10px] px-1.5 py-0.5 bg-orange-500/20 text-orange-600 dark:text-orange-400 rounded">
                          NEW
                        </span>
                      </div>
                      <div className="text-xs text-muted">this place now accepts Bitcoin!</div>
                    </div>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Step: Commentary */}
          {step === 'commentary' && (
            <>
              <button
                onClick={handleBack}
                className="text-xs text-muted hover:text-[var(--fg)] font-mono mb-3"
              >
                ← back
              </button>
              <p className="text-xs text-muted font-mono mb-2">add a note (optional)</p>
              <textarea
                value={commentary}
                onChange={(e) => setCommentary(e.target.value.slice(0, MAX_COMMENTARY))}
                placeholder="share tips for the next person..."
                className="w-full p-2 border border-[var(--border)] bg-[var(--bg-alt)] text-[var(--fg)] resize-none h-20 focus:border-[var(--accent)] focus:outline-none font-mono text-sm"
              />
              <div className="flex justify-between items-center mt-1">
                <span className="text-xs text-faint font-mono">
                  {commentary.length}/{MAX_COMMENTARY}
                </span>
                {commentary.trim() && (
                  <span className="text-xs text-muted font-mono">
                    will be posted on the board
                  </span>
                )}
              </div>

              {error && (
                <p className="mt-3 text-xs text-danger font-mono">{error}</p>
              )}

              <div className="flex justify-end gap-2 mt-4">
                <button onClick={handleClose} className="btn text-xs">
                  cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={loading}
                  className="btn btn-primary text-xs"
                >
                  {loading ? 'planting...' : 'plant seed'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
