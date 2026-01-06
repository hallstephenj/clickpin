'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSession } from '@/lib/hooks/useSession';
import { useGeolocation } from '@/lib/hooks/useGeolocation';
import { useBoard } from '@/lib/hooks/useBoard';
import { LocationGate } from '@/components/LocationGate';
import { Board } from '@/components/Board';
import { config } from '@/lib/config';

function AnimatedProgressBar({ progress }: { progress: number }) {
  const filled = Math.floor(progress * 12);
  const empty = 12 - filled;
  return (
    <div className="font-mono text-xs text-[#999] dark:text-[#666] mt-2">
      {'█'.repeat(filled)}{'░'.repeat(empty)}
    </div>
  );
}

function LoadingScreen({ message, progress }: { message: string; progress: number }) {
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⚡</div>
        <div className="font-mono text-sm text-[#666] dark:text-[#999]">
          {message}
        </div>
        <AnimatedProgressBar progress={progress} />
      </div>
    </div>
  );
}

export default function Home() {
  const { sessionId, loading: sessionLoading } = useSession();
  const { state, location, presenceToken, requestLocation, error: geoError } = useGeolocation(sessionId);
  const { pins, hiddenPins, loading: boardLoading, refreshBoard, hasFetched } = useBoard(location?.slug || null, sessionId);
  const [postsRemaining, setPostsRemaining] = useState(config.rateLimit.freePostsPerLocationPerDay);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('initializing...');

  // Animated progress bar
  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        // Progress moves faster at start, slower as it approaches completion
        const increment = (1 - prev) * 0.08;
        const newProgress = Math.min(prev + increment, 0.95);
        return newProgress;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  // Update loading message based on state
  useEffect(() => {
    if (sessionLoading) {
      setLoadingMessage('initializing...');
    } else if (state.status === 'idle' || state.status === 'requesting') {
      setLoadingMessage('checking location...');
    } else if (location && boardLoading) {
      setLoadingMessage('loading posts...');
    }
  }, [sessionLoading, state.status, location, boardLoading]);

  // Complete progress when everything is loaded
  useEffect(() => {
    if (location && hasFetched && !boardLoading) {
      setProgress(1);
    }
  }, [location, hasFetched, boardLoading]);

  // Auto-request location on mount if session is ready
  useEffect(() => {
    if (sessionId && state.status === 'idle') {
      requestLocation();
    }
  }, [sessionId, state.status, requestLocation]);

  // Fetch quota when location changes
  useEffect(() => {
    if (location && sessionId) {
      setPostsRemaining(config.rateLimit.freePostsPerLocationPerDay);
    }
  }, [location, sessionId]);

  // Show loading screen while checking location
  const isCheckingLocation = sessionLoading || state.status === 'idle' || state.status === 'requesting';

  if (isCheckingLocation) {
    return <LoadingScreen message={loadingMessage} progress={progress} />;
  }

  // No location resolved - show location gate
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

  // Wait for board content to load before showing
  if (boardLoading || !hasFetched) {
    return <LoadingScreen message={loadingMessage} progress={progress} />;
  }

  // Show board with content ready
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
