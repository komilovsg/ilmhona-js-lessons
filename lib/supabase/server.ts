import 'server-only';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { SUPABASE_KEY, SUPABASE_URL } from './config';

/**
 * Per-request server client (route handlers / server actions). Never share it across requests.
 * There is no proxy refreshing sessions: the browser client refreshes tokens itself, and the
 * server only needs a session in /auth/callback, where cookies are writable.
 */
export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Called from a Server Component (read-only cookies): safe to ignore, nothing here relies on it.
        }
      },
    },
  });
}
