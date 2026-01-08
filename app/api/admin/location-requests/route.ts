import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'clickpin-admin-2024';
const GROUPING_RADIUS_M = 150;

// Haversine distance in meters
function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

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

export async function GET(request: NextRequest) {
  // Check admin password
  const password = request.headers.get('X-Admin-Password');
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Fetch pending requests
    const { data: requests, error } = await supabaseAdmin
      .from('location_requests')
      .select('id, lat, lng, suggested_name, status, created_at, is_bitcoin_merchant')
      .eq('status', 'pending')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching location requests:', error);
      return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
    }

    if (!requests || requests.length === 0) {
      return NextResponse.json({ groups: [] });
    }

    // Group requests by proximity (within 150m)
    const groups: GroupedRequest[] = [];
    const assigned = new Set<string>();

    for (const req of requests) {
      if (assigned.has(req.id)) continue;

      // Start a new group with this request
      const group: GroupedRequest = {
        center_lat: req.lat,
        center_lng: req.lng,
        requests: [req],
        suggested_names: [req.suggested_name],
      };
      assigned.add(req.id);

      // Find all nearby requests
      for (const other of requests) {
        if (assigned.has(other.id)) continue;

        const distance = haversineDistance(req.lat, req.lng, other.lat, other.lng);
        if (distance <= GROUPING_RADIUS_M) {
          group.requests.push(other);
          if (!group.suggested_names.includes(other.suggested_name)) {
            group.suggested_names.push(other.suggested_name);
          }
          assigned.add(other.id);
        }
      }

      // Calculate center of all requests in group
      const sumLat = group.requests.reduce((sum, r) => sum + r.lat, 0);
      const sumLng = group.requests.reduce((sum, r) => sum + r.lng, 0);
      group.center_lat = sumLat / group.requests.length;
      group.center_lng = sumLng / group.requests.length;

      groups.push(group);
    }

    // Sort groups by number of requests (most popular first)
    groups.sort((a, b) => b.requests.length - a.requests.length);

    return NextResponse.json({ groups });
  } catch (error) {
    console.error('Admin location requests error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
