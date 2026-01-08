'use client';

import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';

interface Location {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius_m: number;
  btcmap_id?: number | null;
  is_bitcoin_merchant?: boolean;
}

interface ProximityMiniMapProps {
  userLat: number;
  userLng: number;
  locations: Location[];
}

// Custom marker icons
const createIcon = (color: string, size: number = 16) => {
  return L.divIcon({
    className: 'custom-marker',
    html: `<div style="
      background-color: ${color};
      width: ${size}px;
      height: ${size}px;
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      border: 2px solid white;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    "></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size],
  });
};

const bitcoinMerchantIcon = createIcon('#f7931a', 14);
const communityIcon = createIcon('#6b7280', 14);
const userIcon = createIcon('#3b82f6', 18);

// Auto-fit map to show all markers
function MapFitter({ userLat, userLng, locations }: { userLat: number; userLng: number; locations: Location[] }) {
  const map = useMap();

  useEffect(() => {
    if (locations.length === 0) {
      map.setView([userLat, userLng], 15);
      return;
    }

    const bounds = L.latLngBounds([[userLat, userLng]]);
    locations.forEach(loc => {
      bounds.extend([loc.lat, loc.lng]);
    });

    map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
  }, [map, userLat, userLng, locations]);

  return null;
}

export function ProximityMiniMap({ userLat, userLng, locations }: ProximityMiniMapProps) {
  return (
    <div className="w-full h-[200px] rounded-lg overflow-hidden border border-[var(--border)]">
      <MapContainer
        center={[userLat, userLng]}
        zoom={14}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={false}
        dragging={false}
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapFitter userLat={userLat} userLng={userLng} locations={locations} />

        {/* User location marker */}
        <Marker position={[userLat, userLng]} icon={userIcon} />

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
                fillOpacity: 0.15,
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
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
