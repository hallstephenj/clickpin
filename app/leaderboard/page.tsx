'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Trophy, Plant, Storefront, MapPin, Lightning, Spinner } from '@phosphor-icons/react';
import { LeaderboardResponse, LeaderboardType, LeaderboardPeriod, LeaderboardEntry } from '@/types';
import { useSession } from '@/lib/hooks/useSession';

const TYPE_OPTIONS: { value: LeaderboardType; label: string; description: string; icon: typeof Plant }[] = [
  { value: 'seeds', label: 'seeds planted', description: 'Bitcoin conversations started', icon: Plant },
  { value: 'sprouts', label: 'sprouts confirmed', description: 'Merchants converted to Bitcoin', icon: Storefront },
  { value: 'locations', label: 'locations reached', description: 'Unique places visited', icon: MapPin },
];

const PERIOD_OPTIONS: { value: LeaderboardPeriod; label: string }[] = [
  { value: 'all_time', label: 'all time' },
  { value: 'month', label: 'this month' },
  { value: 'week', label: 'this week' },
];

export default function LeaderboardPage() {
  const { sessionId } = useSession();
  const [type, setType] = useState<LeaderboardType>('seeds');
  const [period, setPeriod] = useState<LeaderboardPeriod>('all_time');
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
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
    fetchLeaderboard();
  }, [fetchLeaderboard]);

  const currentTypeOption = TYPE_OPTIONS.find((t) => t.value === type);

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3 mb-4">
            <Trophy size={32} weight="fill" className="text-[var(--accent)]" />
            <h1 className="text-2xl font-bold text-[var(--fg)]">Leaderboard</h1>
          </div>
          <p className="text-sm text-muted max-w-lg">
            Track the top Bitcoin advocates in the community. Rankings are based on
            real-world actions: planting seeds (starting conversations about Bitcoin),
            confirming sprouts (reporting merchants that now accept Bitcoin), and
            reaching new locations.
          </p>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Explanation cards */}
        <div className="grid gap-3 mb-6">
          {TYPE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const isActive = type === option.value;
            return (
              <button
                key={option.value}
                onClick={() => setType(option.value)}
                className={`p-4 border text-left transition-colors ${
                  isActive
                    ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                    : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    size={24}
                    weight={isActive ? 'fill' : 'regular'}
                    className={isActive ? 'text-[var(--accent)]' : 'text-muted'}
                  />
                  <div>
                    <div className={`font-mono text-sm ${isActive ? 'text-[var(--fg)]' : 'text-muted'}`}>
                      {option.label}
                    </div>
                    <div className="text-xs text-faint">{option.description}</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* Period selector */}
        <div className="flex gap-1 mb-6">
          {PERIOD_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setPeriod(option.value)}
              className={`flex-1 py-2 px-3 text-xs font-mono border transition-colors ${
                period === option.value
                  ? 'border-[var(--accent)] text-[var(--fg)] bg-[var(--bg-alt)]'
                  : 'border-[var(--border)] text-muted hover:border-[var(--accent)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {/* Leaderboard */}
        <div className="border border-[var(--border)]">
          <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-alt)]">
            <div className="flex items-center gap-2">
              {currentTypeOption && (
                <>
                  <currentTypeOption.icon size={16} weight="fill" className="text-[var(--accent)]" />
                  <span className="font-mono text-sm text-muted">{currentTypeOption.label}</span>
                </>
              )}
            </div>
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <Spinner size={24} className="animate-spin text-muted" />
            </div>
          )}

          {error && (
            <div className="p-8 text-center">
              <p className="text-sm text-danger font-mono">{error}</p>
            </div>
          )}

          {!loading && !error && data && (
            <>
              {data.entries.length === 0 ? (
                <div className="p-8 text-center">
                  <p className="text-sm text-muted font-mono">no entries yet</p>
                  <p className="text-xs text-faint font-mono mt-2">
                    be the first to {type === 'seeds' ? 'plant a seed' : type === 'sprouts' ? 'report a sprout' : 'visit a location'}!
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-[var(--border)]">
                  {data.entries.map((entry) => (
                    <LeaderboardRow key={entry.identity_id} entry={entry} type={type} />
                  ))}
                </div>
              )}

              {/* Current user position if not in top 50 */}
              {data.current_user_rank && data.current_user_rank > 50 && (
                <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-alt)]">
                  <p className="text-sm text-muted font-mono text-center">
                    your rank: #{data.current_user_rank} ({data.current_user_count}{' '}
                    {type === 'locations' ? 'locations' : type})
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Link wallet prompt */}
        <div className="mt-6 p-4 border border-[var(--border)] bg-[var(--bg-alt)]">
          <div className="flex items-start gap-3">
            <Lightning size={20} className="text-[var(--accent)] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-[var(--fg)] font-mono">want to appear on the leaderboard?</p>
              <p className="text-xs text-muted mt-1">
                Link your Lightning wallet to track your contributions across devices and earn your place on the leaderboard.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="mt-8 pb-6 px-8 flex flex-wrap justify-center gap-x-3 sm:gap-x-6 gap-y-2 text-xs text-faint">
        <Link href="/" className="hover:text-[var(--fg-muted)] transition-colors">home</Link>
        <Link href="/map" className="hover:text-[var(--fg-muted)] transition-colors">map</Link>
        <Link href="/about" className="hover:text-[var(--fg-muted)] transition-colors">about</Link>
        <Link href="/terms" className="hover:text-[var(--fg-muted)] transition-colors">terms</Link>
        <Link href="/privacy" className="hover:text-[var(--fg-muted)] transition-colors">privacy</Link>
      </footer>
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
      <div className="w-10 text-center">
        {entry.rank <= 3 ? (
          <span
            className={`text-lg ${
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
          <span className="text-sm text-muted font-mono">#{entry.rank}</span>
        )}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          {isLinked && (
            <Lightning size={12} weight="fill" className="text-[var(--accent)] flex-shrink-0" />
          )}
          <span className="text-sm font-mono text-[var(--fg)] truncate">
            @{displayName}
          </span>
          {entry.is_current_user && (
            <span className="text-xs text-muted font-mono ml-1">(you)</span>
          )}
        </div>
      </div>

      {/* Count */}
      <div className="text-right">
        <span className="text-lg font-mono font-bold text-[var(--fg)]">
          {entry.count}
        </span>
        <span className="text-xs text-muted font-mono ml-1">
          {type === 'seeds'
            ? entry.count === 1 ? 'seed' : 'seeds'
            : type === 'sprouts'
            ? entry.count === 1 ? 'sprout' : 'sprouts'
            : entry.count === 1 ? 'location' : 'locations'}
        </span>
      </div>
    </div>
  );
}
