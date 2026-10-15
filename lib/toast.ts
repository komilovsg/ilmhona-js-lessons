// Minimal toast store (module-level, consumed by components/Toasts.tsx).
export type Toast = { id: number; emoji: string; title: string; text?: string };

let toasts: Toast[] = [];
let nextId = 1;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const TOAST_MS = 3500;

export function pushToast(t: Omit<Toast, 'id'>) {
  const id = nextId++;
  toasts = [...toasts, { ...t, id }];
  emit();
  setTimeout(() => dismissToast(id), TOAST_MS);
}

export function dismissToast(id: number) {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
}

export const subscribeToasts = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};
export const getToasts = () => toasts;
export const getServerToasts = (): Toast[] => [];
