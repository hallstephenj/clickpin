'use client';

import { Lightning } from '@phosphor-icons/react';

interface DailySpecialBannerProps {
  body: string;
  expiresAt: string;
  locationName: string;
}

export function DailySpecialBanner({ body, expiresAt, locationName }: DailySpecialBannerProps) {
  // Calculate time remaining
  const getTimeRemaining = () => {
    const now = new Date();
    const expires = new Date(expiresAt);
    const diffMs = expires.getTime() - now.getTime();

    if (diffMs <= 0) return 'expired';

    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    }
    return `${minutes}m left`;
  };

  return (
    <div className="border-2 border-orange-500 bg-orange-500/10 p-4 mb-4">
      <div className="flex items-start gap-3">
        <Lightning size={20} weight="fill" className="text-orange-500 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <div className="text-xs font-mono font-bold text-orange-500 uppercase">
              today&apos;s special
            </div>
            <div className="text-xs text-muted font-mono">
              {getTimeRemaining()}
            </div>
          </div>
          <p className="text-sm font-mono whitespace-pre-wrap break-words">
            {body}
          </p>
          <div className="text-xs text-muted font-mono mt-2">
            — {locationName}
          </div>
        </div>
      </div>
    </div>
  );
}
