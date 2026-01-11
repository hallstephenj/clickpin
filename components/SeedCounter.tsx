'use client';

import { useState, useEffect } from 'react';
import { Plant, CaretDown, CaretUp } from '@phosphor-icons/react';
import type { SeedCount } from '@/types';

interface SeedCounterProps {
  locationId: string;
}

export function SeedCounter({ locationId }: SeedCounterProps) {
  const [seedCount, setSeedCount] = useState<SeedCount | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    async function fetchSeedCount() {
      try {
        const response = await fetch(`/api/seed/count?location_id=${locationId}`);
        if (response.ok) {
          const data: SeedCount = await response.json();
          setSeedCount(data);
        }
      } catch (error) {
        console.error('Error fetching seed count:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchSeedCount();
  }, [locationId]);

  if (loading || !seedCount || seedCount.total === 0) {
    return null;
  }

  return (
    <div className="bg-[var(--bg-alt)] border border-[var(--border)] px-4 py-3 mb-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Plant size={18} weight="fill" className="text-green-600" />
          <span className="text-sm">
            <strong>{seedCount.total}</strong>{' '}
            {seedCount.total === 1 ? 'person has' : 'people have'} asked this location to accept bitcoin.
          </span>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-1 text-xs text-muted hover:text-[var(--fg)] transition-colors"
        >
          {expanded ? (
            <>
              <CaretUp size={12} />
              Hide
            </>
          ) : (
            <>
              <CaretDown size={12} />
              Learn how to help
            </>
          )}
        </button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t border-[var(--border)]">
          <div className="flex gap-4 mb-3 text-xs text-muted">
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {seedCount.outcomes.positive} positive
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
              {seedCount.outcomes.neutral} neutral
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-400"></span>
              {seedCount.outcomes.negative} not interested
            </span>
          </div>
          <a
            href="/advocacy"
            className="text-sm text-accent hover:underline font-medium"
          >
            View advocacy resources →
          </a>
        </div>
      )}
    </div>
  );
}
