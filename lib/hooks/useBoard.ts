'use client';

import { useState, useEffect, useCallback } from 'react';
import { Pin, Location } from '@/types';
import { supabase } from '@/lib/supabase';

interface UseBoardResult {
  pins: Pin[];
  hiddenPins: Pin[];
  loading: boolean;
  error: string | null;
  refreshBoard: () => Promise<void>;
}

export function useBoard(
  slug: string | null,
  sessionId: string | null
): UseBoardResult {
  const [pins, setPins] = useState<Pin[]>([]);
  const [hiddenPins, setHiddenPins] = useState<Pin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBoard = useCallback(async () => {
    if (!slug || !sessionId) return;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/board?slug=${encodeURIComponent(slug)}&session_id=${encodeURIComponent(sessionId)}`
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error || 'Failed to load board');
        return;
      }

      setPins(data.pins || []);
      setHiddenPins(data.hiddenPins || []);
    } catch (err) {
      console.error('Failed to fetch board:', err);
      setError('Failed to load board. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [slug, sessionId]);

  // Initial fetch
  useEffect(() => {
    if (slug && sessionId) {
      fetchBoard();
    }
  }, [slug, sessionId, fetchBoard]);

  // Realtime subscription
  useEffect(() => {
    if (!slug) return;

    // Subscribe to changes on the pins table
    const channel = supabase
      .channel(`board:${slug}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'pins',
        },
        (payload) => {
          console.log('Realtime event:', payload);
          // Refresh board on any pin change
          // In production, you might want to be more surgical about updates
          fetchBoard();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [slug, fetchBoard]);

  return {
    pins,
    hiddenPins,
    loading,
    error,
    refreshBoard: fetchBoard,
  };
}
