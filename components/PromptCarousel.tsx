'use client';

import { useState, useEffect, useMemo, useRef } from 'react';

const PROMPTS = [
  // Original 4
  "what's good to eat here?",
  "lost something?",
  "notice something sus?",
  "found something?",
  // Additional 15
  "anyone else hear that?",
  "need a hand with something?",
  "good vibes to share?",
  "looking for recommendations?",
  "what's the deal with...?",
  "anyone know a good...?",
  "heads up about something?",
  "selling or giving away?",
  "need to borrow something?",
  "who else is going to...?",
  "recognize this person/pet?",
  "what's opening soon?",
  "what happened here?",
  "anyone want to...?",
  "local pro tip?",
];

// Fisher-Yates shuffle
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function PromptCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Shuffle prompts on mount
  const prompts = useMemo(() => shuffleArray(PROMPTS), []);

  // Check for reduced motion preference
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mediaQuery.addEventListener('change', handler);
    return () => mediaQuery.removeEventListener('change', handler);
  }, []);

  // Auto-advance carousel
  useEffect(() => {
    if (prefersReducedMotion) return;

    const advance = () => {
      setIsAnimating(true);

      // Wait for fade out, then change content and fade in
      timeoutRef.current = setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % prompts.length);
        setIsAnimating(false);
      }, 1000); // Half of total transition (fade out)
    };

    const interval = setInterval(advance, 4000); // Total display time

    return () => {
      clearInterval(interval);
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [prompts.length, prefersReducedMotion]);

  // For reduced motion, just show center prompt
  if (prefersReducedMotion) {
    return (
      <div className="prompt-carousel" aria-hidden="true">
        <div className="prompt-static">
          {prompts[currentIndex]}
        </div>
      </div>
    );
  }

  const getPrompt = (offset: number) => {
    const index = (currentIndex + offset + prompts.length) % prompts.length;
    return prompts[index];
  };

  return (
    <div className="prompt-carousel" aria-hidden="true">
      {/* Ambient glow behind */}
      <div className="prompt-glow" />

      {/* The rotating prompts */}
      <div className="prompt-track">
        <div className={`prompt-slide prompt-prev ${isAnimating ? 'slide-up' : ''}`}>
          {getPrompt(-1)}
        </div>
        <div className={`prompt-slide prompt-current ${isAnimating ? 'fade-out' : 'fade-in'}`}>
          {getPrompt(0)}
        </div>
        <div className={`prompt-slide prompt-next ${isAnimating ? 'slide-up' : ''}`}>
          {getPrompt(1)}
        </div>
      </div>
    </div>
  );
}
