import type { EmailOtpType } from '@supabase/supabase-js';
import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { createServerSupabase } from '@/lib/supabase/server';

const OTP_TYPES: EmailOtpType[] = ['magiclink', 'email', 'signup', 'invite', 'recovery', 'email_change'];

/** Only same-origin relative paths: "/x?y#z". Rejects "//host", "/\host", absolute URLs, control chars. */
function safeNext(raw: string | null, origin: string): string {
  if (!raw || !raw.startsWith('/') || raw.startsWith('//') || /[\\\u0000-\u001f\u007f]/.test(raw)) return '/';
  try {
    const url = new URL(raw, origin);
    if (url.origin !== origin) return '/';
    url.searchParams.delete('auth_error');
    return url.pathname + url.search + url.hash;
  } catch {
    return '/';
  }
}

/**
 * OAuth (Google) and magic-link landing. Supports both the PKCE `code` flow (default email
 * template; must be opened in the same browser) and the `token_hash` flow (custom template,
 * works on any device — see supabase/README.md).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get('next'), origin);
  const fail = () => {
    const url = new URL(next, origin);
    url.searchParams.set('auth_error', '1');
    return NextResponse.redirect(url);
  };
  if (!isSupabaseConfigured) return NextResponse.redirect(new URL(next, origin));

  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const supabase = await createServerSupabase();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (tokenHash && type && OTP_TYPES.includes(type)) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }
  return fail();
}
