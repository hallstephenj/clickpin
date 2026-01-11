-- Add FORSTALL_MODE feature flag
-- Enables skeuomorphic, pre-iOS7, Scott Forstall-era design

INSERT INTO feature_flags (key, enabled, description)
VALUES ('FORSTALL_MODE', false, 'Skeuomorphic pre-iOS7 design mode with cork pinboard, leather, brushed metal, and bitcoin coin aesthetics')
ON CONFLICT (key) DO NOTHING;
