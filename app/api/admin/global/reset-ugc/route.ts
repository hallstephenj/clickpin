import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';

// DELETE /api/admin/global/reset-ugc - Reset all user-generated content
// Preserves: locations and their settings (name, address, radius, slug, etc.)
// Resets: pins, seeds, sessions, identities, merchant claims, sprout reports
export async function DELETE(request: NextRequest) {
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  const results: Record<string, number> = {};

  try {
    // 1. Delete all pins (posts and replies)
    const { count: pinsCount } = await supabaseAdmin
      .from('pins')
      .select('*', { count: 'exact', head: true });

    const { error: pinsError } = await supabaseAdmin
      .from('pins')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (pinsError) console.error('Error deleting pins:', pinsError);
    results.pins = pinsCount || 0;

    // 2. Delete all seed plantings
    const { count: seedsCount } = await supabaseAdmin
      .from('seed_plantings')
      .select('*', { count: 'exact', head: true });

    const { error: seedsError } = await supabaseAdmin
      .from('seed_plantings')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (seedsError) console.error('Error deleting seeds:', seedsError);
    results.seeds = seedsCount || 0;

    // 3. Delete all sprout reports
    const { count: sproutsCount } = await supabaseAdmin
      .from('sprout_reports')
      .select('*', { count: 'exact', head: true });

    const { error: sproutsError } = await supabaseAdmin
      .from('sprout_reports')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (sproutsError) console.error('Error deleting sprout reports:', sproutsError);
    results.sprout_reports = sproutsCount || 0;

    // 4. Delete all lnurl_device_links (before identities due to FK)
    const { count: linksCount } = await supabaseAdmin
      .from('lnurl_device_links')
      .select('*', { count: 'exact', head: true });

    const { error: linksError } = await supabaseAdmin
      .from('lnurl_device_links')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (linksError) console.error('Error deleting device links:', linksError);
    results.device_links = linksCount || 0;

    // 5. Delete all lnurl_challenges
    const { count: challengesCount } = await supabaseAdmin
      .from('lnurl_challenges')
      .select('*', { count: 'exact', head: true });

    const { error: challengesError } = await supabaseAdmin
      .from('lnurl_challenges')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (challengesError) console.error('Error deleting challenges:', challengesError);
    results.challenges = challengesCount || 0;

    // 6. Delete all lnurl_identities
    const { count: identitiesCount } = await supabaseAdmin
      .from('lnurl_identities')
      .select('*', { count: 'exact', head: true });

    const { error: identitiesError } = await supabaseAdmin
      .from('lnurl_identities')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (identitiesError) console.error('Error deleting identities:', identitiesError);
    results.identities = identitiesCount || 0;

    // 7. Delete all merchant_claims
    const { count: claimsCount } = await supabaseAdmin
      .from('merchant_claims')
      .select('*', { count: 'exact', head: true });

    const { error: claimsError } = await supabaseAdmin
      .from('merchant_claims')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (claimsError) console.error('Error deleting merchant claims:', claimsError);
    results.merchant_claims = claimsCount || 0;

    // 8. Delete all location_requests
    const { count: requestsCount } = await supabaseAdmin
      .from('location_requests')
      .select('*', { count: 'exact', head: true });

    const { error: requestsError } = await supabaseAdmin
      .from('location_requests')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (requestsError) console.error('Error deleting location requests:', requestsError);
    results.location_requests = requestsCount || 0;

    // 9. Delete all device_sessions
    const { count: sessionsCount } = await supabaseAdmin
      .from('device_sessions')
      .select('*', { count: 'exact', head: true });

    const { error: sessionsError } = await supabaseAdmin
      .from('device_sessions')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (sessionsError) console.error('Error deleting sessions:', sessionsError);
    results.sessions = sessionsCount || 0;

    // 10. Reset location UGC fields (but keep settings)
    const { error: locResetError } = await supabaseAdmin
      .from('locations')
      .update({
        // Reset seed counts
        total_seeds: 0,
        positive_seeds: 0,
        neutral_seeds: 0,
        negative_seeds: 0,
        // Reset merchant claim status
        is_claimed: false,
        claimed_by: null,
        claimed_at: null,
        merchant_settings: {},
        // Reset sprout fields
        sprouted_at: null,
        sprouted_by_identity_id: null,
        sprout_photo_url: null,
      })
      .neq('id', '00000000-0000-0000-0000-000000000000');

    if (locResetError) console.error('Error resetting location fields:', locResetError);

    // Calculate total
    const total = Object.values(results).reduce((sum, count) => sum + count, 0);

    return NextResponse.json({
      success: true,
      message: 'All user-generated content has been reset',
      deleted: results,
      total_deleted: total,
    });
  } catch (error) {
    console.error('Reset UGC error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
