import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a Supabase client for browser-side operations.
 * Use this in client components that need auth state.
 */
export function createSupabaseBrowserClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
