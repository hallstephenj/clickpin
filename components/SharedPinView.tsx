'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import { Lightning } from '@phosphor-icons/react';
import { getLocationLabel } from '@/lib/location-utils';

interface SharedPinData {
  pin: {
    id: string;
    body: string;
    doodle_data: string | null;
    badge: string | null;
    created_at: string;
  } | null;
  isRemoved: boolean;
  replyCount: number;
  location: {
    id: string;
    name: string;
    city: string | null;
    address: string | null;
    slug: string;
    lat: number;
    lng: number;
  };
  locationPinCount: number;
}

// Fuzzy, human timestamps
function getFuzzyTime(createdAt: string): string {
  const ageMs = Date.now() - new Date(createdAt).getTime();
  const minutes = ageMs / (1000 * 60);
  const hours = minutes / 60;
  const days = hours / 24;

  if (minutes < 2) return 'just now';
  if (minutes < 5) return 'a few moments ago';
  if (minutes < 15) return 'a few minutes ago';
  if (minutes < 45) return 'about half an hour ago';
  if (minutes < 90) return 'about an hour ago';
  if (hours < 3) return 'a couple hours ago';
  if (hours < 6) return 'a few hours ago';
  if (hours < 12) return 'earlier today';
  if (hours < 24) return 'today';
  if (hours < 48) return 'yesterday';
  if (days < 7) return 'a few days ago';
  if (days < 14) return 'about a week ago';
  if (days < 30) return 'a few weeks ago';
  return 'a while ago';
}

export function SharedPinView({ data }: { data: SharedPinData }) {
  const { pin, isRemoved, replyCount, location, locationPinCount } = data;

  const fuzzyTime = useMemo(
    () => (pin ? getFuzzyTime(pin.created_at) : null),
    [pin]
  );

  const locationLabel = getLocationLabel(location);
  const locationText = locationLabel
    ? `${location.name}, ${locationLabel}`
    : location.name;

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[var(--border)]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80">
            <Lightning size={20} weight="fill" className="text-[#f7931a]" />
            <span className="font-bold">clickpin</span>
          </Link>
          <Link href="/about" className="btn">
            what is this?
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-8">
        {/* Location header */}
        <div className="mb-6">
          <div className="text-xs text-[var(--fg-faint)] font-mono uppercase tracking-wider mb-1">
            shared from
          </div>
          <h1 className="text-xl font-bold">{locationText}</h1>
        </div>

        {/* The Pin */}
        {isRemoved ? (
          <div className="border border-[var(--border)] bg-[var(--bg-alt)] p-6 mb-6">
            <p className="text-[var(--fg-muted)] text-center italic">
              this post was removed
            </p>
          </div>
        ) : (
          <div className="border border-[var(--border)] bg-[var(--bg-alt)] p-5 mb-6">
            {/* Doodle */}
            {pin?.doodle_data && (
              <div className="mb-4">
                <img
                  src={pin.doodle_data}
                  alt=""
                  className="max-w-full max-h-48 object-contain"
                />
              </div>
            )}

            {/* Badge + Body */}
            <p className="text-lg leading-relaxed">
              {pin?.badge && (
                <span className="inline-block text-[10px] font-medium uppercase tracking-wide text-[#8a7a60] bg-[rgba(100,80,50,0.08)] px-1.5 py-0.5 mr-2 rounded-sm align-middle">
                  {pin.badge}
                </span>
              )}
              {pin?.body}
            </p>

            {/* Time */}
            <div className="mt-4 pt-3 border-t border-[var(--border)]">
              <span className="text-sm text-[var(--fg-muted)]">{fuzzyTime}</span>
            </div>
          </div>
        )}

        {/* Reply count */}
        {!isRemoved && replyCount > 0 && (
          <div className="text-sm text-[var(--fg-muted)] mb-8 flex items-center gap-2">
            <span className="text-[#f7931a]">→</span>
            <span>
              {replyCount} {replyCount === 1 ? 'reply' : 'replies'} &mdash; visit location to see them
            </span>
          </div>
        )}

        {/* What is clickpin section */}
        <section className="mb-8">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            what is clickpin?
          </h2>
          <div className="space-y-3 text-[var(--fg-muted)]">
            <p>
              clickpin is an anonymous, hyperlocal message board. posts are tied to
              physical locations — you can only see and create posts when you&apos;re
              actually there.
            </p>
            <p>
              think of it as peeking behind the curtain of the local underground. no accounts,
              no followers, no algorithms. just posts from people who have been where you are.
            </p>
          </div>
        </section>

        {/* This location */}
        <section className="mb-8">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            about this location
          </h2>
          <div className="space-y-4">
            {locationPinCount > 0 && (
              <p className="text-[var(--fg-muted)]">
                there {locationPinCount === 1 ? 'is' : 'are'}{' '}
                <span className="text-[#f7931a] font-medium">{locationPinCount}</span>{' '}
                {locationPinCount === 1 ? 'post' : 'posts'} at {location.name} right now.
              </p>
            )}
            <Link
              href={`/map?lat=${location.lat}&lng=${location.lng}`}
              className="btn btn-primary inline-flex items-center gap-2"
            >
              <span>view on map</span>
              <span>→</span>
            </Link>
          </div>
        </section>

        {/* How it works teaser */}
        <section className="mb-8">
          <h2 className="font-bold text-lg mb-3 border-b border-[var(--border)] pb-2">
            how it works
          </h2>
          <div className="space-y-3">
            <div className="flex gap-3">
              <span className="text-[#f7931a] font-mono font-bold">1.</span>
              <span className="text-[var(--fg-muted)]">allow location access</span>
            </div>
            <div className="flex gap-3">
              <span className="text-[#f7931a] font-mono font-bold">2.</span>
              <span className="text-[var(--fg-muted)]">find a nearby board</span>
            </div>
            <div className="flex gap-3">
              <span className="text-[#f7931a] font-mono font-bold">3.</span>
              <span className="text-[var(--fg-muted)]">post anonymously</span>
            </div>
          </div>
          <div className="mt-4">
            <Link href="/about" className="text-sm text-[#f7931a] hover:underline">
              learn more →
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] mt-8">
        <div className="max-w-2xl mx-auto px-8 py-6 flex flex-wrap justify-center gap-x-3 sm:gap-x-6 gap-y-2 text-xs text-faint">
          <Link href="/map" className="hover:text-[var(--fg-muted)] transition-colors">nearby</Link>
          <Link href="/leaderboard" className="hover:text-[var(--fg-muted)] transition-colors">leaderboard</Link>
          <Link href="/about" className="hover:text-[var(--fg-muted)] transition-colors">about</Link>
          <Link href="/terms" className="hover:text-[var(--fg-muted)] transition-colors">terms</Link>
          <Link href="/privacy" className="hover:text-[var(--fg-muted)] transition-colors">privacy</Link>
        </div>
      </footer>
    </div>
  );
}
