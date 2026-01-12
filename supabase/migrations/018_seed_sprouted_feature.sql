-- Migration 018: SEED_SPROUTED feature
-- Enables reporting when a merchant starts accepting Bitcoin (seed sprouts)

-- Feature flag
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('SEED_SPROUTED', false, 'Enable merchant conversion (sprout) reporting')
ON CONFLICT (key) DO NOTHING;

-- Sprout reports table
-- Stores reports of merchants converting to Bitcoin acceptance
CREATE TABLE IF NOT EXISTS sprout_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  device_session_id UUID NOT NULL REFERENCES device_sessions(id),
  lnurl_identity_id UUID REFERENCES lnurl_identities(id) ON DELETE SET NULL,

  -- Evidence
  photo_url TEXT NOT NULL,
  payment_type TEXT NOT NULL DEFAULT 'unknown' CHECK (payment_type IN ('lightning', 'onchain', 'both', 'unknown')),
  context TEXT CHECK (char_length(context) <= 500),

  -- Review status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'needs_info')),
  reviewer_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES admin_users(id) ON DELETE SET NULL,

  -- Result tracking
  celebratory_pin_id UUID REFERENCES pins(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sprout_reports_location ON sprout_reports(location_id);
CREATE INDEX idx_sprout_reports_status ON sprout_reports(status);
CREATE INDEX idx_sprout_reports_pending ON sprout_reports(created_at) WHERE status = 'pending';
CREATE INDEX idx_sprout_reports_identity ON sprout_reports(lnurl_identity_id);
CREATE INDEX idx_sprout_reports_device ON sprout_reports(device_session_id);

-- Extend locations for sprout tracking
ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS sprouted_at TIMESTAMPTZ;

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS sprouted_by_identity_id UUID REFERENCES lnurl_identities(id) ON DELETE SET NULL;

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS sprout_photo_url TEXT;

ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS sprout_report_id UUID REFERENCES sprout_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_locations_sprouted ON locations(sprouted_at) WHERE sprouted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_locations_sprouted_by ON locations(sprouted_by_identity_id);

-- Extend pins for celebratory/sprouted posts
-- These are special posts that can't be hidden or flagged
ALTER TABLE pins
  ADD COLUMN IF NOT EXISTS is_sprouted_pin BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS idx_pins_sprouted ON pins(is_sprouted_pin) WHERE is_sprouted_pin = TRUE;

-- Add 'Sprouted' to valid badge types (if badges column has a check constraint)
-- Note: badges are stored as text, so we just need to handle it in code

-- RLS policies
ALTER TABLE sprout_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access to sprout_reports"
  ON sprout_reports FOR ALL
  USING (auth.role() = 'service_role');

-- Function to approve a sprout report
-- This handles all the side effects atomically
CREATE OR REPLACE FUNCTION approve_sprout_report(
  report_id UUID,
  admin_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  report_record RECORD;
  location_record RECORD;
  identity_record RECORD;
  celebratory_pin_id UUID;
  author_nym TEXT;
BEGIN
  -- Get the report
  SELECT * INTO report_record
  FROM sprout_reports
  WHERE id = report_id AND status = 'pending';

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Report not found or not pending');
  END IF;

  -- Get the location
  SELECT * INTO location_record
  FROM locations
  WHERE id = report_record.location_id;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Location not found');
  END IF;

  -- Get identity for attribution (if linked)
  IF report_record.lnurl_identity_id IS NOT NULL THEN
    SELECT * INTO identity_record
    FROM lnurl_identities
    WHERE id = report_record.lnurl_identity_id;

    IF FOUND THEN
      author_nym := COALESCE(identity_record.display_name, identity_record.anon_nym);
    END IF;
  END IF;

  -- Create celebratory pin
  celebratory_pin_id := gen_random_uuid();

  INSERT INTO pins (
    id,
    location_id,
    device_session_id,
    lnurl_identity_id,
    author_nym,
    body,
    badge,
    is_sprouted_pin,
    created_at
  ) VALUES (
    celebratory_pin_id,
    report_record.location_id,
    report_record.device_session_id,
    report_record.lnurl_identity_id,
    author_nym,
    location_record.name || ' now accepts Bitcoin!',
    'Sprouted',
    TRUE,
    NOW()
  );

  -- Update location
  UPDATE locations SET
    location_type = 'bitcoin_merchant',
    is_bitcoin_merchant = TRUE,
    sprouted_at = NOW(),
    sprouted_by_identity_id = report_record.lnurl_identity_id,
    sprout_photo_url = report_record.photo_url,
    sprout_report_id = report_id
  WHERE id = report_record.location_id;

  -- Update report status
  UPDATE sprout_reports SET
    status = 'approved',
    reviewer_notes = notes,
    reviewed_at = NOW(),
    reviewed_by = admin_id,
    celebratory_pin_id = celebratory_pin_id
  WHERE id = report_id;

  RETURN json_build_object(
    'success', true,
    'celebratory_pin_id', celebratory_pin_id,
    'location_id', report_record.location_id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to reject a sprout report
CREATE OR REPLACE FUNCTION reject_sprout_report(
  report_id UUID,
  admin_id UUID,
  notes TEXT DEFAULT NULL
)
RETURNS JSON AS $$
DECLARE
  report_record RECORD;
BEGIN
  -- Get and lock the report
  SELECT * INTO report_record
  FROM sprout_reports
  WHERE id = report_id AND status = 'pending'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Report not found or not pending');
  END IF;

  -- Update report status
  UPDATE sprout_reports SET
    status = 'rejected',
    reviewer_notes = notes,
    reviewed_at = NOW(),
    reviewed_by = admin_id
  WHERE id = report_id;

  RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql;
