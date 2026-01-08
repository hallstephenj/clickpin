import { NextRequest, NextResponse } from 'next/server';
import { recomputeAllRollups } from '@/lib/ghostEvents';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'clickpin-admin-2024';

// POST /api/admin/ghosts/recompute - Manually trigger rollup recomputation
export async function POST(request: NextRequest) {
  // Check admin password
  const password = request.headers.get('X-Admin-Password');
  if (password !== ADMIN_PASSWORD) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const count = await recomputeAllRollups();

    return NextResponse.json({
      success: true,
      locations_updated: count,
    });
  } catch (error) {
    console.error('Recompute rollups error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
