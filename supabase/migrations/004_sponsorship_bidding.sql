-- Migration: Sponsorship bidding system
-- Sponsorships now last indefinitely and can be outbid

-- Add active_at column to track when a sponsorship becomes active (24hr after payment)
ALTER TABLE location_sponsorships ADD COLUMN IF NOT EXISTS active_at TIMESTAMPTZ;

-- Add paid_at column to track when payment was received
ALTER TABLE location_sponsorships ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

-- Remove paid_until since sponsorships no longer expire
-- (keeping column for backwards compat but no longer used)

-- Update status check to include 'superseded' state
ALTER TABLE location_sponsorships DROP CONSTRAINT IF EXISTS location_sponsorships_status_check;
ALTER TABLE location_sponsorships ADD CONSTRAINT location_sponsorships_status_check
  CHECK (status IN ('pending', 'paid', 'active', 'superseded', 'expired'));

-- Create index for finding active sponsorship
CREATE INDEX IF NOT EXISTS idx_location_sponsorships_active_at
  ON location_sponsorships (location_id, active_at DESC)
  WHERE status IN ('paid', 'active');
