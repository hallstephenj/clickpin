'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

interface Location {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  radius_m: number;
}

interface LocationMapProps {
  userLat?: number;
  userLng?: number;
}

// Custom marker icon (Leaflet's default icons have issues with Next.js)
const createIcon = (color: string) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24],
  });
};

const locationIcon = createIcon('#f7931a'); // Bitcoin orange
const userIcon = createIcon('#3b82f6'); // Blue for user

// Component to update map center when user location changes
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

export function LocationMap({ userLat, userLng }: LocationMapProps) {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(
    userLat && userLng ? [userLat, userLng] : null
  );

  // Default center (Austin, TX if no user location)
  const defaultCenter: [number, number] = [30.2672, -97.7431];
  const center = userPosition || defaultCenter;

  useEffect(() => {
    // Try to get user's location if not provided
    if (!userPosition && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserPosition([pos.coords.latitude, pos.coords.longitude]);
        },
        () => {
          // Silently fail, just use default
        },
        { enableHighAccuracy: false, timeout: 5000 }
      );
    }
  }, [userPosition]);

  useEffect(() => {
    const fetchLocations = async () => {
      setLoading(true);
      try {
        const params = userPosition
          ? `?lat=${userPosition[0]}&lng=${userPosition[1]}`
          : '';
        const response = await fetch(`/api/nearby-locations${params}`);
        const data = await response.json();
        if (response.ok) {
          setLocations(data.locations || []);
        }
      } catch (err) {
        console.error('Failed to fetch locations:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLocations();
  }, [userPosition]);

  return (
    <div className="relative w-full h-full">
      <MapContainer
        center={center}
        zoom={8}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapUpdater center={center} />

        {/* User location marker */}
        {userPosition && (
          <Marker position={userPosition} icon={userIcon}>
            <Popup>
              <div className="font-mono text-sm">
                <strong>You are here</strong>
              </div>
            </Popup>
          </Marker>
        )}

        {/* Location radius circles */}
        {locations.map((loc) => (
          <Circle
            key={`circle-${loc.id}`}
            center={[loc.lat, loc.lng]}
            radius={loc.radius_m}
            pathOptions={{
              color: '#f7931a',
              fillColor: '#f7931a',
              fillOpacity: 0.1,
              weight: 2,
              opacity: 0.6,
            }}
          />
        ))}

        {/* Location markers */}
        {locations.map((loc) => (
          <Marker
            key={loc.id}
            position={[loc.lat, loc.lng]}
            icon={locationIcon}
          >
            <Popup>
              <div className="font-mono text-sm">
                <strong className="text-[#f7931a]">⚡ {loc.name}</strong>
                <p className="text-xs text-gray-500 mt-1">
                  Radius: {loc.radius_m}m
                </p>
                <p className="text-xs text-gray-500">
                  Go here to view the board
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>

      {/* Loading overlay */}
      {loading && (
        <div className="absolute inset-0 bg-black/20 flex items-center justify-center z-[1000]">
          <div className="bg-white dark:bg-[#0a0a0a] px-4 py-2 rounded font-mono text-sm">
            loading locations...
          </div>
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-[#0a0a0a] border border-[var(--border)] px-3 py-2 z-[1000] font-mono text-xs">
        <div className="flex items-center gap-2 mb-1">
          <span style={{ color: '#f7931a' }}>●</span>
          <span>clickpin board ({locations.length})</span>
        </div>
        {userPosition && (
          <div className="flex items-center gap-2">
            <span style={{ color: '#3b82f6' }}>●</span>
            <span>your location</span>
          </div>
        )}
      </div>
    </div>
  );
}
