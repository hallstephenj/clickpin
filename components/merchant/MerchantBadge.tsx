'use client';

import { CheckCircle } from '@phosphor-icons/react';

interface MerchantBadgeProps {
  label?: string;
}

export function MerchantBadge({ label = 'merchant' }: MerchantBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs font-mono bg-[var(--accent)]/20 text-accent border border-[var(--accent)]/30">
      <CheckCircle size={12} weight="fill" className="text-orange-500" />
      {label}
    </span>
  );
}
