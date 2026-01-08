-- Insert ROTATONATOR feature flag
INSERT INTO feature_flags (key, enabled, description)
VALUES ('ROTATONATOR', false, 'Rotating prompt carousel for empty boards')
ON CONFLICT (key) DO NOTHING;
