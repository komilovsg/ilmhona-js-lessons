import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_KEY, SUPABASE_URL, isSupabaseConfigured } from './config';

let client: SupabaseClient | null = null;

/**
 * Browser client (session + PKCE verifier live in cookies, so /auth/callback can read them).
 * Returns null when Supabase is not configured. Only import this module dynamically from
 * client code so the SDK is never downloaded in local-only mode.
 */
export function getBrowserSupabase(): SupabaseClient | null {
  if (!isSupabaseConfigured || typeof window === 'undefined') return null;
  if (!client) {
    client = createBrowserClient(SUPABASE_URL, SUPABASE_KEY, {
      global: {
        // Requests started while the page is hidden (visibilitychange/pagehide flush) must
        // survive the page being closed.
        fetch: (input, init) =>
          fetch(input, document.visibilityState === 'hidden' ? { ...init, keepalive: true } : init),
      },
    });
  }
  return client;
}
