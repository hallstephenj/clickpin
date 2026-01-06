import { NextResponse } from 'next/server';
import { getFeatureFlags } from '@/lib/featureFlags';

// GET /api/feature-flags - Public endpoint to fetch current flags
export async function GET() {
  try {
    const flags = await getFeatureFlags();
    return NextResponse.json({ flags });
  } catch (error) {
    console.error('Error fetching feature flags:', error);
    return NextResponse.json({ error: 'Failed to fetch flags' }, { status: 500 });
  }
}
