'use client';

import { Lightning } from '@phosphor-icons/react';

interface TipJarButtonProps {
  onClick: () => void;
}

export function TipJarButton({ onClick }: TipJarButtonProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 text-xs font-mono text-accent hover:underline"
      title="Send a tip to this business"
    >
      <Lightning size={14} weight="fill" />
      <span>tip jar</span>
    </button>
  );
}
