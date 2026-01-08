'use client';

import { useState, useEffect, useCallback } from 'react';
import { GhostFeedResponse } from '@/types';

interface UseGhostsOptions {
  city?: string;
  lat?: number;
  lng?: number;
}

interface UseGhostsResult {
  data: GhostFeedResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useGhosts(options: UseGhostsOptions = {}): UseGhostsResult {
  const [data, setData] = useState<GhostFeedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGhosts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (options.city) params.set('city', options.city);
      if (options.lat !== undefined) params.set('lat', String(options.lat));
      if (options.lng !== undefined) params.set('lng', String(options.lng));

      const url = `/api/ghosts${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error('Failed to fetch ghost feed');
      }

      const json = await response.json();
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, [options.city, options.lat, options.lng]);

  useEffect(() => {
    fetchGhosts();
  }, [fetchGhosts]);

  return {
    data,
    loading,
    error,
    refresh: fetchGhosts,
  };
}
