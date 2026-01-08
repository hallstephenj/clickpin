-- Migration: Merchants Feature
-- Enables BTCMap merchants to claim and manage their location boards

-- Insert MERCHANTS feature flag (disabled by default)
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('MERCHANTS', false, 'Enable merchant verification and management features')
ON CONFLICT (key) DO NOTHING;

-- Create merchant_claims table
CREATE TABLE IF NOT EXISTS merchant_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  device_session_id UUID NOT NULL REFERENCES device_sessions(id),
  verification_method TEXT CHECK (verification_method IN ('lightning', 'domain', 'manual')),
  verification_proof JSONB DEFAULT '{}',
  claim_code TEXT UNIQUE,
  invoice_id TEXT,
  amount_sats INTEGER,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'verified', 'revoked')),
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for merchant_claims
CREATE INDEX IF NOT EXISTS idx_merchant_claims_location ON merchant_claims(location_id);
CREATE INDEX IF NOT EXISTS idx_merchant_claims_status ON merchant_claims(status);
CREATE INDEX IF NOT EXISTS idx_merchant_claims_invoice ON merchant_claims(invoice_id);
CREATE INDEX IF NOT EXISTS idx_merchant_claims_device ON merchant_claims(device_session_id);

-- Unique index: only one verified claim per location
CREATE UNIQUE INDEX IF NOT EXISTS idx_merchant_claims_active
  ON merchant_claims(location_id)
  WHERE status = 'verified';

-- Extend locations table for merchant features
ALTER TABLE locations ADD COLUMN IF NOT EXISTS is_claimed BOOLEAN DEFAULT false;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS merchant_settings JSONB DEFAULT '{}';

-- Extend pins table for merchant features
ALTER TABLE pins ADD COLUMN IF NOT EXISTS is_merchant_pinned BOOLEAN DEFAULT false;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS is_merchant_hidden BOOLEAN DEFAULT false;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS is_merchant_post BOOLEAN DEFAULT false;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS is_daily_special BOOLEAN DEFAULT false;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS special_expires_at TIMESTAMPTZ;

-- Enable RLS on merchant_claims
ALTER TABLE merchant_claims ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'merchant_claims'
    AND policyname = 'Service role full access to merchant_claims'
  ) THEN
    CREATE POLICY "Service role full access to merchant_claims"
      ON merchant_claims FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Comments for documentation
COMMENT ON TABLE merchant_claims IS 'Tracks merchant verification claims for locations';
COMMENT ON COLUMN merchant_claims.verification_method IS 'Method used: lightning, domain, or manual';
COMMENT ON COLUMN merchant_claims.verification_proof IS 'JSON proof data: payment_hash, dns_record, or image_url';
COMMENT ON COLUMN merchant_claims.claim_code IS 'Unique code embedded in invoice memo for verification';
COMMENT ON COLUMN locations.merchant_settings IS 'JSON: welcome_message, logo_url, custom_name, tip_jar_address, hours_override';
COMMENT ON COLUMN pins.is_merchant_pinned IS 'Merchant has pinned this post to top of board';
COMMENT ON COLUMN pins.is_merchant_hidden IS 'Merchant has hidden this post from board';
COMMENT ON COLUMN pins.is_merchant_post IS 'Post was made by verified merchant';
COMMENT ON COLUMN pins.is_daily_special IS 'Post is a daily special announcement';
COMMENT ON COLUMN pins.special_expires_at IS 'When daily special auto-expires';
