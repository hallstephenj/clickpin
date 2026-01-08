'use client';

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Lightning, CheckCircle, Circle as CircleIcon } from '@phosphor-icons/react';

interface Location {
  id: string;
  name: string;
  slug: string;
  lat: number;
  lng: number;
  radius_m: number;
  btcmap_id?: number | null;
  is_bitcoin_merchant?: boolean;
  is_claimed?: boolean;
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

// Verified merchant icon with checkmark badge
const verifiedMerchantIcon = L.divIcon({
  className: 'custom-marker-verified',
  html: `<div style="position: relative;">
    <div style="
      background-color: #f7931a;
      width: 24px;
      height: 24px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>
    <div style="
      position: absolute;
      top: -6px;
      right: -6px;
      background-color: #22c55e;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      border: 2px solid white;
      display: flex;
      align-items: center;
      justify-content: center;
    "><svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></div>
  </div>`,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24],
});

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
          const isVerified = isBitcoinMerchant && !!loc.is_claimed;
          const icon = isVerified
            ? verifiedMerchantIcon
            : isBitcoinMerchant
              ? bitcoinMerchantIcon
              : communityIcon;

          return (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={icon}
            >
              <Popup>
                <div className="font-mono text-sm">
                  <strong style={{ color: isBitcoinMerchant ? '#f7931a' : '#6b7280' }} className="inline-flex items-center gap-1">
                    {isBitcoinMerchant && <Lightning size={14} weight="fill" />}
                    {loc.name}
                    {isVerified && <CheckCircle size={14} weight="fill" className="text-green-500" />}
                  </strong>
                  {isVerified && (
                    <p className="text-xs text-green-600 mt-1">
                      Verified merchant
                    </p>
                  )}
                  {isBitcoinMerchant && !isVerified && (
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
        const verifiedCount = locations.filter(l => (l.btcmap_id || l.is_bitcoin_merchant) && l.is_claimed).length;
        const merchantCount = locations.filter(l => (l.btcmap_id || l.is_bitcoin_merchant) && !l.is_claimed).length;
        const communityCount = locations.filter(l => !l.btcmap_id && !l.is_bitcoin_merchant).length;
        return (
          <div className="absolute bottom-4 left-4 bg-white dark:bg-[#0a0a0a] border border-[var(--border)] px-3 py-2 z-[1000] font-mono text-xs">
            {verifiedCount > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <CircleIcon size={10} weight="fill" className="text-green-500" />
                <span>verified merchant ({verifiedCount})</span>
              </div>
            )}
            {merchantCount > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <CircleIcon size={10} weight="fill" className="text-[#f7931a]" />
                <span>bitcoin merchant ({merchantCount})</span>
              </div>
            )}
            {communityCount > 0 && (
              <div className="flex items-center gap-2 mb-1">
                <CircleIcon size={10} weight="fill" className="text-gray-500" />
                <span>community board ({communityCount})</span>
              </div>
            )}
            {userPosition && (
              <div className="flex items-center gap-2">
                <CircleIcon size={10} weight="fill" className="text-blue-500" />
                <span>your location</span>
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
