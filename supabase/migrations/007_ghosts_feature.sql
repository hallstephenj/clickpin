-- Ghosts Feature Migration
-- Adds activity tracking, rollups, and feature flag for the Ghosts homepage

-- 1. Add GHOSTS feature flag (disabled by default)
INSERT INTO feature_flags (key, enabled, description)
VALUES ('GHOSTS', false, 'Master toggle for Ghosts homepage - shows activity signals for locations')
ON CONFLICT (key) DO NOTHING;

-- 2. Add ghosts_enabled column to locations table
ALTER TABLE locations ADD COLUMN IF NOT EXISTS ghosts_enabled BOOLEAN NOT NULL DEFAULT false;

-- 3. Create location_activity_events table (raw events, private)
CREATE TABLE IF NOT EXISTS location_activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'pin_created',
    'reply_created',
    'pin_boosted',
    'pin_deleted_paid',
    'sponsor_bid_paid',
    'sponsor_activated',
    'pin_flagged'
  )),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  coarse_bucket TIMESTAMPTZ NOT NULL, -- Rounded to nearest hour
  metadata JSONB DEFAULT '{}',
  privacy_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_activity_events_location_bucket
  ON location_activity_events(location_id, coarse_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_occurred
  ON location_activity_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_type
  ON location_activity_events(event_type);

-- 4. Create location_activity_rollups table (public-facing summaries)
CREATE TABLE IF NOT EXISTS location_activity_rollups (
  location_id UUID PRIMARY KEY REFERENCES locations(id) ON DELETE CASCADE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pins_last_24h INTEGER NOT NULL DEFAULT 0,
  replies_last_24h INTEGER NOT NULL DEFAULT 0,
  boosts_last_24h INTEGER NOT NULL DEFAULT 0,
  flags_last_24h INTEGER NOT NULL DEFAULT 0,
  sponsorship_active BOOLEAN NOT NULL DEFAULT false,
  sponsor_expires_at TIMESTAMPTZ,
  activity_score INTEGER NOT NULL DEFAULT 0,
  last_activity_bucket TIMESTAMPTZ, -- Coarse time, not exact
  min_k_threshold_met BOOLEAN NOT NULL DEFAULT false,
  total_events_last_24h INTEGER NOT NULL DEFAULT 0
);

-- 5. Create location_activity_daily table (for historical charts)
CREATE TABLE IF NOT EXISTS location_activity_daily (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  pins INTEGER NOT NULL DEFAULT 0,
  replies INTEGER NOT NULL DEFAULT 0,
  boosts INTEGER NOT NULL DEFAULT 0,
  flags INTEGER NOT NULL DEFAULT 0,
  activity_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(location_id, date)
);

CREATE INDEX IF NOT EXISTS idx_activity_daily_location_date
  ON location_activity_daily(location_id, date DESC);

-- 6. Enable RLS on new tables
ALTER TABLE location_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_activity_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_activity_daily ENABLE ROW LEVEL SECURITY;

-- Service role has full access
CREATE POLICY "Service role full access to location_activity_events"
  ON location_activity_events FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to location_activity_rollups"
  ON location_activity_rollups FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to location_activity_daily"
  ON location_activity_daily FOR ALL
  USING (auth.role() = 'service_role');

-- 7. Function to compute coarse bucket (rounds to nearest hour)
CREATE OR REPLACE FUNCTION compute_coarse_bucket(ts TIMESTAMPTZ)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN date_trunc('hour', ts);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. Function to compute activity score
-- Weights: pins=1, replies=0.5, boosts=5, sponsor=10, flags=-1
-- With freshness decay based on last_activity_bucket
CREATE OR REPLACE FUNCTION compute_activity_score(
  p_pins INTEGER,
  p_replies INTEGER,
  p_boosts INTEGER,
  p_sponsorship_active BOOLEAN,
  p_flags INTEGER,
  p_last_activity TIMESTAMPTZ
) RETURNS INTEGER AS $$
DECLARE
  base_score NUMERIC;
  decay_factor NUMERIC;
  hours_since_activity NUMERIC;
BEGIN
  -- Base score calculation
  base_score := (p_pins * 1.0) + (p_replies * 0.5) + (LEAST(p_boosts, 10) * 5.0);

  -- Sponsor bonus
  IF p_sponsorship_active THEN
    base_score := base_score + 10;
  END IF;

  -- Flag penalty (capped)
  base_score := base_score - LEAST(p_flags, 5);

  -- Freshness decay (halves every 12 hours)
  IF p_last_activity IS NOT NULL THEN
    hours_since_activity := EXTRACT(EPOCH FROM (NOW() - p_last_activity)) / 3600;
    decay_factor := POWER(0.5, hours_since_activity / 12.0);
    base_score := base_score * decay_factor;
  END IF;

  RETURN GREATEST(0, ROUND(base_score)::INTEGER);
END;
$$ LANGUAGE plpgsql STABLE;

-- 9. Function to recompute rollups for a location
-- Applies delay (events older than delay_minutes are included)
CREATE OR REPLACE FUNCTION recompute_location_rollup(
  p_location_id UUID,
  p_delay_minutes INTEGER DEFAULT 60,
  p_k_threshold INTEGER DEFAULT 5
) RETURNS VOID AS $$
DECLARE
  v_cutoff TIMESTAMPTZ;
  v_window_start TIMESTAMPTZ;
  v_pins INTEGER;
  v_replies INTEGER;
  v_boosts INTEGER;
  v_flags INTEGER;
  v_total INTEGER;
  v_last_bucket TIMESTAMPTZ;
  v_sponsor_active BOOLEAN;
  v_sponsor_expires TIMESTAMPTZ;
  v_score INTEGER;
  v_k_met BOOLEAN;
BEGIN
  -- Apply delay: only count events older than delay_minutes
  v_cutoff := NOW() - (p_delay_minutes || ' minutes')::INTERVAL;
  v_window_start := v_cutoff - INTERVAL '24 hours';

  -- Count events by type in the 24h window (with delay applied)
  SELECT
    COALESCE(SUM(CASE WHEN event_type = 'pin_created' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN event_type = 'reply_created' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN event_type = 'pin_boosted' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN event_type = 'pin_flagged' THEN 1 ELSE 0 END), 0),
    COUNT(*),
    MAX(coarse_bucket)
  INTO v_pins, v_replies, v_boosts, v_flags, v_total, v_last_bucket
  FROM location_activity_events
  WHERE location_id = p_location_id
    AND occurred_at >= v_window_start
    AND occurred_at <= v_cutoff;

  -- Check for active sponsorship
  SELECT
    EXISTS(
      SELECT 1 FROM location_sponsorships
      WHERE location_id = p_location_id
        AND status IN ('paid', 'active')
        AND active_at <= NOW()
    ),
    (
      SELECT active_at + INTERVAL '24 hours'
      FROM location_sponsorships
      WHERE location_id = p_location_id
        AND status IN ('paid', 'active')
        AND active_at <= NOW()
      ORDER BY active_at DESC
      LIMIT 1
    )
  INTO v_sponsor_active, v_sponsor_expires;

  -- K-anonymity check
  v_k_met := v_total >= p_k_threshold;

  -- Compute activity score
  v_score := compute_activity_score(v_pins, v_replies, v_boosts, v_sponsor_active, v_flags, v_last_bucket);

  -- Upsert rollup
  INSERT INTO location_activity_rollups (
    location_id, updated_at, pins_last_24h, replies_last_24h, boosts_last_24h,
    flags_last_24h, sponsorship_active, sponsor_expires_at, activity_score,
    last_activity_bucket, min_k_threshold_met, total_events_last_24h
  ) VALUES (
    p_location_id, NOW(), v_pins, v_replies, v_boosts,
    v_flags, v_sponsor_active, v_sponsor_expires, v_score,
    v_last_bucket, v_k_met, v_total
  )
  ON CONFLICT (location_id) DO UPDATE SET
    updated_at = NOW(),
    pins_last_24h = EXCLUDED.pins_last_24h,
    replies_last_24h = EXCLUDED.replies_last_24h,
    boosts_last_24h = EXCLUDED.boosts_last_24h,
    flags_last_24h = EXCLUDED.flags_last_24h,
    sponsorship_active = EXCLUDED.sponsorship_active,
    sponsor_expires_at = EXCLUDED.sponsor_expires_at,
    activity_score = EXCLUDED.activity_score,
    last_activity_bucket = EXCLUDED.last_activity_bucket,
    min_k_threshold_met = EXCLUDED.min_k_threshold_met,
    total_events_last_24h = EXCLUDED.total_events_last_24h;
END;
$$ LANGUAGE plpgsql;

-- 10. Function to recompute all active location rollups
CREATE OR REPLACE FUNCTION recompute_all_rollups(
  p_delay_minutes INTEGER DEFAULT 60,
  p_k_threshold INTEGER DEFAULT 5
) RETURNS INTEGER AS $$
DECLARE
  v_count INTEGER := 0;
  v_location_id UUID;
BEGIN
  -- Get locations with recent activity or existing rollups
  FOR v_location_id IN
    SELECT DISTINCT l.id
    FROM locations l
    WHERE l.is_active = true
      AND l.ghosts_enabled = true
      AND (
        EXISTS (
          SELECT 1 FROM location_activity_events e
          WHERE e.location_id = l.id
            AND e.occurred_at >= NOW() - INTERVAL '48 hours'
        )
        OR EXISTS (
          SELECT 1 FROM location_activity_rollups r
          WHERE r.location_id = l.id
        )
      )
  LOOP
    PERFORM recompute_location_rollup(v_location_id, p_delay_minutes, p_k_threshold);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- 11. Function to update daily stats
CREATE OR REPLACE FUNCTION update_daily_activity(p_location_id UUID, p_date DATE)
RETURNS VOID AS $$
BEGIN
  INSERT INTO location_activity_daily (location_id, date, pins, replies, boosts, flags, activity_score)
  SELECT
    p_location_id,
    p_date,
    COALESCE(SUM(CASE WHEN event_type = 'pin_created' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN event_type = 'reply_created' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN event_type = 'pin_boosted' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN event_type = 'pin_flagged' THEN 1 ELSE 0 END), 0),
    0 -- Score computed separately
  FROM location_activity_events
  WHERE location_id = p_location_id
    AND DATE(occurred_at) = p_date
  ON CONFLICT (location_id, date) DO UPDATE SET
    pins = EXCLUDED.pins,
    replies = EXCLUDED.replies,
    boosts = EXCLUDED.boosts,
    flags = EXCLUDED.flags,
    activity_score = EXCLUDED.activity_score;
END;
$$ LANGUAGE plpgsql;
