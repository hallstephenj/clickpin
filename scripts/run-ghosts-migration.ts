import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function run() {
  console.log('Running Ghosts feature migration...\n');

  // Check if GHOSTS flag exists
  const { data: existingFlag } = await supabase
    .from('feature_flags')
    .select('id')
    .eq('key', 'GHOSTS')
    .single();

  if (!existingFlag) {
    const { error } = await supabase
      .from('feature_flags')
      .insert({
        key: 'GHOSTS',
        enabled: false,
        description: 'Master toggle for Ghosts homepage - shows activity signals for locations'
      });
    if (error) {
      console.log('GHOSTS flag insert error:', error.message);
    } else {
      console.log('✓ Added GHOSTS feature flag');
    }
  } else {
    console.log('- GHOSTS flag already exists');
  }

  console.log('\nNote: Run the following SQL in Supabase SQL Editor to complete migration:\n');
  console.log(`
-- 1. Add ghosts_enabled column
ALTER TABLE locations ADD COLUMN IF NOT EXISTS ghosts_enabled BOOLEAN NOT NULL DEFAULT false;

-- 2. Create location_activity_events table
CREATE TABLE IF NOT EXISTS location_activity_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_id UUID NOT NULL REFERENCES locations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'pin_created', 'reply_created', 'pin_boosted', 'pin_deleted_paid',
    'sponsor_bid_paid', 'sponsor_activated', 'pin_flagged'
  )),
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  coarse_bucket TIMESTAMPTZ NOT NULL,
  metadata JSONB DEFAULT '{}',
  privacy_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_activity_events_location_bucket ON location_activity_events(location_id, coarse_bucket DESC);
CREATE INDEX IF NOT EXISTS idx_activity_events_occurred ON location_activity_events(occurred_at DESC);

-- 3. Create location_activity_rollups table
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
  last_activity_bucket TIMESTAMPTZ,
  min_k_threshold_met BOOLEAN NOT NULL DEFAULT false,
  total_events_last_24h INTEGER NOT NULL DEFAULT 0
);

-- 4. Create location_activity_daily table
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

CREATE INDEX IF NOT EXISTS idx_activity_daily_location_date ON location_activity_daily(location_id, date DESC);

-- 5. Enable RLS
ALTER TABLE location_activity_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_activity_rollups ENABLE ROW LEVEL SECURITY;
ALTER TABLE location_activity_daily ENABLE ROW LEVEL SECURITY;
  `);
}

run().catch(console.error);
