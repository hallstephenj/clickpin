-- Enable PostGIS extension for geospatial queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Locations table
CREATE TABLE locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  category TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_m INTEGER NOT NULL DEFAULT 200,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- PostGIS geography column for efficient spatial queries
  geog GEOGRAPHY(POINT, 4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lng, lat), 4326)::geography) STORED
);

-- Create spatial index on locations
CREATE INDEX idx_locations_geog ON locations USING GIST (geog);
CREATE INDEX idx_locations_slug ON locations (slug);
CREATE INDEX idx_locations_active ON locations (is_active) WHERE is_active = true;

-- Device sessions table (anonymous identity)
CREATE TABLE device_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_agent TEXT
);

CREATE INDEX idx_device_sessions_last_seen ON device_sessions (last_seen_at);

-- Pins table
CREATE TABLE pins (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  parent_pin_id UUID REFERENCES pins(id) ON DELETE CASCADE,
  device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
  body TEXT NOT NULL CHECK (char_length(body) <= 280),
  doodle_data TEXT, -- Stores PNG base64 or compressed stroke JSON
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  is_hidden BOOLEAN NOT NULL DEFAULT false,
  boost_score INTEGER NOT NULL DEFAULT 0,
  boost_expires_at TIMESTAMPTZ
);

CREATE INDEX idx_pins_location ON pins (location_id, created_at DESC);
CREATE INDEX idx_pins_parent ON pins (parent_pin_id) WHERE parent_pin_id IS NOT NULL;
CREATE INDEX idx_pins_device_session ON pins (device_session_id);
CREATE INDEX idx_pins_visible ON pins (location_id, created_at DESC)
  WHERE deleted_at IS NULL AND is_hidden = false;
CREATE INDEX idx_pins_boost ON pins (location_id, boost_score DESC, created_at DESC)
  WHERE deleted_at IS NULL AND is_hidden = false AND boost_score > 0;

-- Pin flags table
CREATE TABLE pin_flags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(pin_id, device_session_id)
);

CREATE INDEX idx_pin_flags_pin ON pin_flags (pin_id);

-- Pin boosts table (Lightning payments for boosting)
CREATE TABLE pin_boosts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
  amount_sats INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'dev',
  invoice_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_pin_boosts_invoice ON pin_boosts (invoice_id);
CREATE INDEX idx_pin_boosts_status ON pin_boosts (status) WHERE status = 'pending';

-- Location sponsorships table
CREATE TABLE location_sponsorships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  sponsor_label TEXT NOT NULL,
  amount_sats INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'dev',
  invoice_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_until TIMESTAMPTZ
);

CREATE INDEX idx_location_sponsorships_location ON location_sponsorships (location_id);
CREATE INDEX idx_location_sponsorships_invoice ON location_sponsorships (invoice_id);
CREATE INDEX idx_location_sponsorships_active ON location_sponsorships (location_id, paid_until)
  WHERE status = 'paid';

-- Pin deletion payments table
CREATE TABLE pin_deletion_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  pin_id UUID NOT NULL REFERENCES pins(id) ON DELETE CASCADE,
  device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
  amount_sats INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'dev',
  invoice_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX idx_pin_deletion_payments_invoice ON pin_deletion_payments (invoice_id);
CREATE INDEX idx_pin_deletion_payments_pin ON pin_deletion_payments (pin_id);

-- Post quota ledger table
CREATE TABLE post_quota_ledger (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  free_posts_used INTEGER NOT NULL DEFAULT 0,
  paid_posts_used INTEGER NOT NULL DEFAULT 0,
  UNIQUE(device_session_id, location_id, date)
);

CREATE INDEX idx_post_quota_ledger_lookup ON post_quota_ledger (device_session_id, location_id, date);

-- Post payments table (for paid posts after free quota exceeded)
CREATE TABLE post_payments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  device_session_id UUID NOT NULL REFERENCES device_sessions(id) ON DELETE CASCADE,
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  amount_sats INTEGER NOT NULL,
  provider TEXT NOT NULL DEFAULT 'dev',
  invoice_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'used')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ
);

CREATE INDEX idx_post_payments_invoice ON post_payments (invoice_id);
CREATE INDEX idx_post_payments_status ON post_payments (device_session_id, location_id, status)
  WHERE status = 'paid';

-- Function to find nearest location
CREATE OR REPLACE FUNCTION find_nearest_location(
  user_lat DOUBLE PRECISION,
  user_lng DOUBLE PRECISION,
  max_distance_m INTEGER DEFAULT 200
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  category TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  radius_m INTEGER,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  distance_m DOUBLE PRECISION
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id,
    l.name,
    l.slug,
    l.category,
    l.lat,
    l.lng,
    l.radius_m,
    l.is_active,
    l.created_at,
    ST_Distance(l.geog, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) as distance_m
  FROM locations l
  WHERE l.is_active = true
    AND ST_DWithin(
      l.geog,
      ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography,
      GREATEST(max_distance_m, l.radius_m)
    )
  ORDER BY distance_m ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;

-- Function to get flag count for a pin
CREATE OR REPLACE FUNCTION get_pin_flag_count(p_pin_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER FROM pin_flags WHERE pin_id = p_pin_id;
$$ LANGUAGE sql;

-- Function to check and hide pin if flag threshold exceeded
CREATE OR REPLACE FUNCTION check_flag_threshold()
RETURNS TRIGGER AS $$
DECLARE
  flag_count INTEGER;
  threshold INTEGER := 5; -- Default threshold, can be made configurable
BEGIN
  SELECT COUNT(*) INTO flag_count FROM pin_flags WHERE pin_id = NEW.pin_id;

  IF flag_count >= threshold THEN
    UPDATE pins SET is_hidden = true WHERE id = NEW.pin_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_flag_threshold
AFTER INSERT ON pin_flags
FOR EACH ROW
EXECUTE FUNCTION check_flag_threshold();

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE device_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_sponsorships ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_deletion_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_quota_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE post_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Allow service role full access (used by Next.js server routes)
-- These policies allow the service role to perform all operations
CREATE POLICY "Service role full access" ON locations FOR ALL USING (true);
CREATE POLICY "Service role full access" ON device_sessions FOR ALL USING (true);
CREATE POLICY "Service role full access" ON pins FOR ALL USING (true);
CREATE POLICY "Service role full access" ON pin_flags FOR ALL USING (true);
CREATE POLICY "Service role full access" ON pin_boosts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON location_sponsorships FOR ALL USING (true);
CREATE POLICY "Service role full access" ON pin_deletion_payments FOR ALL USING (true);
CREATE POLICY "Service role full access" ON post_quota_ledger FOR ALL USING (true);
CREATE POLICY "Service role full access" ON post_payments FOR ALL USING (true);

-- Enable Realtime for pins table
ALTER PUBLICATION supabase_realtime ADD TABLE pins;
