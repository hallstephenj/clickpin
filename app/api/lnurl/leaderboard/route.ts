import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';
import { LeaderboardResponse, LeaderboardType, LeaderboardPeriod, LeaderboardEntry } from '@/types';

/**
 * GET /api/lnurl/leaderboard
 * Get leaderboard rankings
 *
 * Query parameters:
 * - type: 'seeds' | 'sprouts' | 'locations' (default: 'seeds')
 * - period: 'all_time' | 'month' | 'week' (default: 'all_time')
 * - device_session_id: Optional, to include current user's rank
 * - limit: Number of entries to return (default: 50, max: 100)
 *
 * Response:
 * {
 *   type: LeaderboardType
 *   period: LeaderboardPeriod
 *   entries: LeaderboardEntry[]
 *   current_user_rank?: number
 *   current_user_count?: number
 * }
 */
export async function GET(request: NextRequest) {
  try {
    // Check if feature is enabled
    const flags = await getFeatureFlags();
    if (!flags.LNURL_AUTH) {
      return NextResponse.json(
        { error: 'LNURL-auth feature is not enabled' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const type = (searchParams.get('type') || 'seeds') as LeaderboardType;
    const period = (searchParams.get('period') || 'all_time') as LeaderboardPeriod;
    const deviceSessionId = searchParams.get('device_session_id');
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);

    // Validate type
    if (!['seeds', 'sprouts', 'locations'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid type parameter' },
        { status: 400 }
      );
    }

    // Validate period
    if (!['all_time', 'month', 'week'].includes(period)) {
      return NextResponse.json(
        { error: 'Invalid period parameter' },
        { status: 400 }
      );
    }

    // Calculate date filter
    let dateFilter: Date | null = null;
    if (period === 'month') {
      dateFilter = new Date();
      dateFilter.setMonth(dateFilter.getMonth() - 1);
    } else if (period === 'week') {
      dateFilter = new Date();
      dateFilter.setDate(dateFilter.getDate() - 7);
    }

    // Get current user's identity if provided
    let currentUserIdentityId: string | null = null;
    if (deviceSessionId) {
      const { data: session } = await supabaseAdmin
        .from('device_sessions')
        .select('lnurl_identity_id')
        .eq('id', deviceSessionId)
        .single();
      currentUserIdentityId = session?.lnurl_identity_id || null;
    }

    let entries: LeaderboardEntry[] = [];
    let currentUserRank: number | undefined;
    let currentUserCount: number | undefined;

    if (type === 'seeds') {
      // Count seeds planted by each identity
      let query = supabaseAdmin
        .from('seed_plantings')
        .select('lnurl_identity_id')
        .not('lnurl_identity_id', 'is', null);

      if (dateFilter) {
        query = query.gte('planted_at', dateFilter.toISOString());
      }

      const { data: plantings, error } = await query;

      if (error) {
        console.error('Error fetching seed plantings:', error);
        return NextResponse.json(
          { error: 'Failed to fetch leaderboard' },
          { status: 500 }
        );
      }

      // Count by identity
      const counts = new Map<string, number>();
      for (const planting of plantings || []) {
        if (planting.lnurl_identity_id) {
          counts.set(
            planting.lnurl_identity_id,
            (counts.get(planting.lnurl_identity_id) || 0) + 1
          );
        }
      }

      // Get identities
      const identityIds = Array.from(counts.keys());
      if (identityIds.length > 0) {
        const { data: identities } = await supabaseAdmin
          .from('lnurl_identities')
          .select('id, display_name, anon_nym')
          .in('id', identityIds);

        // Build entries
        const identityMap = new Map(identities?.map((i) => [i.id, i]) || []);
        const sortedEntries = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([id, count], index) => {
            const identity = identityMap.get(id);
            return {
              rank: index + 1,
              identity_id: id,
              display_name: identity?.display_name || null,
              anon_nym: identity?.anon_nym || 'anon',
              count,
              is_current_user: id === currentUserIdentityId,
            };
          });

        entries = sortedEntries.slice(0, limit);

        // Find current user's rank
        if (currentUserIdentityId) {
          const userEntry = sortedEntries.find((e) => e.identity_id === currentUserIdentityId);
          if (userEntry) {
            currentUserRank = userEntry.rank;
            currentUserCount = userEntry.count;
          }
        }
      }
    } else if (type === 'sprouts') {
      // Count approved sprout reports by each identity
      let query = supabaseAdmin
        .from('sprout_reports')
        .select('lnurl_identity_id')
        .eq('status', 'approved')
        .not('lnurl_identity_id', 'is', null);

      if (dateFilter) {
        query = query.gte('created_at', dateFilter.toISOString());
      }

      const { data: reports, error } = await query;

      if (error) {
        console.error('Error fetching sprout reports:', error);
        return NextResponse.json(
          { error: 'Failed to fetch leaderboard' },
          { status: 500 }
        );
      }

      // Count by identity
      const counts = new Map<string, number>();
      for (const report of reports || []) {
        if (report.lnurl_identity_id) {
          counts.set(
            report.lnurl_identity_id,
            (counts.get(report.lnurl_identity_id) || 0) + 1
          );
        }
      }

      // Get identities
      const identityIds = Array.from(counts.keys());
      if (identityIds.length > 0) {
        const { data: identities } = await supabaseAdmin
          .from('lnurl_identities')
          .select('id, display_name, anon_nym')
          .in('id', identityIds);

        // Build entries
        const identityMap = new Map(identities?.map((i) => [i.id, i]) || []);
        const sortedEntries = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([id, count], index) => {
            const identity = identityMap.get(id);
            return {
              rank: index + 1,
              identity_id: id,
              display_name: identity?.display_name || null,
              anon_nym: identity?.anon_nym || 'anon',
              count,
              is_current_user: id === currentUserIdentityId,
            };
          });

        entries = sortedEntries.slice(0, limit);

        // Find current user's rank
        if (currentUserIdentityId) {
          const userEntry = sortedEntries.find((e) => e.identity_id === currentUserIdentityId);
          if (userEntry) {
            currentUserRank = userEntry.rank;
            currentUserCount = userEntry.count;
          }
        }
      }
    } else if (type === 'locations') {
      // Count unique locations where identity has planted seeds
      let query = supabaseAdmin
        .from('seed_plantings')
        .select('lnurl_identity_id, location_id')
        .not('lnurl_identity_id', 'is', null);

      if (dateFilter) {
        query = query.gte('planted_at', dateFilter.toISOString());
      }

      const { data: plantings, error } = await query;

      if (error) {
        console.error('Error fetching seed plantings:', error);
        return NextResponse.json(
          { error: 'Failed to fetch leaderboard' },
          { status: 500 }
        );
      }

      // Count unique locations by identity
      const locationSets = new Map<string, Set<string>>();
      for (const planting of plantings || []) {
        if (planting.lnurl_identity_id && planting.location_id) {
          if (!locationSets.has(planting.lnurl_identity_id)) {
            locationSets.set(planting.lnurl_identity_id, new Set());
          }
          locationSets.get(planting.lnurl_identity_id)!.add(planting.location_id);
        }
      }

      // Convert to counts
      const counts = new Map<string, number>();
      for (const [id, locations] of locationSets) {
        counts.set(id, locations.size);
      }

      // Get identities
      const identityIds = Array.from(counts.keys());
      if (identityIds.length > 0) {
        const { data: identities } = await supabaseAdmin
          .from('lnurl_identities')
          .select('id, display_name, anon_nym')
          .in('id', identityIds);

        // Build entries
        const identityMap = new Map(identities?.map((i) => [i.id, i]) || []);
        const sortedEntries = Array.from(counts.entries())
          .sort((a, b) => b[1] - a[1])
          .map(([id, count], index) => {
            const identity = identityMap.get(id);
            return {
              rank: index + 1,
              identity_id: id,
              display_name: identity?.display_name || null,
              anon_nym: identity?.anon_nym || 'anon',
              count,
              is_current_user: id === currentUserIdentityId,
            };
          });

        entries = sortedEntries.slice(0, limit);

        // Find current user's rank
        if (currentUserIdentityId) {
          const userEntry = sortedEntries.find((e) => e.identity_id === currentUserIdentityId);
          if (userEntry) {
            currentUserRank = userEntry.rank;
            currentUserCount = userEntry.count;
          }
        }
      }
    }

    const response: LeaderboardResponse = {
      type,
      period,
      entries,
      current_user_rank: currentUserRank,
      current_user_count: currentUserCount,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('LNURL leaderboard error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
