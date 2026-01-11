import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

// GET /api/admin/stats - Get admin dashboard statistics
export async function GET(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setUTCHours(0, 0, 0, 0);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const monthAgo = new Date(now);
    monthAgo.setMonth(monthAgo.getMonth() - 1);

    // Parallel queries for efficiency
    const [
      // Posts
      { count: totalPosts },
      { count: postsToday },
      { count: postsThisWeek },
      { count: hiddenPosts },

      // Seeds
      { count: totalSeeds },
      { count: seedsToday },
      { count: seedsThisWeek },

      // Seed outcomes
      { count: positiveSeeds },
      { count: neutralSeeds },
      { count: negativeSeeds },

      // Locations
      { count: totalLocations },
      { count: activeLocations },
      { count: claimedLocations },
      { count: btcmapLocations },

      // Sessions
      { count: totalSessions },
      { count: activeSessions },

      // Requests
      { count: pendingRequests },

      // Merchant claims
      { count: verifiedClaims },
      { count: pendingClaims },
    ] = await Promise.all([
      // Posts
      supabaseAdmin.from('pins').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('pins').select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString()),
      supabaseAdmin.from('pins').select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString()),
      supabaseAdmin.from('pins').select('*', { count: 'exact', head: true })
        .eq('is_hidden', true),

      // Seeds
      supabaseAdmin.from('seed_plantings').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('seed_plantings').select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart.toISOString()),
      supabaseAdmin.from('seed_plantings').select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo.toISOString()),

      // Seed outcomes
      supabaseAdmin.from('seed_plantings').select('*', { count: 'exact', head: true })
        .eq('outcome', 'positive'),
      supabaseAdmin.from('seed_plantings').select('*', { count: 'exact', head: true })
        .eq('outcome', 'neutral'),
      supabaseAdmin.from('seed_plantings').select('*', { count: 'exact', head: true })
        .eq('outcome', 'negative'),

      // Locations
      supabaseAdmin.from('locations').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('locations').select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      supabaseAdmin.from('locations').select('*', { count: 'exact', head: true })
        .eq('is_claimed', true),
      supabaseAdmin.from('locations').select('*', { count: 'exact', head: true })
        .not('btcmap_id', 'is', null),

      // Sessions
      supabaseAdmin.from('device_sessions').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('device_sessions').select('*', { count: 'exact', head: true })
        .gte('last_seen_at', todayStart.toISOString()),

      // Requests
      supabaseAdmin.from('location_requests').select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),

      // Merchant claims
      supabaseAdmin.from('merchant_claims').select('*', { count: 'exact', head: true })
        .eq('status', 'verified'),
      supabaseAdmin.from('merchant_claims').select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),
    ]);

    // Get top locations by post count
    const { data: topLocations } = await supabaseAdmin
      .from('locations')
      .select('name, slug, city')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(5);

    // Calculate seed success rate
    const totalSeedOutcomes = (positiveSeeds || 0) + (neutralSeeds || 0) + (negativeSeeds || 0);
    const seedSuccessRate = totalSeedOutcomes > 0
      ? Math.round(((positiveSeeds || 0) / totalSeedOutcomes) * 100)
      : 0;

    return NextResponse.json({
      posts: {
        total: totalPosts || 0,
        today: postsToday || 0,
        thisWeek: postsThisWeek || 0,
        hidden: hiddenPosts || 0,
      },
      seeds: {
        total: totalSeeds || 0,
        today: seedsToday || 0,
        thisWeek: seedsThisWeek || 0,
        outcomes: {
          positive: positiveSeeds || 0,
          neutral: neutralSeeds || 0,
          negative: negativeSeeds || 0,
        },
        successRate: seedSuccessRate,
      },
      locations: {
        total: totalLocations || 0,
        active: activeLocations || 0,
        claimed: claimedLocations || 0,
        btcmap: btcmapLocations || 0,
      },
      sessions: {
        total: totalSessions || 0,
        activeToday: activeSessions || 0,
      },
      requests: {
        pending: pendingRequests || 0,
      },
      merchants: {
        verified: verifiedClaims || 0,
        pending: pendingClaims || 0,
      },
      topLocations: topLocations || [],
      generatedAt: now.toISOString(),
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
