-- Migration 017: LNURL-auth identity feature
-- Adds optional Lightning wallet-based identity that coexists with anonymous device sessions

-- Feature flag
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('LNURL_AUTH', false, 'Enable Lightning wallet identity via LNURL-auth')
ON CONFLICT (key) DO NOTHING;

-- Lightning identities table
-- Stores linked wallet identities
CREATE TABLE IF NOT EXISTS lnurl_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  linking_key TEXT UNIQUE NOT NULL,     -- Wallet's public key (secp256k1 hex, 66 chars)
  display_name TEXT,                     -- User-chosen name, optional
  anon_nym TEXT NOT NULL,               -- Generated @anon-XXXXXX identifier from pubkey
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_auth_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_lnurl_identities_linking_key ON lnurl_identities(linking_key);
CREATE INDEX idx_lnurl_identities_nym ON lnurl_identities(anon_nym);

-- Device to identity links (supports multiple devices per identity)
-- When a user scans LNURL-auth on a new device, a new link is created
CREATE TABLE IF NOT EXISTS lnurl_device_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identity_id UUID NOT NULL REFERENCES lnurl_identities(id) ON DELETE CASCADE,
  device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
  device_name TEXT,                     -- Optional user-friendly name
  linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(identity_id, device_session_id)
);

CREATE INDEX idx_lnurl_device_links_device ON lnurl_device_links(device_session_id);
CREATE INDEX idx_lnurl_device_links_identity ON lnurl_device_links(identity_id);

-- LNURL-auth challenges (temporary, for verification flow)
-- These are short-lived records that track pending authentication attempts
CREATE TABLE IF NOT EXISTS lnurl_challenges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  k1 TEXT UNIQUE NOT NULL,              -- 32-byte random challenge (64 char hex)
  device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
  action TEXT NOT NULL DEFAULT 'login' CHECK (action IN ('login', 'link', 'auth')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'expired')),
  linking_key TEXT,                     -- Set after successful verification
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes'),
  verified_at TIMESTAMPTZ
);

CREATE INDEX idx_lnurl_challenges_k1 ON lnurl_challenges(k1);
CREATE INDEX idx_lnurl_challenges_status ON lnurl_challenges(status) WHERE status = 'pending';
CREATE INDEX idx_lnurl_challenges_expires ON lnurl_challenges(expires_at) WHERE status = 'pending';

-- Extend device_sessions to reference linked identity
-- This is the primary link - device knows its current identity
ALTER TABLE device_sessions
  ADD COLUMN IF NOT EXISTS lnurl_identity_id UUID REFERENCES lnurl_identities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_device_sessions_identity ON device_sessions(lnurl_identity_id);

-- Extend pins to track author identity
-- Stores snapshot of identity at creation time for attribution
ALTER TABLE pins
  ADD COLUMN IF NOT EXISTS lnurl_identity_id UUID REFERENCES lnurl_identities(id) ON DELETE SET NULL;

ALTER TABLE pins
  ADD COLUMN IF NOT EXISTS author_nym TEXT;

CREATE INDEX IF NOT EXISTS idx_pins_identity ON pins(lnurl_identity_id);

-- Extend seed_plantings to track author identity
ALTER TABLE seed_plantings
  ADD COLUMN IF NOT EXISTS lnurl_identity_id UUID REFERENCES lnurl_identities(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_seed_plantings_identity ON seed_plantings(lnurl_identity_id);

-- RLS policies
ALTER TABLE lnurl_identities ENABLE ROW LEVEL SECURITY;
ALTER TABLE lnurl_device_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE lnurl_challenges ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to lnurl_identities"
  ON lnurl_identities FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to lnurl_device_links"
  ON lnurl_device_links FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to lnurl_challenges"
  ON lnurl_challenges FOR ALL
  USING (auth.role() = 'service_role');

-- Function to clean up expired challenges (can be called periodically)
CREATE OR REPLACE FUNCTION cleanup_expired_lnurl_challenges()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM lnurl_challenges
  WHERE status = 'pending' AND expires_at < NOW();

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;
