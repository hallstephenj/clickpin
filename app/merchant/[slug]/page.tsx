'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { MerchantSettings } from '@/types';
import { VerifiedBadge } from '@/components/merchant';
import { config } from '@/lib/config';

interface DashboardData {
  location: {
    id: string;
    name: string;
    slug: string;
    city: string | null;
    btcmap_id: number | null;
    address: string | null;
    phone: string | null;
    website: string | null;
    opening_hours: string | null;
  };
  settings: MerchantSettings;
  claim: {
    id: string;
    claimed_at: string;
    verification_method: string;
  };
  stats: {
    pins_today: number;
    pins_week: number;
    pins_total: number;
    replies_week: number;
  };
}

export default function MerchantDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Form state
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [customName, setCustomName] = useState('');
  const [hoursOverride, setHoursOverride] = useState('');
  const [tipJarAddress, setTipJarAddress] = useState('');
  const [tipJarEnabled, setTipJarEnabled] = useState(false);

  // Get session ID from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('clickpin_device_session_id');
    if (stored) {
      setSessionId(stored);
    } else {
      setError('No session found. Please visit the board first.');
      setLoading(false);
    }
  }, []);

  // Fetch location ID by slug
  useEffect(() => {
    if (!slug) return;

    async function fetchLocationId() {
      try {
        console.log('fetchLocationId: fetching for slug', slug);
        const response = await fetch(`/api/location?slug=${slug}`);
        const data = await response.json();
        console.log('fetchLocationId: response', { status: response.status, data });
        if (response.ok && data.location?.id) {
          console.log('fetchLocationId: setting locationId', data.location.id);
          setLocationId(data.location.id);
        } else {
          setError(data.error || 'Location not found');
          setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching location:', err);
        setError('Failed to load location');
        setLoading(false);
      }
    }

    fetchLocationId();
  }, [slug]);

  // Fetch dashboard data
  const fetchDashboard = useCallback(async () => {
    if (!locationId || !sessionId) {
      console.log('fetchDashboard: missing locationId or sessionId', { locationId, sessionId });
      return;
    }

    console.log('fetchDashboard: fetching with', { locationId, sessionId });
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/merchant/dashboard?location_id=${locationId}&session_id=${sessionId}`
      );
      const data = await response.json();
      console.log('fetchDashboard: response', { status: response.status, data });

      if (!response.ok) {
        throw new Error(data.error || 'Failed to load dashboard');
      }

      setDashboard(data);

      // Initialize form with current settings
      setWelcomeMessage(data.settings.welcome_message || '');
      setCustomName(data.settings.custom_name || '');
      setHoursOverride(data.settings.hours_override || '');
      setTipJarAddress(data.settings.tip_jar_address || '');
      setTipJarEnabled(data.settings.tip_jar_enabled || false);
    } catch (err) {
      console.error('fetchDashboard error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [locationId, sessionId]);

  useEffect(() => {
    console.log('Dashboard effect: checking', { locationId, sessionId });
    if (locationId && sessionId) {
      fetchDashboard();
    }
  }, [locationId, sessionId, fetchDashboard]);

  const handleSaveSettings = async () => {
    if (!locationId || !sessionId) return;

    setSaving(true);
    setSaveSuccess(false);

    try {
      const response = await fetch('/api/merchant/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          location_id: locationId,
          session_id: sessionId,
          settings: {
            welcome_message: welcomeMessage,
            custom_name: customName,
            hours_override: hoursOverride,
            tip_jar_address: tipJarAddress,
            tip_jar_enabled: tipJarEnabled,
          },
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save settings');
      }

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);

      // Refresh dashboard
      await fetchDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center">
        <p className="text-muted font-mono">loading dashboard...</p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] p-4">
        <div className="max-w-2xl mx-auto">
          <div className="border border-[var(--danger)] bg-[var(--danger)]/10 p-6 text-center">
            <p className="text-danger font-mono mb-4">{error || 'Not authorized'}</p>
            <button onClick={() => router.push(`/b/${slug}`)} className="btn">
              back to board
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] pb-16">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a]">
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-bold text-lg">{dashboard.location.name}</h1>
                <VerifiedBadge showLabel />
              </div>
              <p className="text-sm text-muted font-mono">merchant dashboard</p>
            </div>
            <button onClick={() => router.push(`/b/${slug}`)} className="btn text-xs">
              view board
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {/* Stats */}
        <section className="mb-8">
          <h2 className="font-mono text-sm text-muted mb-3">activity stats</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="border border-[var(--border)] p-4 text-center">
              <div className="text-2xl font-bold text-accent">{dashboard.stats.pins_today}</div>
              <div className="text-xs text-muted font-mono">posts today</div>
            </div>
            <div className="border border-[var(--border)] p-4 text-center">
              <div className="text-2xl font-bold">{dashboard.stats.pins_week}</div>
              <div className="text-xs text-muted font-mono">posts this week</div>
            </div>
            <div className="border border-[var(--border)] p-4 text-center">
              <div className="text-2xl font-bold">{dashboard.stats.replies_week}</div>
              <div className="text-xs text-muted font-mono">replies this week</div>
            </div>
            <div className="border border-[var(--border)] p-4 text-center">
              <div className="text-2xl font-bold">{dashboard.stats.pins_total}</div>
              <div className="text-xs text-muted font-mono">total posts</div>
            </div>
          </div>
        </section>

        {/* Settings Form */}
        <section className="mb-8">
          <h2 className="font-mono text-sm text-muted mb-3">board settings</h2>
          <div className="border border-[var(--border)] p-4 space-y-4">
            {/* Welcome Message */}
            <div>
              <label className="block text-xs text-muted font-mono mb-1">
                welcome message ({welcomeMessage.length}/{config.merchant.welcomeMessageMaxLength})
              </label>
              <textarea
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
                maxLength={config.merchant.welcomeMessageMaxLength}
                rows={3}
                className="w-full p-2 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm resize-none"
                placeholder="Welcome to our board! Check out our daily specials..."
              />
              <p className="text-xs text-faint font-mono mt-1">
                displayed at the top of your board
              </p>
            </div>

            {/* Custom Name */}
            <div>
              <label className="block text-xs text-muted font-mono mb-1">
                custom display name
              </label>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                maxLength={100}
                className="w-full p-2 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm"
                placeholder={dashboard.location.name}
              />
              <p className="text-xs text-faint font-mono mt-1">
                override the default location name
              </p>
            </div>

            {/* Hours Override */}
            <div>
              <label className="block text-xs text-muted font-mono mb-1">
                business hours
              </label>
              <textarea
                value={hoursOverride}
                onChange={(e) => setHoursOverride(e.target.value)}
                maxLength={500}
                rows={2}
                className="w-full p-2 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm resize-none"
                placeholder={dashboard.location.opening_hours || 'Mon-Fri 9am-5pm, Sat 10am-3pm'}
              />
              <p className="text-xs text-faint font-mono mt-1">
                {dashboard.location.opening_hours
                  ? `BTCMap hours: ${dashboard.location.opening_hours}`
                  : 'set your business hours'}
              </p>
            </div>

            {/* Tip Jar */}
            <div className="border-t border-[var(--border)] pt-4">
              <label className="flex items-center gap-2 cursor-pointer mb-2">
                <input
                  type="checkbox"
                  checked={tipJarEnabled}
                  onChange={(e) => setTipJarEnabled(e.target.checked)}
                  className="w-4 h-4"
                />
                <span className="text-sm font-mono">enable tip jar</span>
              </label>

              {tipJarEnabled && (
                <div className="mt-2">
                  <label className="block text-xs text-muted font-mono mb-1">
                    lightning address or LNURL
                  </label>
                  <input
                    type="text"
                    value={tipJarAddress}
                    onChange={(e) => setTipJarAddress(e.target.value)}
                    className="w-full p-2 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm"
                    placeholder="you@wallet.com or lnurl1..."
                  />
                </div>
              )}
            </div>

            {/* Save Button */}
            <div className="flex items-center gap-3 pt-2">
              <button
                onClick={handleSaveSettings}
                disabled={saving}
                className="btn btn-primary disabled:opacity-50"
              >
                {saving ? 'saving...' : 'save settings'}
              </button>
              {saveSuccess && (
                <span className="text-xs text-accent font-mono">saved!</span>
              )}
            </div>
          </div>
        </section>

        {/* Location Info */}
        <section>
          <h2 className="font-mono text-sm text-muted mb-3">location info</h2>
          <div className="border border-[var(--border)] p-4 space-y-2 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-muted">slug</span>
              <span>/{dashboard.location.slug}</span>
            </div>
            {dashboard.location.city && (
              <div className="flex justify-between">
                <span className="text-muted">city</span>
                <span>{dashboard.location.city}</span>
              </div>
            )}
            {dashboard.location.address && (
              <div className="flex justify-between">
                <span className="text-muted">address</span>
                <span className="text-right max-w-xs">{dashboard.location.address}</span>
              </div>
            )}
            {dashboard.location.phone && (
              <div className="flex justify-between">
                <span className="text-muted">phone</span>
                <span>{dashboard.location.phone}</span>
              </div>
            )}
            {dashboard.location.website && (
              <div className="flex justify-between">
                <span className="text-muted">website</span>
                <a
                  href={dashboard.location.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent hover:underline truncate max-w-xs"
                >
                  {dashboard.location.website}
                </a>
              </div>
            )}
            <div className="flex justify-between border-t border-[var(--border)] pt-2 mt-2">
              <span className="text-muted">claimed</span>
              <span>{new Date(dashboard.claim.claimed_at).toLocaleDateString()}</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="fixed bottom-0 left-0 right-0 border-t border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex justify-center gap-6 text-xs text-faint">
          <a href={`/b/${slug}`} className="hover:text-[var(--fg-muted)] transition-colors">board</a>
          <a href="/" className="hover:text-[var(--fg-muted)] transition-colors">home</a>
          <a href="/about" className="hover:text-[var(--fg-muted)] transition-colors">about</a>
        </div>
      </footer>
    </div>
  );
}
