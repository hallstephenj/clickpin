'use client';

import { useEffect, useState } from 'react';
import { useSession } from '@/lib/hooks/useSession';
import { useGeolocation } from '@/lib/hooks/useGeolocation';
import { useBoard } from '@/lib/hooks/useBoard';
import { LocationGate } from '@/components/LocationGate';
import { Board } from '@/components/Board';
import { config } from '@/lib/config';

export default function Home() {
  const { sessionId, loading: sessionLoading } = useSession();
  const { state, location, presenceToken, requestLocation, error: geoError } = useGeolocation(sessionId);
  const { pins, hiddenPins, loading: boardLoading, refreshBoard } = useBoard(location?.slug || null, sessionId);
  const [postsRemaining, setPostsRemaining] = useState(config.rateLimit.freePostsPerLocationPerDay);

  // Auto-request location on mount if session is ready
  useEffect(() => {
    if (sessionId && state.status === 'idle') {
      requestLocation();
    }
  }, [sessionId, state.status, requestLocation]);

  // Fetch quota when location changes
  useEffect(() => {
    if (location && sessionId) {
      // The quota is returned with each post, but we could also fetch it separately
      // For now, start with the default
      setPostsRemaining(config.rateLimit.freePostsPerLocationPerDay);
    }
  }, [location, sessionId]);

  // Loading state - show while session loading or actively requesting location
  const isCheckingLocation = sessionLoading || state.status === 'idle' || state.status === 'requesting';

  if (isCheckingLocation) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">⚡</div>
          <div className="font-mono text-sm text-[#666] dark:text-[#999]">
            checking location...
          </div>
          <div className="font-mono text-xs text-[#999] dark:text-[#666] mt-2 animate-pulse">
            ████████░░░░
          </div>
        </div>
      </div>
    );
  }

  // No location resolved - show location gate (only after check completed)
  if (!location) {
    return (
      <LocationGate
        state={state}
        error={geoError}
        onRequestLocation={requestLocation}
        sessionId={sessionId}
      />
    );
  }

  // Show board
  return (
    <Board
      location={location}
      pins={pins}
      hiddenPins={hiddenPins}
      presenceToken={presenceToken}
      sessionId={sessionId}
      onRefreshBoard={refreshBoard}
      onRefreshLocation={requestLocation}
      postsRemaining={postsRemaining}
    />
  );
}
