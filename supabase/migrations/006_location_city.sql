-- Migration: Add city field to locations
-- Allows displaying city name beneath board name

ALTER TABLE locations ADD COLUMN IF NOT EXISTS city TEXT;
