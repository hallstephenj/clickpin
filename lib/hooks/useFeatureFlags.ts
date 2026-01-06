'use client';

import { useState, useEffect, useCallback } from 'react';
import { FeatureFlags } from '@/types';
import { DEFAULT_FLAGS } from '@/lib/featureFlags';

interface UseFeatureFlagsResult {
  flags: FeatureFlags;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useFeatureFlags(): UseFeatureFlagsResult {
  const [flags, setFlags] = useState<FeatureFlags>(DEFAULT_FLAGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFlags = useCallback(async () => {
    try {
      const response = await fetch('/api/feature-flags');
      if (!response.ok) {
        throw new Error('Failed to fetch feature flags');
      }
      const data = await response.json();
      setFlags(data.flags);
      setError(null);
    } catch (err) {
      console.error('Error fetching feature flags:', err);
      setError('Failed to load feature flags');
      // Keep using default/cached flags on error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFlags();
  }, [fetchFlags]);

  return {
    flags,
    loading,
    error,
    refresh: fetchFlags,
  };
}
