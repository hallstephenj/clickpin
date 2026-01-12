import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { getFeatureFlags } from '@/lib/featureFlags';

/**
 * GET /api/admin/sprout-reports
 * List sprout reports for admin review
 *
 * Query parameters:
 * - status: 'pending' | 'approved' | 'rejected' | 'needs_info' | 'all' (default: 'pending')
 * - limit: number (default: 50)
 * - offset: number (default: 0)
 *
 * Response:
 * {
 *   reports: SproutReport[]
 *   total: number
 * }
 */
export async function GET(request: NextRequest) {
  // Check admin auth
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    // Check feature flag
    const flags = await getFeatureFlags();
    if (!flags.SEED_SPROUTED) {
      return NextResponse.json(
        { error: 'Sprout reporting feature is not enabled' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'pending';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query - first try simple query to check if reports exist
    let query = supabaseAdmin
      .from('sprout_reports')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by status
    if (status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: rawReports, count, error } = await query;

    if (error) {
      console.error('[Sprouts] Error fetching sprout reports:', error);
      return NextResponse.json(
        { error: 'Failed to fetch reports' },
        { status: 500 }
      );
    }

    console.log('[Sprouts] Found reports:', rawReports?.length, 'total:', count);

    // Now fetch with joins for any found reports
    const reports = [];
    if (rawReports && rawReports.length > 0) {
      for (const report of rawReports) {
        // Fetch location
        const { data: location } = await supabaseAdmin
          .from('locations')
          .select('id, name, address, lat, lng, location_type')
          .eq('id', report.location_id)
          .single();

        // Fetch identity if linked
        let identity = null;
        if (report.lnurl_identity_id) {
          const { data: identityData } = await supabaseAdmin
            .from('lnurl_identities')
            .select('id, display_name, anon_nym')
            .eq('id', report.lnurl_identity_id)
            .single();
          identity = identityData;
        }

        reports.push({
          ...report,
          location,
          identity,
        });
      }
    }

    return NextResponse.json({
      reports: reports || [],
      total: count || 0,
    });
  } catch (error) {
    console.error('Admin sprout reports error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
