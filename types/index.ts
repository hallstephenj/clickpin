// Core database types

// Location type categories
export type LocationType = 'bitcoin_merchant' | 'merchant' | 'community_space';

export interface Location {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  city?: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
  is_bitcoin_merchant?: boolean;
  is_claimed?: boolean;
  location_type?: LocationType;
  merchant_settings?: MerchantSettings;
  created_at: string;
  sponsor_label?: string | null;
  sponsor_url?: string | null;
  sponsor_amount_sats?: number | null;
  // BTCMap integration fields
  btcmap_id?: number | null;
  osm_id?: string | null;
  address?: string | null;
  phone?: string | null;
  website?: string | null;
  opening_hours?: string | null;
  btcmap_icon?: string | null;
  btcmap_verified_at?: string | null;
  btcmap_updated_at?: string | null;
  // Sprout tracking (merchant conversion)
  sprouted_at?: string | null;
  sprouted_by_identity_id?: string | null;
  sprout_photo_url?: string | null;
  sprout_report_id?: string | null;
}

export interface DeviceSession {
  id: string;
  created_at: string;
  last_seen_at: string;
  user_agent: string | null;
  lnurl_identity_id?: string | null;
}

export interface Pin {
  id: string;
  location_id: string;
  parent_pin_id: string | null;
  device_session_id: string;
  body: string;
  doodle_data: string | null;
  badge: string | null;
  created_at: string;
  deleted_at: string | null;
  is_hidden: boolean;
  boost_score: number;
  boost_expires_at: string | null;
  replies?: Pin[];
  flag_count?: number;
  is_mine?: boolean;
  // Merchant features
  is_merchant_pinned?: boolean;
  is_merchant_hidden?: boolean;
  is_merchant_post?: boolean;
  is_daily_special?: boolean;
  special_expires_at?: string | null;
  // LNURL identity attribution
  lnurl_identity_id?: string | null;
  author_nym?: string | null;
  // Sprouted pin (celebratory post)
  is_sprouted_pin?: boolean;
}

export interface PinFlag {
  id: string;
  pin_id: string;
  location_id: string;
  device_session_id: string;
  created_at: string;
}

export interface PinBoost {
  id: string;
  pin_id: string;
  device_session_id: string;
  amount_sats: number;
  provider: string;
  invoice_id: string;
  status: 'pending' | 'paid' | 'expired';
  created_at: string;
  paid_at: string | null;
}

export interface LocationSponsorship {
  id: string;
  location_id: string;
  sponsor_label: string;
  sponsor_url: string | null;
  amount_sats: number;
  provider: string;
  invoice_id: string;
  status: 'pending' | 'paid' | 'active' | 'superseded' | 'expired';
  created_at: string;
  paid_at: string | null;
  active_at: string | null;
}

export interface PinDeletionPayment {
  id: string;
  pin_id: string;
  device_session_id: string;
  amount_sats: number;
  provider: string;
  invoice_id: string;
  status: 'pending' | 'paid' | 'expired';
  created_at: string;
  paid_at: string | null;
}

export interface PostQuotaLedger {
  id: string;
  device_session_id: string;
  location_id: string;
  date: string;
  free_posts_used: number;
  paid_posts_used: number;
}

// API types
export interface PresenceToken {
  device_session_id: string;
  location_id: string;
  location_slug: string;
  timestamp: number;
  accuracy: number;
  signature: string;
}

export interface ResolveLocationRequest {
  lat: number;
  lng: number;
  accuracy: number;
}

export interface ResolveLocationResponse {
  location: Location | null;
  presence_token: string | null;
  error?: string;
}

export interface CreatePinRequest {
  body: string;
  doodle_data?: string | null;
  presence_token: string;
  parent_pin_id?: string | null;
  payment_invoice_id?: string | null;
}

export interface FlagPinRequest {
  pin_id: string;
  presence_token: string;
}

export interface CreateInvoiceRequest {
  presence_token: string;
  pin_id?: string;
  type: 'boost' | 'delete' | 'sponsor' | 'post';
  sponsor_label?: string;
}

export interface InvoiceResponse {
  invoice_id: string;
  payment_request: string;
  amount_sats: number;
  expires_at: string;
}

export interface GeolocationState {
  status: 'idle' | 'requesting' | 'success' | 'error' | 'denied';
  position: GeolocationPosition | null;
  error: string | null;
}

export interface BoardState {
  location: Location | null;
  pins: Pin[];
  loading: boolean;
  error: string | null;
}

// Feature Flags
export interface FeatureFlag {
  id: string;
  key: string;
  enabled: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface FeatureFlags {
  fancy_board_enabled: boolean;
  fancy_tap_to_place: boolean;
  fancy_templates: boolean;
  fancy_sizes: boolean;
  fancy_rotation: boolean;
  fancy_stacking: boolean;
  fancy_aging: boolean;
  fancy_dig_mode: boolean;
  BADGES: boolean;
  SHARENOTES: boolean;
  ROTATONATOR: boolean;
  PROXHOME: boolean;
  PROXHOME_ADVANCED: boolean;
  MERCHANTS: boolean;
  SEED_PLANTED: boolean;
  LNURL_AUTH: boolean;
  SEED_SPROUTED: boolean;
}

// App Settings
export type DesignTheme = 'mono' | 'forstall' | 'neo2026';

export interface AppSettings {
  design_theme: DesignTheme;
}

// Badge types
export const BADGE_OPTIONS = [
  'Question',
  'Announcement',
  'Offer',
  'Request',
  'Lost',
  'Found',
  'Event',
] as const;

export type BadgeType = typeof BADGE_OPTIONS[number];

// Fancy Board Types
export type PinTemplate = 'index' | 'sticky' | 'torn' | 'receipt';
export type PinSize = 'S' | 'M' | 'L';

export interface FancyPin extends Pin {
  x?: number | null;
  y?: number | null;
  rotation?: number | null;
  template?: PinTemplate | null;
  size?: PinSize | null;
  z_seed?: number | null;
}

// Merchant Types
export type MerchantVerificationMethod = 'lightning' | 'domain' | 'manual';
export type MerchantClaimStatus = 'pending' | 'verified' | 'revoked';

export interface MerchantClaim {
  id: string;
  location_id: string;
  device_session_id: string;
  verification_method: MerchantVerificationMethod;
  verification_proof: Record<string, unknown>;
  claim_code: string;
  status: MerchantClaimStatus;
  claimed_at: string | null;
  created_at: string;
  // Supabase Auth integration for multi-device access
  user_id?: string | null;
  linked_at?: string | null;
}

export interface MerchantSettings {
  welcome_message?: string;
  logo_url?: string;
  custom_name?: string;
  tip_jar_address?: string;
  tip_jar_enabled?: boolean;
  hours_override?: string;
}

export interface MerchantDashboardData {
  claim: MerchantClaim;
  location: Location;
  settings: MerchantSettings;
  stats: {
    pins_7d: number;
    replies_7d: number;
    views_7d: number;
  };
}

// Seed Planted Types (Bitcoin Advocacy)
export type SeedOutcome = 'positive' | 'neutral' | 'negative';

export interface SeedPlanting {
  id: string;
  location_id: string;
  device_session_id: string;
  outcome: SeedOutcome;
  commentary?: string;
  pin_id?: string;
  created_at: string;
  lnurl_identity_id?: string | null;
}

export interface SeedCount {
  total: number;
  outcomes: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export interface PlantSeedRequest {
  presence_token: string;
  outcome: SeedOutcome;
  commentary?: string;
}

export interface PlantSeedResponse {
  success: boolean;
  seed_id: string;
  pin_id?: string;
  total_seeds: number;
}

// =============================================================================
// LNURL-auth Identity Types
// =============================================================================

export interface LnurlIdentity {
  id: string;
  linking_key: string;
  display_name: string | null;
  anon_nym: string;
  created_at: string;
  last_auth_at: string;
}

export interface LnurlDeviceLink {
  id: string;
  identity_id: string;
  device_session_id: string;
  device_name: string | null;
  linked_at: string;
  last_used_at: string;
}

export type LnurlChallengeAction = 'login' | 'link' | 'auth';
export type LnurlChallengeStatus = 'pending' | 'verified' | 'expired';

export interface LnurlChallenge {
  id: string;
  k1: string;
  device_session_id: string;
  action: LnurlChallengeAction;
  status: LnurlChallengeStatus;
  linking_key: string | null;
  created_at: string;
  expires_at: string;
  verified_at: string | null;
}

// API Request/Response types for LNURL-auth
export interface LnurlAuthChallengeRequest {
  device_session_id: string;
  action?: LnurlChallengeAction;
}

export interface LnurlAuthChallengeResponse {
  lnurl: string;           // Bech32-encoded LNURL for QR code
  k1: string;              // Challenge ID for polling
  expires_at: string;
}

export interface LnurlAuthStatusResponse {
  status: LnurlChallengeStatus;
  identity?: LnurlIdentity;
}

export interface LnurlProfileUpdateRequest {
  display_name: string | null;
}

// Leaderboard types
export type LeaderboardType = 'seeds' | 'sprouts' | 'locations';
export type LeaderboardPeriod = 'all_time' | 'month' | 'week';

export interface LeaderboardEntry {
  rank: number;
  identity_id: string;
  display_name: string | null;
  anon_nym: string;
  count: number;
  is_current_user?: boolean;
}

export interface LeaderboardResponse {
  type: LeaderboardType;
  period: LeaderboardPeriod;
  entries: LeaderboardEntry[];
  current_user_rank?: number;
  current_user_count?: number;
}

// =============================================================================
// SEED_SPROUTED Types (Merchant Conversion Reporting)
// =============================================================================

export type BitcoinPaymentType = 'lightning' | 'onchain' | 'both' | 'unknown';
export type SproutReportStatus = 'pending' | 'approved' | 'rejected' | 'needs_info';

export interface SproutReport {
  id: string;
  location_id: string;
  device_session_id: string;
  lnurl_identity_id: string | null;
  photo_url: string;
  payment_type: BitcoinPaymentType;
  context: string | null;
  status: SproutReportStatus;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  celebratory_pin_id: string | null;
  created_at: string;
  // Joined data for display
  location?: Location;
  reporter_nym?: string;
}

export interface SubmitSproutRequest {
  presence_token: string;
  photo_data: string;      // Base64-encoded image
  payment_type: BitcoinPaymentType;
  context?: string;
}

export interface SubmitSproutResponse {
  success: boolean;
  report_id: string;
  message: string;
}

export interface AdminSproutReportListResponse {
  reports: SproutReport[];
  total: number;
  pending_count: number;
}

export interface AdminSproutReviewRequest {
  action: 'approve' | 'reject' | 'needs_info';
  notes?: string;
}

export interface AdminSproutReviewResponse {
  success: boolean;
  celebratory_pin_id?: string;
  error?: string;
}
