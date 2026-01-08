'use client';

interface ClaimButtonProps {
  onClick: () => void;
  isMerchantLocation: boolean;
}

export function ClaimButton({ onClick, isMerchantLocation }: ClaimButtonProps) {
  if (!isMerchantLocation) return null;

  return (
    <button
      onClick={onClick}
      className="text-xs font-mono text-accent hover:underline"
    >
      claim this business
    </button>
  );
}
