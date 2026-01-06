'use client';

import { useState } from 'react';
import { GeolocationState } from '@/types';
import { RequestLocationModal } from './RequestLocationModal';

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
  const isNoBoard = error && error.toLowerCase().includes('no clickpin board');
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
            location-locked posts
          </p>
        </div>

        {/* Status */}
        <div className="border border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a]">
          {isLoading ? (
            <div className="p-8 text-center">
              <div className="text-muted mb-2 font-mono text-sm">
                locating...
              </div>
              <div className="text-faint text-xs font-mono animate-pulse">
                ████████░░░░
              </div>
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
                      clickpin shows posts for your current location only.
                    </p>
                    <p className="text-faint text-xs font-mono">
                      your position is never stored
                    </p>
                  </>
                ) : canRequestLocation ? (
                  <p>
                    want to start a board here? request this as a new location.
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

                {canRequestLocation && (
                  <button
                    onClick={() => setShowRequestModal(true)}
                    className="btn w-full justify-center"
                  >
                    request as new location
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-faint font-mono">
          <a href="/map" className="hover:text-[var(--accent)]">find nearby boards</a>
          {' • '}
          <a href="/about" className="hover:text-[var(--accent)]">about</a>
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
