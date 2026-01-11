'use client';

import { useEffect, useState, useLayoutEffect } from 'react';
import { DesignTheme } from '@/types';

const THEME_CACHE_KEY = 'clickpin_theme';

// Apply theme immediately to prevent flash
function applyTheme(theme: DesignTheme) {
  const html = document.documentElement;
  const body = document.body;

  html.classList.remove('forstall-mode', 'neo2026-mode');
  body.classList.remove('forstall-mode', 'neo2026-mode');

  if (theme === 'forstall') {
    html.classList.add('forstall-mode');
    body.classList.add('forstall-mode');
  } else if (theme === 'neo2026') {
    html.classList.add('neo2026-mode');
    body.classList.add('neo2026-mode');
  }
}

export function ForstallModeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<DesignTheme>(() => {
    // Try to get cached theme immediately (only runs on client)
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem(THEME_CACHE_KEY) as DesignTheme | null;
      if (cached && ['mono', 'forstall', 'neo2026'].includes(cached)) {
        return cached;
      }
    }
    return 'mono';
  });
  const [loading, setLoading] = useState(true);

  // Apply cached theme immediately before paint
  useLayoutEffect(() => {
    const cached = localStorage.getItem(THEME_CACHE_KEY) as DesignTheme | null;
    if (cached && ['mono', 'forstall', 'neo2026'].includes(cached)) {
      applyTheme(cached);
    }
  }, []);

  useEffect(() => {
    async function fetchTheme() {
      try {
        const res = await fetch('/api/app-settings');
        const data = await res.json();
        if (data.settings?.design_theme) {
          const newTheme = data.settings.design_theme as DesignTheme;
          setTheme(newTheme);
          // Cache for next page load
          localStorage.setItem(THEME_CACHE_KEY, newTheme);
        }
      } catch (error) {
        console.error('Failed to fetch app settings:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchTheme();
  }, []);

  useEffect(() => {
    if (loading) return;

    const html = document.documentElement;
    const body = document.body;

    // Check current state to avoid unnecessary DOM manipulation
    const hasForstall = html.classList.contains('forstall-mode');
    const hasNeo2026 = html.classList.contains('neo2026-mode');

    // Only manipulate DOM if something actually needs to change
    if (theme === 'mono' && !hasForstall && !hasNeo2026) {
      // Already in mono state, nothing to do
      return;
    }

    // Remove all theme classes first
    html.classList.remove('forstall-mode', 'neo2026-mode');
    body.classList.remove('forstall-mode', 'neo2026-mode');

    // Apply theme class based on selection
    if (theme === 'forstall') {
      html.classList.add('forstall-mode');
      body.classList.add('forstall-mode');
    } else if (theme === 'neo2026') {
      html.classList.add('neo2026-mode');
      body.classList.add('neo2026-mode');
    }
    // 'mono' is the default - no special class needed

    return () => {
      html.classList.remove('forstall-mode', 'neo2026-mode');
      body.classList.remove('forstall-mode', 'neo2026-mode');
    };
  }, [theme, loading]);

  return <>{children}</>;
}
