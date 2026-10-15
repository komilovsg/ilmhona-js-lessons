// Tiny external store: lets Task / CodeBlock open the mentor panel with context.
export type MentorOpen = { taskId?: string; code?: string; output?: string; prefill?: string };
export type MentorState = { open: boolean; seq: number; req: MentorOpen | null };

let state: MentorState = { open: false, seq: 0, req: null };
const subs = new Set<() => void>();
const emit = () => subs.forEach((f) => f());

export const subscribeMentor = (f: () => void) => {
  subs.add(f);
  return () => void subs.delete(f);
};
export const getMentor = () => state;
export const getServerMentor = (): MentorState => ({ open: false, seq: 0, req: null });

export function openMentor(req: MentorOpen | null = null) {
  state = { open: true, seq: state.seq + 1, req };
  emit();
}
export function closeMentor() {
  state = { ...state, open: false };
  emit();
}

/** Code of the task's first runnable block (live CodeMirror text if loaded, else the static <pre>) + its output. */
export function readTaskContext(task: Element): { code: string; output: string } {
  const wraps = [...task.querySelectorAll('.code-wrap')].filter((w) => !w.closest('details'));
  const wrap = wraps.find((w) => w.querySelector('button.run')) ?? wraps[0];
  if (!wrap) return { code: '', output: '' };
  const lines = [...wrap.querySelectorAll('.cm-content .cm-line')];
  const code = lines.length ? lines.map((l) => l.textContent ?? '').join('\n') : (wrap.querySelector('pre')?.textContent ?? '');
  const out = [...wrap.querySelectorAll('.output.show .line')].map((l) => l.textContent ?? '');
  return { code: code.slice(0, 6000), output: out.join('\n').slice(-3000) };
}
