'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Lightning, Storefront, ArrowRight, SignOut } from '@phosphor-icons/react';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginForm } from '@/components/auth/LoginForm';
import { parseCityFromAddress } from '@/lib/location-utils';

interface ClaimedLocation {
  id: string;
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  claimed_at: string;
}

export default function MerchantPortalPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();

  const [locations, setLocations] = useState<ClaimedLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch claimed locations when user is authenticated
  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      setLoading(false);
      return;
    }

    async function fetchLocations() {
      try {
        const response = await fetch('/api/merchant/my-locations');
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load locations');
        }

        setLocations(data.locations || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load locations');
      } finally {
        setLoading(false);
      }
    }

    fetchLocations();
  }, [user, authLoading]);

  const handleSignOut = async () => {
    await signOut();
    setLocations([]);
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <p className="text-muted font-mono">loading...</p>
      </div>
    );
  }

  // Show login form if not authenticated
  if (!user) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Storefront size={28} weight="fill" className="text-accent" />
              <h1 className="text-2xl font-bold">merchant portal</h1>
            </div>
            <p className="text-muted text-sm font-mono">
              sign in to manage your claimed locations
            </p>
          </div>

          <LoginForm type="merchant" redirectTo="/merchant" />

          <div className="mt-8 text-center">
            <a href="/" className="text-sm text-muted hover:text-[var(--fg)] font-mono">
              back to home
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Authenticated view
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] pb-16">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Storefront size={24} weight="fill" className="text-accent" />
                <h1 className="font-bold text-lg">merchant portal</h1>
              </div>
              <p className="text-xs text-muted font-mono mt-1">{user.email}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="btn text-xs flex items-center gap-1"
            >
              <SignOut size={14} />
              sign out
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        <h2 className="font-mono text-sm text-muted mb-4">your locations</h2>

        {loading ? (
          <div className="border border-[var(--border)] p-8 text-center">
            <p className="text-muted font-mono">loading locations...</p>
          </div>
        ) : error ? (
          <div className="border border-[var(--danger)] bg-[var(--danger)]/10 p-6 text-center">
            <p className="text-danger font-mono">{error}</p>
          </div>
        ) : locations.length === 0 ? (
          <div className="border border-[var(--border)] p-8 text-center">
            <Storefront size={48} className="mx-auto mb-4 text-muted" />
            <p className="font-mono mb-2">no claimed locations</p>
            <p className="text-sm text-muted font-mono mb-4">
              claim a bitcoin merchant location to manage it here
            </p>
            <a href="/" className="btn btn-primary inline-flex items-center gap-1">
              <Lightning size={16} weight="fill" />
              explore locations
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {locations.map((loc) => (
              <button
                key={loc.id}
                onClick={() => router.push(`/merchant/${loc.slug}`)}
                className="w-full border border-[var(--border)] hover:border-[var(--accent)] p-4 text-left transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-mono font-medium">{loc.name}</div>
                    <div className="text-xs text-muted font-mono">
                      {(loc.address || loc.city) && <span>{parseCityFromAddress(loc.address) || loc.city} · </span>}
                      /{loc.slug}
                    </div>
                  </div>
                  <ArrowRight size={20} className="text-muted" />
                </div>
                <div className="text-xs text-faint font-mono mt-2">
                  claimed {new Date(loc.claimed_at).toLocaleDateString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a]">
        <div className="max-w-2xl mx-auto px-8 py-3 flex flex-wrap justify-center gap-x-3 sm:gap-x-6 gap-y-2 text-xs text-faint">
          <a href="/" className="hover:text-[var(--fg-muted)] transition-colors">home</a>
          <a href="/about" className="hover:text-[var(--fg-muted)] transition-colors">about</a>
        </div>
      </footer>
    </div>
  );
}
