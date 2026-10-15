// Import-free on purpose: checked with plain `node lib/safe-next.check.mjs` (Node strips the types).

const FORBIDDEN = /[\\\u0000-\u001f\u007f]/;

/**
 * Validates the `next` param of /auth/callback and returns a same-origin URL object.
 * Callers must redirect to (a clone of) the returned URL and never re-resolve a string:
 * `new URL('/..//evil.com', origin)` normalises to pathname `//evil.com`, and resolving that
 * string again would leave the site. Anything suspicious falls back to "/".
 */
export function safeNext(raw: string | null, origin: string): URL {
  const home = new URL('/', origin);
  if (!raw || raw[0] !== '/' || raw.startsWith('//') || FORBIDDEN.test(raw)) return home;
  let url: URL;
  try {
    url = new URL(raw, origin);
  } catch {
    return home;
  }
  if (url.origin !== home.origin || url.username || url.password) return home;
  if (url.pathname.startsWith('//') || FORBIDDEN.test(url.pathname)) return home;
  url.searchParams.delete('auth_error');
  return url;
}
