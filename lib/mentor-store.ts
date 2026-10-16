// Server-only: shared model quota + 7-day request log for /api/mentor, stored in Supabase (service role).
// Dormant without env: everything falls back to per-instance memory, and the mentor behaves as before.
// No imports from other lib modules so `node lib/mentor.check.mjs` can load it; helpers come in via `deps`.
import { createHmac, randomBytes } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

export type Quota = 'minute' | 'day';
/** Own throttle result: 0 = free, seconds to wait (per-minute), 'day' = daily quota spent. */
export type Slot = number | 'day';
export type Outcome = 'ok' | 'off_topic' | 'identity' | 'busy' | 'daily_limit' | 'error' | 'rejected';
/** model_key is opaque ('m1'..); the vendor id lives only in server code (CHAIN in the route). */
export type ModelSpec = { key: string; id: string; rpm: number; rpd: number };
export type LogRow = {
  lesson_slug: string | null;
  task_id: string | null;
  locale: string | null;
  model_key: string | null;
  outcome: Outcome;
  latency_ms: number;
  ip_hash: string | null;
  redacted_question: string | null;
  pii_redacted: boolean;
};
export type ModelStatus = {
  key: string;
  id: string;
  rpm: number;
  rpd: number;
  minuteCount: number;
  dayCount: number;
  state: 'available' | 'minute' | 'exhausted';
  until: number | null; // epoch ms
};
export type LogView = LogRow & { created_at: string };
export type StatusView = {
  storage: 'supabase' | 'memory';
  storageError: boolean;
  now: number;
  models: ModelStatus[];
  totals: Partial<Record<Outcome, number>>;
  logs: LogView[];
};
type Deps = {
  gate: (limit: number) => () => number; // minuteGate from mentor-server
  nextMidnight: (now: number) => number; // nextPacificMidnight from mentor-server
  now?: () => number;
};

const ACQUIRE_MS = 1500;
const WRITE_MS = 2000;
const STATUS_MS = 5000;
const BREAKER_MS = 30_000; // after a storage failure, skip it for a while instead of adding latency to every request
const PURGE_EVERY_MS = 3600_000;
const RING = 50;
export const MAX_QUESTION = 500;

/** Server env. Secret key: new `sb_secret_...` (SUPABASE_SECRET_KEY) or legacy service_role JWT. Never NEXT_PUBLIC. */
export function storeEnv(env: Record<string, string | undefined> = process.env) {
  const url = env.SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY || '';
  // A publishable/anon key here is a misconfiguration: it could not read the tables anyway.
  const configured = Boolean(url && key && !key.startsWith('sb_publishable_'));
  return { url, key, configured };
}

/** UTC calendar day, the rotation period of the ip_hash salt. */
const utcDay = (t: number) => new Date(t).toISOString().slice(0, 10);

/**
 * HMAC(ipGroup, salt of the day). The salt is derived from a server secret and the UTC date, so hashes link
 * requests within one day only, and the database alone cannot reverse them (no raw IP is ever stored).
 */
export function ipHash(ip: string, base: string | Buffer, now = Date.now()): string {
  const salt = createHmac('sha256', base).update(`mentor-ip-salt:v1:${utcDay(now)}`).digest();
  return createHmac('sha256', salt).update(ip).digest('hex').slice(0, 32);
}

/** At most MAX_QUESTION code points (the DB checks char_length, which counts code points). */
export const clip = (s: string, max = MAX_QUESTION) => {
  const cps = [...s];
  return cps.length > max ? cps.slice(0, max).join('') : s;
};

const withTimeout = <T>(p: PromiseLike<T>, ms: number): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    Promise.resolve(p).then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });

export type MentorStore = ReturnType<typeof createMentorStore>;

export function createMentorStore(specs: readonly ModelSpec[], deps: Deps, env: Record<string, string | undefined> = process.env) {
  const now = deps.now ?? (() => Date.now());
  const cfg = storeEnv(env);
  const byId = new Map(specs.map((s) => [s.id, s]));
  const byKey = new Map(specs.map((s) => [s.key, s]));

  // ---- memory (always kept: fallback and the per-instance view) ----
  /** Exhaustion from upstream 429s; also runChain's `state`. */
  const exhausted = new Map<string, { until: number; kind: Quota }>();
  const gates = new Map(specs.map((s) => [s.id, deps.gate(s.rpm)]));
  const recent = new Map<string, number[]>(); // display only: stamps of the last minute
  const days = new Map<string, { day: number; n: number }>(); // display only: today's count (Pacific)
  const ring: LogView[] = [];
  const totals = { day: 0, by: {} as Partial<Record<Outcome, number>> };
  const pacificDay = (t: number) => deps.nextMidnight(t); // id of the Pacific day = its end

  const count = (id: string, t: number) => {
    const r = (recent.get(id) ?? []).filter((x) => t - x < 60_000);
    r.push(t);
    recent.set(id, r);
    const d = days.get(id);
    const day = pacificDay(t);
    days.set(id, d && d.day === day ? { day, n: d.n + 1 } : { day, n: 1 });
  };
  const memAcquire = (id: string): Slot => {
    const w = gates.get(id)?.() ?? 0;
    if (!w) count(id, now());
    return w;
  };

  // ---- Supabase (lazy: the client library is only loaded when configured) ----
  let client: Promise<SupabaseClient> | null = null;
  const db = () =>
    (client ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }),
    ));
  let downUntil = 0;
  const up = () => cfg.configured && now() >= downUntil;
  const fail = (what: string) => {
    downUntil = now() + BREAKER_MS;
    console.error('mentor store unavailable', what); // never the error body (may echo keys/urls)
  };
  let lastPurge = 0;

  const ipBase: string | Buffer = env.MENTOR_IP_SALT || cfg.key || randomBytes(32);

  return {
    configured: cfg.configured,
    exhausted,
    keyOf: (id: string) => byId.get(id)?.key ?? null,
    ipHash: (ip: string) => ipHash(ip, ipBase, now()),

    /** Takes one request slot for `id` (shared across instances when configured). Falls back to memory on any failure. */
    async acquire(id: string): Promise<Slot> {
      const spec = byId.get(id);
      if (!spec || !up()) return memAcquire(id);
      try {
        const sb = await db();
        const { data, error } = await withTimeout(
          sb.rpc('mentor_try_acquire', { p_model_key: spec.key, p_rpm: spec.rpm, p_rpd: spec.rpd }),
          ACQUIRE_MS,
        );
        const row = (Array.isArray(data) ? data[0] : data) as { allowed: boolean; reason: string; retry_after: number } | null;
        if (error || !row) throw new Error('rpc');
        if (row.allowed) {
          count(id, now());
          return 0;
        }
        const secs = Math.max(1, Number(row.retry_after) || 1);
        const kind: Quota = row.reason === 'day' ? 'day' : 'minute';
        exhausted.set(id, { until: now() + secs * 1000, kind }); // local cache: no DB round trip while it lasts
        return kind === 'day' ? 'day' : secs;
      } catch {
        fail('acquire');
        return memAcquire(id);
      }
    },

    /** Upstream 429. runChain already updated the local map; this shares it. Fire-and-forget. */
    markExhausted(id: string, until: number, kind: Quota): void {
      exhausted.set(id, { until, kind });
      const spec = byId.get(id);
      if (!spec || !up()) return;
      void (async () => {
        try {
          const sb = await db();
          const { error } = await withTimeout(
            sb.rpc('mentor_mark_exhausted', { p_model_key: spec.key, p_until: new Date(until).toISOString(), p_status: kind }),
            WRITE_MS,
          );
          if (error) throw new Error('rpc');
        } catch {
          fail('mark');
        }
      })();
    },

    /** One row per request. Never throws, never takes longer than ~2 s; also purges old rows at most hourly. */
    async log(row: LogRow): Promise<void> {
      const t = now();
      const r = { ...row, redacted_question: row.redacted_question === null ? null : clip(row.redacted_question) };
      ring.unshift({ ...r, created_at: new Date(t).toISOString() });
      if (ring.length > RING) ring.length = RING;
      const day = pacificDay(t);
      if (totals.day !== day) Object.assign(totals, { day, by: {} });
      totals.by[r.outcome] = (totals.by[r.outcome] ?? 0) + 1;
      if (!up()) return;
      try {
        const sb = await db();
        const { error } = await withTimeout(sb.from('mentor_log').insert(r), WRITE_MS);
        if (error) throw new Error('insert');
        if (t - lastPurge >= PURGE_EVERY_MS) {
          lastPurge = t;
          const { error: e2 } = await withTimeout(sb.rpc('mentor_purge_logs'), WRITE_MS);
          if (e2) console.error('mentor log purge failed');
        }
      } catch {
        fail('log');
      }
    },

    memoryStatus(storageError = false): StatusView {
      const t = now();
      const models = specs.map((s): ModelStatus => {
        const ex = exhausted.get(s.id);
        const minuteCount = (recent.get(s.id) ?? []).filter((x) => t - x < 60_000).length;
        const d = days.get(s.id);
        const dayCount = d && d.day === pacificDay(t) ? d.n : 0;
        const live = ex && ex.until > t ? ex : null;
        return {
          key: s.key,
          id: s.id,
          rpm: s.rpm,
          rpd: s.rpd,
          minuteCount,
          dayCount,
          state: live ? (live.kind === 'day' ? 'exhausted' : 'minute') : minuteCount >= s.rpm ? 'minute' : 'available',
          until: live?.until ?? null,
        };
      });
      return {
        storage: 'memory',
        storageError,
        now: t,
        models,
        totals: totals.day === pacificDay(t) ? { ...totals.by } : {},
        logs: ring.slice(),
      };
    },

    /** Owner view: shared state from Supabase, or this instance's memory when not configured / unreachable. */
    async status(): Promise<StatusView> {
      if (!cfg.configured) return this.memoryStatus();
      const t = now();
      try {
        const sb = await db();
        const since = new Date(deps.nextMidnight(t) - 24 * 3600_000).toISOString();
        const [usage, tot, logs] = await withTimeout(
          Promise.all([
            sb.from('mentor_model_usage').select('*'),
            sb.rpc('mentor_outcome_totals', { p_since: since }),
            sb
              .from('mentor_log')
              .select('created_at, lesson_slug, task_id, locale, model_key, outcome, latency_ms, ip_hash, redacted_question, pii_redacted')
              .order('created_at', { ascending: false })
              .limit(RING),
          ]),
          STATUS_MS,
        );
        if (usage.error || tot.error || logs.error) throw new Error('select');
        type U = { model_key: string; minute_window: string | null; minute_count: number; day_window: string | null; day_count: number; exhausted_until: string | null; last_status: string | null };
        const rows = new Map(((usage.data ?? []) as U[]).map((u) => [u.model_key, u]));
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles' }).format(t); // YYYY-MM-DD
        const models = specs.map((s): ModelStatus => {
          const u = rows.get(s.key);
          const minuteLive = u?.minute_window && t < Date.parse(u.minute_window) + 60_000;
          const minuteCount = minuteLive ? u!.minute_count : 0;
          const dayCount = u?.day_window === today ? u.day_count : 0;
          const exUntil = u?.exhausted_until ? Date.parse(u.exhausted_until) : 0;
          let state: ModelStatus['state'] = 'available';
          let until: number | null = null;
          if (exUntil > t) [state, until] = [u!.last_status === 'day' ? 'exhausted' : 'minute', exUntil];
          else if (dayCount >= s.rpd) [state, until] = ['exhausted', deps.nextMidnight(t)];
          else if (minuteCount >= s.rpm) [state, until] = ['minute', Date.parse(u!.minute_window!) + 60_000];
          return { key: s.key, id: s.id, rpm: s.rpm, rpd: s.rpd, minuteCount, dayCount, state, until };
        });
        const totals: Partial<Record<Outcome, number>> = {};
        for (const r of (tot.data ?? []) as { outcome: Outcome; n: number }[]) totals[r.outcome] = Number(r.n);
        return { storage: 'supabase', storageError: false, now: t, models, totals, logs: (logs.data ?? []) as LogView[] };
      } catch {
        fail('status');
        return this.memoryStatus(true);
      }
    },

    /** Vendor model id for an opaque key (owner view only). */
    idOf: (key: string | null) => (key ? (byKey.get(key)?.id ?? key) : null),
  };
}
