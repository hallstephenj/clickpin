'use client';

import { Lightning } from '@phosphor-icons/react';

interface IdentityBadgeProps {
  nym: string | null;
  showIcon?: boolean;
  className?: string;
}

/**
 * Displays the author nym for a post
 * Shows @nym for linked users, @anon for anonymous
 */
export function IdentityBadge({ nym, showIcon = false, className = '' }: IdentityBadgeProps) {
  const displayNym = nym || 'anon';
  const isLinked = nym !== null && !nym.startsWith('anon-');

  return (
    <span className={`inline-flex items-center gap-1 text-xs text-muted font-mono ${className}`}>
      {showIcon && isLinked && (
        <Lightning size={10} weight="fill" className="text-[var(--accent)]" />
      )}
      <span>@{displayNym}</span>
    </span>
  );
}
