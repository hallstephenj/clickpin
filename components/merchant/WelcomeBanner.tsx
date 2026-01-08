'use client';

import { PushPin } from '@phosphor-icons/react';
import { MerchantSettings } from '@/types';

interface WelcomeBannerProps {
  settings: MerchantSettings;
  locationName: string;
  openingHours?: string | null;
}

export function WelcomeBanner({ settings, locationName, openingHours }: WelcomeBannerProps) {
  const hours = settings.hours_override || openingHours;
  const hasContent = settings.welcome_message || hours;

  if (!hasContent) return null;

  return (
    <div className="border-2 border-[var(--accent)] bg-[var(--accent)]/5 p-4 mb-4">
      <div className="flex items-start gap-3">
        <PushPin size={20} weight="fill" className="text-accent flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs text-muted font-mono mb-1">
            from {settings.custom_name || locationName}
          </div>
          {settings.welcome_message && (
            <p className="text-sm font-mono whitespace-pre-wrap break-words">
              {settings.welcome_message}
            </p>
          )}
          {hours && (
            <p className="text-xs text-muted font-mono mt-2">
              hours: {hours}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
