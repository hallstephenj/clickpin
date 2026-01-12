import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyAdminAuth } from '@/lib/admin-auth';
import { getFeatureFlags } from '@/lib/featureFlags';
import { formatAuthorNym } from '@/lib/lnurl';
import { v4 as uuidv4 } from 'uuid';

/**
 * GET /api/admin/sprout-reports/[id]
 * Get a single sprout report
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Check admin auth
  const auth = await verifyAdminAuth(request);
  if (!auth.authenticated) {
    return NextResponse.json({ error: auth.error }, { status: 401 });
  }

  try {
    const { id } = await params;

    const { data: report, error } = await supabaseAdmin
      .from('sprout_reports')
      .select(`
        *,
        location:locations(id, name, address, lat, lng, location_type),
        identity:lnurl_identities(id, display_name, anon_nym)
      `)
      .eq('id', id)
      .single();

    if (error || !report) {
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ report });
  } catch (error) {
    console.error('Admin sprout report GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/sprout-reports/[id]
 * Update a sprout report (approve/reject/request info)
 *
 * Request body:
 * {
 *   action: 'approve' | 'reject' | 'needs_info'
 *   notes?: string  // Reviewer notes
 * }
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;
    const body = await request.json();
    const { action, notes } = body;

    console.log('[Sprout Action] Report:', id, 'Action:', action);

    // Validate action
    if (!['approve', 'reject', 'needs_info'].includes(action)) {
      console.log('[Sprout Action] Invalid action:', action);
      return NextResponse.json(
        { error: 'Invalid action' },
        { status: 400 }
      );
    }

    // Get the report (simple query first, then fetch relations)
    const { data: report, error: reportError } = await supabaseAdmin
      .from('sprout_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (reportError || !report) {
      console.log('[Sprout Action] Report not found:', id, reportError);
      return NextResponse.json(
        { error: 'Report not found' },
        { status: 404 }
      );
    }

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

    // Attach relations to report
    const reportWithRelations = { ...report, location, identity };

    if (report.status === 'approved') {
      return NextResponse.json(
        { error: 'Report has already been approved' },
        { status: 400 }
      );
    }

    const newStatus = action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'needs_info';

    // Update report status
    const { error: updateError } = await supabaseAdmin
      .from('sprout_reports')
      .update({
        status: newStatus,
        reviewer_notes: notes || null,
        reviewed_at: new Date().toISOString(),
        reviewed_by: auth.admin?.id || null,
      })
      .eq('id', id);

    if (updateError) {
      console.error('[Sprout Action] Error updating sprout report:', updateError);
      return NextResponse.json(
        { error: 'Failed to update report' },
        { status: 500 }
      );
    }

    console.log('[Sprout Action] Report updated to status:', newStatus);

    // If approved, update location and create celebratory pin
    let celebratoryPinId: string | null = null;

    if (action === 'approve' && location) {

      // Update location to bitcoin_merchant
      const { error: locationError } = await supabaseAdmin
        .from('locations')
        .update({
          location_type: 'bitcoin_merchant',
          sprouted_at: new Date().toISOString(),
          sprouted_by_identity_id: report.lnurl_identity_id,
          sprout_photo_url: report.photo_url,
        })
        .eq('id', report.location_id);

      if (locationError) {
        console.error('Error updating location:', locationError);
        // Don't fail the approval, just log the error
      }

      // Create celebratory pin
      celebratoryPinId = uuidv4();
      const reporterNym = identity ? formatAuthorNym(identity) : null;
      const reportedBy = reporterNym ? ` Reported by @${reporterNym}.` : '';

      const pinBody = `${location.name} now accepts Bitcoin! Confirmed ${new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}.${reportedBy}`;

      const { error: pinError } = await supabaseAdmin
        .from('pins')
        .insert({
          id: celebratoryPinId,
          location_id: report.location_id,
          device_session_id: report.device_session_id,
          body: pinBody,
          badge: 'Sprouted',
          lnurl_identity_id: report.lnurl_identity_id,
          author_nym: reporterNym,
          is_sprouted_pin: true,
        });

      if (pinError) {
        console.error('Error creating celebratory pin:', pinError);
        celebratoryPinId = null;
        // Don't fail the approval, just log the error
      }

      // Update report with celebratory pin ID
      if (celebratoryPinId) {
        await supabaseAdmin
          .from('sprout_reports')
          .update({ celebratory_pin_id: celebratoryPinId })
          .eq('id', id);
      }
    }

    return NextResponse.json({
      success: true,
      status: newStatus,
      celebratory_pin_id: celebratoryPinId,
    });
  } catch (error) {
    console.error('Admin sprout report PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
