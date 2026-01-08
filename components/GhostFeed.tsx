'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useGhosts } from '@/lib/hooks/useGhosts';
import { GhostCard, GhostSection } from './GhostCard';
import { Lightning } from '@phosphor-icons/react';

interface GhostFeedProps {
  onRequestLocation: () => void;
}

export function GhostFeed({ onRequestLocation }: GhostFeedProps) {
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationPermission, setLocationPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');

  // Check location permission on mount
  useEffect(() => {
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'geolocation' }).then((result) => {
        setLocationPermission(result.state as 'prompt' | 'granted' | 'denied');
        if (result.state === 'granted') {
          requestUserLocation();
        }
      });
    }
  }, []);

  const requestUserLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserLocation({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
          setLocationPermission('granted');
        },
        () => {
          setLocationPermission('denied');
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  };

  const { data, loading, error } = useGhosts({
    lat: userLocation?.lat,
    lng: userLocation?.lng,
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <Lightning size={32} weight="fill" className="text-accent mx-auto mb-2" />
          <p className="text-muted font-mono text-sm">loading signals...</p>
        </div>
      </div>
    );
  }

  if (!data?.ghosts_enabled) {
    // Ghosts feature is disabled, show fallback
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md text-center">
          <h1 className="text-2xl font-bold mb-4 inline-flex items-center gap-1">
            <Lightning size={24} weight="fill" className="text-accent" /> clickpin
          </h1>
          <p className="text-muted font-mono text-sm mb-6">
            Location-gated anonymous boards. Visit a location to view its board.
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={onRequestLocation}
              className="btn btn-primary justify-center"
            >
              Find my nearest board
            </button>
            <Link href="/map" className="btn justify-center">
              View map
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const hasNearby = data.nearby && data.nearby.length > 0;
  const hasCityWide = data.city_wide && data.city_wide.length > 0;
  const hasSponsored = data.sponsored && data.sponsored.length > 0;

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold inline-flex items-center gap-1">
              <Lightning size={20} weight="fill" className="text-accent" /> clickpin
            </h1>
            <p className="text-xs text-muted font-mono">activity signals</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onRequestLocation}
              className="btn btn-primary text-sm"
            >
              Go to my board
            </button>
            <Link href="/map" className="btn text-sm">
              Map
            </Link>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto p-4">
        {/* Location permission prompt */}
        {locationPermission === 'prompt' && (
          <div className="mb-6 p-4 border border-[var(--accent)] bg-[var(--accent)]/10 rounded">
            <p className="text-sm mb-3">
              Enable location to see nearby signals and find boards close to you.
            </p>
            <button
              onClick={requestUserLocation}
              className="btn btn-primary text-sm"
            >
              Enable location
            </button>
          </div>
        )}

        {/* Nearby signals section */}
        {hasNearby && (
          <GhostSection
            title="Nearby signals"
            subtitle={`${data.nearby.length} board${data.nearby.length !== 1 ? 's' : ''} within range`}
          >
            <div className="space-y-3">
              {data.nearby.map((ghost) => (
                <GhostCard key={ghost.location_id} ghost={ghost} showDistance />
              ))}
            </div>
          </GhostSection>
        )}

        {/* Sponsored boards section */}
        {hasSponsored && (
          <GhostSection
            title="Sponsor-supported boards"
            subtitle="Community boards with active sponsors"
          >
            <div className="space-y-3">
              {data.sponsored.map((ghost) => (
                <GhostCard key={ghost.location_id} ghost={ghost} showDistance={!!userLocation} />
              ))}
            </div>
          </GhostSection>
        )}

        {/* City-wide signals section */}
        {hasCityWide && (
          <GhostSection
            title="Live around Austin"
            subtitle="Trending activity city-wide"
          >
            <div className="space-y-3">
              {data.city_wide.slice(0, 10).map((ghost) => (
                <GhostCard key={ghost.location_id} ghost={ghost} showDistance={!!userLocation} />
              ))}
            </div>
          </GhostSection>
        )}

        {/* Empty state */}
        {!hasNearby && !hasCityWide && !hasSponsored && (
          <div className="text-center py-12">
            <p className="text-muted font-mono text-sm mb-4">
              No activity signals yet. Be the first!
            </p>
            <Link href="/map" className="btn btn-primary">
              View all boards
            </Link>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="text-center py-8">
            <p className="text-danger font-mono text-sm">{error}</p>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] px-4 py-4 mt-8">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-4 text-xs text-muted font-mono">
            <Link href="/map" className="hover:text-[var(--fg)]">
              nearby
            </Link>
            <span className="text-faint">|</span>
            <Link href="/about" className="hover:text-[var(--fg)]">
              about
            </Link>
            <span className="text-faint">|</span>
            <Link href="/terms" className="hover:text-[var(--fg)]">
              terms
            </Link>
            <span className="text-faint">|</span>
            <Link href="/privacy" className="hover:text-[var(--fg)]">
              privacy
            </Link>
          </div>
          <p className="text-center text-xs text-faint font-mono mt-3">
            Signals show activity, not content. Visit a location to participate.
          </p>
        </div>
      </footer>
    </div>
  );
}
