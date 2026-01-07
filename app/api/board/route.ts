import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { Pin } from '@/types';

// GET /api/board?slug=xxx&session_id=xxx - Get pins for a location
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug');
    const sessionId = searchParams.get('session_id');

    if (!slug) {
      return NextResponse.json({ error: 'Location slug required' }, { status: 400 });
    }

    // Get location by slug
    const { data: location, error: locationError } = await supabaseAdmin
      .from('locations')
      .select('id, name, slug, category, city, lat, lng, radius_m')
      .eq('slug', slug)
      .eq('is_active', true)
      .single();

    if (locationError || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    // Get active sponsorship (where active_at has passed)
    const now = new Date().toISOString();
    const { data: sponsorship } = await supabaseAdmin
      .from('location_sponsorships')
      .select('sponsor_label, sponsor_url, amount_sats')
      .eq('location_id', location.id)
      .in('status', ['paid', 'active'])
      .lte('active_at', now)
      .order('active_at', { ascending: false })
      .limit(1)
      .single();

    // Get top-level pins (not replies), exclude deleted
    const { data: allPins, error: pinsError } = await supabaseAdmin
      .from('pins')
      .select('*')
      .eq('location_id', location.id)
      .is('parent_pin_id', null)
      .is('deleted_at', null)
      .order('boost_score', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(100);

    if (pinsError) {
      console.error('Error fetching pins:', pinsError);
      return NextResponse.json({ error: 'Failed to fetch pins' }, { status: 500 });
    }

    // Separate visible and hidden pins
    const pins = (allPins || []).filter((p) => !p.is_hidden);
    const hiddenPins = (allPins || []).filter((p) => p.is_hidden);

    // Get replies for all pins (including hidden parent pins)
    const allPinIds = allPins?.map((p) => p.id) || [];
    let replies: Pin[] = [];
    let hiddenReplies: Pin[] = [];

    if (allPinIds.length > 0) {
      const { data: repliesData, error: repliesError } = await supabaseAdmin
        .from('pins')
        .select('*')
        .in('parent_pin_id', allPinIds)
        .is('deleted_at', null)
        .order('created_at', { ascending: true });

      if (!repliesError && repliesData) {
        replies = repliesData.filter((r) => !r.is_hidden);
        hiddenReplies = repliesData.filter((r) => r.is_hidden);
      }
    }

    // Get flag counts for all pins
    const allPinIdsForFlags = [...allPinIds, ...replies.map((r) => r.id), ...hiddenReplies.map((r) => r.id)];
    let flagCounts: Record<string, number> = {};

    if (allPinIdsForFlags.length > 0) {
      const { data: flags } = await supabaseAdmin
        .from('pin_flags')
        .select('pin_id')
        .in('pin_id', allPinIdsForFlags);

      if (flags) {
        flagCounts = flags.reduce((acc, flag) => {
          acc[flag.pin_id] = (acc[flag.pin_id] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);
      }
    }

    // Build pins with replies and metadata
    const buildPinWithReplies = (pin: Pin, allReplies: Pin[]) => {
      const pinReplies = allReplies
        .filter((r) => r.parent_pin_id === pin.id)
        .map((r) => ({
          ...r,
          is_mine: r.device_session_id === sessionId,
          flag_count: flagCounts[r.id] || 0,
        }));

      return {
        ...pin,
        replies: pinReplies,
        is_mine: pin.device_session_id === sessionId,
        flag_count: flagCounts[pin.id] || 0,
      };
    };

    const pinsWithReplies = pins.map((pin) => buildPinWithReplies(pin, replies));
    const hiddenPinsWithReplies = hiddenPins.map((pin) => buildPinWithReplies(pin, [...replies, ...hiddenReplies]));

    return NextResponse.json({
      location: {
        ...location,
        sponsor_label: sponsorship?.sponsor_label || null,
        sponsor_url: sponsorship?.sponsor_url || null,
        sponsor_amount_sats: sponsorship?.amount_sats || null,
      },
      pins: pinsWithReplies,
      hiddenPins: hiddenPinsWithReplies,
    });
  } catch (error) {
    console.error('Board error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
