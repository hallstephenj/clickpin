'use client';

import { useState, useEffect, useCallback } from 'react';
import { X, Trophy, Plant, Storefront, MapPin, Lightning, Spinner } from '@phosphor-icons/react';
import { LeaderboardResponse, LeaderboardType, LeaderboardPeriod, LeaderboardEntry } from '@/types';

interface LeaderboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  onLinkWallet?: () => void;
}

const TYPE_OPTIONS: { value: LeaderboardType; label: string; icon: typeof Plant }[] = [
  { value: 'seeds', label: 'seeds', icon: Plant },
  { value: 'sprouts', label: 'sprouts', icon: Storefront },
  { value: 'locations', label: 'locations', icon: MapPin },
];

const PERIOD_OPTIONS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'all_time', label: 'all time' },
  { value: 'month', label: 'this month' },
  { value: 'week', label: 'this week' },
];

export function LeaderboardModal({ isOpen, onClose, sessionId, onLinkWallet }: LeaderboardModalProps) {
  const [type, setType] = useState<LeaderboardType>('seeds');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all_time');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        type,
        period,
        limit: '50',
      });
      if (sessionId) {
        params.set('device_session_id', sessionId);
      }

      const response = await fetch(`/api/lnurl/leaderboard?${params}`);

      if (!response.ok) {
        if (response.status === 403) {
          setError('Leaderboard feature not available');
          return;
        }
        throw new Error('Failed to fetch leaderboard');
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching leaderboard:', err);
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [type, period, sessionId]);

  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard();
    }
  }, [isOpen, fetchLeaderboard]);

  if (!isOpen) return null;

  const TypeIcon = TYPE_OPTIONS.find((t) => t.value === type)?.icon || Plant;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-start justify-center z-50 p-4 pt-10">
      <div className="bg-[#fafafa] dark:bg-[#0a0a0a] border border-[var(--border)] w-full max-w-md max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--border)]">
          <div className="flex items-center gap-2">
            <Trophy size={16} weight="fill" className="text-[var(--accent)]" />
            <span className="font-mono text-sm text-muted">leaderboard</span>
          </div>
          <button onClick={onClose} className="text-muted hover:text-[var(--fg)] leading-none">
            <X size={18} />
          </button>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-[var(--border)] space-y-3">
          {/* Type selector */}
          <div className="flex gap-1">
            {TYPE_OPTIONS.map((option) => {
              const Icon = option.icon;
              return (
                <button
                  key={option.value}
                  onClick={() => setType(option.value)}
                  className={`flex-1 py-2 px-3 text-xs font-mono flex items-center justify-center gap-1 border transition-colors ${
                    type === option.value
                      ? 'border-[var(--accent)] text-[var(--fg)] bg-[var(--bg-alt)]'
                      : 'border-[var(--border)] text-muted hover:border-[var(--accent)]'
                  }`}
                >
                  <Icon size={14} weight={type === option.value ? 'fill' : 'regular'} />
                  {option.label}
                </button>
              );
            })}
          </div>

          {/* Period selector */}
          <div className="flex gap-1">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.value}
                onClick={() => setPeriod(option.value)}
                className={`flex-1 py-1 px-2 text-xs font-mono border transition-colors ${
                  period === option.value
                    ? 'border-[var(--accent)] text-[var(--fg)]'
                    : 'border-[var(--border)] text-muted hover:border-[var(--accent)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex justify-center py-8">
              <Spinner size={24} className="animate-spin text-muted" />
            </div>
          )}

          {error && (
            <div className="p-4 text-center">
              <p className="text-xs text-danger font-mono">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {data.entries.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-muted font-mono">no entries yet</p>
                  <p className="text-xs text-faint font-mono mt-1">
                    be the first to plant a seed!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {data.entries.map((entry) => (
                    <LeaderboardRow
                      key={entry.identity_id}
                      entry={entry}
                      type={type}
                    />
                  ))}
                </div>
              )}

              {/* Current user position if not in top 50 */}
              {data.current_user_rank && data.current_user_rank > 50 && (
                <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-alt)]">
                  <p className="text-xs text-muted font-mono text-center">
                    your rank: #{data.current_user_rank} ({data.current_user_count}{' '}
                    {type === 'locations' ? 'locations' : type})
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer - Link wallet prompt */}
        {onLinkWallet && (
          <div className="px-4 py-3 border-t border-[var(--border)] bg-[var(--bg-alt)]">
            <button
              onClick={onLinkWallet}
              className="w-full flex items-center justify-center gap-2 text-xs font-mono text-muted hover:text-[var(--fg)]"
            >
              <Lightning size={14} />
              link wallet to appear on leaderboard
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LeaderboardRow({
  entry,
  type,
}: {
  entry: LeaderboardEntry;
  type: LeaderboardType;
}) {
  const displayName = entry.display_name || entry.anon_nym;
  const isLinked = entry.display_name !== null;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3 ${
        entry.is_current_user ? 'bg-[var(--accent)]/10' : ''
      }`}
    >
      {/* Rank */}
      <div className="w-8 text-center">
        {entry.rank <= 3 ? (
          <span
            className={`text-sm font-mono font-bold ${
              entry.rank === 1
                ? 'text-yellow-500'
                : entry.rank === 2
                ? 'text-gray-400'
                : 'text-amber-700'
            }`}
          >
            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : '🥉'}
          </span>
        ) : (
          <span className="text-xs text-muted font-mono">#{entry.rank}</span>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {isLinked && (
            <Lightning size={10} weight="fill" className="text-[var(--accent)] flex-shrink-0" />
          )}
          <span className="text-sm font-mono text-[var(--fg)] truncate">
            @{displayName}
          </span>
          {entry.is_current_user && (
            <span className="text-xs text-muted font-mono">(you)</span>
          )}
        </div>
      </div>

      {/* Count */}
      <div className="text-right">
        <span className="text-sm font-mono font-bold text-[var(--fg)]">
          {entry.count}
        </span>
        <span className="text-xs text-muted font-mono ml-1">
          {type === 'seeds' ? (entry.count === 1 ? 'seed' : 'seeds') :
           type === 'sprouts' ? (entry.count === 1 ? 'sprout' : 'sprouts') :
           type === 'locations' ? (entry.count === 1 ? 'loc' : 'locs') : ''}
        </span>
      </div>
    </div>
  );
}
