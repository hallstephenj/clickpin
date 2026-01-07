import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPresenceToken } from '@/lib/presence';

// GET /api/sponsor/queue - Get sponsorship queue for a location
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const presenceToken = searchParams.get('presence_token');

    if (!presenceToken) {
      return NextResponse.json({ error: 'Presence token required' }, { status: 400 });
    }

    // Validate presence token
    const tokenResult = verifyPresenceToken(presenceToken);
    if (!tokenResult.valid || !tokenResult.token) {
      return NextResponse.json({ error: tokenResult.error }, { status: 401 });
    }

    const { location_id } = tokenResult.token;

    // Get all paid/active sponsorships for this location, ordered by active_at
    const { data: sponsorships, error } = await supabaseAdmin
      .from('location_sponsorships')
      .select('id, sponsor_label, amount_sats, status, paid_at, active_at, created_at')
      .eq('location_id', location_id)
      .in('status', ['paid', 'active'])
      .order('active_at', { ascending: true });

    if (error) {
      console.error('Error fetching sponsorship queue:', error);
      return NextResponse.json({ error: 'Failed to fetch queue' }, { status: 500 });
    }

    const now = new Date();

    // Process sponsorships to add timing info
    const queue = (sponsorships || []).map((s, index) => {
      const activeAt = s.active_at ? new Date(s.active_at) : null;
      const isActive = activeAt && activeAt <= now;

      // Calculate when this sponsorship's guaranteed 24hr window ends
      const expiresAt = activeAt
        ? new Date(activeAt.getTime() + 24 * 60 * 60 * 1000)
        : null;

      // Calculate remaining time if active
      let remainingMs = 0;
      if (isActive && expiresAt) {
        remainingMs = Math.max(0, expiresAt.getTime() - now.getTime());
      }

      // Calculate time until activation if not yet active
      let startsInMs = 0;
      if (!isActive && activeAt) {
        startsInMs = Math.max(0, activeAt.getTime() - now.getTime());
      }

      return {
        id: s.id,
        sponsor_label: s.sponsor_label,
        amount_sats: s.amount_sats,
        status: s.status,
        is_current: isActive && index === 0,
        is_active: isActive,
        active_at: s.active_at,
        expires_at: expiresAt?.toISOString() || null,
        remaining_hours: remainingMs > 0 ? Math.ceil(remainingMs / (60 * 60 * 1000)) : 0,
        remaining_ms: remainingMs,
        starts_in_hours: startsInMs > 0 ? Math.ceil(startsInMs / (60 * 60 * 1000)) : 0,
        starts_in_ms: startsInMs,
        position: index + 1,
      };
    });

    // Find current active sponsor (first one where active_at <= now)
    const currentSponsor = queue.find(s => s.is_active);

    // Pending sponsors are those not yet active
    const pendingSponsors = queue.filter(s => !s.is_active);

    return NextResponse.json({
      current: currentSponsor || null,
      pending: pendingSponsors,
      total_in_queue: queue.length,
    });
  } catch (error) {
    console.error('Sponsor queue error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
