'use client';

import { useState, useEffect, useCallback } from 'react';

interface LocationRequest {
  id: string;
  lat: number;
  lng: number;
  suggested_name: string;
  status: string;
  created_at: string;
}

interface GroupedRequest {
  center_lat: number;
  center_lng: number;
  requests: LocationRequest[];
  suggested_names: string[];
}

interface Location {
  id: string;
  slug: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  created_at: string;
  pin_count?: number;
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

type Tab = 'requests' | 'locations';
type View = 'list' | 'pins';

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>('locations');
  const [currentView, setCurrentView] = useState<View>('list');

  // Requests state
  const [groups, setGroups] = useState<GroupedRequest[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [newLocationName, setNewLocationName] = useState<Record<string, string>>({});

  // Locations state
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationsLoading, setLocationsLoading] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [locationPins, setLocationPins] = useState<Pin[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [editLocationName, setEditLocationName] = useState('');

  const fetchRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const response = await fetch('/api/admin/location-requests', {
        headers: { 'X-Admin-Password': password },
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
  }, [password]);

  const fetchLocations = useCallback(async () => {
    setLocationsLoading(true);
    try {
      const response = await fetch('/api/admin/locations', {
        headers: { 'X-Admin-Password': password },
      });
      if (response.ok) {
        const data = await response.json();
        setLocations(data.locations || []);
      }
    } catch (err) {
      console.error('Failed to fetch locations:', err);
    } finally {
      setLocationsLoading(false);
    }
  }, [password]);

  const fetchLocationPins = useCallback(async (locationId: string) => {
    setPinsLoading(true);
    try {
      const response = await fetch(`/api/admin/locations/${locationId}/pins`, {
        headers: { 'X-Admin-Password': password },
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
  }, [password]);

  useEffect(() => {
    if (authenticated && currentView === 'list') {
      if (activeTab === 'requests') {
        fetchRequests();
      } else {
        fetchLocations();
      }
    }
  }, [authenticated, activeTab, currentView, fetchRequests, fetchLocations]);

  useEffect(() => {
    if (selectedLocation && currentView === 'pins') {
      fetchLocationPins(selectedLocation.id);
    }
  }, [selectedLocation, currentView, fetchLocationPins]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    try {
      const response = await fetch('/api/admin/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (response.ok) {
        setAuthenticated(true);
      } else {
        setAuthError('invalid password');
      }
    } catch {
      setAuthError('authentication failed');
    }
  };

  const handleApprove = async (group: GroupedRequest) => {
    const name = newLocationName[`${group.center_lat}-${group.center_lng}`];
    if (!name?.trim()) {
      alert('Please enter a location name');
      return;
    }

    setActionLoading(`${group.center_lat}-${group.center_lng}`);
    try {
      const response = await fetch('/api/admin/approve-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({
          lat: group.center_lat,
          lng: group.center_lng,
          name: name.trim(),
          request_ids: group.requests.map((r) => r.id),
        }),
      });

      if (response.ok) {
        await fetchRequests();
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
          'X-Admin-Password': password,
        },
        body: JSON.stringify({
          request_ids: group.requests.map((r) => r.id),
        }),
      });

      if (response.ok) {
        await fetchRequests();
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

  const handleSelectLocation = (location: Location) => {
    setSelectedLocation(location);
    setCurrentView('pins');
    setShowHidden(false);
  };

  const handleBackToLocations = () => {
    setCurrentView('list');
    setSelectedLocation(null);
    setLocationPins([]);
  };

  const handleStartEdit = (location: Location) => {
    setEditingLocationId(location.id);
    setEditLocationName(location.name);
  };

  const handleCancelEdit = () => {
    setEditingLocationId(null);
    setEditLocationName('');
  };

  const handleSaveEdit = async (locationId: string) => {
    if (!editLocationName.trim()) {
      alert('Please enter a location name');
      return;
    }

    setActionLoading(locationId);
    try {
      const response = await fetch(`/api/admin/locations/${locationId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Password': password,
        },
        body: JSON.stringify({ name: editLocationName.trim() }),
      });

      if (response.ok) {
        const data = await response.json();
        setLocations((prev) =>
          prev.map((loc) =>
            loc.id === locationId
              ? { ...loc, name: data.location.name, slug: data.location.slug }
              : loc
          )
        );
        setEditingLocationId(null);
        setEditLocationName('');
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
        headers: { 'X-Admin-Password': password },
      });

      if (response.ok) {
        await fetchLocations();
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

  const handleDeletePin = async (pinId: string) => {
    if (!confirm('Delete this pin?')) return;

    setActionLoading(pinId);
    try {
      const response = await fetch(`/api/admin/pins/${pinId}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Password': password },
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
        headers: { 'X-Admin-Password': password },
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

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-[#fafafa] dark:bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-sm w-full">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold mb-1">
              <span className="text-accent">⚡</span> clickpin admin
            </h1>
            <p className="text-muted text-sm font-mono">location management</p>
          </div>

          <form onSubmit={handleLogin} className="border border-[var(--border)] p-6">
            <div className="mb-4">
              <label className="block text-xs text-muted font-mono mb-1">
                admin password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-2 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm"
                autoFocus
              />
            </div>

            {authError && (
              <p className="mb-4 text-xs text-danger font-mono">{authError}</p>
            )}

            <button type="submit" className="btn btn-primary w-full justify-center">
              login
            </button>
          </form>
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
              onClick={handleBackToLocations}
              className="text-sm text-muted hover:text-[var(--fg)] font-mono mb-4 flex items-center gap-1"
            >
              ← back to locations
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
            <h1 className="text-2xl font-bold">
              <span className="text-accent">⚡</span> clickpin admin
            </h1>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[var(--border)]">
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
        </div>

        {/* Locations Tab */}
        {activeTab === 'locations' && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono text-sm text-muted">all locations</h2>
              <button
                onClick={fetchLocations}
                disabled={locationsLoading}
                className="btn text-xs"
              >
                {locationsLoading ? 'loading...' : 'refresh'}
              </button>
            </div>

            {locations.length === 0 ? (
              <div className="border border-[var(--border)] p-8 text-center">
                <p className="text-muted font-mono">no locations</p>
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
                            className="flex-1 p-2 bg-[var(--bg-alt)] border border-[var(--border)] font-mono text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleSaveEdit(loc.id);
                              if (e.key === 'Escape') handleCancelEdit();
                            }}
                          />
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
                            <div className="font-mono text-sm font-medium">{loc.name}</div>
                            <div className="text-xs text-muted font-mono">/{loc.slug}</div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-muted font-mono">
                              {loc.pin_count || 0} pin{loc.pin_count !== 1 ? 's' : ''}
                            </span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleStartEdit(loc);
                              }}
                              className="text-xs text-muted hover:text-[var(--fg)] font-mono"
                            >
                              edit
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteLocation(loc);
                              }}
                              disabled={actionLoading === loc.id}
                              className="text-xs text-danger hover:underline font-mono"
                            >
                              {actionLoading === loc.id ? '...' : 'delete'}
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
                              <span>"{req.suggested_name}"</span>
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
      </div>
    </div>
  );
}
