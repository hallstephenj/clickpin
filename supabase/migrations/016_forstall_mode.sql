-- Create app_settings table for global application settings
-- Design theme: 'mono' (default) or 'forstall' (skeuomorphic)

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default design theme
INSERT INTO app_settings (key, value, description)
VALUES ('design_theme', 'mono', 'App design theme: mono (default) or forstall (skeuomorphic)')
ON CONFLICT (key) DO NOTHING;

-- Remove FORSTALL_MODE from feature_flags if it exists
DELETE FROM feature_flags WHERE key = 'FORSTALL_MODE';

-- Enable RLS
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access to app settings
CREATE POLICY "Anyone can read app_settings"
  ON app_settings FOR SELECT
  TO public
  USING (true);

-- Only authenticated admins can update (handled by API with admin auth)
