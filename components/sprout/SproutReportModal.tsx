'use client';

import { useState, useRef } from 'react';
import { X, Camera, Image as ImageIcon, Lightning, CurrencyBtc, Question, Spinner, Check, ArrowLeft } from '@phosphor-icons/react';

interface SproutReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: {
    photo: string;
    payment_type: 'lightning' | 'onchain' | 'both' | 'unknown';
    context?: string;
  }) => Promise<void>;
  locationName: string;
}

type Step = 'confirm' | 'photo' | 'payment' | 'context' | 'submitting' | 'success';

const PAYMENT_OPTIONS: {
  value: 'lightning' | 'onchain' | 'both' | 'unknown';
  label: string;
  description: string;
  icon: typeof Lightning;
}[] = [
  {
    value: 'lightning',
    label: 'Lightning Network',
    description: 'Fast, instant payments',
    icon: Lightning,
  },
  {
    value: 'onchain',
    label: 'On-chain',
    description: 'Traditional Bitcoin transactions',
    icon: CurrencyBtc,
  },
  {
    value: 'both',
    label: 'Both',
    description: 'Lightning and on-chain accepted',
    icon: CurrencyBtc,
  },
  {
    value: 'unknown',
    label: 'Not sure',
    description: 'But it worked!',
    icon: Question,
  },
];

export function SproutReportModal({
  isOpen,
  onClose,
  onSubmit,
  locationName,
}: SproutReportModalProps) {
  const [step, setStep] = useState<Step>('confirm');
  const [photo, setPhoto] = useState<string | null>(null);
  const [paymentType, setPaymentType] = useState<'lightning' | 'onchain' | 'both' | 'unknown' | null>(null);
  const [context, setContext] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const MAX_CONTEXT = 500;

  const handleClose = () => {
    setStep('confirm');
    setPhoto(null);
    setPaymentType(null);
    setContext('');
    setError(null);
    onClose();
  };

  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image too large. Maximum size is 5MB.');
      return;
    }

    // Convert to base64
    const reader = new FileReader();
    reader.onload = () => {
      setPhoto(reader.result as string);
      setError(null);
      setStep('payment');
    };
    reader.onerror = () => {
      setError('Failed to read image');
    };
    reader.readAsDataURL(file);
  };

  const handlePaymentSelect = (type: typeof paymentType) => {
    setPaymentType(type);
    setStep('context');
  };

  const handleSubmit = async () => {
    if (!photo || !paymentType) return;

    setStep('submitting');
    setError(null);

    try {
      await onSubmit({
        photo,
        payment_type: paymentType,
        context: context.trim() || undefined,
      });
      setStep('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit report');
      setStep('context'); // Go back to last input step
    }
  };

  const goBack = () => {
    if (step === 'photo') setStep('confirm');
    else if (step === 'payment') setStep('photo');
    else if (step === 'context') setStep('payment');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-10">
      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            {step !== 'confirm' && step !== 'submitting' && step !== 'success' && (
              <button onClick={goBack} className="text-muted hover:text-[var(--fg)] mr-1">
                <ArrowLeft size={16} />
              </button>
            )}
            <span className="font-mono text-sm text-muted">report sprout</span>
          </div>
          <button onClick={handleClose} className="text-muted hover:text-[var(--fg)] leading-none">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Step 1: Confirmation */}
          {step === 'confirm' && (
            <>
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 mb-3">
                  <Lightning size={24} weight="fill" className="text-orange-500" />
                </div>
                <h3 className="font-mono text-sm text-[var(--fg)] mb-2">
                  Confirm Sprout Report
                </h3>
              </div>

              <p className="text-xs text-muted font-mono text-center mb-4">
                You&apos;re reporting that <span className="text-[var(--fg)]">{locationName}</span> now accepts Bitcoin payments.
              </p>

              <p className="text-xs text-faint font-mono text-center mb-6">
                This report will be reviewed and, if confirmed, this location will be added to the Bitcoin merchant map.
              </p>

              <button
                onClick={() => setStep('photo')}
                className="w-full btn btn-primary text-sm"
              >
                continue
              </button>
            </>
          )}

          {/* Step 2: Photo Upload */}
          {step === 'photo' && (
            <>
              <p className="text-xs text-muted font-mono mb-4">
                share a photo to help verify this
              </p>

              {photo ? (
                <div className="mb-4">
                  <img
                    src={photo}
                    alt="Selected"
                    className="w-full max-h-48 object-contain border border-[var(--border)]"
                  />
                  <button
                    onClick={() => setPhoto(null)}
                    className="mt-2 text-xs text-muted hover:text-[var(--fg)] font-mono"
                  >
                    change photo
                  </button>
                </div>
              ) : (
                <div className="space-y-2 mb-4">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    className="w-full p-4 border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-3 transition-colors"
                  >
                    <Camera size={24} className="text-muted" />
                    <div className="text-left">
                      <div className="font-mono text-sm text-[var(--fg)]">take photo</div>
                      <div className="text-xs text-muted">use your camera</div>
                    </div>
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-3 transition-colors"
                  >
                    <ImageIcon size={24} className="text-muted" />
                    <div className="text-left">
                      <div className="font-mono text-sm text-[var(--fg)]">choose from gallery</div>
                      <div className="text-xs text-muted">select existing photo</div>
                    </div>
                  </button>
                </div>
              )}

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoSelect}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoSelect}
                className="hidden"
              />

              <div className="bg-[var(--bg-alt)] p-3 border border-[var(--border)]">
                <p className="text-xs text-faint font-mono">
                  <strong>tip:</strong> show the business name AND evidence of Bitcoin payment acceptance (sign, sticker, QR code, etc.)
                </p>
              </div>

              {error && (
                <p className="mt-3 text-xs text-danger font-mono">{error}</p>
              )}

              {photo && (
                <button
                  onClick={() => setStep('payment')}
                  className="w-full mt-4 btn btn-primary text-sm"
                >
                  continue
                </button>
              )}
            </>
          )}

          {/* Step 3: Payment Type */}
          {step === 'payment' && (
            <>
              <p className="text-xs text-muted font-mono mb-4">
                what payment method did they accept?
              </p>

              <div className="space-y-2">
                {PAYMENT_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      key={option.value}
                      onClick={() => handlePaymentSelect(option.value)}
                      className="w-full p-3 border border-[var(--border)] hover:border-[var(--accent)] flex items-center gap-3 text-left transition-colors"
                    >
                      <Icon
                        size={20}
                        weight={option.value === 'lightning' ? 'fill' : 'regular'}
                        className="text-orange-500 flex-shrink-0"
                      />
                      <div>
                        <div className="font-mono text-sm text-[var(--fg)]">{option.label}</div>
                        <div className="text-xs text-muted">{option.description}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}

          {/* Step 4: Context */}
          {step === 'context' && (
            <>
              <p className="text-xs text-muted font-mono mb-2">
                any additional details? (optional)
              </p>

              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value.slice(0, MAX_CONTEXT))}
                placeholder="e.g., 'Owner said they started accepting Bitcoin last month'"
                className="w-full p-2 border border-[var(--border)] bg-[var(--bg-alt)] text-[var(--fg)] resize-none h-24 focus:border-[var(--accent)] focus:outline-none font-mono text-sm"
              />
              <div className="flex justify-between items-center mt-1 mb-4">
                <span className="text-xs text-faint font-mono">
                  {context.length}/{MAX_CONTEXT}
                </span>
              </div>

              {error && (
                <p className="mb-3 text-xs text-danger font-mono">{error}</p>
              )}

              <button
                onClick={handleSubmit}
                className="w-full btn btn-primary text-sm"
              >
                submit report
              </button>
            </>
          )}

          {/* Submitting */}
          {step === 'submitting' && (
            <div className="text-center py-8">
              <Spinner size={32} className="animate-spin text-muted mx-auto mb-4" />
              <p className="text-sm text-muted font-mono">submitting report...</p>
            </div>
          )}

          {/* Success */}
          {step === 'success' && (
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                <Check size={24} weight="bold" className="text-green-600" />
              </div>
              <h3 className="font-mono text-sm text-[var(--fg)] mb-2">
                Report Submitted!
              </h3>
              <p className="text-xs text-muted font-mono mb-6">
                Your sprout report has been submitted for review. Thank you for helping grow the Bitcoin merchant map!
              </p>
              <button onClick={handleClose} className="btn text-sm">
                close
              </button>
            </div>
          )}
        </div>

        {/* Progress indicator */}
        {['photo', 'payment', 'context'].includes(step) && (
          <div className="px-4 pb-4">
            <div className="flex gap-1">
              {['photo', 'payment', 'context'].map((s, i) => (
                <div
                  key={s}
                  className={`flex-1 h-1 rounded ${
                    ['photo', 'payment', 'context'].indexOf(step) >= i
                      ? 'bg-[var(--accent)]'
                      : 'bg-[var(--border)]'
                  }`}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
