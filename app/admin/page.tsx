'use client';

import { useState, useEffect, useCallback } from 'react';
import { Lightning, PencilSimple, Storefront, Broom, Trash, SignOut, UsersThree, Plant, ArrowLeft, Copy, Check, MapPin, Palette } from '@phosphor-icons/react';
import { parseCityFromAddress } from '@/lib/location-utils';
import { useAuth } from '@/components/auth/AuthProvider';
import { LoginForm } from '@/components/auth/LoginForm';

// Supabase auth uses cookies, so no custom headers needed
const getAuthHeaders = (): HeadersInit => ({});

interface LocationRequest {
  id: string;
  lat: number;
  lng: number;
  suggested_name: string;
  status: string;
  created_at: string;
  is_bitcoin_merchant: boolean;
}

interface GroupedRequest {
  center_lat: number;
  center_lng: number;
  requests: LocationRequest[];
  suggested_names: string[];
}

type LocationType = 'bitcoin_merchant' | 'merchant' | 'community_space';

interface Location {
  id: string;
  slug: string;
  name: string;
  city: string | null;
  category: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
  created_at: string;
  pin_count?: number;
  seed_count?: number;
  is_claimed?: boolean;
  is_bitcoin_merchant?: boolean;
  btcmap_id?: number | null;
  osm_id?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  opening_hours?: string | null;
  btcmap_icon?: string | null;
  btcmap_verified_at?: string | null;
  btcmap_updated_at?: string | null;
  merchant_settings?: Record<string, unknown>;
  merchant_claim?: Record<string, unknown> | null;
  location_type?: LocationType;
}

interface Pin {
  id: string;
  body: string;
  doodle_data: string | null;
  created_at: string;
  flag_count: number;
  is_hidden: boolean;
  boost_score: number;
}

interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  updated_at: string;
}

type Tab = 'stats' | 'requests' | 'locations' | 'flags' | 'controls' | 'sprouts';
type View = 'list' | 'pins' | 'detail';

interface SproutReport {
  id: string;
  location_id: string;
  device_session_id: string;
  lnurl_identity_id: string | null;
  photo_url: string;
  payment_type: string;
  context: string | null;
  status: string;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
  location: {
    id: string;
    name: string;
    address: string | null;
    lat: number;
    lng: number;
    location_type: string;
  } | null;
  identity: {
    id: string;
    display_name: string | null;
    anon_nym: string;
  } | null;
}

interface AdminStats {
  posts: { total: number; today: number; thisWeek: number; hidden: number };
  seeds: {
    total: number;
    today: number;
    thisWeek: number;
    outcomes: { positive: number; neutral: number; negative: number };
    successRate: number;
  };
  locations: { total: number; active: number; claimed: number; btcmap: number };
  sessions: { total: number; activeToday: number };
  requests: { pending: number };
  merchants: { verified: number; pending: number };
  topLocations: Array<{ name: string; slug: string; city: string | null }>;
  generatedAt: string;
}

export default function AdminPage() {
  const { user, loading: authLoading, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('stats');
  const [currentView, setCurrentView] = useState<View>('list');

  // Requests state
  const [groups, setGroups] = useState<GroupedRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState<Record<string, string>>({});
  const [newLocationType, setNewLocationType] = useState<Record<string, LocationType>>({});

  // Locations state
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [locationsPage, setLocationsPage] = useState(1);
  const [locationsTotalPages, setLocationsTotalPages] = useState(1);
  const [locationsTotal, setLocationsTotal] = useState(0);
  const [locationsSearch, setLocationsSearch] = useState('');
  const [locationsSource, setLocationsSource] = useState<'all' | 'btcmap' | 'manual'>('all');
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [locationPins, setLocationPins] = useState<Pin[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editLocationName, setEditLocationName] = useState('');
  const [editLocationRadius, setEditLocationRadius] = useState('');
  const [editLocationType, setEditLocationType] = useState<LocationType>('merchant');

  // Detail view state (god mode editing)
  const [detailLocation, setDetailLocation] = useState<Location | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [editFields, setEditFields] = useState<Record<string, string>>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // Feature flags state
  const [featureFlags, setFeatureFlags] = useState<FeatureFlag[]>([]);
  const [flagsLoading, setFlagsLoading] = useState(false);

  // App settings state (design theme)
  const [designTheme, setDesignTheme] = useState<'mono' | 'forstall' | 'neo2026'>('mono');
  const [themeLoading, setThemeLoading] = useState(false);

  // Stats state
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // Sprouts state
  const [sproutReports, setSproutReports] = useState<SproutReport[]>([]);
  const [sproutsLoading, setSproutsLoading] = useState(false);
  const [sproutsFilter, setSproutsFilter] = useState<'pending' | 'all'>('pending');
  const [selectedReport, setSelectedReport] = useState<SproutReport | null>(null);
  const [reportActionLoading, setReportActionLoading] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const response = await fetch('/api/admin/stats', {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchSprouts = useCallback(async (status: 'pending' | 'all' = 'pending') => {
    setSproutsLoading(true);
    try {
      const response = await fetch(`/api/admin/sprout-reports?status=${status}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setSproutReports(data.reports || []);
      }
    } catch (err) {
      console.error('Failed to fetch sprout reports:', err);
    } finally {
      setSproutsLoading(false);
    }
  }, []);

  const handleSproutAction = async (reportId: string, action: 'approve' | 'reject' | 'needs_info', notes?: string) => {
    setReportActionLoading(reportId);
    try {
      const response = await fetch(`/api/admin/sprout-reports/${reportId}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes }),
      });
      if (response.ok) {
        // Refresh the list
        fetchSprouts(sproutsFilter);
        setSelectedReport(null);
      }
    } catch (err) {
      console.error('Failed to update sprout report:', err);
    } finally {
      setReportActionLoading(null);
    }
  };

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const response = await fetch('/api/admin/location-requests', {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setGroups(data.groups || []);
      }
    } catch (err) {
      console.error('Failed to fetch requests:', err);
    } finally {
      setRequestsLoading(false);
    }
  }, []);

  const fetchLocations = useCallback(async (page = 1, search = '', source: 'all' | 'btcmap' | 'manual' = 'all') => {
    setLocationsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50', source });
      if (search) params.set('search', search);

      const response = await fetch(`/api/admin/locations?${params}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setLocations(data.locations || []);
        setLocationsPage(data.pagination?.page || 1);
        setLocationsTotalPages(data.pagination?.totalPages || 1);
        setLocationsTotal(data.pagination?.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    } finally {
      setLocationsLoading(false);
    }
  }, []);

  const fetchLocationPins = useCallback(async (locationId: string) => {
    setPinsLoading(true);
    try {
      const response = await fetch(`/api/admin/locations/${locationId}/pins`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setLocationPins(data.pins || []);
      }
    } catch (err) {
      console.error('Failed to fetch pins:', err);
    } finally {
      setPinsLoading(false);
    }
  }, []);

  const fetchFlags = useCallback(async () => {
    setFlagsLoading(true);
    try {
      const response = await fetch('/api/admin/feature-flags', {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setFeatureFlags(data.flags || []);
      }
    } catch (err) {
      console.error('Failed to fetch feature flags:', err);
    } finally {
      setFlagsLoading(false);
    }
  }, []);

  const fetchDesignTheme = useCallback(async () => {
    try {
      const response = await fetch('/api/app-settings', {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        if (data.settings?.design_theme) {
          setDesignTheme(data.settings.design_theme);
        }
      }
    } catch (err) {
      console.error('Failed to fetch design theme:', err);
    }
  }, []);

  const handleSetDesignTheme = async (theme: 'mono' | 'forstall' | 'neo2026') => {
    setThemeLoading(true);
    try {
      const response = await fetch('/api/admin/app-settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ key: 'design_theme', value: theme }),
      });
      if (response.ok) {
        setDesignTheme(theme);
        // Force reload to apply theme change
        window.location.reload();
      }
    } catch (err) {
      console.error('Failed to update design theme:', err);
    } finally {
      setThemeLoading(false);
    }
  };

  const handleToggleFlag = async (flag: FeatureFlag) => {
    setActionLoading(flag.id);
    try {
      const response = await fetch('/api/admin/feature-flags', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ key: flag.key, enabled: !flag.enabled }),
      });

      if (response.ok) {
        setFeatureFlags((prev) =>
          prev.map((f) => (f.id === flag.id ? { ...f, enabled: !f.enabled } : f))
        );
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to toggle flag');
      }
    } catch {
      alert('Failed to toggle flag');
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    if (user && currentView === 'list') {
      // Always fetch flags so we know which features are enabled
      if (featureFlags.length === 0) {
        fetchFlags();
      }
      // Fetch design theme for controls tab
      fetchDesignTheme();
      if (activeTab === 'stats') {
        fetchStats();
      } else if (activeTab === 'requests') {
        fetchRequests();
      } else if (activeTab === 'locations') {
        fetchLocations(1, '', locationsSource);
      } else if (activeTab === 'flags') {
        fetchFlags();
      } else if (activeTab === 'sprouts') {
        fetchSprouts(sproutsFilter);
      }
    }
  }, [user, activeTab, currentView, fetchRequests, fetchLocations, fetchFlags, fetchStats, fetchDesignTheme, fetchSprouts, featureFlags.length, sproutsFilter]);

  // Helper to check if a feature flag is enabled
  const isFeatureEnabled = (key: string) => {
    const flag = featureFlags.find((f) => f.key === key);
    return flag?.enabled ?? false;
  };

  useEffect(() => {
    if (selectedLocation && currentView === 'pins') {
      fetchLocationPins(selectedLocation.id);
    }
  }, [selectedLocation, currentView, fetchLocationPins]);

  const removeGroupFromList = (group: GroupedRequest) => {
    setGroups((prev) => prev.filter(
      (g) => g.center_lat !== group.center_lat || g.center_lng !== group.center_lng
    ));
  };

  const handleApprove = async (group: GroupedRequest) => {
    const key = `${group.center_lat}-${group.center_lng}`;
    const name = newLocationName[key];
    if (!name?.trim()) {
      alert('Please enter a location name');
      return;
    }

    // Default to merchant if not selected, or bitcoin_merchant if any request marked it
    const defaultType = group.requests.some(r => r.is_bitcoin_merchant) ? 'bitcoin_merchant' : 'merchant';
    const locationType = newLocationType[key] || defaultType;

    setActionLoading(key);
    try {
      const response = await fetch('/api/admin/approve-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          lat: group.center_lat,
          lng: group.center_lng,
          name: name.trim(),
          location_type: locationType,
          request_ids: group.requests.map((r) => r.id),
        }),
      });

      if (response.ok) {
        // Remove from list immediately
        removeGroupFromList(group);
        setNewLocationName((prev) => ({
          ...prev,
          [`${group.center_lat}-${group.center_lng}`]: '',
        }));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to approve');
      }
    } catch {
      alert('Failed to approve location');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (group: GroupedRequest) => {
    if (!confirm('Reject all requests in this group?')) return;

    setActionLoading(`${group.center_lat}-${group.center_lng}`);
    try {
      const response = await fetch('/api/admin/reject-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({
          request_ids: group.requests.map((r) => r.id),
        }),
      });

      if (response.ok) {
        // Remove from list immediately
        removeGroupFromList(group);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to reject');
      }
    } catch {
      alert('Failed to reject requests');
    } finally {
      setActionLoading(null);
    }
  };

  const fetchLocationDetail = useCallback(async (locationId: string) => {
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/admin/locations/${locationId}`, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        setDetailLocation(data.location);
        // Initialize edit fields
        const loc = data.location;
        setEditFields({
          name: loc.name || '',
          slug: loc.slug || '',
          category: loc.category || '',
          lat: String(loc.lat),
          lng: String(loc.lng),
          radius_m: String(loc.radius_m),
          address: loc.address || '',
          phone: loc.phone || '',
          website: loc.website || '',
          opening_hours: loc.opening_hours || '',
          btcmap_id: loc.btcmap_id ? String(loc.btcmap_id) : '',
          osm_id: loc.osm_id || '',
        });
      }
    } catch (err) {
      console.error('Failed to fetch location detail:', err);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleSelectLocation = (location: Location) => {
    setSelectedLocation(location);
    setCurrentView('detail');
    fetchLocationDetail(location.id);
  };

  const handleBackToLocations = () => {
    setCurrentView('list');
    setSelectedLocation(null);
    setLocationPins([]);
    setDetailLocation(null);
    setEditFields({});
  };

  const handleSaveField = async (field: string, value: string) => {
    if (!detailLocation) return;

    setActionLoading(`save-${field}`);
    try {
      // Convert string booleans to actual booleans
      let parsedValue: string | boolean | number = value;
      if (value === 'true') parsedValue = true;
      else if (value === 'false') parsedValue = false;
      // Keep numbers as strings - the API will parse them

      const response = await fetch(`/api/admin/locations/${detailLocation.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ [field]: parsedValue }),
      });

      if (response.ok) {
        const data = await response.json();
        setDetailLocation(data.location);
        // Update locations list
        setLocations((prev) =>
          prev.map((loc) => loc.id === detailLocation.id ? { ...loc, ...data.location } : loc)
        );
      } else {
        const data = await response.json();
        alert(data.error || `Failed to update ${field}`);
      }
    } catch {
      alert(`Failed to update ${field}`);
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearSeeds = async (location: Location) => {
    if (!confirm(`Delete ALL seed data from "${location.name}"? This cannot be undone.`)) return;

    setActionLoading(`seeds-${location.id}`);
    try {
      const response = await fetch(`/api/admin/locations/${location.id}/clear-seeds`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Deleted ${data.deleted_count} seed plantings from ${location.name}`);
        // Refresh detail view
        if (detailLocation?.id === location.id) {
          fetchLocationDetail(location.id);
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to clear seeds');
      }
    } catch {
      alert('Failed to clear seeds');
    } finally {
      setActionLoading(null);
    }
  };

  const copyToClipboard = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch {
      console.error('Failed to copy');
    }
  };

  const handleStartEdit = (location: Location) => {
    setEditingLocationId(location.id);
    setEditLocationName(location.name);
    setEditLocationRadius(String(location.radius_m));
    setEditLocationType(location.location_type || 'merchant');
  };

  const handleCancelEdit = () => {
    setEditingLocationId(null);
    setEditLocationName('');
    setEditLocationRadius('');
    setEditLocationType('merchant');
  };

  const handleSaveEdit = async (locationId: string) => {
    if (!editLocationName.trim()) {
      alert('Please enter a location name');
      return;
    }

    const radius = parseInt(editLocationRadius, 10);
    if (isNaN(radius) || radius < 10 || radius > 5000) {
      alert('Radius must be between 10 and 5000 meters');
      return;
    }

    setActionLoading(locationId);
    try {
      const response = await fetch(`/api/admin/locations/${locationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ name: editLocationName.trim(), radius_m: radius, location_type: editLocationType }),
      });

      if (response.ok) {
        const data = await response.json();
        setLocations((prev) =>
          prev.map((loc) =>
            loc.id === locationId
              ? {
                  ...loc,
                  name: data.location.name,
                  slug: data.location.slug,
                  radius_m: data.location.radius_m,
                  location_type: data.location.location_type,
                  is_bitcoin_merchant: data.location.is_bitcoin_merchant,
                }
              : loc
          )
        );
        setEditingLocationId(null);
        setEditLocationName('');
        setEditLocationRadius('');
        setEditLocationType('merchant');
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update location');
      }
    } catch {
      alert('Failed to update location');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteLocation = async (location: Location) => {
    if (!confirm(`Delete "${location.name}"? This will delete all pins at this location.`)) return;

    setActionLoading(location.id);
    try {
      const response = await fetch(`/api/admin/locations/${location.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        await fetchLocations(locationsPage, locationsSearch, locationsSource);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete location');
      }
    } catch {
      alert('Failed to delete location');
    } finally {
      setActionLoading(null);
    }
  };

  const handleClearPins = async (location: Location) => {
    if (!confirm(`Delete ALL posts from "${location.name}"? This cannot be undone.`)) return;

    setActionLoading(`clear-${location.id}`);
    try {
      const response = await fetch(`/api/admin/locations/${location.id}/clear-pins`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Deleted ${data.deleted_count} posts from ${location.name}`);
        await fetchLocations(locationsPage, locationsSearch, locationsSource);
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to clear posts');
      }
    } catch {
      alert('Failed to clear posts');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeletePin = async (pinId: string) => {
    if (!confirm('Delete this pin?')) return;

    setActionLoading(pinId);
    try {
      const response = await fetch(`/api/admin/pins/${pinId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        setLocationPins((prev) => prev.filter((p) => p.id !== pinId));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to delete pin');
      }
    } catch {
      alert('Failed to delete pin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleTogglePinHidden = async (pin: Pin) => {
    setActionLoading(pin.id);
    try {
      const response = await fetch(`/api/admin/pins/${pin.id}/toggle-hidden`, {
        method: 'POST',
        headers: getAuthHeaders(),
      });

      if (response.ok) {
        setLocationPins((prev) =>
          prev.map((p) => (p.id === pin.id ? { ...p, is_hidden: !p.is_hidden } : p))
        );
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to toggle pin');
      }
    } catch {
      alert('Failed to toggle pin');
    } finally {
      setActionLoading(null);
    }
  };

  const handleMerchantReset = async (location: Location, action: 'de-verify' | 'reset-settings' | 'full-reset') => {
    const actionLabels = {
      'de-verify': 'remove verified status from',
      'reset-settings': 'clear merchant settings for',
      'full-reset': 'completely reset merchant data for',
    };

    if (!confirm(`Are you sure you want to ${actionLabels[action]} "${location.name}"?`)) return;

    setActionLoading(`merchant-${location.id}`);
    try {
      const response = await fetch(`/api/admin/locations/${location.id}/merchant-reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
        body: JSON.stringify({ action }),
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Successfully performed ${action} on ${location.name}`);
        // Update local state
        if (action === 'de-verify' || action === 'full-reset') {
          setLocations((prev) =>
            prev.map((loc) =>
              loc.id === location.id ? { ...loc, is_claimed: false } : loc
            )
          );
        }
        if (action === 'reset-settings' || action === 'full-reset') {
          setLocations((prev) =>
            prev.map((loc) =>
              loc.id === location.id ? { ...loc, merchant_settings: {} } : loc
            )
          );
        }
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to reset merchant');
      }
    } catch {
      alert('Failed to reset merchant');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle sign out
  const handleSignOut = async () => {
    await signOut();
  };

  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <p className="text-muted font-mono">loading...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-1 inline-flex items-center gap-1">
              <Lightning size={24} weight="fill" className="text-accent" /> clickpin admin
            </h1>
            <p className="text-muted text-sm font-mono">location management</p>
          </div>

          <LoginForm type="admin" redirectTo="/admin" />
        </div>
      </div>
    );
  }

  // Detail view for a specific location (god mode)
  if (currentView === 'detail' && selectedLocation) {
    const loc = detailLocation || selectedLocation;
    const isBtcmapImported = Boolean(loc.btcmap_id);

    // Fields that come from BTCMap and should not be edited if imported
    const btcmapFields = ['name', 'lat', 'lng', 'address', 'phone', 'website', 'opening_hours', 'btcmap_id', 'osm_id'];

    const EditableField = ({ label, field, type = 'text', readonly = false }: { label: string; field: string; type?: string; readonly?: boolean }) => {
      const isBtcmapField = isBtcmapImported && btcmapFields.includes(field);
      const isReadonly = readonly || isBtcmapField;

      return (
      <div className="flex items-center gap-2 py-2 border-b border-[var(--border)]">
        <label className="text-xs text-muted font-mono w-28 flex-shrink-0">
          {label}
          {isBtcmapField && <span title="Imported from BTCMap"><MapPin size={12} weight="fill" className="text-[#f7931a] ml-1 inline" /></span>}
        </label>
        {isReadonly ? (
          <div className="flex-1 flex items-center gap-2">
            <span className={`font-mono text-sm ${isBtcmapField ? 'text-muted' : ''}`}>{editFields[field] || '-'}</span>
            {editFields[field] && (
              <button
                onClick={() => copyToClipboard(editFields[field], field)}
                className="text-muted hover:text-[var(--fg)]"
                title="Copy"
              >
                {copiedField === field ? <Check size={14} /> : <Copy size={14} />}
              </button>
            )}
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <input
              type={type}
              value={editFields[field] || ''}
              onChange={(e) => setEditFields((prev) => ({ ...prev, [field]: e.target.value }))}
              className="flex-1 p-1.5 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm"
            />
            <button
              onClick={() => handleSaveField(field, editFields[field])}
              disabled={actionLoading === `save-${field}`}
              className="btn text-xs"
            >
              {actionLoading === `save-${field}` ? '...' : 'save'}
            </button>
          </div>
        )}
      </div>
    );
    };

    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] p-4">
        <div className="max-w-3xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <button
              onClick={handleBackToLocations}
              className="text-sm text-muted hover:text-[var(--fg)] font-mono mb-4 flex items-center gap-1"
            >
              <ArrowLeft size={14} /> back to locations
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2">
                  {loc.name}
                  {loc.location_type === 'bitcoin_merchant' && <Lightning size={20} weight="fill" className="text-[#f7931a]" />}
                  {loc.location_type === 'community_space' && <UsersThree size={20} className="text-blue-500" />}
                </h1>
                <p className="text-muted text-sm font-mono">/{loc.slug} · ID: {loc.id}</p>
              </div>
              <button
                onClick={() => fetchLocationDetail(loc.id)}
                disabled={detailLoading}
                className="btn text-xs"
              >
                {detailLoading ? 'loading...' : 'refresh'}
              </button>
            </div>
          </div>

          {detailLoading && !detailLocation ? (
            <div className="border border-[var(--border)] p-8 text-center">
              <p className="text-muted font-mono">loading location details...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* BTCMap notice */}
              {isBtcmapImported && (
                <div className="border border-[#f7931a] bg-[#f7931a]/10 p-3">
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin size={16} weight="fill" className="text-[#f7931a]" />
                    <span className="font-mono">
                      imported from BTCMap — fields marked with <MapPin size={12} weight="fill" className="text-[#f7931a] inline" /> are synced and cannot be edited here
                    </span>
                  </div>
                </div>
              )}

              {/* Quick stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="border border-[var(--border)] p-3 text-center">
                  <div className="text-2xl font-bold">{loc.pin_count || 0}</div>
                  <div className="text-xs text-muted font-mono">posts</div>
                </div>
                <div className="border border-[var(--border)] p-3 text-center">
                  <div className="text-2xl font-bold">{loc.seed_count || 0}</div>
                  <div className="text-xs text-muted font-mono">seeds</div>
                </div>
                <div className="border border-[var(--border)] p-3 text-center">
                  <div className={`text-2xl font-bold ${loc.is_claimed ? 'text-green-500' : 'text-muted'}`}>
                    {loc.is_claimed ? '✓' : '✗'}
                  </div>
                  <div className="text-xs text-muted font-mono">claimed</div>
                </div>
                <div className="border border-[var(--border)] p-3 text-center">
                  <div className={`text-2xl font-bold ${loc.is_active ? 'text-green-500' : 'text-red-500'}`}>
                    {loc.is_active ? '✓' : '✗'}
                  </div>
                  <div className="text-xs text-muted font-mono">active</div>
                </div>
              </div>

              {/* Basic Info */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h2 className="font-mono text-sm font-bold">basic info</h2>
                </div>
                <div className="p-4">
                  <EditableField label="name" field="name" />
                  <EditableField label="category" field="category" />
                  <EditableField label="slug" field="slug" readonly />
                </div>
              </div>

              {/* Location Type */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h2 className="font-mono text-sm font-bold">location type</h2>
                </div>
                <div className="p-4">
                  <div className="flex gap-2 flex-wrap">
                    {(['merchant', 'bitcoin_merchant', 'community_space'] as LocationType[]).map((type) => (
                      <button
                        key={type}
                        onClick={() => handleSaveField('location_type', type)}
                        disabled={actionLoading === 'save-location_type'}
                        className={`flex items-center gap-1.5 px-3 py-2 text-xs font-mono border ${
                          loc.location_type === type
                            ? type === 'bitcoin_merchant' ? 'border-[#f7931a] bg-orange-100 dark:bg-orange-900'
                            : type === 'community_space' ? 'border-blue-500 bg-blue-100 dark:bg-blue-900'
                            : 'border-gray-500 bg-gray-100 dark:bg-gray-800'
                            : 'border-[var(--border)] hover:border-[var(--accent)]'
                        }`}
                      >
                        {type === 'bitcoin_merchant' && <Lightning size={14} weight="fill" className="text-[#f7931a]" />}
                        {type === 'merchant' && <Storefront size={14} className="text-gray-500" />}
                        {type === 'community_space' && <UsersThree size={14} className="text-blue-500" />}
                        {type.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Coordinates */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h2 className="font-mono text-sm font-bold">coordinates</h2>
                </div>
                <div className="p-4">
                  <EditableField label="latitude" field="lat" type="number" />
                  <EditableField label="longitude" field="lng" type="number" />
                  <EditableField label="radius (m)" field="radius_m" type="number" />
                  <div className="mt-2">
                    <a
                      href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-accent hover:underline font-mono"
                    >
                      view on google maps →
                    </a>
                  </div>
                </div>
              </div>

              {/* BTCMap / Contact Info */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h2 className="font-mono text-sm font-bold">contact & btcmap info</h2>
                </div>
                <div className="p-4">
                  <EditableField label="address" field="address" />
                  <EditableField label="phone" field="phone" />
                  <EditableField label="website" field="website" />
                  <EditableField label="hours" field="opening_hours" />
                  <EditableField label="btcmap id" field="btcmap_id" type="number" />
                  <EditableField label="osm id" field="osm_id" />
                  {loc.btcmap_id && (
                    <div className="mt-2">
                      <a
                        href={`https://btcmap.org/merchant/${loc.btcmap_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-accent hover:underline font-mono"
                      >
                        view on btcmap →
                      </a>
                    </div>
                  )}
                </div>
              </div>

              {/* Status Toggles */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h2 className="font-mono text-sm font-bold">status toggles</h2>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">is_active</div>
                      <div className="text-xs text-muted">location appears in searches</div>
                    </div>
                    <button
                      onClick={() => handleSaveField('is_active', String(!loc.is_active))}
                      disabled={actionLoading === 'save-is_active'}
                      className={`px-4 py-2 font-mono text-sm ${
                        loc.is_active ? 'bg-green-500 text-white' : 'bg-[var(--bg-alt)] border border-[var(--border)]'
                      }`}
                    >
                      {actionLoading === 'save-is_active' ? '...' : loc.is_active ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">is_claimed</div>
                      <div className="text-xs text-muted">merchant has verified ownership</div>
                    </div>
                    <button
                      onClick={() => handleSaveField('is_claimed', String(!loc.is_claimed))}
                      disabled={actionLoading === 'save-is_claimed'}
                      className={`px-4 py-2 font-mono text-sm ${
                        loc.is_claimed ? 'bg-green-500 text-white' : 'bg-[var(--bg-alt)] border border-[var(--border)]'
                      }`}
                    >
                      {actionLoading === 'save-is_claimed' ? '...' : loc.is_claimed ? 'ON' : 'OFF'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Merchant Settings (if claimed) */}
              {loc.merchant_settings && Object.keys(loc.merchant_settings).length > 0 && (
                <div className="border border-[var(--border)]">
                  <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                    <h2 className="font-mono text-sm font-bold">merchant settings (json)</h2>
                  </div>
                  <div className="p-4">
                    <pre className="text-xs font-mono bg-[var(--bg-alt)] p-3 overflow-x-auto">
                      {JSON.stringify(loc.merchant_settings, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Timestamps */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h2 className="font-mono text-sm font-bold">timestamps</h2>
                </div>
                <div className="p-4 text-xs font-mono text-muted space-y-1">
                  <div>created: {new Date(loc.created_at).toLocaleString()}</div>
                  {loc.btcmap_verified_at && <div>btcmap verified: {new Date(loc.btcmap_verified_at).toLocaleString()}</div>}
                  {loc.btcmap_updated_at && <div>btcmap updated: {new Date(loc.btcmap_updated_at).toLocaleString()}</div>}
                </div>
              </div>

              {/* Danger Zone */}
              <div className="border border-[var(--danger)]">
                <div className="px-4 py-2 border-b border-[var(--danger)] bg-[var(--danger)]/10">
                  <h2 className="font-mono text-sm font-bold text-danger">danger zone</h2>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setCurrentView('pins');
                        fetchLocationPins(loc.id);
                      }}
                      className="btn text-xs"
                    >
                      view posts ({loc.pin_count || 0})
                    </button>
                    <button
                      onClick={() => handleClearPins(loc)}
                      disabled={actionLoading === `clear-${loc.id}` || (loc.pin_count || 0) === 0}
                      className="btn text-xs text-danger border-danger hover:bg-danger hover:text-white disabled:opacity-30"
                    >
                      <Broom size={14} /> clear all posts
                    </button>
                    <button
                      onClick={() => handleClearSeeds(loc)}
                      disabled={actionLoading === `seeds-${loc.id}` || (loc.seed_count || 0) === 0}
                      className="btn text-xs text-danger border-danger hover:bg-danger hover:text-white disabled:opacity-30"
                    >
                      <Plant size={14} /> clear all seeds ({loc.seed_count || 0})
                    </button>
                  </div>
                  {(loc.is_claimed || loc.is_bitcoin_merchant) && (
                    <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--border)]">
                      <span className="text-xs text-muted font-mono self-center">merchant actions:</span>
                      {loc.is_claimed && (
                        <button
                          onClick={() => handleMerchantReset(loc, 'de-verify')}
                          disabled={actionLoading === `merchant-${loc.id}`}
                          className="btn text-xs"
                        >
                          de-verify
                        </button>
                      )}
                      <button
                        onClick={() => handleMerchantReset(loc, 'reset-settings')}
                        disabled={actionLoading === `merchant-${loc.id}`}
                        className="btn text-xs"
                      >
                        clear settings
                      </button>
                      <button
                        onClick={() => handleMerchantReset(loc, 'full-reset')}
                        disabled={actionLoading === `merchant-${loc.id}`}
                        className="btn text-xs text-danger border-danger"
                      >
                        full merchant reset
                      </button>
                    </div>
                  )}
                  <div className="pt-2 border-t border-[var(--border)]">
                    <button
                      onClick={() => {
                        if (confirm(`DELETE "${loc.name}" and ALL its data? This cannot be undone!`)) {
                          handleDeleteLocation(loc);
                          handleBackToLocations();
                        }
                      }}
                      disabled={actionLoading === loc.id}
                      className="btn text-xs text-white bg-danger hover:bg-red-700"
                    >
                      <Trash size={14} /> delete location permanently
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Pins view for a specific location
  if (currentView === 'pins' && selectedLocation) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] p-4">
        <div className="max-w-2xl mx-auto">
          {/* Header with back button */}
          <div className="mb-6">
            <button
              onClick={() => setCurrentView('detail')}
              className="text-sm text-muted hover:text-[var(--fg)] font-mono mb-4 flex items-center gap-1"
            >
              <ArrowLeft size={14} /> back to location details
            </button>
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl font-bold">{selectedLocation.name}</h1>
                <p className="text-muted text-sm font-mono">/{selectedLocation.slug}</p>
              </div>
              <button
                onClick={() => fetchLocationPins(selectedLocation.id)}
                disabled={pinsLoading}
                className="btn text-xs"
              >
                {pinsLoading ? 'loading...' : 'refresh'}
              </button>
            </div>
          </div>

          {/* Location info */}
          <div className="mb-6 p-3 border border-[var(--border)] bg-[var(--bg-alt)]">
            <div className="text-xs text-muted font-mono">
              coords: {selectedLocation.lat.toFixed(4)}, {selectedLocation.lng.toFixed(4)} •
              radius: {selectedLocation.radius_m}m
            </div>
          </div>

          {/* Pins list */}
          {(() => {
            const visiblePins = locationPins.filter((p) => !p.is_hidden);
            const hiddenPins = locationPins.filter((p) => p.is_hidden);

            const renderPin = (pin: Pin) => (
              <div
                key={pin.id}
                className={`border border-[var(--border)] p-4 ${
                  pin.is_hidden ? 'bg-[var(--bg-alt)] border-dashed' : 'bg-[#fafafa] dark:bg-[#0a0a0a]'
                }`}
              >
                {/* Doodle */}
                {pin.doodle_data && (
                  <div className="mb-3">
                    <img
                      src={pin.doodle_data}
                      alt="Doodle"
                      className="max-w-full h-auto border border-[var(--border)]"
                      style={{ maxHeight: '200px' }}
                    />
                  </div>
                )}

                {/* Body text */}
                <div className="font-mono text-sm mb-3 whitespace-pre-wrap break-words">
                  {pin.body}
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between text-xs border-t border-[var(--border)] pt-3 mt-3">
                  <div className="flex flex-wrap gap-2 text-muted font-mono">
                    <span>{new Date(pin.created_at).toLocaleString()}</span>
                    {pin.flag_count > 0 && (
                      <span className="text-danger">{pin.flag_count} flag{pin.flag_count !== 1 ? 's' : ''}</span>
                    )}
                    {pin.boost_score > 0 && (
                      <span className="text-[var(--accent)]">boosted</span>
                    )}
                    {pin.is_hidden && (
                      <span className="text-danger font-medium">HIDDEN</span>
                    )}
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleTogglePinHidden(pin)}
                      disabled={actionLoading === pin.id}
                      className="text-xs text-muted hover:text-[var(--fg)] font-mono"
                    >
                      {actionLoading === pin.id
                        ? '...'
                        : pin.is_hidden
                          ? 'unhide'
                          : 'hide'}
                    </button>
                    <button
                      onClick={() => handleDeletePin(pin.id)}
                      disabled={actionLoading === pin.id}
                      className="text-xs text-danger hover:underline font-mono"
                    >
                      {actionLoading === pin.id ? '...' : 'delete'}
                    </button>
                  </div>
                </div>
              </div>
            );

            return (
              <div className="mb-4">
                <h2 className="font-mono text-sm text-muted mb-4">
                  {visiblePins.length} pin{visiblePins.length !== 1 ? 's' : ''}
                </h2>

                {pinsLoading ? (
                  <div className="border border-[var(--border)] p-8 text-center">
                    <p className="text-muted font-mono">loading pins...</p>
                  </div>
                ) : visiblePins.length === 0 ? (
                  <div className="border border-[var(--border)] p-8 text-center">
                    <p className="text-muted font-mono">no pins at this location</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {visiblePins.map(renderPin)}
                  </div>
                )}

                {/* Hidden posts collapsible section */}
                {hiddenPins.length > 0 && (
                  <div className="mt-6">
                    <button
                      onClick={() => setShowHidden(!showHidden)}
                      className="text-sm text-muted hover:text-[var(--fg)] font-mono flex items-center gap-1 mb-3"
                    >
                      <span>{showHidden ? '↑' : '↓'}</span>
                      <span>hidden posts ({hiddenPins.length})</span>
                    </button>
                    {showHidden && (
                      <div className="space-y-3 pl-4 border-l-2 border-[var(--border)]">
                        {hiddenPins.map(renderPin)}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    );
  }

  // Main list view
  return (
    <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] p-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold inline-flex items-center gap-1">
              <Lightning size={24} weight="fill" className="text-accent" /> clickpin admin
            </h1>
            {user?.email && (
              <p className="text-xs text-muted font-mono mt-1">{user.email}</p>
            )}
          </div>
          <button
            onClick={handleSignOut}
            className="btn text-xs flex items-center gap-1"
            title="Sign out"
          >
            <SignOut size={14} />
            sign out
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--border)]">
          <button
            onClick={() => setActiveTab('stats')}
            className={`px-4 py-2 font-mono text-sm border-b-2 -mb-px ${
              activeTab === 'stats'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-muted hover:text-[var(--fg)]'
            }`}
          >
            stats
          </button>
          <button
            onClick={() => setActiveTab('locations')}
            className={`px-4 py-2 font-mono text-sm border-b-2 -mb-px ${
              activeTab === 'locations'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-muted hover:text-[var(--fg)]'
            }`}
          >
            locations
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 font-mono text-sm border-b-2 -mb-px ${
              activeTab === 'requests'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-muted hover:text-[var(--fg)]'
            }`}
          >
            requests {groups.length > 0 && `(${groups.length})`}
          </button>
          {isFeatureEnabled('SEED_SPROUTED') && (
            <button
              onClick={() => setActiveTab('sprouts')}
              className={`px-4 py-2 font-mono text-sm border-b-2 -mb-px ${
                activeTab === 'sprouts'
                  ? 'border-[var(--accent)] text-[var(--accent)]'
                  : 'border-transparent text-muted hover:text-[var(--fg)]'
              }`}
            >
              sprouts {sproutReports.filter(r => r.status === 'pending').length > 0 && `(${sproutReports.filter(r => r.status === 'pending').length})`}
            </button>
          )}
          <button
            onClick={() => setActiveTab('flags')}
            className={`px-4 py-2 font-mono text-sm border-b-2 -mb-px ${
              activeTab === 'flags'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-muted hover:text-[var(--fg)]'
            }`}
          >
            flags
          </button>
          <button
            onClick={() => setActiveTab('controls')}
            className={`px-4 py-2 font-mono text-sm border-b-2 -mb-px ${
              activeTab === 'controls'
                ? 'border-[var(--accent)] text-[var(--accent)]'
                : 'border-transparent text-muted hover:text-[var(--fg)]'
            }`}
          >
            more controls
          </button>
        </div>

        {/* Stats Tab */}
        {activeTab === 'stats' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-sm text-muted">dashboard stats</h2>
              <button
                onClick={fetchStats}
                disabled={statsLoading}
                className="btn text-xs"
              >
                {statsLoading ? 'loading...' : 'refresh'}
              </button>
            </div>

            {statsLoading && !stats ? (
              <div className="text-center py-8 text-muted font-mono">loading stats...</div>
            ) : stats ? (
              <div className="space-y-6">
                {/* Overview Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="border border-[var(--border)] p-4">
                    <div className="text-2xl font-bold text-accent">{stats.posts.today}</div>
                    <div className="text-xs text-muted font-mono">posts today</div>
                  </div>
                  <div className="border border-[var(--border)] p-4">
                    <div className="text-2xl font-bold text-green-600">{stats.seeds.today}</div>
                    <div className="text-xs text-muted font-mono">seeds today</div>
                  </div>
                  <div className="border border-[var(--border)] p-4">
                    <div className="text-2xl font-bold">{stats.sessions.activeToday}</div>
                    <div className="text-xs text-muted font-mono">active sessions</div>
                  </div>
                  <div className="border border-[var(--border)] p-4">
                    <div className="text-2xl font-bold text-amber-500">{stats.requests.pending}</div>
                    <div className="text-xs text-muted font-mono">pending requests</div>
                  </div>
                </div>

                {/* Detailed Stats */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Posts */}
                  <div className="border border-[var(--border)]">
                    <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                      <h3 className="font-mono text-sm font-bold flex items-center gap-2">
                        <Lightning size={16} /> posts
                      </h3>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">total</span>
                        <span className="font-mono">{stats.posts.total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">today</span>
                        <span className="font-mono text-accent">{stats.posts.today}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">this week</span>
                        <span className="font-mono">{stats.posts.thisWeek}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">hidden</span>
                        <span className="font-mono text-red-500">{stats.posts.hidden}</span>
                      </div>
                    </div>
                  </div>

                  {/* Seeds */}
                  <div className="border border-[var(--border)]">
                    <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                      <h3 className="font-mono text-sm font-bold flex items-center gap-2">
                        <Plant size={16} /> seeds
                      </h3>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">total</span>
                        <span className="font-mono">{stats.seeds.total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">today</span>
                        <span className="font-mono text-green-600">{stats.seeds.today}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">this week</span>
                        <span className="font-mono">{stats.seeds.thisWeek}</span>
                      </div>
                      <div className="flex justify-between items-center pt-2 border-t border-[var(--border)]">
                        <span className="text-muted text-sm">success rate</span>
                        <span className="font-mono text-green-600">{stats.seeds.successRate}%</span>
                      </div>
                      <div className="flex gap-2 text-xs">
                        <span className="text-green-600">+{stats.seeds.outcomes.positive}</span>
                        <span className="text-amber-500">~{stats.seeds.outcomes.neutral}</span>
                        <span className="text-red-500">-{stats.seeds.outcomes.negative}</span>
                      </div>
                    </div>
                  </div>

                  {/* Locations */}
                  <div className="border border-[var(--border)]">
                    <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                      <h3 className="font-mono text-sm font-bold flex items-center gap-2">
                        <MapPin size={16} /> locations
                      </h3>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">total</span>
                        <span className="font-mono">{stats.locations.total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">active</span>
                        <span className="font-mono">{stats.locations.active}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">claimed</span>
                        <span className="font-mono text-accent">{stats.locations.claimed}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">from BTCMap</span>
                        <span className="font-mono">{stats.locations.btcmap}</span>
                      </div>
                    </div>
                  </div>

                  {/* Merchants */}
                  <div className="border border-[var(--border)]">
                    <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                      <h3 className="font-mono text-sm font-bold flex items-center gap-2">
                        <Storefront size={16} /> merchants
                      </h3>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">verified claims</span>
                        <span className="font-mono text-green-600">{stats.merchants.verified}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">pending claims</span>
                        <span className="font-mono text-amber-500">{stats.merchants.pending}</span>
                      </div>
                    </div>
                  </div>

                  {/* Sessions */}
                  <div className="border border-[var(--border)]">
                    <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                      <h3 className="font-mono text-sm font-bold flex items-center gap-2">
                        <UsersThree size={16} /> sessions
                      </h3>
                    </div>
                    <div className="p-4 space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">total devices</span>
                        <span className="font-mono">{stats.sessions.total.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted text-sm">active today</span>
                        <span className="font-mono text-accent">{stats.sessions.activeToday}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generated timestamp */}
                <div className="text-xs text-faint font-mono text-center">
                  last updated: {new Date(stats.generatedAt).toLocaleString()}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted font-mono">failed to load stats</div>
            )}
          </>
        )}

        {/* Locations Tab */}
        {activeTab === 'locations' && (
          <>
            <div className="flex flex-col gap-3 mb-4">
              <div className="flex items-center justify-between">
                <h2 className="font-mono text-sm text-muted">
                  locations ({locationsTotal.toLocaleString()})
                </h2>
                <button
                  onClick={() => fetchLocations(locationsPage, locationsSearch, locationsSource)}
                  disabled={locationsLoading}
                  className="btn text-xs"
                >
                  {locationsLoading ? 'loading...' : 'refresh'}
                </button>
              </div>

              {/* Search */}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="search locations..."
                  value={locationsSearch}
                  onChange={(e) => setLocationsSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setLocationsPage(1);
                      fetchLocations(1, locationsSearch, locationsSource);
                    }
                  }}
                  className="flex-1 p-2 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm"
                />
                <button
                  onClick={() => {
                    setLocationsPage(1);
                    fetchLocations(1, locationsSearch, locationsSource);
                  }}
                  className="btn text-xs"
                >
                  search
                </button>
                {locationsSearch && (
                  <button
                    onClick={() => {
                      setLocationsSearch('');
                      setLocationsPage(1);
                      fetchLocations(1, '', locationsSource);
                    }}
                    className="btn text-xs"
                  >
                    clear
                  </button>
                )}
              </div>

              {/* Source Filter */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted font-mono">filter:</span>
                <button
                  onClick={() => {
                    setLocationsSource('all');
                    setLocationsPage(1);
                    fetchLocations(1, locationsSearch, 'all');
                  }}
                  className={`btn text-xs ${locationsSource === 'all' ? 'btn-primary' : ''}`}
                >
                  all
                </button>
                <button
                  onClick={() => {
                    setLocationsSource('btcmap');
                    setLocationsPage(1);
                    fetchLocations(1, locationsSearch, 'btcmap');
                  }}
                  className={`btn text-xs ${locationsSource === 'btcmap' ? 'btn-primary' : ''}`}
                >
                  btcmap
                </button>
                <button
                  onClick={() => {
                    setLocationsSource('manual');
                    setLocationsPage(1);
                    fetchLocations(1, locationsSearch, 'manual');
                  }}
                  className={`btn text-xs ${locationsSource === 'manual' ? 'btn-primary' : ''}`}
                >
                  manual
                </button>
              </div>

              {/* Pagination */}
              {locationsTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    onClick={() => {
                      const newPage = locationsPage - 1;
                      setLocationsPage(newPage);
                      fetchLocations(newPage, locationsSearch, locationsSource);
                    }}
                    disabled={locationsPage <= 1 || locationsLoading}
                    className="btn text-xs"
                  >
                    ← prev
                  </button>
                  <span className="font-mono text-xs text-muted">
                    page {locationsPage} of {locationsTotalPages}
                  </span>
                  <button
                    onClick={() => {
                      const newPage = locationsPage + 1;
                      setLocationsPage(newPage);
                      fetchLocations(newPage, locationsSearch, locationsSource);
                    }}
                    disabled={locationsPage >= locationsTotalPages || locationsLoading}
                    className="btn text-xs"
                  >
                    next →
                  </button>
                </div>
              )}
            </div>

            {locations.length === 0 ? (
              <div className="border border-[var(--border)] p-8 text-center">
                <p className="text-muted font-mono">
                  {locationsSearch ? 'no matching locations' : 'no locations'}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {locations.map((loc) => (
                  <div
                    key={loc.id}
                    className="border border-[var(--border)] hover:border-[var(--accent)] p-4"
                  >
                    {editingLocationId === loc.id ? (
                      // Edit mode
                      <div>
                        <div className="flex gap-2 mb-2">
                          <input
                            type="text"
                            value={editLocationName}
                            onChange={(e) => setEditLocationName(e.target.value)}
                            placeholder="Location name"
                            className="flex-1 p-2 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(loc.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editLocationRadius}
                              onChange={(e) => setEditLocationRadius(e.target.value)}
                              placeholder="Radius"
                              min={10}
                              max={5000}
                              className="w-20 p-2 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm"
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveEdit(loc.id);
                                if (e.key === 'Escape') handleCancelEdit();
                              }}
                            />
                            <span className="text-xs text-muted font-mono">m</span>
                          </div>
                        </div>
                        {/* Location type selector */}
                        <div className="flex gap-2 mb-2">
                          <button
                            type="button"
                            onClick={() => setEditLocationType('merchant')}
                            className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-mono border ${
                              editLocationType === 'merchant'
                                ? 'border-gray-500 bg-gray-100 dark:bg-gray-800'
                                : 'border-[var(--border)] hover:border-gray-400'
                            }`}
                          >
                            <Storefront size={14} className="text-gray-500" />
                            merchant
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLocationType('bitcoin_merchant')}
                            className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-mono border ${
                              editLocationType === 'bitcoin_merchant'
                                ? 'border-[#f7931a] bg-orange-100 dark:bg-orange-900'
                                : 'border-[var(--border)] hover:border-[#f7931a]'
                            }`}
                          >
                            <Lightning size={14} weight="fill" className="text-[#f7931a]" />
                            bitcoin
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditLocationType('community_space')}
                            className={`flex items-center gap-1.5 px-2 py-1.5 text-xs font-mono border ${
                              editLocationType === 'community_space'
                                ? 'border-blue-500 bg-blue-100 dark:bg-blue-900'
                                : 'border-[var(--border)] hover:border-blue-400'
                            }`}
                          >
                            <UsersThree size={14} className="text-blue-500" />
                            community
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSaveEdit(loc.id)}
                            disabled={actionLoading === loc.id}
                            className="btn btn-primary text-xs"
                          >
                            {actionLoading === loc.id ? '...' : 'save'}
                          </button>
                          <button
                            onClick={handleCancelEdit}
                            disabled={actionLoading === loc.id}
                            className="btn text-xs"
                          >
                            cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      // View mode
                      <div
                        className="cursor-pointer"
                        onClick={() => handleSelectLocation(loc)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-mono text-sm font-medium flex items-center gap-2">
                              {loc.name}
                              {loc.location_type === 'bitcoin_merchant' && (
                                <span title="Bitcoin merchant"><Lightning size={14} weight="fill" className="text-[#f7931a]" /></span>
                              )}
                              {loc.location_type === 'community_space' && (
                                <span title="Community space"><UsersThree size={14} className="text-blue-500" /></span>
                              )}
                              {(!loc.location_type || loc.location_type === 'merchant') && (
                                <span title="Merchant"><Storefront size={14} className="text-gray-400" /></span>
                              )}
                              {loc.is_claimed && (
                                <span className="text-xs bg-green-500/20 text-green-600 px-1.5 py-0.5 rounded font-mono">verified</span>
                              )}
                            </div>
                            <div className="text-xs text-muted font-mono">
                              {(loc.address || loc.city) && <span className="text-faint">{parseCityFromAddress(loc.address) || loc.city} · </span>}
                              /{loc.slug}
                              {loc.btcmap_id && <span className="text-faint"> · btcmap #{loc.btcmap_id}</span>}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted font-mono">
                              {loc.radius_m}m · {loc.pin_count || 0}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(loc);
                              }}
                              className="p-1.5 rounded text-muted hover:text-[var(--fg)] hover:bg-[var(--bg-alt)]"
                              title="Edit location"
                            >
                              <PencilSimple size={16} />
                            </button>
                            {/* Merchant actions dropdown */}
                            {(loc.is_claimed || loc.is_bitcoin_merchant) && (
                              <div className="relative group">
                                <button
                                  onClick={(e) => e.stopPropagation()}
                                  className="p-1.5 rounded text-muted hover:text-[var(--fg)] hover:bg-[var(--bg-alt)]"
                                  title="Merchant actions"
                                >
                                  <Storefront size={16} />
                                </button>
                                <div className="absolute right-0 top-full mt-1 bg-[var(--bg)] border border-[var(--border)] shadow-lg z-10 hidden group-hover:block min-w-[140px]">
                                  {loc.is_claimed && (
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleMerchantReset(loc, 'de-verify');
                                      }}
                                      disabled={actionLoading === `merchant-${loc.id}`}
                                      className="block w-full text-left px-3 py-2 text-xs font-mono hover:bg-[var(--bg-alt)] text-danger"
                                    >
                                      de-verify
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMerchantReset(loc, 'reset-settings');
                                    }}
                                    disabled={actionLoading === `merchant-${loc.id}`}
                                    className="block w-full text-left px-3 py-2 text-xs font-mono hover:bg-[var(--bg-alt)]"
                                  >
                                    clear settings
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleMerchantReset(loc, 'full-reset');
                                    }}
                                    disabled={actionLoading === `merchant-${loc.id}`}
                                    className="block w-full text-left px-3 py-2 text-xs font-mono hover:bg-[var(--bg-alt)] text-danger border-t border-[var(--border)]"
                                  >
                                    full reset
                                  </button>
                                </div>
                              </div>
                            )}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleClearPins(loc);
                              }}
                              disabled={actionLoading === `clear-${loc.id}` || (loc.pin_count || 0) === 0}
                              className="p-1.5 rounded text-muted hover:text-danger hover:bg-[var(--bg-alt)] disabled:opacity-30 disabled:hover:text-muted disabled:hover:bg-transparent"
                              title="Clear all posts"
                            >
                              <Broom size={16} />
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLocation(loc);
                              }}
                              disabled={actionLoading === loc.id}
                              className="p-1.5 rounded text-muted hover:text-danger hover:bg-[var(--bg-alt)]"
                              title="Delete location"
                            >
                              <Trash size={16} />
                            </button>
                          </div>
                        </div>
                        <div className="text-xs text-faint font-mono mt-2">
                          {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* Requests Tab */}
        {activeTab === 'requests' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-sm text-muted">pending requests</h2>
              <button
                onClick={fetchRequests}
                disabled={requestsLoading}
                className="btn text-xs"
              >
                {requestsLoading ? 'loading...' : 'refresh'}
              </button>
            </div>

            {groups.length === 0 ? (
              <div className="border border-[var(--border)] p-8 text-center">
                <p className="text-muted font-mono">no pending requests</p>
              </div>
            ) : (
              <div className="space-y-4">
                {groups.map((group) => {
                  const key = `${group.center_lat}-${group.center_lng}`;
                  const isLoading = actionLoading === key;

                  return (
                    <div
                      key={key}
                      className="border border-[var(--border)] bg-[#fafafa] dark:bg-[#0a0a0a]"
                    >
                      {/* Group Header */}
                      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                        <div className="flex items-center justify-between">
                          <div className="font-mono text-sm">
                            <span className="text-muted">coords:</span>{' '}
                            {group.center_lat.toFixed(4)}, {group.center_lng.toFixed(4)}
                          </div>
                          <div className="text-xs text-muted font-mono">
                            {group.requests.length} request{group.requests.length !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      {/* Suggested Names */}
                      <div className="p-4 border-b border-[var(--border)]">
                        <div className="text-xs text-muted font-mono mb-2">suggested names:</div>
                        <div className="flex flex-wrap gap-2">
                          {group.suggested_names.map((name, i) => (
                            <button
                              key={i}
                              onClick={() =>
                                setNewLocationName((prev) => ({ ...prev, [key]: name }))
                              }
                              className="px-2 py-1 text-sm bg-[var(--bg-alt)] border border-[var(--border)] hover:border-[var(--accent)] font-mono"
                            >
                              {name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Individual Requests */}
                      <div className="p-4 border-b border-[var(--border)] max-h-48 overflow-y-auto">
                        <div className="text-xs text-muted font-mono mb-2">requests:</div>
                        <div className="space-y-2">
                          {group.requests.map((req) => (
                            <div key={req.id} className="text-sm font-mono flex justify-between">
                              <span>
                                "{req.suggested_name}"
                                {req.is_bitcoin_merchant && (
                                  <span title="Bitcoin merchant"><Lightning size={14} weight="fill" className="text-[#f7931a] ml-1 inline" /></span>
                                )}
                              </span>
                              <span className="text-faint text-xs">
                                {new Date(req.created_at).toLocaleDateString()}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="p-4">
                        <div className="mb-3">
                          <label className="block text-xs text-muted font-mono mb-1">
                            final location name:
                          </label>
                          <input
                            type="text"
                            value={newLocationName[key] || ''}
                            onChange={(e) =>
                              setNewLocationName((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                            placeholder="Enter location name to approve"
                            className="w-full p-2 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm"
                          />
                        </div>
                        <div className="mb-3">
                          <label className="block text-xs text-muted font-mono mb-1">
                            location type:
                          </label>
                          <div className="space-y-2">
                            {(() => {
                              const defaultType = group.requests.some(r => r.is_bitcoin_merchant) ? 'bitcoin_merchant' : 'merchant';
                              const selectedType = newLocationType[key] || defaultType;
                              return (
                                <>
                                  <label className={`flex items-center gap-2 p-2 border cursor-pointer transition-colors ${
                                    selectedType === 'merchant'
                                      ? 'border-gray-500 bg-gray-50 dark:bg-gray-900'
                                      : 'border-[var(--border)]'
                                  }`}>
                                    <input
                                      type="radio"
                                      name={`location_type_${key}`}
                                      checked={selectedType === 'merchant'}
                                      onChange={() => setNewLocationType((prev) => ({ ...prev, [key]: 'merchant' }))}
                                      className="w-4 h-4 m-0 p-0 !w-4"
                                    />
                                    <Storefront size={16} className="text-gray-500" />
                                    <span className="text-sm font-mono">business (no bitcoin)</span>
                                  </label>
                                  <label className={`flex items-center gap-2 p-2 border cursor-pointer transition-colors ${
                                    selectedType === 'bitcoin_merchant'
                                      ? 'border-[#f7931a] bg-orange-50 dark:bg-orange-950'
                                      : 'border-[var(--border)]'
                                  }`}>
                                    <input
                                      type="radio"
                                      name={`location_type_${key}`}
                                      checked={selectedType === 'bitcoin_merchant'}
                                      onChange={() => setNewLocationType((prev) => ({ ...prev, [key]: 'bitcoin_merchant' }))}
                                      className="w-4 h-4 m-0 p-0 !w-4 accent-[#f7931a]"
                                    />
                                    <Lightning size={16} weight="fill" className="text-[#f7931a]" />
                                    <span className="text-sm font-mono">business (accepts bitcoin)</span>
                                  </label>
                                  <label className={`flex items-center gap-2 p-2 border cursor-pointer transition-colors ${
                                    selectedType === 'community_space'
                                      ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                                      : 'border-[var(--border)]'
                                  }`}>
                                    <input
                                      type="radio"
                                      name={`location_type_${key}`}
                                      checked={selectedType === 'community_space'}
                                      onChange={() => setNewLocationType((prev) => ({ ...prev, [key]: 'community_space' }))}
                                      className="w-4 h-4 m-0 p-0 !w-4 accent-blue-500"
                                    />
                                    <UsersThree size={16} className="text-blue-500" />
                                    <span className="text-sm font-mono">community space</span>
                                  </label>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(group)}
                            disabled={isLoading || !newLocationName[key]?.trim()}
                            className="btn btn-primary flex-1 justify-center disabled:opacity-50"
                          >
                            {isLoading ? 'processing...' : 'approve & create location'}
                          </button>
                          <button
                            onClick={() => handleReject(group)}
                            disabled={isLoading}
                            className="btn flex-1 justify-center disabled:opacity-50"
                          >
                            reject all
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Flags Tab */}
        {activeTab === 'flags' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-sm text-muted">feature flags</h2>
              <button
                onClick={fetchFlags}
                disabled={flagsLoading}
                className="btn text-xs"
              >
                {flagsLoading ? 'loading...' : 'refresh'}
              </button>
            </div>

            {flagsLoading && featureFlags.length === 0 ? (
              <div className="border border-[var(--border)] p-8 text-center">
                <p className="text-muted font-mono">loading flags...</p>
              </div>
            ) : featureFlags.length === 0 ? (
              <div className="border border-[var(--border)] p-8 text-center">
                <p className="text-muted font-mono">no feature flags configured</p>
                <p className="text-xs text-faint font-mono mt-2">run the database migration first</p>
              </div>
            ) : (
              <div className="space-y-2">
                {/* Feature flags organized with sub-features under parents */}
                <div className="text-xs text-muted font-mono mb-2">
                  feature flags:
                </div>
                {(() => {
                  // Sub-flags are nested under their parent - define which flags are children
                  const subFlagParents: Record<string, string> = {
                    'PROXHOME_ADVANCED': 'PROXHOME',
                  };
                  // Fancy sub-flags (fancy_* except fancy_board_enabled) are children of fancy_board_enabled
                  const fancySubFlags = featureFlags
                    .filter((f) => f.key.startsWith('fancy_') && f.key !== 'fancy_board_enabled')
                    .map((f) => f.key);
                  fancySubFlags.forEach((key) => {
                    subFlagParents[key] = 'fancy_board_enabled';
                  });

                  // All flags that aren't sub-flags are major flags
                  const allSubFlagKeys = Object.keys(subFlagParents);
                  const majorFlags = featureFlags
                    .filter((f) => !allSubFlagKeys.includes(f.key))
                    .map((f) => f.key);

                  const renderMajorFlag = (flag: FeatureFlag) => (
                    <div
                      key={flag.id}
                      className={`border-2 p-4 ${
                        flag.enabled
                          ? 'border-[var(--accent)] bg-[var(--accent)]/10'
                          : 'border-[var(--border)]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-mono text-sm font-bold flex items-center gap-2">
                            {flag.enabled ? '🟢' : '⚪'} {flag.key}
                          </div>
                          <div className="text-xs text-muted font-mono mt-1">
                            {flag.description || 'No description'}
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleFlag(flag)}
                          disabled={actionLoading === flag.id}
                          className={`px-4 py-2 font-mono text-sm ${
                            flag.enabled
                              ? 'bg-[var(--accent)] text-black'
                              : 'bg-[var(--bg-alt)] border border-[var(--border)]'
                          }`}
                        >
                          {actionLoading === flag.id ? '...' : flag.enabled ? 'ON' : 'OFF'}
                        </button>
                      </div>
                    </div>
                  );

                  const renderSubFlag = (flag: FeatureFlag, masterKey: string, displayName?: string) => {
                    const masterEnabled = featureFlags.find((f) => f.key === masterKey)?.enabled;
                    return (
                      <div
                        key={flag.id}
                        className={`border border-[var(--border)] p-3 ml-6 ${
                          !masterEnabled ? 'opacity-50' : ''
                        } ${flag.enabled && masterEnabled ? 'border-l-4 border-l-[var(--accent)]' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-mono text-sm flex items-center gap-2">
                              {flag.enabled ? '🟢' : '⚪'} {displayName || flag.key}
                            </div>
                            <div className="text-xs text-muted font-mono mt-1">
                              {flag.description || 'No description'}
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleFlag(flag)}
                            disabled={actionLoading === flag.id}
                            className={`px-3 py-1 font-mono text-xs ${
                              flag.enabled
                                ? 'bg-[var(--accent)] text-black'
                                : 'bg-[var(--bg-alt)] border border-[var(--border)]'
                            }`}
                          >
                            {actionLoading === flag.id ? '...' : flag.enabled ? 'ON' : 'OFF'}
                          </button>
                        </div>
                      </div>
                    );
                  };

                  // Get sub-flags for a given parent key
                  const getSubFlags = (parentKey: string) =>
                    featureFlags.filter((f) => subFlagParents[f.key] === parentKey);

                  return featureFlags
                    .filter((flag) => majorFlags.includes(flag.key))
                    .map((flag) => (
                      <div key={flag.id}>
                        {renderMajorFlag(flag)}

                        {/* Render any sub-flags for this parent */}
                        {getSubFlags(flag.key).map((subFlag) =>
                          renderSubFlag(
                            subFlag,
                            flag.key,
                            subFlag.key.startsWith('fancy_') ? subFlag.key.replace('fancy_', '') : undefined
                          )
                        )}
                      </div>
                    ));
                })()}
              </div>
            )}
          </>
        )}

        {/* Controls Tab */}
        {activeTab === 'controls' && (
          <>
            <div className="mb-4">
              <h2 className="font-mono text-sm text-muted">global controls</h2>
              <p className="text-xs text-faint font-mono mt-1">app settings and danger zone controls</p>
            </div>

            <div className="space-y-6">
              {/* Design Theme Selector */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h3 className="font-mono text-sm font-bold flex items-center gap-2">
                    <Palette size={16} /> design theme
                  </h3>
                </div>
                <div className="p-4">
                  <p className="text-xs text-muted mb-3">choose the app&apos;s visual style</p>
                  <div className="flex flex-col gap-2">
                    <label className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors ${
                      designTheme === 'mono'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                        : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                    }`}>
                      <input
                        type="radio"
                        name="design_theme"
                        value="mono"
                        checked={designTheme === 'mono'}
                        onChange={() => handleSetDesignTheme('mono')}
                        disabled={themeLoading}
                        className="m-0 p-0 !w-4"
                      />
                      <div>
                        <div className="font-mono text-sm font-bold">mono</div>
                        <div className="text-xs text-muted">clean, minimal, modern design (default)</div>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors ${
                      designTheme === 'forstall'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                        : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                    }`}>
                      <input
                        type="radio"
                        name="design_theme"
                        value="forstall"
                        checked={designTheme === 'forstall'}
                        onChange={() => handleSetDesignTheme('forstall')}
                        disabled={themeLoading}
                        className="m-0 p-0 !w-4"
                      />
                      <div>
                        <div className="font-mono text-sm font-bold">forstall</div>
                        <div className="text-xs text-muted">skeuomorphic, pre-iOS7 style with cork, leather, and brushed metal</div>
                      </div>
                    </label>
                    <label className={`flex items-center gap-3 p-3 border rounded cursor-pointer transition-colors ${
                      designTheme === 'neo2026'
                        ? 'border-[var(--accent)] bg-[var(--accent)]/5'
                        : 'border-[var(--border)] hover:border-[var(--accent)]/50'
                    }`}>
                      <input
                        type="radio"
                        name="design_theme"
                        value="neo2026"
                        checked={designTheme === 'neo2026'}
                        onChange={() => handleSetDesignTheme('neo2026')}
                        disabled={themeLoading}
                        className="m-0 p-0 !w-4"
                      />
                      <div>
                        <div className="font-mono text-sm font-bold">neo2026</div>
                        <div className="text-xs text-muted">2026 neoskeuomorphism — warm porcelain surfaces, soft shadows, amber accents</div>
                      </div>
                    </label>
                  </div>
                  {themeLoading && (
                    <div className="mt-2 text-xs text-muted font-mono">applying theme...</div>
                  )}
                </div>
              </div>

              {/* Seed Controls */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h3 className="font-mono text-sm font-bold flex items-center gap-2">
                    <Plant size={16} /> seed controls
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">reset all seed plantings</div>
                      <div className="text-xs text-muted">deletes all seed data across all locations</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('DELETE ALL SEED PLANTINGS? This cannot be undone!')) return;
                        if (!confirm('Are you REALLY sure? This will reset ALL seed data!')) return;
                        setActionLoading('reset-all-seeds');
                        try {
                          const res = await fetch('/api/admin/global/reset-seeds', {
                            method: 'DELETE',
                            headers: getAuthHeaders(),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            alert(`Deleted ${data.deleted_count} seed plantings`);
                          } else {
                            alert(data.error || 'Failed to reset seeds');
                          }
                        } catch {
                          alert('Failed to reset seeds');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === 'reset-all-seeds'}
                      className="btn text-xs text-danger border-danger hover:bg-danger hover:text-white"
                    >
                      {actionLoading === 'reset-all-seeds' ? '...' : 'reset all seeds'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Pin Controls */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h3 className="font-mono text-sm font-bold flex items-center gap-2">
                    <Lightning size={16} /> post controls
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">purge hidden posts</div>
                      <div className="text-xs text-muted">permanently delete all hidden/moderated posts</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('DELETE ALL HIDDEN POSTS? This cannot be undone!')) return;
                        setActionLoading('purge-hidden');
                        try {
                          const res = await fetch('/api/admin/global/purge-hidden-pins', {
                            method: 'DELETE',
                            headers: getAuthHeaders(),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            alert(`Deleted ${data.deleted_count} hidden posts`);
                          } else {
                            alert(data.error || 'Failed to purge posts');
                          }
                        } catch {
                          alert('Failed to purge posts');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === 'purge-hidden'}
                      className="btn text-xs"
                    >
                      {actionLoading === 'purge-hidden' ? '...' : 'purge hidden'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">reset all posts</div>
                      <div className="text-xs text-muted">deletes ALL posts across all locations</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('DELETE ALL POSTS? This cannot be undone!')) return;
                        if (!confirm('Are you REALLY sure? This will delete EVERY post!')) return;
                        setActionLoading('reset-all-posts');
                        try {
                          const res = await fetch('/api/admin/global/reset-posts', {
                            method: 'DELETE',
                            headers: getAuthHeaders(),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            alert(`Deleted ${data.deleted_count} posts`);
                          } else {
                            alert(data.error || 'Failed to reset posts');
                          }
                        } catch {
                          alert('Failed to reset posts');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === 'reset-all-posts'}
                      className="btn text-xs text-danger border-danger hover:bg-danger hover:text-white"
                    >
                      {actionLoading === 'reset-all-posts' ? '...' : 'reset all posts'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Merchant Controls */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h3 className="font-mono text-sm font-bold flex items-center gap-2">
                    <Storefront size={16} /> merchant controls
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">reset all merchant claims</div>
                      <div className="text-xs text-muted">removes verification from all locations</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('RESET ALL MERCHANT CLAIMS? This cannot be undone!')) return;
                        setActionLoading('reset-merchants');
                        try {
                          const res = await fetch('/api/admin/global/reset-merchant-claims', {
                            method: 'DELETE',
                            headers: getAuthHeaders(),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            alert(`Reset ${data.reset_count} merchant claims`);
                          } else {
                            alert(data.error || 'Failed to reset merchants');
                          }
                        } catch {
                          alert('Failed to reset merchants');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === 'reset-merchants'}
                      className="btn text-xs text-danger border-danger hover:bg-danger hover:text-white"
                    >
                      {actionLoading === 'reset-merchants' ? '...' : 'reset all claims'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Location Request Controls */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h3 className="font-mono text-sm font-bold">request controls</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">clear all pending requests</div>
                      <div className="text-xs text-muted">reject all location requests</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('CLEAR ALL PENDING REQUESTS? This cannot be undone!')) return;
                        setActionLoading('clear-requests');
                        try {
                          const res = await fetch('/api/admin/global/clear-requests', {
                            method: 'DELETE',
                            headers: getAuthHeaders(),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            alert(`Cleared ${data.deleted_count} requests`);
                            fetchRequests();
                          } else {
                            alert(data.error || 'Failed to clear requests');
                          }
                        } catch {
                          alert('Failed to clear requests');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === 'clear-requests'}
                      className="btn text-xs"
                    >
                      {actionLoading === 'clear-requests' ? '...' : 'clear all'}
                    </button>
                  </div>
                </div>
              </div>

              {/* BTCMap Controls */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h3 className="font-mono text-sm font-bold flex items-center gap-2">
                    <MapPin size={16} /> btcmap controls
                  </h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">trigger btcmap sync</div>
                      <div className="text-xs text-muted">manually resync data from BTCMap API</div>
                    </div>
                    <button
                      onClick={async () => {
                        setActionLoading('btcmap-sync');
                        try {
                          const res = await fetch('/api/admin/global/btcmap-sync', {
                            method: 'POST',
                            headers: getAuthHeaders(),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            alert(`Synced ${data.synced_count} locations from BTCMap`);
                            fetchLocations(1, '', locationsSource);
                          } else {
                            alert(data.error || 'Failed to sync BTCMap');
                          }
                        } catch {
                          alert('Failed to sync BTCMap');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === 'btcmap-sync'}
                      className="btn text-xs btn-primary"
                    >
                      {actionLoading === 'btcmap-sync' ? 'syncing...' : 'sync now'}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">clear btcmap locations</div>
                      <div className="text-xs text-muted">removes all BTCMap-imported locations</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('DELETE ALL BTCMAP LOCATIONS? This cannot be undone!')) return;
                        if (!confirm('Are you REALLY sure? This will remove all BTCMap-imported locations!')) return;
                        setActionLoading('clear-btcmap');
                        try {
                          const res = await fetch('/api/admin/global/clear-btcmap-locations', {
                            method: 'DELETE',
                            headers: getAuthHeaders(),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            alert(`Deleted ${data.deleted_count} BTCMap locations`);
                            fetchLocations(1, '', locationsSource);
                          } else {
                            alert(data.error || 'Failed to clear BTCMap locations');
                          }
                        } catch {
                          alert('Failed to clear BTCMap locations');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === 'clear-btcmap'}
                      className="btn text-xs text-danger border-danger hover:bg-danger hover:text-white"
                    >
                      {actionLoading === 'clear-btcmap' ? '...' : 'clear btcmap'}
                    </button>
                  </div>
                </div>
              </div>

              {/* Session Controls */}
              <div className="border border-[var(--border)]">
                <div className="px-4 py-2 border-b border-[var(--border)] bg-[var(--bg-alt)]">
                  <h3 className="font-mono text-sm font-bold">session controls</h3>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">reset my device session</div>
                      <div className="text-xs text-muted">get a fresh session (clears seed/post limits)</div>
                    </div>
                    <button
                      onClick={() => {
                        if (!confirm('Reset your device session? You\'ll get a new session ID.')) return;
                        // Clear the session cookie
                        document.cookie = 'device_session_id=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
                        localStorage.removeItem('device_session_id');
                        // Clear all seed_planted keys from localStorage
                        const keysToRemove: string[] = [];
                        for (let i = 0; i < localStorage.length; i++) {
                          const key = localStorage.key(i);
                          if (key?.startsWith('seed_planted_')) {
                            keysToRemove.push(key);
                          }
                        }
                        keysToRemove.forEach(key => localStorage.removeItem(key));
                        alert(`Session cleared! Removed ${keysToRemove.length} seed tracking entries. Refreshing...`);
                        window.location.reload();
                      }}
                      className="btn text-xs btn-primary"
                    >
                      reset my session
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-mono text-sm">clear all sessions</div>
                      <div className="text-xs text-muted">removes all device session data</div>
                    </div>
                    <button
                      onClick={async () => {
                        if (!confirm('CLEAR ALL SESSIONS? Users will need to refresh.')) return;
                        setActionLoading('clear-sessions');
                        try {
                          const res = await fetch('/api/admin/global/clear-sessions', {
                            method: 'DELETE',
                            headers: getAuthHeaders(),
                          });
                          const data = await res.json();
                          if (res.ok) {
                            alert(`Cleared ${data.deleted_count} sessions`);
                          } else {
                            alert(data.error || 'Failed to clear sessions');
                          }
                        } catch {
                          alert('Failed to clear sessions');
                        } finally {
                          setActionLoading(null);
                        }
                      }}
                      disabled={actionLoading === 'clear-sessions'}
                      className="btn text-xs"
                    >
                      {actionLoading === 'clear-sessions' ? '...' : 'clear sessions'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Sprouts Tab */}
        {activeTab === 'sprouts' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-mono">sprout reports</h2>
              <div className="flex items-center gap-2">
                <select
                  value={sproutsFilter}
                  onChange={(e) => {
                    setSproutsFilter(e.target.value as 'pending' | 'all');
                    fetchSprouts(e.target.value as 'pending' | 'all');
                  }}
                  className="px-2 py-1 border border-[var(--border)] bg-[var(--bg-alt)] text-[var(--fg)] font-mono text-sm"
                >
                  <option value="pending">pending</option>
                  <option value="all">all</option>
                </select>
                <button
                  onClick={() => fetchSprouts(sproutsFilter)}
                  disabled={sproutsLoading}
                  className="btn text-xs"
                >
                  {sproutsLoading ? '...' : 'refresh'}
                </button>
              </div>
            </div>

            {sproutsLoading ? (
              <p className="text-muted font-mono text-sm">loading...</p>
            ) : sproutReports.length === 0 ? (
              <p className="text-muted font-mono text-sm">no {sproutsFilter} reports</p>
            ) : (
              <div className="space-y-4">
                {sproutReports.map((report) => (
                  <div key={report.id} className="border border-[var(--border)] p-4">
                    <div className="flex gap-4">
                      {/* Photo thumbnail */}
                      <div className="flex-shrink-0">
                        <img
                          src={report.photo_url}
                          alt="Sprout evidence"
                          className="w-24 h-24 object-cover border border-[var(--border)] cursor-pointer"
                          onClick={() => window.open(report.photo_url, '_blank')}
                        />
                      </div>

                      {/* Report details */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <h3 className="font-mono text-sm font-bold truncate">
                              {report.location?.name || 'Unknown location'}
                            </h3>
                            <p className="text-xs text-muted truncate">
                              {report.location?.address || 'No address'}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 text-xs font-mono ${
                            report.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' :
                            report.status === 'approved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' :
                            report.status === 'rejected' ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}>
                            {report.status}
                          </span>
                        </div>

                        <div className="mt-2 space-y-1">
                          <p className="text-xs text-muted font-mono">
                            payment: <span className="text-[var(--fg)]">{report.payment_type}</span>
                          </p>
                          {report.identity && (
                            <p className="text-xs text-muted font-mono">
                              reporter: <span className="text-[var(--fg)]">@{report.identity.display_name || report.identity.anon_nym}</span>
                            </p>
                          )}
                          {report.context && (
                            <p className="text-xs text-muted font-mono mt-2">
                              &quot;{report.context}&quot;
                            </p>
                          )}
                          <p className="text-xs text-faint font-mono">
                            {new Date(report.created_at).toLocaleString()}
                          </p>
                        </div>

                        {/* Actions for pending reports */}
                        {report.status === 'pending' && (
                          <div className="mt-3 flex gap-2">
                            <button
                              onClick={() => handleSproutAction(report.id, 'approve')}
                              disabled={reportActionLoading === report.id}
                              className="btn text-xs bg-green-100 border-green-500 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-300"
                            >
                              {reportActionLoading === report.id ? '...' : 'approve'}
                            </button>
                            <button
                              onClick={() => {
                                const notes = prompt('Reason for rejection (optional):');
                                handleSproutAction(report.id, 'reject', notes || undefined);
                              }}
                              disabled={reportActionLoading === report.id}
                              className="btn text-xs bg-red-100 border-red-500 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-300"
                            >
                              reject
                            </button>
                            <button
                              onClick={() => {
                                const notes = prompt('What info is needed?');
                                if (notes) handleSproutAction(report.id, 'needs_info', notes);
                              }}
                              disabled={reportActionLoading === report.id}
                              className="btn text-xs"
                            >
                              needs info
                            </button>
                          </div>
                        )}

                        {report.reviewer_notes && (
                          <p className="mt-2 text-xs text-muted font-mono italic">
                            notes: {report.reviewer_notes}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
