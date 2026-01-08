'use client';

import { useState, useEffect, useMemo } from 'react';

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
  const [isTransitioning, setIsTransitioning] = useState(false);

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

    const interval = setInterval(() => {
      setIsTransitioning(true);

      // After transition completes, update index
      setTimeout(() => {
        setCurrentIndex((prev) => (prev + 1) % prompts.length);
        setIsTransitioning(false);
      }, 800); // Match CSS transition duration
    }, 3000); // 3 seconds per prompt

    return () => clearInterval(interval);
  }, [prompts.length, prefersReducedMotion]);

  // Get visible prompts (previous, current, next)
  const getPromptAt = (offset: number) => {
    const index = (currentIndex + offset + prompts.length) % prompts.length;
    return prompts[index];
  };

  // For reduced motion, just show center prompt
  if (prefersReducedMotion) {
    return (
      <div className="prompt-carousel" aria-hidden="true">
        <div className="prompt-carousel-inner">
          <div className="prompt-item prompt-center">
            {prompts[currentIndex]}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="prompt-carousel" aria-hidden="true">
      <div className={`prompt-carousel-inner ${isTransitioning ? 'transitioning' : ''}`}>
        {/* Previous prompt (above, fading out when transitioning) */}
        <div className="prompt-item prompt-top">
          {getPromptAt(-1)}
        </div>

        {/* Current prompt (center) */}
        <div className="prompt-item prompt-center">
          {getPromptAt(0)}
        </div>

        {/* Next prompt (below) */}
        <div className="prompt-item prompt-bottom">
          {getPromptAt(1)}
        </div>

        {/* Incoming prompt (hidden below, slides up during transition) */}
        <div className="prompt-item prompt-incoming">
          {getPromptAt(2)}
        </div>
      </div>
    </div>
  );
}
