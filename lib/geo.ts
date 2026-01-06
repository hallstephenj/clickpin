// Haversine distance calculation for fallback when PostGIS is not available

const EARTH_RADIUS_M = 6371000; // Earth's radius in meters

export interface Coordinates {
  lat: number;
  lng: number;
}

// Calculate distance between two points using Haversine formula
export function haversineDistance(point1: Coordinates, point2: Coordinates): number {
  const lat1Rad = toRadians(point1.lat);
  const lat2Rad = toRadians(point2.lat);
  const deltaLat = toRadians(point2.lat - point1.lat);
  const deltaLng = toRadians(point2.lng - point1.lng);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(deltaLng / 2) * Math.sin(deltaLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_M * c; // Distance in meters
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

// Find nearest location from a list using Haversine (fallback method)
export function findNearestLocationFallback<T extends Coordinates & { radius_m: number }>(
  userLocation: Coordinates,
  locations: T[],
  maxDistanceM: number
): (T & { distance_m: number }) | null {
  let nearest: (T & { distance_m: number }) | null = null;
  let minDistance = Infinity;

  for (const location of locations) {
    const distance = haversineDistance(userLocation, location);
    const effectiveRadius = Math.max(maxDistanceM, location.radius_m);

    if (distance <= effectiveRadius && distance < minDistance) {
      minDistance = distance;
      nearest = { ...location, distance_m: distance };
    }
  }

  return nearest;
}

// Validate coordinates
export function isValidCoordinate(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}
