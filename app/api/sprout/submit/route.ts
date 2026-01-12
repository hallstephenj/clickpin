import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPresenceToken } from '@/lib/presence';
import { getFeatureFlags } from '@/lib/featureFlags';
import { uploadSproutPhoto } from '@/lib/storage';
import { v4 as uuidv4 } from 'uuid';

const VALID_PAYMENT_TYPES = ['lightning', 'onchain', 'both', 'unknown'];
const MAX_CONTEXT_LENGTH = 500;

/**
 * POST /api/sprout/submit
 * Submit a sprout report (merchant now accepts Bitcoin)
 *
 * Request body:
 * {
 *   presence_token: string
 *   photo: string           // Base64-encoded image
 *   payment_type: 'lightning' | 'onchain' | 'both' | 'unknown'
 *   context?: string        // Optional context (max 500 chars)
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   report_id: string
 * }
 */
export async function POST(request: NextRequest) {
  try {
    // Check feature flag
    const flags = await getFeatureFlags();
    if (!flags.SEED_SPROUTED) {
      return NextResponse.json(
        { error: 'Sprout reporting feature is not enabled' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { presence_token, photo, payment_type, context } = body;

    // Validate presence token
    const tokenResult = verifyPresenceToken(presence_token);
    if (!tokenResult.valid || !tokenResult.token) {
      return NextResponse.json({ error: tokenResult.error }, { status: 401 });
    }

    const { device_session_id, location_id } = tokenResult.token;

    // Validate photo
    if (!photo || typeof photo !== 'string') {
      return NextResponse.json(
        { error: 'Photo is required' },
        { status: 400 }
      );
    }

    // Validate payment type
    if (!payment_type || !VALID_PAYMENT_TYPES.includes(payment_type)) {
      return NextResponse.json(
        { error: 'Invalid payment type' },
        { status: 400 }
      );
    }

    // Validate context length
    if (context && context.length > MAX_CONTEXT_LENGTH) {
      return NextResponse.json(
        { error: `Context exceeds maximum length of ${MAX_CONTEXT_LENGTH} characters` },
        { status: 400 }
      );
    }

    // Verify location exists and is type 'merchant'
    const { data: location, error: locationError } = await supabaseAdmin
      .from('locations')
      .select('id, name, location_type')
      .eq('id', location_id)
      .single();

    if (locationError || !location) {
      return NextResponse.json({ error: 'Location not found' }, { status: 404 });
    }

    if (location.location_type !== 'merchant') {
      return NextResponse.json(
        { error: 'Sprout reports can only be submitted for merchant locations' },
        { status: 400 }
      );
    }

    // Check if there's already a pending or approved sprout report for this location
    const { data: existingReport } = await supabaseAdmin
      .from('sprout_reports')
      .select('id, status')
      .eq('location_id', location_id)
      .in('status', ['pending', 'approved'])
      .single();

    if (existingReport) {
      if (existingReport.status === 'approved') {
        return NextResponse.json(
          { error: 'This location has already been reported as accepting Bitcoin' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'There is already a pending sprout report for this location' },
        { status: 400 }
      );
    }

    // Get device session's identity for attribution
    let lnurlIdentityId: string | null = null;

    const { data: sessionWithIdentity } = await supabaseAdmin
      .from('device_sessions')
      .select('lnurl_identity_id')
      .eq('id', device_session_id)
      .single();

    if (sessionWithIdentity?.lnurl_identity_id) {
      lnurlIdentityId = sessionWithIdentity.lnurl_identity_id;
    }

    // Generate report ID
    const reportId = uuidv4();

    // Upload photo
    let photoUrl: string;
    try {
      photoUrl = await uploadSproutPhoto(photo, reportId);
    } catch (err) {
      console.error('Error uploading sprout photo:', err);
      return NextResponse.json(
        { error: err instanceof Error ? err.message : 'Failed to upload photo' },
        { status: 500 }
      );
    }

    // Create sprout report
    const { error: reportError } = await supabaseAdmin
      .from('sprout_reports')
      .insert({
        id: reportId,
        location_id,
        device_session_id,
        lnurl_identity_id: lnurlIdentityId,
        photo_url: photoUrl,
        payment_type,
        context: context?.trim() || null,
        status: 'pending',
      });

    if (reportError) {
      console.error('Error creating sprout report:', reportError);
      return NextResponse.json(
        { error: 'Failed to submit report' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      report_id: reportId,
    });
  } catch (error) {
    console.error('Sprout submit error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
