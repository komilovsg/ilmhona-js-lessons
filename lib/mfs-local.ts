import { useSyncExternalStore } from 'react';

// Local-only state of lesson widgets (checklists, homework links): localStorage keys with the `mfs:` prefix.
// Separate from the progress store (`ilmhona:v2`), never synced.
const listeners = new Set<() => void>();

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeLocal(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => (listeners.add(l), () => void listeners.delete(l));

/** Raw stored string; null on the server, during hydration and when nothing is stored. */
export const useLocal = (key: string) => useSyncExternalStore(subscribe, () => read(key), () => null);
