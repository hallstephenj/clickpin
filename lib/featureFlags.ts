import { supabaseAdmin } from '@/lib/supabase';
import { FeatureFlags } from '@/types';

// Default flags (all disabled)
export const DEFAULT_FLAGS: FeatureFlags = {
  fancy_board_enabled: false,
  fancy_tap_to_place: false,
  fancy_templates: false,
  fancy_sizes: false,
  fancy_rotation: false,
  fancy_stacking: false,
  fancy_aging: false,
  fancy_dig_mode: false,
  GHOSTS: false,
};

// All feature flag keys
export const FEATURE_FLAG_KEYS = [
  'fancy_board_enabled',
  'fancy_tap_to_place',
  'fancy_templates',
  'fancy_sizes',
  'fancy_rotation',
  'fancy_stacking',
  'fancy_aging',
  'fancy_dig_mode',
  'GHOSTS',
] as const;

// Server-side: Fetch all flags from database
export async function getFeatureFlags(): Promise<FeatureFlags> {
  try {
    const { data: flags, error } = await supabaseAdmin
      .from('feature_flags')
      .select('key, enabled');

    if (error || !flags) {
      console.error('Error fetching feature flags:', error);
      return DEFAULT_FLAGS;
    }

    const flagMap = flags.reduce((acc, flag) => {
      if (flag.key in DEFAULT_FLAGS) {
        acc[flag.key as keyof FeatureFlags] = flag.enabled;
      }
      return acc;
    }, { ...DEFAULT_FLAGS } as FeatureFlags);

    return flagMap;
  } catch (error) {
    console.error('Failed to fetch feature flags:', error);
    return DEFAULT_FLAGS;
  }
}

// Check if fancy board is active (master toggle enabled)
export function isFancyBoardActive(flags: FeatureFlags): boolean {
  return flags.fancy_board_enabled;
}

// Check if any fancy sub-feature is enabled
export function hasAnyFancyFeature(flags: FeatureFlags): boolean {
  return (
    flags.fancy_tap_to_place ||
    flags.fancy_templates ||
    flags.fancy_sizes ||
    flags.fancy_rotation ||
    flags.fancy_stacking ||
    flags.fancy_aging ||
    flags.fancy_dig_mode
  );
}
