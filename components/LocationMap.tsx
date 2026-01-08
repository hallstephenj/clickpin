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
  btcmap_id?: number | null;
  is_bitcoin_merchant?: boolean;
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

const bitcoinMerchantIcon = createIcon('#f7931a'); // Bitcoin orange for merchants
const communityIcon = createIcon('#6b7280'); // Gray for community boards
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
        {locations.map((loc) => {
          const isBitcoinMerchant = !!loc.btcmap_id || !!loc.is_bitcoin_merchant;
          const color = isBitcoinMerchant ? '#f7931a' : '#6b7280';
          return (
            <Circle
              key={`circle-${loc.id}`}
              center={[loc.lat, loc.lng]}
              radius={loc.radius_m}
              pathOptions={{
                color,
                fillColor: color,
                fillOpacity: 0.1,
                weight: 2,
                opacity: 0.6,
              }}
            />
          );
        })}

        {/* Location markers */}
        {locations.map((loc) => {
          const isBitcoinMerchant = !!loc.btcmap_id || !!loc.is_bitcoin_merchant;
          return (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={isBitcoinMerchant ? bitcoinMerchantIcon : communityIcon}
            >
              <Popup>
                <div className="font-mono text-sm">
                  <strong style={{ color: isBitcoinMerchant ? '#f7931a' : '#6b7280' }}>
                    {isBitcoinMerchant ? '⚡ ' : ''}{loc.name}
                  </strong>
                  {isBitcoinMerchant && (
                    <p className="text-xs text-[#f7931a] mt-1">
                      Bitcoin accepted here
                    </p>
                  )}
                  <p className="text-xs text-gray-500 mt-1">
                    Radius: {loc.radius_m}m
                  </p>
                  <p className="text-xs text-gray-500">
                    Go here to view the board
                  </p>
                </div>
              </Popup>
            </Marker>
          );
        })}
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
      {(() => {
        const merchantCount = locations.filter(l => l.btcmap_id || l.is_bitcoin_merchant).length;
        const communityCount = locations.length - merchantCount;
        return (
          <div className="absolute bottom-4 left-4 bg-white dark:bg-[#0a0a0a] border border-[var(--border)] px-3 py-2 z-[1000] font-mono text-xs">
            <div className="flex items-center gap-2 mb-1">
              <span style={{ color: '#f7931a' }}>●</span>
              <span>bitcoin merchant ({merchantCount})</span>
            </div>
            {communityCount > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <span style={{ color: '#6b7280' }}>●</span>
                <span>community board ({communityCount})</span>
              </div>
            )}
            {userPosition && (
              <div className="flex items-center gap-2">
                <span style={{ color: '#3b82f6' }}>●</span>
                <span>your location</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
