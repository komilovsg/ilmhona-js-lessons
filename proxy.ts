import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, isLocale, LOCALE_COOKIE, type Locale } from '@/lib/i18n';

function pickLocale(req: NextRequest): Locale {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  if (isLocale(cookie)) return cookie;
  const accept = req.headers.get('accept-language') ?? '';
  const tags = accept
    .split(',')
    .map((p) => {
      const [tag, q] = p.trim().split(';q=');
      return { lang: tag.toLowerCase().split('-')[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { lang } of tags) if (isLocale(lang)) return lang;
  return defaultLocale;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split('/')[1] ?? '';
  // Already prefixed (valid locale), or a two-letter unknown prefix: let the router serve it / 404.
  if (isLocale(first) || /^[a-z]{2}$/.test(first)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/${pickLocale(req)}${pathname === '/' ? '' : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip /_next, /api, /auth, /dev and anything with a file extension (favicon.ico, images, ...).
  matcher: ['/((?!_next|api|auth|dev|.*\\..*).*)'],
};
