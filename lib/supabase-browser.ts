import { createBrowserClient, type SupabaseClient } from '@supabase/ssr';

let browserClient: SupabaseClient | null = null;

/**
 * Gets the singleton Supabase client for browser-side operations.
 * Reuses the same instance to avoid "Multiple GoTrueClient instances" warning.
 */
export function createSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }
  return browserClient;
}
