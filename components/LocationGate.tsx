'use client';

import { useState, useEffect } from 'react';
import { GeolocationState } from '@/types';
import { RequestLocationModal } from './RequestLocationModal';

function AnimatedProgressBar() {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setProgress(prev => {
        const increment = (1 - prev) * 0.08;
        return Math.min(prev + increment, 0.95);
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const filled = Math.floor(progress * 12);
  const empty = 12 - filled;
  return (
    <div className="text-faint text-xs font-mono">
      {'█'.repeat(filled)}{'░'.repeat(empty)}
    </div>
  );
}

interface LocationGateProps {
  state: GeolocationState;
  error: string | null;
  onRequestLocation: () => void;
  sessionId: string | null;
}

export function LocationGate({ state, error, onRequestLocation, sessionId }: LocationGateProps) {
  const [showRequestModal, setShowRequestModal] = useState(false);
  const isLoading = state.status === 'requesting';
  const isDenied = state.status === 'denied';
  const hasPosition = state.position !== null;
  const isNoBoard = error && (error.toLowerCase().includes('no clickpin board') || error.toLowerCase().includes("doesn't have a clickpin"));
  const isAccuracyError = error && error.toLowerCase().includes('accuracy');
  const canRequestLocation = hasPosition && (isNoBoard || isAccuracyError);

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-sm w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-1">
            <span className="text-accent">⚡</span> clickpin
          </h1>
          <p className="text-muted text-sm font-mono">
            if you're not there, you can't see it
          </p>
        </div>

        {/* Status */}
        <div className="border border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a]">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="text-muted mb-2 font-mono text-sm">
                locating...
              </div>
              <AnimatedProgressBar />
            </div>
          ) : (
            <div className="p-6">
              {/* Error message */}
              {error && (
                <div className="mb-4 p-3 border border-[var(--danger)] bg-[var(--bg-alt)] text-sm">
                  <span className="text-danger font-mono">{error}</span>
                </div>
              )}

              {/* Instructions */}
              <div className="text-sm text-muted mb-6">
                {isDenied ? (
                  <p>
                    location access denied. enable it in browser settings to use clickpin.
                  </p>
                ) : state.status === 'idle' ? (
                  <>
                    <p className="mb-2">
                      each board is locked to its physical location. only people actually there can read or post. posts fade over time — nothing lasts forever.
                    </p>
                    <p className="text-faint text-xs font-mono">
                      your position is verified but never stored
                    </p>
                  </>
                ) : canRequestLocation ? (
                  <p>
                    no board here yet. claim this spot and start something.
                  </p>
                ) : null}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2">
                <button
                  onClick={onRequestLocation}
                  disabled={isLoading}
                  className="btn btn-primary w-full justify-center disabled:opacity-50"
                >
                  {state.status === 'idle'
                    ? 'find my board'
                    : isDenied
                      ? 'try again'
                      : 'refresh location'}
                </button>

                {isNoBoard && (
                  <a
                    href="/map"
                    className="btn w-full justify-center text-center"
                  >
                    find nearby boards
                  </a>
                )}

                {canRequestLocation && (
                  <button
                    onClick={() => setShowRequestModal(true)}
                    className="btn w-full justify-center"
                  >
                    request this location
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-faint font-mono">
          <a href="/about" className="hover:text-[var(--accent)]">about</a>
          {' • '}
          <a href="/terms" className="hover:text-[var(--accent)]">terms</a>
          {' • '}
          <a href="/privacy" className="hover:text-[var(--accent)]">privacy</a>
        </div>
      </div>

      {/* Request Location Modal */}
      {canRequestLocation && state.position && (
        <RequestLocationModal
          isOpen={showRequestModal}
          onClose={() => setShowRequestModal(false)}
          lat={state.position.coords.latitude}
          lng={state.position.coords.longitude}
          sessionId={sessionId}
        />
      )}
    </div>
  );
}
