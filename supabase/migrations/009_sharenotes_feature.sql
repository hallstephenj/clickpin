-- Insert SHARENOTES feature flag
INSERT INTO feature_flags (key, enabled, description)
VALUES ('SHARENOTES', false, 'Shareable pin links with social preview images')
ON CONFLICT (key) DO NOTHING;
