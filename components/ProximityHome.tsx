'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { GeolocationState } from '@/types';
import { RequestLocationModal } from './RequestLocationModal';

// Dynamically import map to avoid SSR issues
const ProximityMiniMap = dynamic(
  () => import('@/components/ProximityMiniMap').then(mod => mod.ProximityMiniMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[200px] rounded-lg bg-[var(--bg-alt)] border border-[var(--border)] flex items-center justify-center">
        <span className="text-muted text-sm font-mono">loading map...</span>
      </div>
    ),
  }
);

interface NearbyBoard {
  id: string;
  name: string;
  slug: string;
  distance_m: number;
  pins_last_hour: number;
  pins_today: number;
  active_sessions: number;
  lat: number;
  lng: number;
  radius_m: number;
  btcmap_id?: number | null;
  is_bitcoin_merchant?: boolean;
  website?: string | null;
}

interface ProximityStats {
  boards_within_mile: number;
  total_pins_last_hour: number;
  trending_board: { name: string; active_users: number } | null;
  nearby_boards: NearbyBoard[];
  user_lat: number;
  user_lng: number;
  expanded_search: boolean;
}

interface ProximityHomeProps {
  state: GeolocationState;
  onRequestLocation: () => void;
  sessionId: string | null;
}

function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

export function ProximityHome({ state, onRequestLocation, sessionId }: ProximityHomeProps) {
  const [stats, setStats] = useState<ProximityStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);

  const hasPosition = state.position !== null;
  const userLat = state.position?.coords.latitude;
  const userLng = state.position?.coords.longitude;

  // Fetch proximity stats when we have a position
  useEffect(() => {
    if (!userLat || !userLng) return;

    setLoading(true);
    fetch(`/api/proximity-stats?lat=${userLat}&lng=${userLng}`)
      .then(res => res.json())
      .then(data => {
        if (!data.error) {
          setStats(data);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [userLat, userLng]);

  const boardsCount = stats?.boards_within_mile || 0;
  const nearbyBoards = stats?.nearby_boards || [];

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-1">
            <span className="text-accent">⚡</span> clickpin
          </h1>
          <p className="text-muted text-sm font-mono">
            the bitcoin underground
          </p>
        </div>

        {/* Main content */}
        <div className="border border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a] p-6">
          {/* Discovery message - NOT red/error style */}
          <div className="text-center mb-6">
            <div className="text-lg font-semibold text-[var(--fg)] mb-1">
              You're in uncharted territory!
            </div>
            {loading ? (
              <div className="text-muted text-sm font-mono">checking nearby...</div>
            ) : boardsCount > 0 ? (
              <div className="text-muted text-sm">
                but there {boardsCount === 1 ? 'is' : 'are'}{' '}
                <span className="text-accent font-semibold">{boardsCount} board{boardsCount !== 1 ? 's' : ''}</span>{' '}
                {stats?.expanded_search ? 'within 10km' : 'within reach'}
              </div>
            ) : (
              <div className="text-muted text-sm">
                no boards nearby yet — be the first to start one
              </div>
            )}
          </div>

          {/* Mini map */}
          {hasPosition && userLat && userLng && (
            <div className="mb-6">
              <ProximityMiniMap
                userLat={userLat}
                userLng={userLng}
                locations={nearbyBoards.map(b => ({
                  id: b.id,
                  name: b.name,
                  lat: b.lat,
                  lng: b.lng,
                  radius_m: b.radius_m,
                  btcmap_id: b.btcmap_id,
                  is_bitcoin_merchant: b.is_bitcoin_merchant,
                }))}
              />
            </div>
          )}

          {/* Nearby board stats boxes */}
          {nearbyBoards.length > 0 && (
            <div className="space-y-2 mb-6">
              {nearbyBoards.slice(0, 3).map(board => (
                <div
                  key={board.id}
                  className="p-3 bg-[var(--bg-alt)] border border-[var(--border)] rounded"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm text-[var(--fg)] truncate flex items-center gap-1.5">
                        <span>{board.name}</span>
                        {(board.btcmap_id || board.is_bitcoin_merchant) && (
                          <span className="text-[#f7931a] text-xs" title="Accepts Bitcoin">⚡</span>
                        )}
                        {board.website && (
                          <a
                            href={board.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="text-muted hover:text-accent transition-colors"
                            title="Visit website"
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="12"
                              height="12"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        )}
                      </div>
                      <div className="text-xs text-muted font-mono">
                        {formatDistance(board.distance_m)} away
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {board.active_sessions > 0 ? (
                          <div className="text-xs text-accent font-mono">
                            {board.active_sessions} active now
                          </div>
                        ) : board.pins_today > 0 ? (
                          <div className="text-xs text-muted font-mono">
                            {board.pins_today} pins today
                          </div>
                        ) : (
                          <div className="text-xs text-faint font-mono">
                            quiet
                          </div>
                        )}
                      </div>
                      <a
                        href={`https://maps.apple.com/?daddr=${board.lat},${board.lng}`}
                        onClick={(e) => {
                          e.preventDefault();
                          // Try Apple Maps first (iOS), fall back to Google Maps
                          const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
                          const url = isIOS
                            ? `maps://maps.apple.com/?daddr=${board.lat},${board.lng}`
                            : `https://www.google.com/maps/dir/?api=1&destination=${board.lat},${board.lng}`;
                          window.open(url, '_blank');
                        }}
                        className="p-2 text-muted hover:text-accent transition-colors"
                        title={`Navigate to ${board.name}`}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polygon points="3 11 22 2 13 21 11 13 3 11" />
                        </svg>
                      </a>
                    </div>
                  </div>
                </div>
              ))}

              {/* Legend */}
              {nearbyBoards.slice(0, 3).some(b => b.btcmap_id || b.is_bitcoin_merchant) && (
                <div className="flex items-center justify-center gap-4 text-xs text-faint font-mono pt-2">
                  <span className="flex items-center gap-1">
                    <span className="text-[#f7931a]">⚡</span> accepts bitcoin
                  </span>
                </div>
              )}

              {/* Aggregate stat if there are pins */}
              {stats && stats.total_pins_last_hour > 0 && (
                <div className="text-center text-xs text-muted font-mono pt-2">
                  {stats.total_pins_last_hour} pin{stats.total_pins_last_hour !== 1 ? 's' : ''} dropped nearby in the last hour
                </div>
              )}

              {/* Trending board if exists */}
              {stats?.trending_board && stats.trending_board.active_users > 1 && (
                <div className="text-center text-xs text-accent font-mono">
                  Trending: {stats.trending_board.name} ({stats.trending_board.active_users} users)
                </div>
              )}
            </div>
          )}

          {/* See full map link */}
          {nearbyBoards.length > 0 && (
            <div className="text-center mb-6">
              <Link
                href="/map"
                className="text-sm text-muted hover:text-accent transition-colors"
              >
                See the full map →
              </Link>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col gap-2">
            <button
              onClick={onRequestLocation}
              className="btn btn-primary w-full justify-center"
            >
              refresh location
            </button>

            {hasPosition && (
              <button
                onClick={() => setShowRequestModal(true)}
                className="btn w-full justify-center"
              >
                request this location
              </button>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-center gap-6 text-xs text-faint">
          <Link href="/map" className="hover:text-[var(--fg-muted)] transition-colors">nearby</Link>
          <Link href="/about" className="hover:text-[var(--fg-muted)] transition-colors">about</Link>
          <Link href="/terms" className="hover:text-[var(--fg-muted)] transition-colors">terms</Link>
          <Link href="/privacy" className="hover:text-[var(--fg-muted)] transition-colors">privacy</Link>
        </div>
      </div>

      {/* Request Location Modal */}
      {hasPosition && state.position && (
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
