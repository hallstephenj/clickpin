import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getFeatureFlags } from '@/lib/featureFlags';
import { isValidDisplayName, sanitizeDisplayName } from '@/lib/lnurl';
import { LnurlIdentity } from '@/types';

/**
 * GET /api/lnurl/profile
 * Get the LNURL identity for a device session
 *
 * Query parameters:
 * - device_session_id: The device session ID
 *
 * Response:
 * {
 *   identity: LnurlIdentity | null
 *   is_linked: boolean
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
    const deviceSessionId = searchParams.get('device_session_id');

    if (!deviceSessionId) {
      return NextResponse.json(
        { error: 'device_session_id is required' },
        { status: 400 }
      );
    }

    // Get device session with identity
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('device_sessions')
      .select('id, lnurl_identity_id')
      .eq('id', deviceSessionId)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Device session not found' },
        { status: 404 }
      );
    }

    // If no identity linked, return null
    if (!session.lnurl_identity_id) {
      return NextResponse.json({
        identity: null,
        is_linked: false,
      });
    }

    // Get identity
    const { data: identity, error: identityError } = await supabaseAdmin
      .from('lnurl_identities')
      .select('*')
      .eq('id', session.lnurl_identity_id)
      .single();

    if (identityError || !identity) {
      return NextResponse.json({
        identity: null,
        is_linked: false,
      });
    }

    return NextResponse.json({
      identity: identity as LnurlIdentity,
      is_linked: true,
    });
  } catch (error) {
    console.error('LNURL profile GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/lnurl/profile
 * Update the display name for an LNURL identity
 *
 * Request body:
 * {
 *   device_session_id: string
 *   display_name: string | null  // null to clear
 * }
 *
 * Response:
 * {
 *   success: boolean
 *   identity: LnurlIdentity
 * }
 */
export async function PATCH(request: NextRequest) {
  try {
    // Check if feature is enabled
    const flags = await getFeatureFlags();
    if (!flags.LNURL_AUTH) {
      return NextResponse.json(
        { error: 'LNURL-auth feature is not enabled' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { device_session_id, display_name } = body;

    if (!device_session_id) {
      return NextResponse.json(
        { error: 'device_session_id is required' },
        { status: 400 }
      );
    }

    // Get device session with identity
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('device_sessions')
      .select('id, lnurl_identity_id')
      .eq('id', device_session_id)
      .single();

    if (sessionError || !session || !session.lnurl_identity_id) {
      return NextResponse.json(
        { error: 'No identity linked to this device' },
        { status: 400 }
      );
    }

    // Validate and sanitize display name
    let sanitizedName: string | null = null;
    if (display_name !== null && display_name !== '') {
      if (!isValidDisplayName(display_name)) {
        return NextResponse.json(
          { error: 'Invalid display name. Use 1-30 characters, alphanumeric and underscores only.' },
          { status: 400 }
        );
      }
      sanitizedName = sanitizeDisplayName(display_name);

      // Check if name is taken by another identity
      const { data: existing } = await supabaseAdmin
        .from('lnurl_identities')
        .select('id')
        .eq('display_name', sanitizedName)
        .neq('id', session.lnurl_identity_id)
        .single();

      if (existing) {
        return NextResponse.json(
          { error: 'This display name is already taken' },
          { status: 400 }
        );
      }
    }

    // Update identity
    const { data: updatedIdentity, error: updateError } = await supabaseAdmin
      .from('lnurl_identities')
      .update({ display_name: sanitizedName })
      .eq('id', session.lnurl_identity_id)
      .select()
      .single();

    if (updateError || !updatedIdentity) {
      console.error('Error updating identity:', updateError);
      return NextResponse.json(
        { error: 'Failed to update display name' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      identity: updatedIdentity as LnurlIdentity,
    });
  } catch (error) {
    console.error('LNURL profile PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/lnurl/profile
 * Unlink an LNURL identity from a device session
 *
 * Request body:
 * {
 *   device_session_id: string
 * }
 *
 * Response:
 * {
 *   success: boolean
 * }
 */
export async function DELETE(request: NextRequest) {
  try {
    // Check if feature is enabled
    const flags = await getFeatureFlags();
    if (!flags.LNURL_AUTH) {
      return NextResponse.json(
        { error: 'LNURL-auth feature is not enabled' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { device_session_id } = body;

    if (!device_session_id) {
      return NextResponse.json(
        { error: 'device_session_id is required' },
        { status: 400 }
      );
    }

    // Get device session
    const { data: session, error: sessionError } = await supabaseAdmin
      .from('device_sessions')
      .select('id, lnurl_identity_id')
      .eq('id', device_session_id)
      .single();

    if (sessionError || !session) {
      return NextResponse.json(
        { error: 'Device session not found' },
        { status: 404 }
      );
    }

    if (!session.lnurl_identity_id) {
      return NextResponse.json(
        { error: 'No identity linked to this device' },
        { status: 400 }
      );
    }

    // Remove device link
    await supabaseAdmin
      .from('lnurl_device_links')
      .delete()
      .eq('identity_id', session.lnurl_identity_id)
      .eq('device_session_id', device_session_id);

    // Clear identity from device session
    await supabaseAdmin
      .from('device_sessions')
      .update({ lnurl_identity_id: null })
      .eq('id', device_session_id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('LNURL profile DELETE error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
