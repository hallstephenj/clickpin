'use client';

import { CheckCircle } from '@phosphor-icons/react';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md';
  showLabel?: boolean;
}

export function VerifiedBadge({ size = 'sm', showLabel = false }: VerifiedBadgeProps) {
  const iconSize = size === 'sm' ? 14 : 16;
  const textSize = size === 'sm' ? 'text-xs' : 'text-sm';

  return (
    <span
      className={`inline-flex items-center gap-1 ${textSize} text-accent font-mono`}
      title="Verified merchant"
    >
      <CheckCircle size={iconSize} weight="fill" className="text-orange-500" />
      {showLabel && <span>verified</span>}
    </span>
  );
}
