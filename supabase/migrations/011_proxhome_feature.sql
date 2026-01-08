-- Insert PROXHOME feature flag
INSERT INTO feature_flags (key, enabled, description)
VALUES ('PROXHOME', false, 'Discovery-framed homepage for users outside of boards')
ON CONFLICT (key) DO NOTHING;
