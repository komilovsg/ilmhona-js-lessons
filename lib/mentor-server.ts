// Server-only helpers for /api/mentor: client key for rate limiting, reply signatures, request hygiene.
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

/** IPv4 as is; IPv6 grouped by /64 (one subscriber usually owns a whole /64); IPv4-mapped IPv6 unwrapped. */
export function ipGroup(raw: string): string {
  let ip = raw.trim().replace(/^\[|\](?::\d+)?$/g, '');
  const v4port = ip.match(/^(\d+\.\d+\.\d+\.\d+)(?::\d+)?$/);
  if (v4port) return v4port[1];
  ip = ip.split('%')[0].toLowerCase();
  const v4 = ip.match(/^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (v4) return v4[1];
  const [head, tail = ''] = ip.split('::');
  const h = head ? head.split(':') : [];
  const t = ip.includes('::') ? (tail ? tail.split(':') : []) : [];
  const groups = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  if (groups.length !== 8 || groups.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return 'bad-ip';
  return groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':') + '::/64';
}

/** Rate-limit key. On Vercel x-real-ip is set by the edge and cannot be spoofed; elsewhere trust the first X-Forwarded-For hop. */
export function clientKey(headers: Headers, onVercel = !!process.env.VERCEL): string {
  const real = headers.get('x-real-ip');
  const xff = headers.get('x-forwarded-for')?.split(',')[0];
  const raw = onVercel ? real : xff?.trim() || real;
  return raw ? ipGroup(raw) : 'unknown';
}

let cachedSecret: Buffer | null = null;
function secret(): Buffer | null {
  if (cachedSecret) return cachedSecret;
  const own = process.env.MENTOR_SIGNING_SECRET;
  const base = own || process.env.GEMINI_API_KEY;
  if (!base) return (cachedSecret = randomBytes(32)); // fake/dev mode: per-process key, signatures die with the process
  // Derived key, so the API key itself is never the HMAC key (domain-separated, one-way).
  cachedSecret = own ? Buffer.from(own) : createHash('sha256').update('mentor-reply-signing:v1\0').update(base).digest();
  return cachedSecret;
}

/** HMAC-SHA256 over lesson slug + reply text, base64url. Ties a model turn to what this server actually sent. */
export function signReply(slug: string, text: string, key = secret()): string {
  if (!key) return '';
  return createHmac('sha256', key).update(`${slug}\n${text}`).digest('base64url');
}

export function verifyReply(slug: string, text: string, sig: unknown, key = secret()): boolean {
  if (!key || typeof sig !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(sig)) return false;
  const want = Buffer.from(signReply(slug, text, key));
  const got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Sliding one-minute window shared by all clients. Returns 0 when allowed, else seconds until a slot frees up. */
export function minuteGate(limit: number, now = () => Date.now()): () => number {
  const stamps: number[] = [];
  return () => {
    const t = now();
    while (stamps.length && t - stamps[0] >= 60_000) stamps.shift();
    if (stamps.length >= limit) return Math.max(1, Math.ceil((stamps[0] + 60_000 - t) / 1000));
    stamps.push(t);
    return 0;
  };
}

/** Seconds to wait from an upstream 429 / RESOURCE_EXHAUSTED body (google.rpc.RetryInfo.retryDelay "17s"), default 30, clamped to 5..300. */
export function retryDelay(body: string, fallback = 30): number {
  const m = body.match(/"retryDelay"\s*:\s*"(\d+(?:\.\d+)?)s"/);
  const s = m ? Math.ceil(Number(m[1])) : fallback;
  return Math.min(300, Math.max(5, s));
}

export const MAX_BODY = 64 * 1024;

/** Header checks: 415 for non-JSON, 403 for cross-site requests. null = ok. */
export function checkHeaders(req: Request): 403 | 415 | null {
  const ct = req.headers.get('content-type') ?? '';
  if (!/^application\/json\s*(?:;|$)/i.test(ct)) return 415;
  const site = req.headers.get('sec-fetch-site');
  if (site !== null && site !== 'same-origin') return 403;
  const origin = req.headers.get('origin');
  if (origin !== null) {
    const host = req.headers.get('host') ?? new URL(req.url).host;
    let oh = '';
    try {
      oh = new URL(origin).host;
    } catch {}
    if (!oh || oh.toLowerCase() !== host.toLowerCase()) return 403;
  }
  return null;
}

/** Reads the body with a hard byte cap (Content-Length is checked first but never trusted). */
export async function readBody(req: Request, max = MAX_BODY): Promise<string | 413 | 400> {
  const len = Number(req.headers.get('content-length') ?? 0);
  if (len > max) return 413;
  if (!req.body) return 400;
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      void reader.cancel().catch(() => {});
      return 413;
    }
    chunks.push(value);
  }
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
  } catch {
    return 400;
  }
}
