-- Add badge column to pins table
ALTER TABLE pins ADD COLUMN IF NOT EXISTS badge TEXT;

-- Insert BADGES feature flag
INSERT INTO feature_flags (key, enabled, description)
VALUES ('BADGES', false, 'Optional post labels (Question, Announcement, Offer, etc.)')
ON CONFLICT (key) DO NOTHING;
