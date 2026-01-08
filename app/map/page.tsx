'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Lightning } from '@phosphor-icons/react';

// Dynamically import the map component to avoid SSR issues with Leaflet
const LocationMap = dynamic(
  () => import('@/components/LocationMap').then((mod) => mod.LocationMap),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-full flex items-center justify-center bg-[#fafafa] dark:bg-[#0a0a0a]">
        <div className="font-mono text-sm text-muted">loading map...</div>
      </div>
    ),
  }
);

export default function MapPage() {
  return (
    <div className="h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 border-b border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a] px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/" className="text-accent font-bold text-lg hover:opacity-80">
              <Lightning size={24} weight="fill" />
            </Link>
            <h1 className="font-bold text-[var(--fg)]">nearby boards</h1>
          </div>
          <Link href="/" className="btn">
            ← back
          </Link>
        </div>
      </header>

      {/* Map container - explicit height needed for Leaflet */}
      <div className="flex-1 relative min-h-0">
        <LocationMap />
      </div>

      {/* Footer hint */}
      <footer className="flex-shrink-0 border-t border-[var(--border)] px-4 py-3">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-xs text-faint font-mono">
            visit a location to access its board
          </div>
          <div className="text-[10px] text-faint mt-1">
            Merchant data provided by <a href="https://btcmap.org" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--fg-muted)]">BTC Map</a> (AGPL-3.0 open-source project)
          </div>
        </div>
      </footer>
    </div>
  );
}
