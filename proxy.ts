import { NextResponse, type NextRequest } from 'next/server';
import { defaultLocale, fromUrlLocale, LOCALE_COOKIE, toUrlLocale } from '@/lib/i18n';

/** Returns the URL segment ('ru' | 'tj'). The cookie stores the segment; a legacy 'tg' value counts as 'tj'. */
function pickSegment(req: NextRequest): string {
  const cookie = req.cookies.get(LOCALE_COOKIE)?.value;
  const fromCookie = fromUrlLocale(cookie === 'tg' ? 'tj' : cookie);
  if (fromCookie) return toUrlLocale(fromCookie);
  const accept = req.headers.get('accept-language') ?? '';
  const tags = accept
    .split(',')
    .map((p) => {
      const [tag, q] = p.trim().split(';q=');
      return { lang: tag.toLowerCase().split('-')[0], q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { lang } of tags) {
    if (lang === 'ru') return 'ru';
    if (lang === 'tg' || lang === 'tj') return 'tj';
  }
  return toUrlLocale(defaultLocale);
}

function noStore(res: NextResponse) {
  res.headers.set('Cache-Control', 'private, no-store');
  res.headers.set('Vary', 'Cookie, Accept-Language');
  return res;
}

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const first = pathname.split('/')[1] ?? '';
  // Old Tajik URLs: /tg and /tg/... -> /tj/... (path + query kept).
  if (first === 'tg') {
    const url = req.nextUrl.clone();
    url.pathname = `/tj${pathname.slice(3)}`;
    return NextResponse.redirect(url, 308);
  }
  // Already prefixed (valid locale), or a two-letter unknown prefix: let the router serve it / 404.
  if (fromUrlLocale(first) || /^[a-z]{2}$/.test(first)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `/${pickSegment(req)}${pathname === '/' ? '' : pathname}`;
  return noStore(NextResponse.redirect(url));
}

export const config = {
  // Skip /_next, /api, /auth, /dev, /apple-icon and anything with a file extension (favicon.ico, images, ...).
  matcher: ['/((?!_next|api|auth|dev|apple-icon|.*\\..*).*)'],
};
