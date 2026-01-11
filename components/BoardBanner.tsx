'use client';

import { useState, useEffect } from 'react';
import { X } from '@phosphor-icons/react';
import type { LocationType } from '@/types';

interface BoardBannerProps {
  locationType: LocationType;
  locationId: string;
}

const BANNER_CONFIG: Record<LocationType, { bg: string; text: string; message: string }> = {
  merchant: {
    bg: 'bg-gray-600',
    text: 'text-white',
    message: "This merchant doesn't yet accept bitcoin.",
  },
  community_space: {
    bg: 'bg-blue-500',
    text: 'text-white',
    message: "This is a bitcoin community space.",
  },
  bitcoin_merchant: {
    bg: 'bg-[#f7931a]',
    text: 'text-white',
    message: "This merchant accepts bitcoin!",
  },
};

export function BoardBanner({ locationType, locationId }: BoardBannerProps) {
  const [dismissed, setDismissed] = useState(true); // Start dismissed to avoid flash

  const storageKey = `banner_dismissed_${locationId}`;

  useEffect(() => {
    // Check localStorage on mount
    const isDismissed = localStorage.getItem(storageKey) === 'true';
    setDismissed(isDismissed);
  }, [storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(storageKey, 'true');
  };

  // Don't show banner if dismissed
  if (dismissed) {
    return null;
  }

  const config = BANNER_CONFIG[locationType];
  if (!config) return null;

  return (
    <div className={`${config.bg} ${config.text} px-4 py-2 flex items-center justify-center relative`}>
      <span className="text-sm font-medium text-center">{config.message}</span>
      <button
        onClick={handleDismiss}
        className="absolute right-4 opacity-70 hover:opacity-100 transition-opacity"
        aria-label="Dismiss banner"
      >
        <X size={16} weight="bold" />
      </button>
    </div>
  );
}

// Bitcoin merchant glow effect styles - to be added to the board container
export const bitcoinMerchantGlowClass = 'bitcoin-merchant-glow';

export const bitcoinMerchantGlowStyles = `
  .bitcoin-merchant-glow {
    box-shadow: 0 0 20px rgba(247, 147, 26, 0.3),
                0 0 40px rgba(247, 147, 26, 0.1);
    animation: bitcoin-glow 3s ease-in-out infinite alternate;
  }

  @keyframes bitcoin-glow {
    from { box-shadow: 0 0 20px rgba(247, 147, 26, 0.2); }
    to { box-shadow: 0 0 30px rgba(247, 147, 26, 0.4); }
  }
`;
