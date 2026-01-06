'use client';

import { useState, useCallback } from 'react';
import { GeolocationState, Location } from '@/types';

interface UseGeolocationResult {
  state: GeolocationState;
  location: Location | null;
  presenceToken: string | null;
  distanceM: number | null;
  requestLocation: () => Promise<void>;
  error: string | null;
}

export function useGeolocation(sessionId: string | null): UseGeolocationResult {
  const [state, setState] = useState<GeolocationState>({
    status: 'idle',
    position: null,
    error: null,
  });
  const [location, setLocation] = useState<Location | null>(null);
  const [presenceToken, setPresenceToken] = useState<string | null>(null);
  const [distanceM, setDistanceM] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const requestLocation = useCallback(async () => {
    if (!sessionId) {
      setError('Session not initialized');
      return;
    }

    setState({ status: 'requesting', position: null, error: null });
    setError(null);

    // Request browser geolocation
    if (!navigator.geolocation) {
      setState({ status: 'error', position: null, error: 'Geolocation not supported' });
      setError('Your browser does not support geolocation');
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
        });
      });

      // Keep status as 'requesting' while we resolve the location from server
      // Resolve location from server
      const response = await fetch('/api/resolve-location', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy,
          session_id: sessionId,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setState({ status: 'error', position, error: data.error });
        setError(data.error || 'Failed to resolve location');
        setLocation(null);
        setPresenceToken(null);
        return;
      }

      if (!data.location) {
        setState({ status: 'error', position, error: data.message });
        setError(data.message || 'No Clickpin board here yet');
        setLocation(null);
        setPresenceToken(null);
        return;
      }

      // Only set success after we have the location
      setLocation(data.location);
      setPresenceToken(data.presence_token);
      setDistanceM(data.distance_m);
      setError(null);
      setState({ status: 'success', position, error: null });
    } catch (geoError) {
      const err = geoError as GeolocationPositionError;
      let errorMessage = 'Failed to get your location';

      switch (err.code) {
        case err.PERMISSION_DENIED:
          errorMessage = 'Location permission denied. Please enable location access.';
          setState({ status: 'denied', position: null, error: errorMessage });
          break;
        case err.POSITION_UNAVAILABLE:
          errorMessage = 'Location unavailable. Please try again.';
          setState({ status: 'error', position: null, error: errorMessage });
          break;
        case err.TIMEOUT:
          errorMessage = 'Location request timed out. Please try again.';
          setState({ status: 'error', position: null, error: errorMessage });
          break;
        default:
          setState({ status: 'error', position: null, error: errorMessage });
      }

      setError(errorMessage);
    }
  }, [sessionId]);

  return {
    state,
    location,
    presenceToken,
    distanceM,
    requestLocation,
    error,
  };
}
