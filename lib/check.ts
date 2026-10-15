// Auto-check: compare console output with the task's expected text. Pure, no imports (runnable by node).

export const CHECK_STRINGS = {
  ok: '✓ Верно!',
  okAgain: '✓ Верно',
  lineDiff: (n: number, exp: string, got: string) => `Почти! Строка ${n}: ожидалось «${exp}», получено «${got}»`,
  missing: (exp: number, got: number) => `Не хватает строк: ожидалось ${exp}, получено ${got}`,
  extra: (exp: number, got: number) => `Лишние строки: ожидалось ${exp}, получено ${got}`,
};

type Line = { text: string; cls?: string };

/** Split, trim each line, collapse whitespace runs, drop leading/trailing empty lines. */
export function normalizeText(text: string): string[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim().replace(/\s+/g, ' '));
  while (lines.length && lines[0] === '') lines.shift();
  while (lines.length && lines[lines.length - 1] === '') lines.pop();
  return lines;
}

/** Runner output -> normalized lines (placeholder lines with cls 'empty' are ignored). */
export function normalizeOutput(lines: Line[]): string[] {
  return normalizeText(lines.filter((l) => l.cls !== 'empty').map((l) => l.text).join('\n'));
}

export type Diff =
  | { ok: true }
  | { ok: false; kind: 'line'; line: number; exp: string; got: string }
  | { ok: false; kind: 'missing' | 'extra'; exp: number; got: number };

export function diffLines(expected: string[], actual: string[]): Diff {
  const n = Math.min(expected.length, actual.length);
  for (let i = 0; i < n; i++) {
    if (expected[i] !== actual[i]) return { ok: false, kind: 'line', line: i + 1, exp: expected[i], got: actual[i] };
  }
  if (actual.length < expected.length) return { ok: false, kind: 'missing', exp: expected.length, got: actual.length };
  if (actual.length > expected.length) return { ok: false, kind: 'extra', exp: expected.length, got: actual.length };
  return { ok: true };
}

/** Match = same lines and the run had no error. */
export function matches(expected: string[], actual: string[], hadError: boolean): boolean {
  return !hadError && diffLines(expected, actual).ok;
}

const clip = (s: string, max = 48) => (s.length > max ? s.slice(0, max - 1) + '…' : s);

export function diffMessage(d: Diff): string {
  if (d.ok) return CHECK_STRINGS.okAgain;
  if (d.kind === 'line') return CHECK_STRINGS.lineDiff(d.line, clip(d.exp), clip(d.got));
  return d.kind === 'missing' ? CHECK_STRINGS.missing(d.exp, d.got) : CHECK_STRINGS.extra(d.exp, d.got);
}
