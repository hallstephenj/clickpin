import { createSupabaseServerClient } from './supabase-server';
import { supabaseAdmin } from './supabase';

export interface AdminUser {
  id: string;
  email: string;
  role: 'admin' | 'super_admin';
}

export interface MerchantAuth {
  user_id: string;
  claim_id: string;
  location_id: string;
  device_session_id: string;
}

/**
 * Get the currently authenticated admin user, if any.
 * Returns null if not authenticated or not an admin.
 */
export async function getAdminUser(): Promise<AdminUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: adminUser } = await supabaseAdmin
      .from('admin_users')
      .select('id, email, role')
      .eq('id', user.id)
      .single();

    return adminUser;
  } catch {
    return null;
  }
}

/**
 * Get authenticated merchant access for a specific location.
 * Uses Supabase Auth to check if the current user owns a verified claim.
 */
export async function getMerchantAuth(locationId: string): Promise<MerchantAuth | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return null;

    const { data: claim } = await supabaseAdmin
      .from('merchant_claims')
      .select('id, location_id, device_session_id')
      .eq('user_id', user.id)
      .eq('location_id', locationId)
      .eq('status', 'verified')
      .single();

    if (!claim) return null;

    return {
      user_id: user.id,
      claim_id: claim.id,
      location_id: claim.location_id,
      device_session_id: claim.device_session_id,
    };
  } catch {
    return null;
  }
}

/**
 * Link an existing merchant claim to an authenticated user.
 * This enables multi-device access and account recovery.
 */
export async function linkMerchantClaim(
  userId: string,
  claimId: string,
  deviceSessionId: string
): Promise<boolean> {
  try {
    // Update the claim to link to this user
    const { error: updateError } = await supabaseAdmin
      .from('merchant_claims')
      .update({
        user_id: userId,
        linked_at: new Date().toISOString(),
      })
      .eq('id', claimId)
      .is('user_id', null); // Only link if not already linked

    if (updateError) return false;

    // Add device to merchant_user_devices for multi-device tracking
    await supabaseAdmin
      .from('merchant_user_devices')
      .upsert({
        user_id: userId,
        device_session_id: deviceSessionId,
        claim_id: claimId,
      }, {
        onConflict: 'user_id,device_session_id,claim_id',
      });

    return true;
  } catch {
    return false;
  }
}

/**
 * Add a new device for an authenticated merchant.
 */
export async function addMerchantDevice(
  userId: string,
  claimId: string,
  deviceSessionId: string,
  deviceName?: string
): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('merchant_user_devices')
      .insert({
        user_id: userId,
        device_session_id: deviceSessionId,
        claim_id: claimId,
        device_name: deviceName,
      });

    return !error;
  } catch {
    return false;
  }
}

/**
 * Verify merchant access - supports both:
 * 1. New Supabase Auth (user_id in merchant_claims)
 * 2. Legacy device session auth (device_session_id match)
 */
export async function verifyMerchantAccess(
  locationId: string,
  sessionId: string
): Promise<MerchantAuth | null> {
  // First try new auth method via Supabase Auth
  const authMerchant = await getMerchantAuth(locationId);
  if (authMerchant) return authMerchant;

  // Fall back to legacy device session auth
  const { data: claim } = await supabaseAdmin
    .from('merchant_claims')
    .select('id, location_id, device_session_id')
    .eq('location_id', locationId)
    .eq('device_session_id', sessionId)
    .eq('status', 'verified')
    .single();

  if (!claim) return null;

  return {
    user_id: '', // Empty for legacy auth
    claim_id: claim.id,
    location_id: claim.location_id,
    device_session_id: claim.device_session_id,
  };
}
