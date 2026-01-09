import { NextRequest, NextResponse } from 'next/server';
import { recomputeAllRollups } from '@/lib/ghostEvents';
import { verifyAdminAuth } from '@/lib/admin-auth';

// POST /api/admin/ghosts/recompute - Manually trigger rollup recomputation
export async function POST(request: NextRequest) {
  // Check admin auth (supports both Supabase and legacy password)
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
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
