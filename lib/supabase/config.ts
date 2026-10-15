// Public Supabase settings. NEXT_PUBLIC_* values are inlined at build time, so they must be
// referenced literally. When either is missing the app runs fully local (no auth, no network).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
// New projects get a "publishable" key (sb_publishable_...); older ones have the legacy anon JWT.
export const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_KEY);
