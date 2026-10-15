// Pure merge/diff helpers for progress sync. No imports and only erasable TS syntax,
// so `node lib/supabase/merge.check.mjs` can run them directly (Node strips the types).

export type Rec = { solvedAt: string; auto: boolean; hints: number[]; xp: number };
export type SolvedMap = Record<string, Rec>;
/** Row shape of public.task_progress (minus user_id / updated_at). */
export type Row = {
  lesson_slug: string;
  task_id: string;
  solved_at: string;
  auto: boolean;
  hints: number[];
  xp: number;
};
export type RowKey = { lesson_slug: string; task_id: string };
export type Diff = { upserts: Row[]; deletes: RowKey[] };

// Must match the CHECK constraints in supabase/migrations/0001_init.sql.
export const SLUG_RE = /^[a-z0-9-]{1,40}$/;
export const TASK_RE = /^[A-Za-z0-9_-]{1,40}$/;
export const MAX_XP = 40;
export const MAX_HINTS = 10;

export function splitKey(key: string): RowKey | null {
  const i = key.indexOf(':');
  if (i < 0) return null;
  const lesson_slug = key.slice(0, i);
  const task_id = key.slice(i + 1);
  return SLUG_RE.test(lesson_slug) && TASK_RE.test(task_id) ? { lesson_slug, task_id } : null;
}

function time(s: unknown): number {
  const t = typeof s === 'string' ? Date.parse(s) : NaN;
  return Number.isNaN(t) ? Infinity : t;
}

export function cleanHints(h: unknown): number[] {
  if (!Array.isArray(h)) return [];
  const set = new Set<number>();
  for (const v of h) if (Number.isInteger(v) && v >= 0 && v <= 32767) set.add(v);
  return [...set].sort((a, b) => a - b);
}

function numXp(x: unknown): number {
  return typeof x === 'number' && Number.isFinite(x) ? x : 0;
}

/** Conflict rule: earliest solvedAt, auto = OR, xp = max, hints = sorted union. */
export function mergeRecord(a: Rec, b: Rec): Rec {
  return {
    solvedAt: time(b.solvedAt) < time(a.solvedAt) ? b.solvedAt : a.solvedAt,
    auto: Boolean(a.auto || b.auto),
    hints: cleanHints([...(a.hints ?? []), ...(b.hints ?? [])]),
    xp: Math.max(numXp(a.xp), numXp(b.xp)),
  };
}

/** Union by key. Local entries that can't be synced (odd keys) are kept untouched. */
export function mergeSolved(local: SolvedMap, remote: SolvedMap): SolvedMap {
  const out: SolvedMap = { ...local };
  for (const [k, r] of Object.entries(remote)) out[k] = out[k] ? mergeRecord(out[k], r) : r;
  return out;
}

/** Normalised DB row, or null when the record can't be stored (bad key / date). */
export function toRow(key: string, rec: Rec): Row | null {
  const k = splitKey(key);
  const t = time(rec?.solvedAt);
  if (!k || t === Infinity) return null;
  return {
    ...k,
    solved_at: new Date(t).toISOString(),
    auto: Boolean(rec.auto),
    hints: cleanHints(rec.hints).slice(0, MAX_HINTS),
    xp: Math.min(MAX_XP, Math.max(0, Math.round(numXp(rec.xp)))),
  };
}

export function rowsEqual(a: Row, b: Row): boolean {
  return (
    a.lesson_slug === b.lesson_slug &&
    a.task_id === b.task_id &&
    time(a.solved_at) === time(b.solved_at) &&
    a.auto === b.auto &&
    a.xp === b.xp &&
    a.hints.length === b.hints.length &&
    a.hints.every((h, i) => h === b.hints[i])
  );
}

export function solvedFromRows(rows: readonly Row[]): SolvedMap {
  const out: SolvedMap = {};
  for (const r of rows) {
    out[`${r.lesson_slug}:${r.task_id}`] = {
      solvedAt: new Date(r.solved_at).toISOString(),
      auto: r.auto,
      hints: cleanHints(r.hints),
      xp: r.xp,
    };
  }
  return out;
}

/** What to send so that the remote copy of `prev` becomes `next` (compared as normalised rows). */
export function diffSolved(prev: SolvedMap, next: SolvedMap): Diff {
  const upserts: Row[] = [];
  const deletes: RowKey[] = [];
  for (const [k, rec] of Object.entries(next)) {
    const row = toRow(k, rec);
    if (!row) continue;
    const old = prev[k] ? toRow(k, prev[k]) : null;
    if (!old || !rowsEqual(old, row)) upserts.push(row);
  }
  for (const k of Object.keys(prev)) {
    if (k in next) continue;
    const key = splitKey(k);
    if (key) deletes.push(key);
  }
  return { upserts, deletes };
}

/** Shallow structural equality of two solved maps (used to skip no-op replaceState calls). */
export function sameSolved(a: SolvedMap, b: SolvedMap): boolean {
  const ka = Object.keys(a);
  if (ka.length !== Object.keys(b).length) return false;
  return ka.every((k) => {
    const x = a[k];
    const y = b[k];
    return (
      !!y &&
      x.solvedAt === y.solvedAt &&
      x.auto === y.auto &&
      x.xp === y.xp &&
      (x.hints ?? []).join() === (y.hints ?? []).join()
    );
  });
}

export type CleanProgress = {
  version: 2;
  solved: Record<string, Rec>;
  hintsOpened: Record<string, number[]>;
  updatedAt: string;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Validates parsed localStorage progress. Returns null when the shape is unusable. Never throws. */
export function cleanProgress(p: unknown): CleanProgress | null {
  if (!isObj(p) || p.version !== 2 || !isObj(p.solved)) return null;
  const solved: Record<string, Rec> = Object.create(null);
  for (const k of Object.keys(p.solved)) {
    if (!splitKey(k)) continue;
    const r = p.solved[k];
    if (!isObj(r)) continue;
    solved[k] = {
      solvedAt: typeof r.solvedAt === 'string' ? r.solvedAt : '',
      auto: r.auto === true,
      hints: cleanHints(r.hints),
      xp: Math.min(MAX_XP, Math.max(0, numXp(r.xp))),
    };
  }
  const hintsOpened: Record<string, number[]> = Object.create(null);
  if (isObj(p.hintsOpened)) {
    for (const k of Object.keys(p.hintsOpened)) {
      if (splitKey(k)) hintsOpened[k] = cleanHints(p.hintsOpened[k]);
    }
  }
  return { version: 2, solved, hintsOpened, updatedAt: typeof p.updatedAt === 'string' ? p.updatedAt : '' };
}
