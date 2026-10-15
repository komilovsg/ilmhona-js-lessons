// Cross-device progress sync (Supabase). Local storage stays the source of truth for the UI:
// remote failures never touch local data, and every sign-in / page load re-merges the full
// remote copy, so anything that failed to upload is retried then at the latest.
//
// Two tabs of the same user may both sync (the `storage` event replays one tab's change in the
// other). That only duplicates idempotent upserts/deletes keyed by (user, lesson, task).
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSnapshot, replaceState, subscribe } from '@/lib/progress';
import { diffSolved, mergeSolved, sameSolved, solvedFromRows, type Row, type RowKey, type SolvedMap } from '@/lib/supabase/merge';

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline';

/** User id whose remote copy the local progress was last merged with. */
// Legacy 'ilmhona:' prefix kept on purpose (renaming would break sync ownership of existing browsers).
const OWNER_KEY = 'ilmhona:sync:owner';
const DEBOUNCE_MS = 800;
const MAX_BACKOFF_MS = 60_000;
const COLUMNS = 'lesson_slug,task_id,solved_at,auto,hints,xp';

type Op = { op: 'upsert'; row: Row } | { op: 'delete'; key: RowKey };
type Ctx = {
  sb: SupabaseClient;
  userId: string;
  stopped: boolean;
  ready: boolean; // initial merge done, change tracking active
  baseline: SolvedMap;
  pending: Map<string, Op>;
  timer: ReturnType<typeof setTimeout> | null;
  attempt: number;
  flushing: Promise<void> | null;
  cleanup: (() => void)[];
};

let ctx: Ctx | null = null;
let status: SyncStatus = 'idle';
const statusListeners = new Set<(s: SyncStatus) => void>();

function setStatus(s: SyncStatus) {
  if (s === status) return;
  status = s;
  statusListeners.forEach((l) => l(s));
}
export function getSyncStatus(): SyncStatus {
  return status;
}
export function onSyncStatus(l: (s: SyncStatus) => void): () => void {
  statusListeners.add(l);
  return () => statusListeners.delete(l);
}

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

const backoff = (attempt: number) => Math.min(MAX_BACKOFF_MS, 1000 * 2 ** attempt) * (0.75 + Math.random() * 0.5);

function schedule(c: Ctx, ms: number) {
  if (c.stopped) return;
  if (c.timer) clearTimeout(c.timer);
  c.timer = setTimeout(() => {
    c.timer = null;
    void (c.ready ? flush(c) : initialMerge(c));
  }, ms);
}

/** Start syncing for this user (no-op if already syncing for them). */
export function startSync(sb: SupabaseClient, userId: string) {
  if (ctx && !ctx.stopped && ctx.userId === userId) return;
  stopSync();
  const c: Ctx = {
    sb,
    userId,
    stopped: false,
    ready: false,
    baseline: {},
    pending: new Map(),
    timer: null,
    attempt: 0,
    flushing: null,
    cleanup: [],
  };
  ctx = c;

  const onHidden = () => {
    if (document.visibilityState === 'hidden') void flush(c);
  };
  const onPageHide = () => void flush(c);
  const onOnline = () => schedule(c, 0);
  document.addEventListener('visibilitychange', onHidden);
  window.addEventListener('pagehide', onPageHide);
  window.addEventListener('online', onOnline);
  c.cleanup.push(() => {
    document.removeEventListener('visibilitychange', onHidden);
    window.removeEventListener('pagehide', onPageHide);
    window.removeEventListener('online', onOnline);
  });

  void initialMerge(c);
}

/** Stop syncing. Local progress is kept as is; unsent changes are re-merged on next sign-in. */
export function stopSync() {
  const c = ctx;
  ctx = null;
  if (!c) return;
  c.stopped = true;
  if (c.timer) clearTimeout(c.timer);
  c.cleanup.forEach((f) => f());
  setStatus('idle');
}

/** Send pending changes now (e.g. before sign-out). Resolves even if the network fails. */
export async function flushSync(timeoutMs = 3000): Promise<void> {
  const c = ctx;
  if (!c || !c.ready) return;
  await Promise.race([flush(c), new Promise((r) => setTimeout(r, timeoutMs))]);
}

async function initialMerge(c: Ctx) {
  if (c.stopped || c.ready) return;
  setStatus('syncing');
  const { data, error } = await c.sb.from('task_progress').select(COLUMNS).eq('user_id', c.userId);
  if (c.stopped) return;
  if (error || !data) {
    setStatus('offline');
    schedule(c, backoff(c.attempt++));
    return;
  }
  c.attempt = 0;
  const remote = solvedFromRows(data as Row[]);

  // Merge synchronously with the current snapshot so no local change can slip in between.
  const local = getSnapshot();
  const owner = lsGet(OWNER_KEY);
  // Local progress already merged into ANOTHER account (shared classroom computer): don't
  // upload it into this one; show this account's progress instead. Anonymous progress
  // (no owner yet) is claimed by the first account that signs in.
  const foreign = !!owner && owner !== c.userId;
  const merged = foreign ? remote : mergeSolved(local.solved, remote);
  const hintsOpened = foreign ? {} : local.hintsOpened;
  lsSet(OWNER_KEY, c.userId);
  if (!sameSolved(local.solved, merged) || hintsOpened !== local.hintsOpened) {
    replaceState({ ...local, solved: merged, hintsOpened });
  }

  // Baseline = what we just wrote, so the replaceState above never echoes back as a diff.
  c.baseline = getSnapshot().solved;
  c.ready = true;
  c.cleanup.push(subscribe(() => onLocalChange(c)));

  const { upserts } = diffSolved(remote, merged); // merged ⊇ remote: never deletes here
  enqueue(c, upserts, []);
  if (c.pending.size) await flush(c);
  else setStatus('synced');
}

function onLocalChange(c: Ctx) {
  if (c.stopped) return;
  const next = getSnapshot().solved;
  if (next === c.baseline) return; // hint-only or no-op commit
  const { upserts, deletes } = diffSolved(c.baseline, next);
  c.baseline = next;
  if (!upserts.length && !deletes.length) return;
  enqueue(c, upserts, deletes);
  schedule(c, DEBOUNCE_MS);
}

function enqueue(c: Ctx, upserts: Row[], deletes: RowKey[]) {
  for (const row of upserts) c.pending.set(`${row.lesson_slug}:${row.task_id}`, { op: 'upsert', row });
  for (const key of deletes) c.pending.set(`${key.lesson_slug}:${key.task_id}`, { op: 'delete', key });
}

function flush(c: Ctx): Promise<void> {
  // Changes queued during an in-flight request go right after it (unless it failed: then the
  // backoff timer owns the retry).
  if (c.flushing) return c.flushing.then(() => (c.pending.size && c.attempt === 0 ? flush(c) : undefined));
  if (c.stopped || !c.pending.size) return Promise.resolve();
  if (c.timer) {
    clearTimeout(c.timer);
    c.timer = null;
  }
  c.flushing = doFlush(c).finally(() => {
    c.flushing = null;
  });
  return c.flushing;
}

async function doFlush(c: Ctx) {
  const batch = new Map(c.pending);
  c.pending.clear();
  setStatus('syncing');

  const rows: (Row & { user_id: string })[] = [];
  const delsBySlug = new Map<string, string[]>();
  for (const op of batch.values()) {
    if (op.op === 'upsert') rows.push({ ...op.row, user_id: c.userId });
    else delsBySlug.set(op.key.lesson_slug, [...(delsBySlug.get(op.key.lesson_slug) ?? []), op.key.task_id]);
  }

  try {
    if (rows.length) {
      const { error } = await c.sb.from('task_progress').upsert(rows, { onConflict: 'user_id,lesson_slug,task_id' });
      if (error) throw error;
    }
    for (const [slug, ids] of delsBySlug) {
      const { error } = await c.sb
        .from('task_progress')
        .delete()
        .eq('user_id', c.userId)
        .eq('lesson_slug', slug)
        .in('task_id', ids);
      if (error) throw error;
    }
    c.attempt = 0;
    if (!c.stopped) setStatus(c.pending.size ? 'syncing' : 'synced');
  } catch {
    if (c.stopped) return;
    // Put back whatever wasn't superseded by a newer change meanwhile; retry with backoff.
    // (Ops are idempotent, so re-sending a partially applied batch is safe.)
    for (const [k, op] of batch) if (!c.pending.has(k)) c.pending.set(k, op);
    setStatus('offline');
    schedule(c, backoff(c.attempt++));
  }
}
