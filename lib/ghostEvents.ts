import { supabaseAdmin } from './supabase';
import { GhostEventType } from '@/types';

// Ghost configuration constants
export const GHOST_CONFIG = {
  DELAY_MINUTES: 60, // Events are delayed before affecting public rollups
  TIME_BUCKET_MINUTES: 60, // Round timestamps to this granularity
  K_THRESHOLD: 5, // Minimum events for k-anonymity
  SCORE_WEIGHTS: {
    pin: 1,
    reply: 0.5,
    boost: 5,
    sponsor: 10,
    flag: -1,
  },
  FRESHNESS_DECAY_HOURS: 12, // Score halves every N hours
};

/**
 * Compute coarse time bucket (rounded to nearest hour)
 */
function computeCoarseBucket(date: Date = new Date()): string {
  const bucket = new Date(date);
  bucket.setMinutes(0, 0, 0);
  return bucket.toISOString();
}

/**
 * Log a ghost event for activity tracking
 * This is fire-and-forget - errors are logged but don't block the main operation
 */
export async function logGhostEvent(
  locationId: string,
  eventType: GhostEventType,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const now = new Date();
    const coarseBucket = computeCoarseBucket(now);

    const { error } = await supabaseAdmin
      .from('location_activity_events')
      .insert({
        location_id: locationId,
        event_type: eventType,
        occurred_at: now.toISOString(),
        coarse_bucket: coarseBucket,
        metadata,
        privacy_version: 1,
      });

    if (error) {
      // Log but don't throw - ghost events are non-critical
      console.error('Ghost event logging failed:', error.message);
    }
  } catch (err) {
    console.error('Ghost event logging error:', err);
  }
}

/**
 * Compute activity score from rollup data
 */
export function computeActivityScore(
  pins: number,
  replies: number,
  boosts: number,
  sponsorshipActive: boolean,
  flags: number,
  lastActivityBucket: string | null
): number {
  const { SCORE_WEIGHTS, FRESHNESS_DECAY_HOURS } = GHOST_CONFIG;

  // Base score calculation
  let baseScore =
    pins * SCORE_WEIGHTS.pin +
    replies * SCORE_WEIGHTS.reply +
    Math.min(boosts, 10) * SCORE_WEIGHTS.boost; // Cap boost contribution

  // Sponsor bonus
  if (sponsorshipActive) {
    baseScore += SCORE_WEIGHTS.sponsor;
  }

  // Flag penalty (capped)
  baseScore += Math.min(flags, 5) * SCORE_WEIGHTS.flag;

  // Freshness decay (halves every N hours)
  if (lastActivityBucket) {
    const hoursSinceActivity =
      (Date.now() - new Date(lastActivityBucket).getTime()) / (1000 * 60 * 60);
    const decayFactor = Math.pow(0.5, hoursSinceActivity / FRESHNESS_DECAY_HOURS);
    baseScore *= decayFactor;
  }

  return Math.max(0, Math.round(baseScore));
}

/**
 * Determine activity level from score
 */
export function getActivityLevel(score: number): 'quiet' | 'warm' | 'busy' {
  if (score >= 15) return 'busy';
  if (score >= 5) return 'warm';
  return 'quiet';
}

/**
 * Format coarse time bucket to human-readable "last active" text
 * Uses vague time buckets to prevent stalking
 */
export function formatLastActive(lastActivityBucket: string | null): string {
  if (!lastActivityBucket) {
    return 'no recent activity';
  }

  const now = Date.now();
  const lastActivity = new Date(lastActivityBucket).getTime();
  const hoursSince = (now - lastActivity) / (1000 * 60 * 60);

  // Use vague buckets, never exact times
  if (hoursSince < 3) {
    return 'within the last 3 hours';
  } else if (hoursSince < 6) {
    return 'within the last 6 hours';
  } else if (hoursSince < 12) {
    return 'within the last 12 hours';
  } else if (hoursSince < 24) {
    return 'today';
  } else if (hoursSince < 48) {
    return 'yesterday';
  } else if (hoursSince < 168) {
    return 'this week';
  } else {
    return 'over a week ago';
  }
}

/**
 * Generate a signal text line from rollup data
 * Rotates through different signals to provide variety
 */
export function generateSignalText(
  pinsToday: number,
  repliesToday: number,
  boostsToday: number,
  sponsorshipActive: boolean,
  sponsorLabel: string | null,
  locationSlug: string
): string {
  const signals: string[] = [];

  // Content signals
  if (pinsToday > 0) {
    signals.push(`${pinsToday} new pin${pinsToday !== 1 ? 's' : ''} today`);
  }

  if (repliesToday > 0) {
    signals.push(`${repliesToday} repl${repliesToday !== 1 ? 'ies' : 'y'} today`);
  }

  if (boostsToday > 0) {
    signals.push(`${boostsToday} boost${boostsToday !== 1 ? 's' : ''} today`);
  }

  // Sponsor signals
  if (sponsorshipActive && sponsorLabel) {
    signals.push(`sponsored by ${sponsorLabel}`);
  }

  // If no signals, return default
  if (signals.length === 0) {
    return 'waiting for signals...';
  }

  // Deterministic rotation based on location slug and hour
  // This ensures the same location shows the same signal at the same time
  const hour = new Date().getHours();
  const index = (locationSlug.charCodeAt(0) + hour) % signals.length;
  return signals[index];
}

/**
 * Recompute rollup for a single location
 * Called by admin trigger or cron job
 */
export async function recomputeLocationRollup(locationId: string): Promise<void> {
  const { DELAY_MINUTES, K_THRESHOLD } = GHOST_CONFIG;

  // Events older than delay_minutes are included
  const cutoff = new Date(Date.now() - DELAY_MINUTES * 60 * 1000);
  const windowStart = new Date(cutoff.getTime() - 24 * 60 * 60 * 1000);

  // Count events by type
  const { data: events, error: eventsError } = await supabaseAdmin
    .from('location_activity_events')
    .select('event_type, coarse_bucket')
    .eq('location_id', locationId)
    .gte('occurred_at', windowStart.toISOString())
    .lte('occurred_at', cutoff.toISOString());

  if (eventsError) {
    console.error('Error fetching events for rollup:', eventsError);
    return;
  }

  const pins = events?.filter((e) => e.event_type === 'pin_created').length || 0;
  const replies = events?.filter((e) => e.event_type === 'reply_created').length || 0;
  const boosts = events?.filter((e) => e.event_type === 'pin_boosted').length || 0;
  const flags = events?.filter((e) => e.event_type === 'pin_flagged').length || 0;
  const total = events?.length || 0;

  // Get last activity bucket
  const lastBucket = events?.length
    ? events.reduce((latest, e) =>
        e.coarse_bucket > latest ? e.coarse_bucket : latest, events[0].coarse_bucket)
    : null;

  // Check for active sponsorship
  const { data: sponsor } = await supabaseAdmin
    .from('location_sponsorships')
    .select('sponsor_label, active_at')
    .eq('location_id', locationId)
    .in('status', ['paid', 'active'])
    .lte('active_at', new Date().toISOString())
    .order('active_at', { ascending: false })
    .limit(1)
    .single();

  const sponsorshipActive = !!sponsor;
  const sponsorExpiresAt = sponsor?.active_at
    ? new Date(new Date(sponsor.active_at).getTime() + 24 * 60 * 60 * 1000).toISOString()
    : null;

  // K-anonymity check
  const kMet = total >= K_THRESHOLD;

  // Compute score
  const score = computeActivityScore(
    pins,
    replies,
    boosts,
    sponsorshipActive,
    flags,
    lastBucket
  );

  // Upsert rollup
  const { error: upsertError } = await supabaseAdmin
    .from('location_activity_rollups')
    .upsert({
      location_id: locationId,
      updated_at: new Date().toISOString(),
      pins_last_24h: pins,
      replies_last_24h: replies,
      boosts_last_24h: boosts,
      flags_last_24h: flags,
      sponsorship_active: sponsorshipActive,
      sponsor_expires_at: sponsorExpiresAt,
      activity_score: score,
      last_activity_bucket: lastBucket,
      min_k_threshold_met: kMet,
      total_events_last_24h: total,
    });

  if (upsertError) {
    console.error('Error upserting rollup:', upsertError);
  }
}

/**
 * Recompute all active location rollups
 * Returns count of locations updated
 */
export async function recomputeAllRollups(): Promise<number> {
  // Get locations with ghosts enabled and recent activity
  const { data: locations, error } = await supabaseAdmin
    .from('locations')
    .select('id')
    .eq('is_active', true)
    .eq('ghosts_enabled', true);

  if (error || !locations) {
    console.error('Error fetching locations for rollup:', error);
    return 0;
  }

  let count = 0;
  for (const loc of locations) {
    await recomputeLocationRollup(loc.id);
    count++;
  }

  return count;
}
