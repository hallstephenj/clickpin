'use client';

import { useState, useEffect } from 'react';
import { X, Lightning, Check, Copy, CaretDown, CaretUp, Spinner } from '@phosphor-icons/react';
import { QRCodeSVG } from 'qrcode.react';
import { useLnurlAuthFlow } from '@/lib/hooks/useLnurlIdentity';

interface LnurlAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  onSuccess?: () => void;
}

const COMPATIBLE_WALLETS = [
  { name: 'Alby', url: 'https://getalby.com' },
  { name: 'Phoenix', url: 'https://phoenix.acinq.co' },
  { name: 'Breez', url: 'https://breez.technology' },
  { name: 'Zeus', url: 'https://zeusln.app' },
  { name: 'BlueWallet', url: 'https://bluewallet.io' },
  { name: 'Wallet of Satoshi', url: 'https://www.walletofsatoshi.com' },
];

export function LnurlAuthModal({ isOpen, onClose, sessionId, onSuccess }: LnurlAuthModalProps) {
  const { lnurl, status, error, identity, startAuth, reset } = useLnurlAuthFlow(sessionId);
  const [copied, setCopied] = useState(false);
  const [showWallets, setShowWallets] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState<string | null>(null);

  // Start auth flow when modal opens
  useEffect(() => {
    if (isOpen && sessionId && status === 'idle') {
      startAuth();
    }
  }, [isOpen, sessionId, status, startAuth]);

  // Handle successful verification
  useEffect(() => {
    if (status === 'verified' && identity) {
      // Pre-fill display name if identity has one
      if (identity.display_name) {
        setDisplayName(identity.display_name);
      }
    }
  }, [status, identity]);

  const handleClose = () => {
    reset();
    setCopied(false);
    setShowWallets(false);
    setDisplayName('');
    setNameError(null);
    onClose();
  };

  const handleCopy = async () => {
    if (!lnurl) return;
    try {
      await navigator.clipboard.writeText(lnurl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const handleSaveDisplayName = async () => {
    if (!sessionId) return;

    setSavingName(true);
    setNameError(null);

    try {
      const response = await fetch('/api/lnurl/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_session_id: sessionId,
          display_name: displayName.trim() || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save name');
      }

      onSuccess?.();
      handleClose();
    } catch (err) {
      setNameError(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSavingName(false);
    }
  };

  const handleSkipName = () => {
    onSuccess?.();
    handleClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Lightning size={16} weight="fill" className="text-[var(--accent)]" />
            <span className="font-mono text-sm text-muted">
              {status === 'verified' ? 'wallet linked' : 'link wallet'}
            </span>
          </div>
          <button onClick={handleClose} className="text-muted hover:text-[var(--fg)] leading-none">
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {status === 'waiting' && lnurl && (
            <>
              <p className="text-xs text-muted font-mono mb-4 text-center">
                scan with a Lightning wallet to link your identity
              </p>

              {/* QR Code */}
              <div className="flex justify-center mb-4">
                <div className="p-3 bg-white">
                  <QRCodeSVG
                    value={lnurl.toUpperCase()}
                    size={200}
                    level="M"
                    includeMargin={false}
                  />
                </div>
              </div>

              {/* Copy button */}
              <button
                onClick={handleCopy}
                className="w-full p-2 border border-[var(--border)] hover:border-[var(--accent)] flex items-center justify-center gap-2 text-xs font-mono transition-colors"
              >
                {copied ? (
                  <>
                    <Check size={14} className="text-green-600" />
                    copied!
                  </>
                ) : (
                  <>
                    <Copy size={14} />
                    copy lnurl
                  </>
                )}
              </button>

              {/* Wallet help */}
              <button
                onClick={() => setShowWallets(!showWallets)}
                className="w-full mt-3 text-xs text-muted hover:text-[var(--fg)] font-mono flex items-center justify-center gap-1"
              >
                which wallets can I use?
                {showWallets ? <CaretUp size={12} /> : <CaretDown size={12} />}
              </button>

              {showWallets && (
                <div className="mt-2 p-3 border border-[var(--border)] bg-[var(--bg-alt)]">
                  <p className="text-xs text-muted font-mono mb-2">
                    any wallet supporting LNURL-auth:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {COMPATIBLE_WALLETS.map((wallet) => (
                      <a
                        key={wallet.name}
                        href={wallet.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-mono text-[var(--accent)] hover:underline"
                      >
                        {wallet.name}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <p className="mt-4 text-xs text-faint font-mono text-center">
                waiting for wallet...
              </p>
            </>
          )}

          {status === 'verified' && identity && (
            <>
              <div className="text-center mb-4">
                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 mb-3">
                  <Check size={24} weight="bold" className="text-green-600" />
                </div>
                <p className="text-sm font-mono text-[var(--fg)]">wallet linked!</p>
                <p className="text-xs text-muted font-mono mt-1">
                  you&apos;re now @{identity.anon_nym}
                </p>
              </div>

              {/* Display name input */}
              <div className="mb-4">
                <label className="text-xs text-muted font-mono block mb-1">
                  choose a display name (optional)
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value.slice(0, 30))}
                  placeholder={identity.anon_nym}
                  className="w-full p-2 border border-[var(--border)] bg-[var(--bg-alt)] text-[var(--fg)] focus:border-[var(--accent)] focus:outline-none font-mono text-sm"
                />
                <p className="text-xs text-faint font-mono mt-1">
                  1-30 chars, letters, numbers, underscores
                </p>
              </div>

              {nameError && (
                <p className="mb-3 text-xs text-danger font-mono">{nameError}</p>
              )}

              <div className="flex gap-2">
                <button
                  onClick={handleSkipName}
                  className="btn text-xs flex-1"
                >
                  skip
                </button>
                <button
                  onClick={handleSaveDisplayName}
                  disabled={savingName}
                  className="btn btn-primary text-xs flex-1"
                >
                  {savingName ? 'saving...' : 'save'}
                </button>
              </div>
            </>
          )}

          {status === 'expired' && (
            <div className="text-center">
              <p className="text-sm text-muted font-mono mb-4">
                QR code expired
              </p>
              <button
                onClick={() => {
                  reset();
                  startAuth();
                }}
                className="btn btn-primary text-xs"
              >
                generate new code
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <p className="text-sm text-danger font-mono mb-2">
                {error || 'something went wrong'}
              </p>
              <button
                onClick={() => {
                  reset();
                  startAuth();
                }}
                className="btn text-xs"
              >
                try again
              </button>
            </div>
          )}

          {status === 'idle' && (
            <div className="flex justify-center py-8">
              <Spinner size={24} className="animate-spin text-muted" />
            </div>
          )}
        </div>

        {/* Footer info */}
        {status === 'waiting' && (
          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-alt)]">
            <p className="text-xs text-faint font-mono">
              linking your wallet lets you keep your identity across devices and appear on leaderboards
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
