import { NextRequest, NextResponse } from 'next/server';
import { getFeatureFlags } from '@/lib/featureFlags';
import { verifyMerchantAuth, getMerchantSettings, updateMerchantSettings } from '@/lib/merchant';
import { config } from '@/lib/config';

/**
 * GET /api/merchant/settings
 * Get merchant settings for a location
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
        { error: 'Not authorized to manage this location' },
        { status: 403 }
      );
    }

    const settings = await getMerchantSettings(location_id);
    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching merchant settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/merchant/settings
 * Update merchant settings for a location
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { location_id, session_id, settings } = body;

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
        { error: 'Not authorized to manage this location' },
        { status: 403 }
      );
    }

    // Validate settings
    const validSettings: Record<string, unknown> = {};

    if (settings.welcome_message !== undefined) {
      if (typeof settings.welcome_message !== 'string') {
        return NextResponse.json(
          { error: 'welcome_message must be a string' },
          { status: 400 }
        );
      }
      if (settings.welcome_message.length > config.merchant.welcomeMessageMaxLength) {
        return NextResponse.json(
          { error: `welcome_message must be ${config.merchant.welcomeMessageMaxLength} characters or less` },
          { status: 400 }
        );
      }
      validSettings.welcome_message = settings.welcome_message.trim() || null;
    }

    if (settings.custom_name !== undefined) {
      if (typeof settings.custom_name !== 'string') {
        return NextResponse.json(
          { error: 'custom_name must be a string' },
          { status: 400 }
        );
      }
      if (settings.custom_name.length > 100) {
        return NextResponse.json(
          { error: 'custom_name must be 100 characters or less' },
          { status: 400 }
        );
      }
      validSettings.custom_name = settings.custom_name.trim() || null;
    }

    if (settings.logo_url !== undefined) {
      if (settings.logo_url !== null && typeof settings.logo_url !== 'string') {
        return NextResponse.json(
          { error: 'logo_url must be a string or null' },
          { status: 400 }
        );
      }
      // Basic URL validation
      if (settings.logo_url && !settings.logo_url.match(/^https?:\/\/.+/)) {
        return NextResponse.json(
          { error: 'logo_url must be a valid URL' },
          { status: 400 }
        );
      }
      validSettings.logo_url = settings.logo_url || null;
    }

    if (settings.hours_override !== undefined) {
      if (settings.hours_override !== null && typeof settings.hours_override !== 'string') {
        return NextResponse.json(
          { error: 'hours_override must be a string or null' },
          { status: 400 }
        );
      }
      if (settings.hours_override && settings.hours_override.length > 500) {
        return NextResponse.json(
          { error: 'hours_override must be 500 characters or less' },
          { status: 400 }
        );
      }
      validSettings.hours_override = settings.hours_override?.trim() || null;
    }

    if (settings.tip_jar_address !== undefined) {
      if (settings.tip_jar_address !== null && typeof settings.tip_jar_address !== 'string') {
        return NextResponse.json(
          { error: 'tip_jar_address must be a string or null' },
          { status: 400 }
        );
      }
      validSettings.tip_jar_address = settings.tip_jar_address?.trim() || null;
    }

    if (settings.tip_jar_enabled !== undefined) {
      if (typeof settings.tip_jar_enabled !== 'boolean') {
        return NextResponse.json(
          { error: 'tip_jar_enabled must be a boolean' },
          { status: 400 }
        );
      }
      validSettings.tip_jar_enabled = settings.tip_jar_enabled;
    }

    if (Object.keys(validSettings).length === 0) {
      return NextResponse.json(
        { error: 'No valid settings provided' },
        { status: 400 }
      );
    }

    const updated = await updateMerchantSettings(location_id, validSettings);
    return NextResponse.json({ settings: updated });
  } catch (error) {
    console.error('Error updating merchant settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
