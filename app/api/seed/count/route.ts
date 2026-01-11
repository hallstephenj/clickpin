import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import type { SeedCount } from '@/types';

// GET /api/seed/count - Get seed count for a location
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location_id = searchParams.get('location_id');

    if (!location_id) {
      return NextResponse.json({ error: 'location_id is required' }, { status: 400 });
    }

    // Get total count
    const { count: total, error: countError } = await supabaseAdmin
      .from('seed_plantings')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', location_id);

    if (countError) {
      console.error('Error fetching seed count:', countError);
      return NextResponse.json({ error: 'Failed to fetch seed count' }, { status: 500 });
    }

    // Get outcome breakdown
    const { data: outcomes, error: outcomesError } = await supabaseAdmin
      .from('seed_plantings')
      .select('outcome')
      .eq('location_id', location_id);

    if (outcomesError) {
      console.error('Error fetching seed outcomes:', outcomesError);
      return NextResponse.json({ error: 'Failed to fetch seed outcomes' }, { status: 500 });
    }

    // Count by outcome
    const outcomeCounts = {
      positive: 0,
      neutral: 0,
      negative: 0,
    };

    for (const row of outcomes || []) {
      if (row.outcome in outcomeCounts) {
        outcomeCounts[row.outcome as keyof typeof outcomeCounts]++;
      }
    }

    const response: SeedCount = {
      total: total || 0,
      outcomes: outcomeCounts,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Seed count error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
