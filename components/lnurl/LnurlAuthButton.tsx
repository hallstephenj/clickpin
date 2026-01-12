'use client';

import { Lightning } from '@phosphor-icons/react';

interface LnurlAuthButtonProps {
  onClick: () => void;
  isLinked?: boolean;
  displayNym?: string;
  compact?: boolean;
  className?: string;
}

export function LnurlAuthButton({
  onClick,
  isLinked = false,
  displayNym,
  compact = false,
  className = '',
}: LnurlAuthButtonProps) {
  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`flex items-center gap-1 text-xs font-mono ${
          isLinked ? 'text-[var(--accent)]' : 'text-muted hover:text-[var(--fg)]'
        } ${className}`}
        title={isLinked ? `Linked as @${displayNym}` : 'Link Lightning wallet'}
      >
        <Lightning size={14} weight={isLinked ? 'fill' : 'regular'} />
        {isLinked && displayNym && <span>@{displayNym}</span>}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-3 py-2 border border-[var(--border)] hover:border-[var(--accent)] transition-colors ${className}`}
    >
      <Lightning
        size={16}
        weight={isLinked ? 'fill' : 'regular'}
        className={isLinked ? 'text-[var(--accent)]' : 'text-muted'}
      />
      <span className="text-xs font-mono text-[var(--fg)]">
        {isLinked ? `@${displayNym}` : 'link wallet'}
      </span>
    </button>
  );
}
