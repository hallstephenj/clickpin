'use client';

import Link from 'next/link';
import { GhostCard as GhostCardType } from '@/types';
import { Lightning } from '@phosphor-icons/react';

interface GhostCardProps {
  ghost: GhostCardType;
  showDistance?: boolean;
}

export function GhostCard({ ghost, showDistance = false }: GhostCardProps) {
  // Activity meter colors and labels
  const activityConfig = {
    quiet: { color: 'var(--muted)', label: 'Quiet', bg: 'var(--bg-alt)' },
    warm: { color: 'var(--accent)', label: 'Warm', bg: 'rgba(247, 147, 26, 0.1)' },
    busy: { color: 'var(--success)', label: 'Busy', bg: 'rgba(34, 197, 94, 0.1)' },
  };

  const config = activityConfig[ghost.activity_level];

  // Format distance for display
  const formatDistance = (meters: number | null | undefined) => {
    if (meters === null || meters === undefined) return null;
    if (meters < 1000) return `${meters}m away`;
    return `${(meters / 1000).toFixed(1)}km away`;
  };

  const distanceText = showDistance ? formatDistance(ghost.distance_m) : null;

  return (
    <div
      className="border border-[var(--border)] p-4 hover:border-[var(--accent)] transition-colors"
      style={{ backgroundColor: config.bg }}
    >
      {/* Header: Name + City */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-[var(--fg)]">{ghost.name}</h3>
          {ghost.city && (
            <p className="text-xs text-muted font-mono">{ghost.city}</p>
          )}
        </div>

        {/* Activity meter */}
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: config.color }}
          />
          <span className="text-xs font-mono" style={{ color: config.color }}>
            {config.label}
          </span>
        </div>
      </div>

      {/* Signal text */}
      <div className="mb-3">
        <p className="text-sm text-[var(--fg)]">{ghost.signal_text}</p>
      </div>

      {/* Sponsor badge */}
      {ghost.sponsorship_active && ghost.sponsor_label && (
        <div className="mb-3 text-xs text-muted font-mono flex items-center gap-1">
          <Lightning size={14} weight="fill" className="text-accent" />
          <span>Sponsored by {ghost.sponsor_label}</span>
        </div>
      )}

      {/* Footer: Last active + Distance + CTA */}
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-3 text-muted font-mono">
          <span>{ghost.last_activity_text}</span>
          {distanceText && (
            <>
              <span className="text-faint">•</span>
              <span>{distanceText}</span>
            </>
          )}
        </div>

        <Link
          href={`/map?highlight=${ghost.slug}`}
          className="text-accent hover:underline font-mono"
        >
          go there →
        </Link>
      </div>

      {/* Privacy note - subtle */}
      <p className="mt-3 text-xs text-faint font-mono opacity-60">
        Signals don't reveal content. You still have to be there.
      </p>
    </div>
  );
}

// Section header component
interface GhostSectionProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function GhostSection({ title, subtitle, children }: GhostSectionProps) {
  return (
    <section className="mb-8">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-[var(--fg)]">{title}</h2>
        {subtitle && (
          <p className="text-xs text-muted font-mono">{subtitle}</p>
        )}
      </div>
      {children}
    </section>
  );
}
