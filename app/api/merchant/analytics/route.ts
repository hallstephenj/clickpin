import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';
import { verifyMerchantAuth } from '@/lib/merchant';

/**
 * GET /api/merchant/analytics
 * Fetch privacy-preserving analytics for a merchant's location
 * Query params: location_id, session_id
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const location_id = searchParams.get('location_id');
    const session_id = searchParams.get('session_id');

    if (!location_id || !session_id) {
      return NextResponse.json(
        { error: 'Missing location_id or session_id' },
        { status: 400 }
      );
    }

    // Check if MERCHANTS feature is enabled
    const flags = await getFeatureFlags();
    if (!flags.MERCHANTS) {
      return NextResponse.json(
        { error: 'Merchant features are not enabled' },
        { status: 403 }
      );
    }

    // Verify merchant owns this location
    const claim = await verifyMerchantAuth(location_id, session_id);
    if (!claim) {
      return NextResponse.json(
        { error: 'Not authorized to view analytics' },
        { status: 403 }
      );
    }

    const now = new Date();

    // Helper to get date N days ago
    const daysAgo = (n: number) => {
      const date = new Date(now);
      date.setDate(date.getDate() - n);
      return date.toISOString();
    };

    // Get daily post counts for last 7 days
    const dailyStats = await Promise.all(
      [0, 1, 2, 3, 4, 5, 6].map(async (daysBack) => {
        const startOfDay = new Date(now);
        startOfDay.setDate(startOfDay.getDate() - daysBack);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(startOfDay);
        endOfDay.setHours(23, 59, 59, 999);

        const { count: posts } = await supabaseAdmin
          .from('pins')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', location_id)
          .is('parent_pin_id', null)
          .is('deleted_at', null)
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());

        const { count: replies } = await supabaseAdmin
          .from('pins')
          .select('*', { count: 'exact', head: true })
          .eq('location_id', location_id)
          .not('parent_pin_id', 'is', null)
          .is('deleted_at', null)
          .gte('created_at', startOfDay.toISOString())
          .lte('created_at', endOfDay.toISOString());

        return {
          date: startOfDay.toISOString().split('T')[0],
          day: startOfDay.toLocaleDateString('en-US', { weekday: 'short' }),
          posts: posts || 0,
          replies: replies || 0,
        };
      })
    );

    // Get hourly distribution (aggregate, privacy-preserving)
    const { data: allPins } = await supabaseAdmin
      .from('pins')
      .select('created_at')
      .eq('location_id', location_id)
      .is('deleted_at', null)
      .gte('created_at', daysAgo(30));

    // Count posts by hour of day
    const hourlyDistribution = new Array(24).fill(0);
    if (allPins) {
      allPins.forEach((pin) => {
        const hour = new Date(pin.created_at).getHours();
        hourlyDistribution[hour]++;
      });
    }

    // Find peak hours (top 3)
    const peakHours = hourlyDistribution
      .map((count, hour) => ({ hour, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 3)
      .filter((h) => h.count > 0)
      .map((h) => {
        const hourStr = h.hour === 0 ? '12am' : h.hour < 12 ? `${h.hour}am` : h.hour === 12 ? '12pm' : `${h.hour - 12}pm`;
        return hourStr;
      });

    // Get totals
    const { count: totalPosts } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', location_id)
      .is('parent_pin_id', null)
      .is('deleted_at', null);

    const { count: totalReplies } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', location_id)
      .not('parent_pin_id', 'is', null)
      .is('deleted_at', null);

    const { count: postsThisWeek } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', location_id)
      .is('parent_pin_id', null)
      .is('deleted_at', null)
      .gte('created_at', daysAgo(7));

    const { count: postsLastWeek } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true })
      .eq('location_id', location_id)
      .is('parent_pin_id', null)
      .is('deleted_at', null)
      .gte('created_at', daysAgo(14))
      .lt('created_at', daysAgo(7));

    // Calculate week-over-week change
    const weekOverWeekChange =
      postsLastWeek && postsLastWeek > 0
        ? Math.round((((postsThisWeek || 0) - postsLastWeek) / postsLastWeek) * 100)
        : null;

    return NextResponse.json({
      analytics: {
        daily: dailyStats.reverse(), // Oldest first
        totals: {
          posts: totalPosts || 0,
          replies: totalReplies || 0,
          posts_this_week: postsThisWeek || 0,
          week_over_week_change: weekOverWeekChange,
        },
        peak_hours: peakHours,
      },
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
