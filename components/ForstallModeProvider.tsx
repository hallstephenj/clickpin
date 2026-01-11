'use client';

import { useEffect } from 'react';
import { useFeatureFlags } from '@/lib/hooks/useFeatureFlags';

export function ForstallModeProvider({ children }: { children: React.ReactNode }) {
  const { flags, loading } = useFeatureFlags();

  useEffect(() => {
    if (loading) return;

    const html = document.documentElement;
    const body = document.body;

    if (flags.FORSTALL_MODE) {
      html.classList.add('forstall-mode');
      body.classList.add('forstall-mode');
    } else {
      html.classList.remove('forstall-mode');
      body.classList.remove('forstall-mode');
    }

    return () => {
      html.classList.remove('forstall-mode');
      body.classList.remove('forstall-mode');
    };
  }, [flags.FORSTALL_MODE, loading]);

  return <>{children}</>;
}
