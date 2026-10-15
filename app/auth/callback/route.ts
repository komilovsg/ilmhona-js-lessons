import { NextResponse, type NextRequest } from 'next/server';
import { safeNext } from '@/lib/safe-next';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * OAuth (Google) and magic-link landing. PKCE `code` flow only: the code verifier lives in a
 * cookie of the browser that started sign-in, so a link forwarded by someone else can't log the
 * victim into the sender's account (login CSRF). That is also why a magic link must be opened in
 * the same browser. Do not add a `token_hash` / verifyOtp branch here.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  // A validated URL object; redirect to it (or a clone), never re-resolve it as a string.
  const next = safeNext(searchParams.get('next'), origin);
  const fail = () => {
    const url = new URL(next);
    url.searchParams.set('auth_error', '1');
    return NextResponse.redirect(url);
  };
  if (!isSupabaseConfigured) return NextResponse.redirect(next);

  const code = searchParams.get('code');
  if (code) {
    const supabase = await createServerSupabase();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(next);
  }
  return fail();
}
