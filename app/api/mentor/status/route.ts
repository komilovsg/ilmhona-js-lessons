import { createHash, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { getMentorStore } from '@/lib/mentor-models';
import { clientKey } from '@/lib/mentor-server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Owner-only status of the mentor: model quota, today's outcomes, last 50 log rows.
// Auth: `Authorization: Bearer <MENTOR_ADMIN_TOKEN>`; without the env var the endpoint is off (404).
const MIN_TOKEN = 24;
const FAIL_LIMIT = 5; // failed attempts per client per window, then 429 until the window passes
const FAIL_WINDOW_MS = 15 * 60_000;
const fails = new Map<string, { n: number; at: number }>();

const headers = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' };
const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
  NextResponse.json(body, { status, headers: { ...headers, ...extra } });

const digest = (s: string) => createHash('sha256').update(s).digest();

/** Constant-time compare on SHA-256 digests (equal length whatever the input). */
function tokenOk(header: string | null, token: string): boolean {
  const m = header?.match(/^Bearer\s+(\S{1,512})$/);
  return !!m && timingSafeEqual(digest(m[1]), digest(token));
}

export async function GET(req: Request) {
  const token = process.env.MENTOR_ADMIN_TOKEN ?? '';
  if (token.length < MIN_TOKEN) return json({ error: 'not_found' }, 404);

  const ip = clientKey(req.headers);
  const now = Date.now();
  const f = fails.get(ip);
  if (f && now - f.at > FAIL_WINDOW_MS) fails.delete(ip);
  const cur = fails.get(ip);
  if (cur && cur.n >= FAIL_LIMIT) {
    const wait = Math.ceil((cur.at + FAIL_WINDOW_MS - now) / 1000);
    return json({ error: 'rate_limited' }, 429, { 'Retry-After': String(Math.max(1, wait)) });
  }
  if (!tokenOk(req.headers.get('authorization'), token)) {
    fails.set(ip, { n: (cur?.n ?? 0) + 1, at: cur?.at ?? now });
    if (fails.size > 5000) for (const [k, v] of fails) if (now - v.at > FAIL_WINDOW_MS) fails.delete(k);
    return json({ error: 'unauthorized' }, 401, { 'WWW-Authenticate': 'Bearer' });
  }
  fails.delete(ip);

  const store = getMentorStore();
  const s = await store.status();
  // Owner view: opaque keys are mapped back to the vendor model ids here (never in student-facing responses).
  return json({ ...s, configured: store.configured, logs: s.logs.map((l) => ({ ...l, ip_hash: undefined, model: store.idOf(l.model_key) })) });
}
