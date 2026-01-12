'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { MerchantSettings } from '@/types';
import { VerifiedBadge } from '@/components/merchant';
import { config } from '@/lib/config';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginForm } from '@/components/auth/LoginForm';
import { Envelope, CheckCircle, Link as LinkIcon } from '@phosphor-icons/react';
import { parseCityFromAddress } from '@/lib/location-utils';

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
    user_id?: string | null;
    linked_at?: string | null;
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
  const searchParams = useSearchParams();
  const slug = params.slug as string;
  const { user, loading: authLoading } = useAuth();

  const [sessionId, setSessionId] = useState<string | null>(null);
  const [locationId, setLocationId] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Account linking state
  const [showLinkAccount, setShowLinkAccount] = useState(false);
  const [linkingAccount, setLinkingAccount] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  // Form state
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [customName, setCustomName] = useState('');
  const [hoursOverride, setHoursOverride] = useState('');
  const [tipJarAddress, setTipJarAddress] = useState('');
  const [tipJarEnabled, setTipJarEnabled] = useState(false);

  // Check if we should auto-link after magic link callback
  const shouldAutoLink = searchParams.get('link_claim') === 'true';

  // Get session ID from localStorage (optional if logged in)
  useEffect(() => {
    const stored = localStorage.getItem('clickpin_device_session_id');
    if (stored) {
      setSessionId(stored);
    }
    // Don't set error here - we might be logged in via Supabase Auth
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
    // Need location_id, and either sessionId or user (Supabase Auth)
    if (!locationId) {
      console.log('fetchDashboard: missing locationId');
      return;
    }

    // If no session and not logged in, can't fetch
    if (!sessionId && !user) {
      console.log('fetchDashboard: no session or user, waiting for auth');
      return;
    }

    console.log('fetchDashboard: fetching with', { locationId, sessionId, user: user?.email });
    setLoading(true);
    setError(null);

    try {
      // Build URL - session_id is optional if logged in
      let url = `/api/merchant/dashboard?location_id=${locationId}`;
      if (sessionId) {
        url += `&session_id=${sessionId}`;
      }

      const response = await fetch(url);
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
  }, [locationId, sessionId, user]);

  useEffect(() => {
    console.log('Dashboard effect: checking', { locationId, sessionId, user: user?.email, authLoading });

    // Wait for auth to finish loading
    if (authLoading) return;

    // If we have locationId and either sessionId or user, fetch dashboard
    if (locationId && (sessionId || user)) {
      fetchDashboard();
    } else if (locationId && !sessionId && !user) {
      // No session and not logged in - show login prompt
      setLoading(false);
    }
  }, [locationId, sessionId, user, authLoading, fetchDashboard]);

  // Auto-link account after magic link callback
  useEffect(() => {
    if (shouldAutoLink && user && dashboard?.claim && !dashboard.claim.user_id && sessionId) {
      handleLinkAccount();
    }
  }, [shouldAutoLink, user, dashboard, sessionId]);

  // Link the current claim to the authenticated user
  const handleLinkAccount = async () => {
    if (!user || !dashboard?.claim || !sessionId) return;

    setLinkingAccount(true);
    setLinkError(null);

    try {
      const response = await fetch('/api/merchant/auth/link-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claim_id: dashboard.claim.id,
          device_session_id: sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to link account');
      }

      setLinkSuccess(true);
      setShowLinkAccount(false);

      // Refresh dashboard to get updated claim info
      await fetchDashboard();

      // Clear the link_claim param from URL
      router.replace(`/merchant/${slug}`);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Failed to link account');
    } finally {
      setLinkingAccount(false);
    }
  };

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

  // Show login form if no session and not logged in
  if (!loading && !dashboard && !sessionId && !user && locationId) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] p-4">
        <div className="max-w-sm mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-xl font-bold mb-1">merchant login</h1>
            <p className="text-muted text-sm font-mono">sign in to access your dashboard</p>
          </div>

          <LoginForm
            type="merchant"
            redirectTo={`/merchant/${slug}`}
          />

          <div className="mt-6 text-center">
            <button onClick={() => router.push(`/b/${slug}`)} className="text-sm text-muted hover:text-[var(--fg)] font-mono">
              back to board
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] p-4">
        <div className="max-w-2xl mx-auto">
          <div className="border border-[var(--danger)] bg-[var(--danger)]/10 p-6 text-center">
            <p className="text-danger font-mono mb-4">{error || 'Not authorized'}</p>
            {!user && (
              <p className="text-sm text-muted font-mono mb-4">
                If you linked your email, try logging in:
              </p>
            )}
            <div className="flex gap-3 justify-center">
              {!user && (
                <button
                  onClick={() => setError(null)}
                  className="btn btn-primary"
                >
                  sign in
                </button>
              )}
              <button onClick={() => router.push(`/b/${slug}`)} className="btn">
                back to board
              </button>
            </div>
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
        {/* Account Linking Banner - show if not linked and user is authenticated */}
        {user && !dashboard.claim.user_id && (
          <section className="mb-8">
            <div className="border-2 border-[var(--accent)] bg-[var(--accent)]/10 p-4">
              <div className="flex items-start gap-3">
                <LinkIcon size={24} className="text-accent flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-sm mb-1">link your account</h3>
                  <p className="text-xs text-muted font-mono mb-3">
                    Connect your email ({user.email}) to access this dashboard from any device.
                  </p>
                  {linkError && (
                    <p className="text-xs text-danger font-mono mb-2">{linkError}</p>
                  )}
                  <button
                    onClick={handleLinkAccount}
                    disabled={linkingAccount}
                    className="btn btn-primary text-xs disabled:opacity-50"
                  >
                    {linkingAccount ? 'linking...' : 'link account'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Account Section - show link option if not linked */}
        {!user && !dashboard.claim.user_id && (
          <section className="mb-8">
            <h2 className="font-mono text-sm text-muted mb-3">account</h2>
            {showLinkAccount ? (
              <div className="border border-[var(--border)]">
                <div className="p-4 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-mono">add email for multi-device access</p>
                    <button
                      onClick={() => setShowLinkAccount(false)}
                      className="text-xs text-muted hover:text-[var(--fg)]"
                    >
                      cancel
                    </button>
                  </div>
                </div>
                <div className="p-4">
                  <LoginForm
                    type="merchant"
                    redirectTo={`/merchant/${slug}?link_claim=true`}
                    locationId={locationId || undefined}
                  />
                </div>
              </div>
            ) : (
              <div className="border border-[var(--border)] p-4">
                <div className="flex items-start gap-3">
                  <Envelope size={20} className="text-muted flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-mono mb-2">
                      currently using device-only access
                    </p>
                    <p className="text-xs text-muted font-mono mb-3">
                      add your email to access this dashboard from any device and recover your account if you lose this device.
                    </p>
                    <button
                      onClick={() => setShowLinkAccount(true)}
                      className="btn text-xs"
                    >
                      add email
                    </button>
                  </div>
                </div>
              </div>
            )}
          </section>
        )}

        {/* Account Linked Status */}
        {dashboard.claim.user_id && (
          <section className="mb-8">
            <h2 className="font-mono text-sm text-muted mb-3">account</h2>
            <div className="border border-[var(--accent)] bg-[var(--accent)]/5 p-4">
              <div className="flex items-center gap-2">
                <CheckCircle size={20} weight="fill" className="text-accent" />
                <div>
                  <p className="text-sm font-mono">account linked</p>
                  {user?.email && (
                    <p className="text-xs text-muted font-mono">{user.email}</p>
                  )}
                </div>
              </div>
              {dashboard.claim.linked_at && (
                <p className="text-xs text-faint font-mono mt-2">
                  linked {new Date(dashboard.claim.linked_at).toLocaleDateString()}
                </p>
              )}
            </div>
          </section>
        )}

        {/* Link Success Message */}
        {linkSuccess && (
          <section className="mb-8">
            <div className="border border-[var(--accent)] bg-[var(--accent)]/10 p-4 text-center">
              <CheckCircle size={32} weight="fill" className="text-accent mx-auto mb-2" />
              <p className="font-mono text-sm">account linked successfully!</p>
              <p className="text-xs text-muted font-mono mt-1">
                you can now access this dashboard from any device
              </p>
            </div>
          </section>
        )}

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
                  className="w-4 h-4 m-0 p-0 !w-4"
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
            {(dashboard.location.address || dashboard.location.city) && (
              <div className="flex justify-between">
                <span className="text-muted">location</span>
                <span className="text-right max-w-xs">{parseCityFromAddress(dashboard.location.address) || dashboard.location.city}</span>
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
        <div className="max-w-2xl mx-auto px-8 py-3 flex flex-wrap justify-center gap-x-3 sm:gap-x-6 gap-y-2 text-xs text-faint">
          <a href={`/b/${slug}`} className="hover:text-[var(--fg-muted)] transition-colors">board</a>
          <a href="/" className="hover:text-[var(--fg-muted)] transition-colors">home</a>
          <a href="/leaderboard" className="hover:text-[var(--fg-muted)] transition-colors">leaderboard</a>
          <a href="/about" className="hover:text-[var(--fg-muted)] transition-colors">about</a>
        </div>
      </footer>
    </div>
  );
}
