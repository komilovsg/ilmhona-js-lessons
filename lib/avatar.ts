/**
 * Only Google profile photos are rendered (same rule as the profiles.avatar_url CHECK in
 * supabase/migrations/0001_init.sql); anything else falls back to the initial.
 */
export const isSafeAvatar = (u: string | null | undefined): u is string =>
  !!u && u.length <= 500 && /^https:\/\/lh[0-9]+\.googleusercontent\.com\//.test(u);
