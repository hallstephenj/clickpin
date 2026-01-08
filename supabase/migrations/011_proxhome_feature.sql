-- Insert PROXHOME feature flag (enabled by default)
INSERT INTO feature_flags (key, enabled, description)
VALUES ('PROXHOME', true, 'Discovery-framed homepage for users outside of boards')
ON CONFLICT (key) DO NOTHING;
