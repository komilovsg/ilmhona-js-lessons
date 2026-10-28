// Auto-check: compare console output with the task's expected text. Pure, no runtime imports (runnable by node).
import type { Messages } from '../messages/ru';

/** Dictionary section with the diff messages (`t.check`). */
export type CheckStrings = Messages['check'];

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

export function diffMessage(d: Diff, s: CheckStrings): string {
  if (d.ok) return s.okAgain;
  if (d.kind === 'line') return s.lineDiff(d.line, clip(d.exp), clip(d.got));
  return d.kind === 'missing' ? s.missing(d.exp, d.got) : s.extra(d.exp, d.got);
}

/** One TypeScript diagnostic from the worker (1-based line/col, `start`/`length` = offsets in the snippet). */
export type TsDiagnostic = { line: number; col: number; start: number; length: number; code: number; message: string };

/** `Строка 3, столбец 7: Type 'string' is not assignable to type 'number'. (TS2322)` — the compiler message stays English. */
export function formatTsDiagnostic(d: TsDiagnostic, s: Messages['ts']): string {
  return `${s.at(d.line, d.col)}: ${d.message} (TS${d.code})`;
}
