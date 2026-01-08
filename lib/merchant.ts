import { supabaseAdmin } from '@/lib/supabase';
import { MerchantClaim, MerchantSettings } from '@/types';
import crypto from 'crypto';

/**
 * Generate a unique claim code for merchant verification
 */
export function generateClaimCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

/**
 * Verify that a device session owns the claim for a location
 */
export async function verifyMerchantAuth(
  locationId: string,
  sessionId: string
): Promise<MerchantClaim | null> {
  const { data: claim } = await supabaseAdmin
    .from('merchant_claims')
    .select('*')
    .eq('location_id', locationId)
    .eq('device_session_id', sessionId)
    .eq('status', 'verified')
    .single();

  return claim;
}

/**
 * Check if a location is claimed by any merchant
 */
export async function isLocationClaimed(locationId: string): Promise<boolean> {
  const { data: claim } = await supabaseAdmin
    .from('merchant_claims')
    .select('id')
    .eq('location_id', locationId)
    .eq('status', 'verified')
    .single();

  return !!claim;
}

/**
 * Get the active merchant claim for a location
 */
export async function getLocationClaim(locationId: string): Promise<MerchantClaim | null> {
  const { data: claim } = await supabaseAdmin
    .from('merchant_claims')
    .select('*')
    .eq('location_id', locationId)
    .eq('status', 'verified')
    .single();

  return claim;
}

/**
 * Get merchant settings for a location
 */
export async function getMerchantSettings(locationId: string): Promise<MerchantSettings> {
  const { data: location } = await supabaseAdmin
    .from('locations')
    .select('merchant_settings')
    .eq('id', locationId)
    .single();

  return (location?.merchant_settings as MerchantSettings) || {};
}

/**
 * Update merchant settings for a location
 */
export async function updateMerchantSettings(
  locationId: string,
  settings: Partial<MerchantSettings>
): Promise<MerchantSettings> {
  // Get current settings
  const current = await getMerchantSettings(locationId);

  // Merge with new settings
  const updated = { ...current, ...settings };

  // Update in database
  const { data, error } = await supabaseAdmin
    .from('locations')
    .update({ merchant_settings: updated })
    .eq('id', locationId)
    .select('merchant_settings')
    .single();

  if (error) throw error;
  return (data?.merchant_settings as MerchantSettings) || {};
}

/**
 * Mark a location as claimed and update its status
 */
export async function markLocationClaimed(
  locationId: string,
  claimed: boolean
): Promise<void> {
  const { error } = await supabaseAdmin
    .from('locations')
    .update({ is_claimed: claimed })
    .eq('id', locationId);

  if (error) throw error;
}

/**
 * Create a pending merchant claim
 */
export async function createPendingClaim(
  locationId: string,
  deviceSessionId: string,
  invoiceId: string,
  amountSats: number,
  claimCode: string
): Promise<MerchantClaim> {
  const { data, error } = await supabaseAdmin
    .from('merchant_claims')
    .insert({
      location_id: locationId,
      device_session_id: deviceSessionId,
      verification_method: 'lightning',
      claim_code: claimCode,
      invoice_id: invoiceId,
      amount_sats: amountSats,
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Verify a merchant claim after payment
 */
export async function verifyMerchantClaim(invoiceId: string): Promise<MerchantClaim | null> {
  const now = new Date().toISOString();

  // Find the pending claim
  const { data: claim, error: findError } = await supabaseAdmin
    .from('merchant_claims')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('status', 'pending')
    .single();

  if (findError || !claim) return null;

  // Update to verified
  const { data: verified, error: updateError } = await supabaseAdmin
    .from('merchant_claims')
    .update({
      status: 'verified',
      claimed_at: now,
      verification_proof: { payment_confirmed: now },
    })
    .eq('id', claim.id)
    .select()
    .single();

  if (updateError) throw updateError;

  // Mark location as claimed
  await markLocationClaimed(claim.location_id, true);

  return verified;
}

/**
 * Revoke a merchant claim (admin action)
 */
export async function revokeMerchantClaim(claimId: string): Promise<void> {
  // Get the claim first to find the location
  const { data: claim, error: findError } = await supabaseAdmin
    .from('merchant_claims')
    .select('location_id')
    .eq('id', claimId)
    .single();

  if (findError || !claim) throw new Error('Claim not found');

  // Update claim status
  const { error: updateError } = await supabaseAdmin
    .from('merchant_claims')
    .update({ status: 'revoked' })
    .eq('id', claimId);

  if (updateError) throw updateError;

  // Mark location as unclaimed
  await markLocationClaimed(claim.location_id, false);
}
