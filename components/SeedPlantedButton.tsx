'use client';

import { useState, useEffect } from 'react';
import { Plant, Check, Spinner } from '@phosphor-icons/react';
import { SeedPlantedModal } from './SeedPlantedModal';
import type { SeedOutcome, LocationType } from '@/types';

interface SeedPlantedButtonProps {
  locationId: string;
  locationName: string;
  locationType: LocationType | undefined;
  presenceToken: string | null;
  seedPlantedEnabled: boolean;
  sproutEnabled: boolean;
  onSeedPlanted?: () => void;
}

export function SeedPlantedButton({
  locationId,
  locationName,
  locationType,
  presenceToken,
  seedPlantedEnabled,
  sproutEnabled,
  onSeedPlanted,
}: SeedPlantedButtonProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [hasPlantedToday, setHasPlantedToday] = useState(false);
  const [checking, setChecking] = useState(true);

  // Check if user has already planted today
  useEffect(() => {
    // Use localStorage to track daily planting (supplement to server-side check)
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `seed_planted_${locationId}_${today}`;
    const planted = localStorage.getItem(storageKey) === 'true';
    setHasPlantedToday(planted);
    setChecking(false);
  }, [locationId]);

  const handlePlant = async (outcome: SeedOutcome, commentary?: string) => {
    if (!presenceToken) {
      throw new Error('Location not verified. Please refresh your location.');
    }

    const response = await fetch('/api/seed/plant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presence_token: presenceToken,
        outcome,
        commentary,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Failed to plant seed');
    }

    // Mark as planted in localStorage
    const today = new Date().toISOString().split('T')[0];
    const storageKey = `seed_planted_${locationId}_${today}`;
    localStorage.setItem(storageKey, 'true');
    setHasPlantedToday(true);

    onSeedPlanted?.();
  };

  const handleSproutSubmit = async (data: {
    photo: string;
    payment_type: 'lightning' | 'onchain' | 'both' | 'unknown';
    context?: string;
  }) => {
    if (!presenceToken) {
      throw new Error('Location not verified. Please refresh your location.');
    }

    const response = await fetch('/api/sprout/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presence_token: presenceToken,
        photo: data.photo,
        payment_type: data.payment_type,
        context: data.context,
      }),
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Failed to submit sprout report');
    }

    onSeedPlanted?.();
  };

  // Don't show if:
  // - Feature is disabled
  // - Location is not a merchant (bitcoin_merchant or community_space should not show)
  // - No presence token (not physically present)
  if (!seedPlantedEnabled || locationType !== 'merchant' || !presenceToken) {
    return null;
  }

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-muted text-sm">
        <Spinner size={16} className="animate-spin" />
        <span>Checking...</span>
      </div>
    );
  }

  if (hasPlantedToday) {
    return (
      <div className="flex items-center gap-2 text-green-600 text-xs font-mono">
        <Check size={14} weight="bold" />
        <span>seed planted today</span>
      </div>
    );
  }

  return (
    <>
      <button
        onClick={() => setModalOpen(true)}
        className="btn text-xs font-mono"
      >
        <Plant size={14} weight="fill" className="text-green-600" />
        plant seed
      </button>

      <SeedPlantedModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onPlant={handlePlant}
        onSproutSubmit={sproutEnabled ? handleSproutSubmit : undefined}
        locationName={locationName}
        sproutEnabled={sproutEnabled}
      />
    </>
  );
}
