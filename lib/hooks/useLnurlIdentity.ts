'use client';

import { useState, useEffect, useCallback } from 'react';
import { LnurlIdentity } from '@/types';

interface UseLnurlIdentityResult {
  identity: LnurlIdentity | null;
  loading: boolean;
  error: string | null;
  isLinked: boolean;
  refetch: () => Promise<void>;
  updateDisplayName: (name: string | null) => Promise<void>;
  unlink: () => Promise<void>;
}

/**
 * Hook for managing LNURL identity state
 *
 * @param sessionId - The device session ID
 * @param enabled - Whether the LNURL_AUTH feature is enabled
 * @returns Identity state and actions
 */
export function useLnurlIdentity(
  sessionId: string | null,
  enabled: boolean = true
): UseLnurlIdentityResult {
  const [identity, setIdentity] = useState<LnurlIdentity | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIdentity = useCallback(async () => {
    if (!sessionId || !enabled) {
      setIdentity(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(
        `/api/lnurl/profile?device_session_id=${sessionId}`
      );

      if (!response.ok) {
        if (response.status === 403) {
          // Feature not enabled
          setIdentity(null);
          return;
        }
        throw new Error('Failed to fetch identity');
      }

      const data = await response.json();
      setIdentity(data.identity || null);
    } catch (err) {
      console.error('Error fetching identity:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch identity');
      setIdentity(null);
    } finally {
      setLoading(false);
    }
  }, [sessionId, enabled]);

  // Fetch identity on mount and when session changes
  useEffect(() => {
    fetchIdentity();
  }, [fetchIdentity]);

  const updateDisplayName = useCallback(
    async (name: string | null) => {
      if (!sessionId || !identity) {
        throw new Error('No identity to update');
      }

      const response = await fetch('/api/lnurl/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_session_id: sessionId,
          display_name: name,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update display name');
      }

      const data = await response.json();
      setIdentity(data.identity);
    },
    [sessionId, identity]
  );

  const unlink = useCallback(async () => {
    if (!sessionId) {
      throw new Error('No session to unlink');
    }

    const response = await fetch('/api/lnurl/profile', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        device_session_id: sessionId,
      }),
    });

    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || 'Failed to unlink identity');
    }

    setIdentity(null);
  }, [sessionId]);

  return {
    identity,
    loading,
    error,
    isLinked: identity !== null,
    refetch: fetchIdentity,
    updateDisplayName,
    unlink,
  };
}

/**
 * Hook for managing LNURL-auth flow
 * Used by the auth modal to create challenges and poll status
 */
interface UseLnurlAuthFlowResult {
  lnurl: string | null;
  k1: string | null;
  status: 'idle' | 'waiting' | 'verified' | 'expired' | 'error';
  error: string | null;
  identity: LnurlIdentity | null;
  startAuth: () => Promise<void>;
  reset: () => void;
}

export function useLnurlAuthFlow(sessionId: string | null): UseLnurlAuthFlowResult {
  const [lnurl, setLnurl] = useState<string | null>(null);
  const [k1, setK1] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'waiting' | 'verified' | 'expired' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [identity, setIdentity] = useState<LnurlIdentity | null>(null);

  const startAuth = useCallback(async () => {
    if (!sessionId) {
      setError('No session ID');
      setStatus('error');
      return;
    }

    try {
      setStatus('waiting');
      setError(null);

      // Create challenge
      const response = await fetch('/api/lnurl/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          device_session_id: sessionId,
          action: 'login',
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create challenge');
      }

      const data = await response.json();
      setLnurl(data.lnurl);
      setK1(data.k1);
    } catch (err) {
      console.error('Error starting auth:', err);
      setError(err instanceof Error ? err.message : 'Failed to start auth');
      setStatus('error');
    }
  }, [sessionId]);

  // Poll for status when waiting
  useEffect(() => {
    if (status !== 'waiting' || !k1) return;

    const pollInterval = setInterval(async () => {
      try {
        const response = await fetch(`/api/lnurl/status?k1=${k1}`);

        if (!response.ok) {
          throw new Error('Failed to check status');
        }

        const data = await response.json();

        if (data.status === 'verified') {
          setStatus('verified');
          setIdentity(data.identity || null);
          clearInterval(pollInterval);
        } else if (data.status === 'expired') {
          setStatus('expired');
          clearInterval(pollInterval);
        }
        // If still pending, continue polling
      } catch (err) {
        console.error('Error polling status:', err);
        // Don't stop polling on transient errors
      }
    }, 2000); // Poll every 2 seconds

    // Cleanup on unmount or status change
    return () => clearInterval(pollInterval);
  }, [status, k1]);

  const reset = useCallback(() => {
    setLnurl(null);
    setK1(null);
    setStatus('idle');
    setError(null);
    setIdentity(null);
  }, []);

  return {
    lnurl,
    k1,
    status,
    error,
    identity,
    startAuth,
    reset,
  };
}
