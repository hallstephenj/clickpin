-- Fix RLS policies to allow INSERT operations
-- The original policies only had USING clause which doesn't apply to INSERT
-- This migration drops and recreates the policies with proper WITH CHECK clause

-- Drop existing policies
DROP POLICY IF EXISTS "Service role full access" ON locations;
DROP POLICY IF EXISTS "Service role full access" ON device_sessions;
DROP POLICY IF EXISTS "Service role full access" ON pins;
DROP POLICY IF EXISTS "Service role full access" ON pin_flags;
DROP POLICY IF EXISTS "Service role full access" ON pin_boosts;
DROP POLICY IF EXISTS "Service role full access" ON location_sponsorships;
DROP POLICY IF EXISTS "Service role full access" ON pin_deletion_payments;
DROP POLICY IF EXISTS "Service role full access" ON post_quota_ledger;
DROP POLICY IF EXISTS "Service role full access" ON post_payments;

-- Recreate policies with both USING and WITH CHECK
CREATE POLICY "Service role full access" ON locations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON device_sessions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pins FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pin_flags FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pin_boosts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON location_sponsorships FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON pin_deletion_payments FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON post_quota_ledger FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Service role full access" ON post_payments FOR ALL USING (true) WITH CHECK (true);
