import { useSyncExternalStore } from 'react';
import { cleanProgress } from '@/lib/supabase/merge';

export type TaskRecord = { solvedAt: string; auto: boolean; hints: number[]; xp: number };
export type ProgressState = {
  version: 2;
  /** key = `${lessonSlug}:${taskId}` */
  solved: Record<string, TaskRecord>;
  hintsOpened: Record<string, number[]>;
  updatedAt: string;
};

// NOTE: storage keys keep the legacy 'ilmhona:' prefix on purpose: renaming would wipe students' saved progress.
const KEY = 'ilmhona:v2';
const MIGRATED_KEY = 'ilmhona:v2:migrated';
const CORRUPT_KEY = 'ilmhona:v2:corrupt';
const OLD_PREFIX = 'ilmhona:';

const EMPTY: ProgressState = { version: 2, solved: {}, hintsOpened: {}, updatedAt: '' };

let state: ProgressState = EMPTY;
let loaded = false;
const listeners = new Set<() => void>();

const taskKey = (slug: string, id: string) => `${slug}:${id}`;

function lsGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function lsSet(k: string, v: string) {
  try {
    localStorage.setItem(k, v);
  } catch {}
}

function parse(raw: string | null): ProgressState {
  if (!raw) return EMPTY;
  try {
    const clean = cleanProgress(JSON.parse(raw));
    if (clean) return clean;
  } catch {}
  // Unreadable or wrong shape: keep a copy for debugging, start empty.
  lsSet(CORRUPT_KEY, raw.slice(0, 200000));
  return EMPTY;
}

/** Old static page names (fixed: these pages no longer exist). */
const LEGACY_FILES: Record<string, string> = {
  '01-functions.html': 'functions',
  '02-arrays.html': 'arrays',
  '03-objects.html': 'objects',
};

/** One-time import of old per-page keys `ilmhona:<file>.html:<taskId>` (old keys are left untouched). */
function migrate(s: ProgressState): ProgressState {
  if (lsGet(MIGRATED_KEY)) return s;
  const bySlug = new Map(Object.entries(LEGACY_FILES));
  const solved = { ...s.solved };
  const now = new Date().toISOString();
  let changed = false;
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k || !k.startsWith(OLD_PREFIX)) continue;
      const m = k.slice(OLD_PREFIX.length).match(/^([^:]+\.html):(.+)$/);
      const slug = m && bySlug.get(m[1]);
      if (!m || !slug || !localStorage.getItem(k)) continue;
      const tk = taskKey(slug, m[2]);
      if (!solved[tk]) {
        solved[tk] = { solvedAt: now, auto: false, hints: [], xp: 0 };
        changed = true;
      }
    }
  } catch {}
  const next = changed ? { ...s, solved, updatedAt: now } : s;
  if (changed) lsSet(KEY, JSON.stringify(next));
  lsSet(MIGRATED_KEY, '1');
  return next;
}

function ensureLoaded() {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  state = migrate(parse(lsGet(KEY)));
}

function commit(next: ProgressState, persist = true) {
  state = { ...next, updatedAt: new Date().toISOString() };
  if (persist) lsSet(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1 && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
  };
}

function onStorage(e: StorageEvent) {
  if (e.key !== KEY && e.key !== null) return;
  state = parse(lsGet(KEY));
  listeners.forEach((l) => l());
}

export function getSnapshot(): ProgressState {
  ensureLoaded();
  return state;
}
export function getServerSnapshot(): ProgressState {
  return EMPTY;
}

export function isSolved(slug: string, id: string): boolean {
  return !!getSnapshot().solved[taskKey(slug, id)];
}

export function markSolved(slug: string, id: string, opts: { auto?: boolean; xp?: number } = {}) {
  const s = getSnapshot();
  const k = taskKey(slug, id);
  if (s.solved[k]) return;
  const rec: TaskRecord = {
    solvedAt: new Date().toISOString(),
    auto: opts.auto ?? false,
    hints: s.hintsOpened[k] ?? [],
    xp: opts.xp ?? 0,
  };
  commit({ ...s, solved: { ...s.solved, [k]: rec } });
}

export function unmark(slug: string, id: string) {
  const s = getSnapshot();
  const k = taskKey(slug, id);
  if (!s.solved[k]) return;
  const solved = { ...s.solved };
  delete solved[k];
  commit({ ...s, solved });
}

export function noteHint(slug: string, id: string, hintIndex: number) {
  const s = getSnapshot();
  const k = taskKey(slug, id);
  const cur = s.hintsOpened[k] ?? [];
  if (cur.includes(hintIndex)) return;
  commit({ ...s, hintsOpened: { ...s.hintsOpened, [k]: [...cur, hintIndex] } });
}

/** Replace the whole state (future server sync). */
export function replaceState(next: ProgressState) {
  ensureLoaded();
  commit(next);
}

export function useProgress(): ProgressState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
