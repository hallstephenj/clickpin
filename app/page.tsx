'use client';

import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Lightning } from '@phosphor-icons/react';
import { useSession } from '@/lib/hooks/useSession';
import { useGeolocation } from '@/lib/hooks/useGeolocation';
import { useBoard } from '@/lib/hooks/useBoard';
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlags';
import { LocationGate } from '@/components/LocationGate';
import { ProximityHome } from '@/components/ProximityHome';
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

function LoadingScreen({ message, progress, fadeOut }: { message: string; progress: number; fadeOut?: boolean }) {
  return (
    <div
      className={`min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center transition-opacity duration-300 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}
    >
      <div className="text-center">
        <Lightning size={48} weight="fill" className="text-accent mb-4 mx-auto" />
        <div className="font-mono text-sm text-[#666] dark:text-[#999]">
          {message}
        </div>
        <AnimatedProgressBar progress={progress} />
      </div>
    </div>
  );
}

function HomeContent() {
  const searchParams = useSearchParams();
  const viewNearby = searchParams.get('view') === 'nearby';

  const { sessionId, loading: sessionLoading } = useSession();
  const { flags, loading: flagsLoading } = useFeatureFlags();
  const { state, location: geoLocation, presenceToken, requestLocation, error: geoError } = useGeolocation(sessionId);
  const { pins, hiddenPins, boardLocation, loading: boardLoading, refreshBoard, hasFetched } = useBoard(geoLocation?.slug || null, sessionId);

  // Use boardLocation for sponsor info (updated on refresh), fallback to geoLocation
  const location = boardLocation || geoLocation;
  const [postsRemaining, setPostsRemaining] = useState(config.rateLimit.freePostsPerLocationPerDay);
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('initializing...');

  // Transition state: 'loading' -> 'completing' -> 'done'
  const [transitionState, setTransitionState] = useState<'loading' | 'completing' | 'done'>('loading');

  // Prefetch proximity stats for ProximityHome
  const [prefetchedProximityStats, setPrefetchedProximityStats] = useState<unknown>(null);
  const [proximityStatsFetched, setProximityStatsFetched] = useState(false);

  // Minimum animation time for mono theme
  const [minAnimationComplete, setMinAnimationComplete] = useState(false);
  const [isMonoTheme, setIsMonoTheme] = useState(false);

  // Detect theme on mount
  useEffect(() => {
    const isMono = typeof window !== 'undefined' &&
      !document.documentElement.classList.contains('forstall-mode') &&
      !document.documentElement.classList.contains('neo2026-mode');
    setIsMonoTheme(isMono);

    if (isMono) {
      // Mono theme: require minimum 2.5s before completing
      const timer = setTimeout(() => setMinAnimationComplete(true), 2500);
      return () => clearTimeout(timer);
    } else {
      setMinAnimationComplete(true);
    }
  }, []);

  // Animated progress bar
  useEffect(() => {
    if (isMonoTheme) {
      // Mono theme: slow linear progress, one block every 250ms
      const interval = setInterval(() => {
        setProgress(prev => {
          const newProgress = prev + (1 / 12); // Add one block worth
          return Math.min(newProgress, 0.95);
        });
      }, 250);
      return () => clearInterval(interval);
    } else {
      // Other themes: faster exponential progress
      const interval = setInterval(() => {
        setProgress(prev => {
          const increment = (1 - prev) * 0.08;
          return Math.min(prev + increment, 0.95);
        });
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isMonoTheme]);

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

  // Determine if we're still in initial loading phase
  const isCheckingLocation = sessionLoading || flagsLoading || state.status === 'requesting';

  // Prefetch proximity stats when we have position but no resolved location
  useEffect(() => {
    const userLat = state.position?.coords.latitude;
    const userLng = state.position?.coords.longitude;

    // Only prefetch if we have position, no location resolved, and haven't fetched yet
    if (userLat && userLng && !geoLocation && !proximityStatsFetched && !isCheckingLocation) {
      fetch(`/api/proximity-stats?lat=${userLat}&lng=${userLng}`)
        .then(res => res.json())
        .then(data => {
          if (!data.error) {
            setPrefetchedProximityStats(data);
          }
        })
        .catch(console.error)
        .finally(() => setProximityStatsFetched(true));
    }
  }, [state.position, geoLocation, proximityStatsFetched, isCheckingLocation]);

  // Determine if data is loaded (separate from animation readiness)
  const needsProximityStats = !geoLocation && state.position && flags.PROXHOME;
  const isDataReady = !isCheckingLocation && (
    (needsProximityStats && proximityStatsFetched) || // ProximityHome with stats loaded
    (!geoLocation && !needsProximityStats) ||         // LocationGate (no position)
    hasFetched                                         // Board with data loaded
  );

  // Content is ready when data is loaded AND minimum animation time has passed
  const isContentReady = isDataReady && minAnimationComplete;

  // Handle transition when content is ready
  useEffect(() => {
    if (isContentReady && transitionState === 'loading') {
      // Complete the progress bar first
      setProgress(1);
      // Brief pause at 100% before fading
      const pauseTimer = setTimeout(() => {
        setTransitionState('completing');
      }, 500);

      return () => clearTimeout(pauseTimer);
    }
  }, [isContentReady, transitionState]);

  useEffect(() => {
    if (transitionState === 'completing') {
      // After fade animation completes, mark as done
      const fadeTimer = setTimeout(() => {
        setTransitionState('done');
      }, 300);

      return () => clearTimeout(fadeTimer);
    }
  }, [transitionState]);

  // Auto-request location on mount if session is ready
  useEffect(() => {
    if (sessionId && state.status === 'idle' && !flagsLoading) {
      requestLocation();
    }
  }, [sessionId, state.status, requestLocation, flagsLoading]);

  // Fetch quota when location changes
  useEffect(() => {
    if (location && sessionId) {
      setPostsRemaining(config.rateLimit.freePostsPerLocationPerDay);
    }
  }, [location, sessionId]);

  // Show loading screen while checking location or during transition
  if (isCheckingLocation || transitionState !== 'done') {
    // Still in initial loading phase
    if (isCheckingLocation) {
      return <LoadingScreen message={loadingMessage} progress={progress} />;
    }
    // Transition phase - show loading with fade, content underneath
    if (transitionState === 'loading' || transitionState === 'completing') {
      return <LoadingScreen message={loadingMessage} progress={progress} fadeOut={transitionState === 'completing'} />;
    }
  }

  // If PROXHOME_ADVANCED is enabled and user clicked "nearby", show ProximityHome
  // even when at a location (pass currentLocation to show "return to board" button)
  if (flags.PROXHOME && flags.PROXHOME_ADVANCED && viewNearby && state.position) {
    return (
      <div className="animate-fade-in">
        <ProximityHome
          state={state}
          onRequestLocation={requestLocation}
          sessionId={sessionId}
          currentLocation={geoLocation || undefined}
          prefetchedStats={prefetchedProximityStats}
        />
      </div>
    );
  }

  // No location resolved - show location gate or proximity home
  if (!geoLocation) {
    // Use ProximityHome for discovery-framed experience when PROXHOME is enabled
    // and user has position but no board found
    if (flags.PROXHOME && state.position) {
      return (
        <div className="animate-fade-in">
          <ProximityHome
            state={state}
            onRequestLocation={requestLocation}
            sessionId={sessionId}
            prefetchedStats={prefetchedProximityStats}
          />
        </div>
      );
    }

    return (
      <div className="animate-fade-in">
        <LocationGate
          state={state}
          error={geoError}
          onRequestLocation={requestLocation}
          sessionId={sessionId}
        />
      </div>
    );
  }

  // Wait for initial board content to load before showing (not on refresh)
  if (!hasFetched) {
    return <LoadingScreen message={loadingMessage} progress={progress} />;
  }

  // Use boardLocation if available (has latest sponsor info), otherwise geoLocation
  // geoLocation is guaranteed non-null at this point since we checked above
  const displayLocation = boardLocation || geoLocation!;

  // Show board with content ready
  return (
    <div className="animate-fade-in">
      <Board
        location={displayLocation}
        pins={pins}
        hiddenPins={hiddenPins}
        presenceToken={presenceToken}
        sessionId={sessionId}
        onRefreshBoard={refreshBoard}
        onRefreshLocation={requestLocation}
        postsRemaining={postsRemaining}
      />
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<LoadingScreen message="initializing..." progress={0} />}>
      <HomeContent />
    </Suspense>
  );
}
