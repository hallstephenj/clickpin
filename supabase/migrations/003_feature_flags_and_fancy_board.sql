-- Feature Flags Table
CREATE TABLE feature_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key TEXT UNIQUE NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_feature_flags_key ON feature_flags (key);

-- Enable RLS
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to feature_flags"
  ON feature_flags FOR ALL
  USING (true)
  WITH CHECK (true);

-- Seed default feature flags (all disabled)
INSERT INTO feature_flags (key, enabled, description) VALUES
  ('fancy_board_enabled', false, 'Master toggle for all fancy board features'),
  ('fancy_tap_to_place', false, 'Enable tap-to-place positioning for pins'),
  ('fancy_templates', false, 'Enable paper templates (index, sticky, torn, receipt)'),
  ('fancy_sizes', false, 'Enable size variants (S, M, L)'),
  ('fancy_rotation', false, 'Enable note rotation (-4 to +4 degrees)'),
  ('fancy_stacking', false, 'Enable z-index based stacking with boost lift'),
  ('fancy_aging', false, 'Enable aging/patina CSS effects'),
  ('fancy_dig_mode', false, 'Enable long-press dig/peek interaction');

-- Add fancy board columns to pins table (all nullable for backward compatibility)
ALTER TABLE pins ADD COLUMN IF NOT EXISTS x DOUBLE PRECISION;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS y DOUBLE PRECISION;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS rotation DOUBLE PRECISION;
ALTER TABLE pins ADD COLUMN IF NOT EXISTS template TEXT CHECK (template IN ('index', 'sticky', 'torn', 'receipt'));
ALTER TABLE pins ADD COLUMN IF NOT EXISTS size TEXT CHECK (size IN ('S', 'M', 'L'));
ALTER TABLE pins ADD COLUMN IF NOT EXISTS z_seed INTEGER;

-- Index for efficient z-order queries
CREATE INDEX IF NOT EXISTS idx_pins_z_order ON pins (location_id, z_seed, created_at)
  WHERE deleted_at IS NULL AND is_hidden = false;

-- Function to auto-update updated_at on feature_flags
CREATE OR REPLACE FUNCTION update_feature_flags_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_feature_flags_updated_at
BEFORE UPDATE ON feature_flags
FOR EACH ROW
EXECUTE FUNCTION update_feature_flags_updated_at();
