-- Migration: Supabase Auth for Admin & Merchant Accounts
-- This adds proper user authentication using Supabase Auth with email magic links

-- Admin users table (linked to auth.users)
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'admin' CHECK (role IN ('admin', 'super_admin')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users(role);

-- Multi-device support for merchants
CREATE TABLE IF NOT EXISTS merchant_user_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_session_id UUID NOT NULL REFERENCES device_sessions(id),
  claim_id UUID NOT NULL REFERENCES merchant_claims(id),
  device_name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, device_session_id, claim_id)
);

CREATE INDEX IF NOT EXISTS idx_merchant_user_devices_user ON merchant_user_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_merchant_user_devices_claim ON merchant_user_devices(claim_id);

-- Add optional user link to merchant_claims for multi-device support
ALTER TABLE merchant_claims
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS linked_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_merchant_claims_user ON merchant_claims(user_id);

-- RLS policies for admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY "Service role full access to admin_users"
  ON admin_users FOR ALL
  USING (auth.role() = 'service_role');

-- Admins can read their own record
CREATE POLICY "Admins can read own record"
  ON admin_users FOR SELECT
  USING (auth.uid() = id);

-- RLS policies for merchant_user_devices
ALTER TABLE merchant_user_devices ENABLE ROW LEVEL SECURITY;

-- Service role can do anything
CREATE POLICY "Service role full access to merchant_user_devices"
  ON merchant_user_devices FOR ALL
  USING (auth.role() = 'service_role');

-- Users can manage their own devices
CREATE POLICY "Users can manage own devices"
  ON merchant_user_devices FOR ALL
  USING (auth.uid() = user_id);
