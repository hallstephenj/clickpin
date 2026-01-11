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
  location_type?: 'bitcoin_merchant' | 'merchant' | 'community_space';
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

// Pin colors matching the SEED_PLANTED spec
const PIN_COLORS = {
  bitcoin_merchant: '#F7931A', // Orange
  merchant: '#6B7280',         // Gray (non-bitcoin merchants)
  community_space: '#3B82F6',  // Blue
  user_location: '#EF4444',    // Red
};

const bitcoinMerchantIcon = createIcon(PIN_COLORS.bitcoin_merchant, 14);
const merchantIcon = createIcon(PIN_COLORS.merchant, 14);
const communitySpaceIcon = createIcon(PIN_COLORS.community_space, 14);
const userIcon = createIcon(PIN_COLORS.user_location, 18);

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
          const locationType = loc.location_type ||
            (loc.btcmap_id || loc.is_bitcoin_merchant ? 'bitcoin_merchant' : 'merchant');
          const color = PIN_COLORS[locationType] || PIN_COLORS.merchant;
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
          const locationType = loc.location_type ||
            (loc.btcmap_id || loc.is_bitcoin_merchant ? 'bitcoin_merchant' : 'merchant');

          let icon;
          if (locationType === 'bitcoin_merchant') {
            icon = bitcoinMerchantIcon;
          } else if (locationType === 'community_space') {
            icon = communitySpaceIcon;
          } else {
            icon = merchantIcon;
          }

          return (
            <Marker
              key={loc.id}
              position={[loc.lat, loc.lng]}
              icon={icon}
            />
          );
        })}
      </MapContainer>
    </div>
  );
}
