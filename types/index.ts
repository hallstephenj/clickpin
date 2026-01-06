// Core database types

export interface Location {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
  created_at: string;
  sponsor_label?: string | null;
}

export interface DeviceSession {
  id: string;
  created_at: string;
  last_seen_at: string;
  user_agent: string | null;
}

export interface Pin {
  id: string;
  location_id: string;
  parent_pin_id: string | null;
  device_session_id: string;
  body: string;
  doodle_data: string | null;
  created_at: string;
  deleted_at: string | null;
  is_hidden: boolean;
  boost_score: number;
  boost_expires_at: string | null;
  replies?: Pin[];
  flag_count?: number;
  is_mine?: boolean;
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
  amount_sats: number;
  provider: string;
  invoice_id: string;
  status: 'pending' | 'paid' | 'expired';
  created_at: string;
  paid_until: string | null;
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
