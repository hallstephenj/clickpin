-- Migration: SEED_PLANTED Feature
-- Enables coordinated Bitcoin advocacy at non-Bitcoin-accepting merchant locations
-- Adds location categories, seed planting tracking, and visual theming support

-- =============================================================================
-- 1. Insert SEED_PLANTED feature flag (disabled by default)
-- =============================================================================
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('SEED_PLANTED', false, 'Enable seed planting feature for Bitcoin merchant advocacy')
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 2. Add location_type column to locations table
-- =============================================================================
ALTER TABLE locations ADD COLUMN IF NOT EXISTS location_type TEXT DEFAULT 'merchant';

-- Add check constraint for valid location types
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'locations_location_type_check'
  ) THEN
    ALTER TABLE locations ADD CONSTRAINT locations_location_type_check
      CHECK (location_type IN ('bitcoin_merchant', 'merchant', 'community_space'));
  END IF;
END $$;

-- Create index for location_type queries
CREATE INDEX IF NOT EXISTS idx_locations_location_type ON locations(location_type);

-- =============================================================================
-- 3. Migrate existing locations based on is_bitcoin_merchant and is_claimed
-- =============================================================================
-- Set bitcoin merchants
UPDATE locations
SET location_type = 'bitcoin_merchant'
WHERE is_bitcoin_merchant = true AND location_type = 'merchant';

-- Non-bitcoin merchants that are claimed stay as 'merchant' (already default)
-- Unclaimed, non-bitcoin locations also stay as 'merchant'

-- =============================================================================
-- 4. Create seed_plantings table
-- =============================================================================
CREATE TABLE IF NOT EXISTS seed_plantings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  device_session_id UUID NOT NULL REFERENCES device_sessions(id),
  outcome TEXT NOT NULL CHECK (outcome IN ('positive', 'neutral', 'negative')),
  commentary TEXT CHECK (char_length(commentary) <= 280),
  pin_id UUID REFERENCES pins(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for counting seeds by location
CREATE INDEX IF NOT EXISTS idx_seed_plantings_location ON seed_plantings(location_id);

-- Index for checking daily limit per device per location
-- Note: Daily uniqueness is enforced at the application level
CREATE INDEX IF NOT EXISTS idx_seed_plantings_daily
  ON seed_plantings(device_session_id, location_id, created_at);

-- Index for outcome aggregation
CREATE INDEX IF NOT EXISTS idx_seed_plantings_outcome ON seed_plantings(location_id, outcome);

-- =============================================================================
-- 5. Enable RLS on seed_plantings
-- =============================================================================
ALTER TABLE seed_plantings ENABLE ROW LEVEL SECURITY;

-- Policy: Service role has full access
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'seed_plantings'
    AND policyname = 'Service role full access to seed_plantings'
  ) THEN
    CREATE POLICY "Service role full access to seed_plantings"
      ON seed_plantings FOR ALL
      USING (auth.role() = 'service_role');
  END IF;
END $$;

-- =============================================================================
-- 6. Comments for documentation
-- =============================================================================
COMMENT ON TABLE seed_plantings IS 'Tracks Bitcoin advocacy conversations at non-Bitcoin merchant locations';
COMMENT ON COLUMN seed_plantings.outcome IS 'Conversation outcome: positive (interested), neutral (listened), negative (not interested)';
COMMENT ON COLUMN seed_plantings.commentary IS 'Optional note for future advocates, max 280 chars';
COMMENT ON COLUMN seed_plantings.pin_id IS 'Reference to pin created if commentary was provided';
COMMENT ON COLUMN locations.location_type IS 'Category: bitcoin_merchant (accepts BTC), merchant (does not accept BTC), community_space (non-commercial)';
