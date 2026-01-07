-- Migration: Add sponsor_url to location_sponsorships
-- Allows sponsors to link their name to a custom URL

ALTER TABLE location_sponsorships ADD COLUMN IF NOT EXISTS sponsor_url TEXT;
