-- Add BTCMap integration fields to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS btcmap_id INTEGER UNIQUE;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS osm_id TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS opening_hours TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS btcmap_icon TEXT;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS btcmap_verified_at TIMESTAMPTZ;
ALTER TABLE locations ADD COLUMN IF NOT EXISTS btcmap_updated_at TIMESTAMPTZ;

-- Index for BTCMap sync
CREATE INDEX IF NOT EXISTS idx_locations_btcmap_id ON locations(btcmap_id);
CREATE INDEX IF NOT EXISTS idx_locations_btcmap_updated ON locations(btcmap_updated_at);
