'use client';

import { useMemo } from 'react';

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

  const locationText = location.city
    ? `${location.name}, ${location.city}`
    : location.name;

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a]">
        <div className="max-w-lg mx-auto px-4 py-4">
          <a href="/" className="text-lg font-bold text-[var(--fg)]">
            <span className="text-accent">&#x26A1;</span> clickpin
          </a>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">
        {/* Pin Card */}
        <div className="shared-pin-card">
          {isRemoved ? (
            <div className="shared-pin-removed">
              <p className="text-muted text-center py-8">
                this pin was removed
              </p>
            </div>
          ) : (
            <>
              {/* Doodle */}
              {pin?.doodle_data && (
                <div className="shared-pin-doodle">
                  <img src={pin.doodle_data} alt="" />
                </div>
              )}

              {/* Body */}
              <p className="shared-pin-body">
                {pin?.badge && (
                  <span className="paperweight-badge">{pin.badge}</span>
                )}
                {pin?.body}
              </p>
            </>
          )}

          {/* Location and time */}
          <div className="shared-pin-meta">
            <div className="shared-pin-location">{locationText}</div>
            {!isRemoved && fuzzyTime && (
              <div className="shared-pin-time">{fuzzyTime}</div>
            )}
          </div>
        </div>

        {/* Reply count - only if pin is visible */}
        {!isRemoved && replyCount > 0 && (
          <div className="shared-pin-replies">
            {replyCount} {replyCount === 1 ? 'reply' : 'replies'} &middot;{' '}
            <span className="text-muted">visit location to see replies</span>
          </div>
        )}

        {/* Explanation box */}
        <div className="shared-pin-explainer">
          <p className="shared-pin-explainer-text">
            <strong>clickpin</strong> is an anonymous, hyperlocal message board.
            posts are tied to physical locations &mdash; you can only see and
            create posts when you&apos;re actually there.
          </p>

          {locationPinCount > 0 && (
            <p className="shared-pin-explainer-count">
              {locationPinCount} {locationPinCount === 1 ? 'post' : 'posts'} at
              this location right now
            </p>
          )}

          <a
            href={`/map?lat=${location.lat}&lng=${location.lng}`}
            className="btn btn-primary shared-pin-map-btn"
          >
            view on map
          </a>
        </div>

        {/* Footer links */}
        <div className="shared-pin-footer">
          <a href="/">home</a>
          <a href="/about">about</a>
          <a href="/terms">terms</a>
          <a href="/privacy">privacy</a>
        </div>
      </main>
    </div>
  );
}
