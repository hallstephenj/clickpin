'use client';

import { useState, useEffect, useCallback } from 'react';

const SESSION_KEY = 'clickpin_device_session_id';

export function useSession() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const initSession = useCallback(async () => {
    try {
      // Check localStorage first
      const storedSessionId = localStorage.getItem(SESSION_KEY);

      const response = await fetch('/api/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: storedSessionId }),
      });

      if (!response.ok) {
        throw new Error('Failed to initialize session');
      }

      const data = await response.json();
      const newSessionId = data.session_id;

      // Store in localStorage
      localStorage.setItem(SESSION_KEY, newSessionId);
      setSessionId(newSessionId);
    } catch (error) {
      console.error('Session initialization error:', error);
      // Generate a fallback local session
      const fallbackId = `local_${Date.now()}_${Math.random().toString(36).slice(2)}`;
      localStorage.setItem(SESSION_KEY, fallbackId);
      setSessionId(fallbackId);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initSession();
  }, [initSession]);

  return { sessionId, loading };
}
