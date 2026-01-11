'use client';

import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Lightning } from '@phosphor-icons/react';

interface TipModalProps {
  isOpen: boolean;
  onClose: () => void;
  lightningAddress: string;
  locationName: string;
}

export function TipModal({ isOpen, onClose, lightningAddress, locationName }: TipModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(lightningAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Format for QR code - Lightning addresses use lightning: prefix
  const qrValue = lightningAddress.startsWith('lnurl')
    ? lightningAddress.toUpperCase()
    : `lightning:${lightningAddress}`;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-20">
      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] w-full max-w-sm">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <span className="font-mono text-sm text-muted">tip jar</span>
          <button
            onClick={onClose}
            className="text-muted hover:text-[var(--fg)] leading-none"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-4">
          <div className="text-center mb-4">
            <p className="text-sm font-mono">
              Send a tip to <span className="font-bold">{locationName}</span>
            </p>
          </div>

          {/* QR Code */}
          <div className="flex justify-center py-4 bg-white rounded mb-4">
            <QRCodeSVG
              value={qrValue}
              size={180}
              level="M"
              includeMargin={true}
            />
          </div>

          {/* Lightning Address */}
          <div className="mb-4">
            <div className="text-xs text-muted font-mono mb-1 text-center">
              lightning address
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={lightningAddress}
                readOnly
                className="flex-1 p-2 text-xs font-mono bg-[var(--bg-alt)] truncate text-center"
              />
              <button onClick={handleCopy} className="btn text-xs">
                {copied ? 'copied' : 'copy'}
              </button>
            </div>
            <a
              href={`lightning:${lightningAddress}`}
              className="btn w-full mt-2 justify-center text-xs"
            >
              <Lightning size={14} weight="fill" className="mr-1" />
              open in wallet
            </a>
          </div>

          <p className="text-xs text-faint font-mono text-center">
            Scan with any Lightning wallet to send a tip directly to this business.
          </p>
        </div>
      </div>
    </div>
  );
}
