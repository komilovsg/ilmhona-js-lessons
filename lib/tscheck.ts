// Client of the TypeScript check worker (public/ts-lib/worker.js). The compiler (~9 MB, ~1.7 MB gzip) and the lib
// .d.ts files are self-hosted and load only when a page runs its first data-lang="ts" block; the worker stays
// alive for the page, so later runs are fast (libs parsed once, previous program reused).
import type { TsDiagnostic } from './check';

export type TsResult = { diagnostics: TsDiagnostic[]; js: string };

let worker: Worker | null = null;
let ready: Promise<void> | null = null;
let seq = 0;
const waiting = new Map<number, { ok: (r: TsResult) => void; fail: (e: Error) => void }>();

function boot(): Promise<void> {
  if (!ready) {
    ready = new Promise<void>((resolve, reject) => {
      const w = new Worker('/ts-lib/worker.js');
      worker = w;
      w.onmessage = (e: MessageEvent) => {
        const m = e.data as { ready?: boolean; error?: string; id?: number; diagnostics?: TsDiagnostic[]; js?: string };
        if (m.ready === true) return resolve();
        if (m.ready === false) return reject(new Error(m.error));
        const p = m.id === undefined ? undefined : waiting.get(m.id);
        if (!p || m.id === undefined) return;
        waiting.delete(m.id);
        if (m.error !== undefined) p.fail(new Error(m.error));
        else p.ok({ diagnostics: m.diagnostics ?? [], js: m.js ?? '' });
      };
      w.onerror = () => reject(new Error('worker'));
    });
    ready.catch(() => {
      worker?.terminate();
      worker = null;
      ready = null; // next run retries
    });
  }
  return ready;
}

/** Start loading the compiler (idempotent). */
export const preloadTs = () => void boot().catch(() => {});

/** Type-check `code` (strict, ES2022 + DOM) and transpile it to JS. Rejects if the compiler cannot load. */
export async function checkTs(code: string): Promise<TsResult> {
  await boot();
  return new Promise((ok, fail) => {
    const id = ++seq;
    waiting.set(id, { ok, fail });
    worker?.postMessage({ id, code });
  });
}
