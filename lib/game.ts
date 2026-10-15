// Game rules: XP, levels, streaks, achievements. Pure functions over ProgressState.
import type { Messages } from '../messages/ru';
import type { ProgressState } from './progress';

/** Dictionary section with rank names and achievement texts (`t.game`). */
export type GameStrings = Messages['game'];

const EMOJI = {
  first: '🌱',
  lesson: '🎓',
  nohints: '🧠',
  hard3: '💪',
  streak3: '🔥',
  streak7: '⚡',
  owl: '🦉',
  sprint: '🏃',
} as const;

export type Lvl = 'easy' | 'mid' | 'hard' | null;
export const BASE_XP = { easy: 10, mid: 20, hard: 40 } as const;
export const HINT_PENALTY = 0.25;
export const MIN_XP_FACTOR = 0.25;
export const LEVEL_THRESHOLDS = [0, 50, 150, 300, 500, 800, 1200, 1700, 2300, 3000];

/** Percent of base XP lost to opened hints (0, 25, 50, 75 — the factor never drops below 25%). */
export function hintPenaltyPct(hints: number): number {
  return Math.round((1 - Math.max(MIN_XP_FACTOR, 1 - HINT_PENALTY * Math.max(0, hints))) * 100);
}

/** XP for solving a task. Manual marking is worth 50% of base, then the hint penalty applies. */
export function calcXp(level: Lvl, hints: number, auto: boolean): number {
  const base = BASE_XP[level ?? 'mid'];
  const factor = Math.max(MIN_XP_FACTOR, 1 - HINT_PENALTY * Math.max(0, hints));
  return Math.round(base * (auto ? 1 : 0.5) * factor);
}

export function totalXp(s: ProgressState): number {
  return Object.values(s.solved).reduce((a, r) => a + (r.xp || 0), 0);
}

export type LevelInfo = { level: number; rank: string; xp: number; floor: number; next: number | null; pct: number };

export function levelInfo(xp: number, ranks: readonly string[]): LevelInfo {
  let i = 0;
  while (i + 1 < LEVEL_THRESHOLDS.length && xp >= LEVEL_THRESHOLDS[i + 1]) i++;
  const floor = LEVEL_THRESHOLDS[i];
  const next = LEVEL_THRESHOLDS[i + 1] ?? null;
  const pct = next === null ? 100 : Math.round(((xp - floor) / (next - floor)) * 100);
  return { level: i + 1, rank: ranks[i], xp, floor, next, pct };
}

// ---- streaks (local calendar days) ----
const dayNum = (d: Date) => Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);

function solvedDays(s: ProgressState): number[] {
  const set = new Set<number>();
  for (const r of Object.values(s.solved)) {
    const d = new Date(r.solvedAt);
    if (!isNaN(d.getTime())) set.add(dayNum(d));
  }
  return [...set].sort((a, b) => a - b);
}

/** Current streak: consecutive days ending today (or yesterday, so it survives until midnight). */
export function currentStreak(s: ProgressState, now: number): number {
  if (!now) return 0;
  const days = new Set(solvedDays(s));
  const today = dayNum(new Date(now));
  let d = days.has(today) ? today : today - 1;
  let n = 0;
  while (days.has(d)) {
    n++;
    d--;
  }
  return n;
}

export function longestStreak(s: ProgressState): number {
  let best = 0;
  let run = 0;
  let prev = -Infinity;
  for (const d of solvedDays(s)) {
    run = d === prev + 1 ? run + 1 : 1;
    prev = d;
    best = Math.max(best, run);
  }
  return best;
}

// ---- achievements ----
export type Meta = Record<string, Record<string, 'e' | 'm' | 'h'>>;
export type Achievement = { id: string; emoji: string; title: string; desc: string; how: string; unlocked: boolean };

export function achievements(s: ProgressState, meta: Meta, strings: GameStrings): Achievement[] {
  const entries = Object.entries(s.solved);
  const times = entries.map(([, r]) => new Date(r.solvedAt).getTime()).filter((t) => !isNaN(t)).sort((a, b) => a - b);
  const levelOf = (key: string) => {
    const i = key.indexOf(':');
    return meta[key.slice(0, i)]?.[key.slice(i + 1)];
  };
  const lessonDone = Object.entries(meta).some(([slug, tasks]) => {
    const ids = Object.keys(tasks);
    return ids.length > 0 && ids.every((id) => s.solved[`${slug}:${id}`]);
  });
  const streak = longestStreak(s);
  const unlocked: Record<keyof typeof EMOJI, boolean> = {
    first: entries.length >= 1,
    lesson: lessonDone,
    nohints: entries.filter(([, r]) => r.auto && r.hints.length === 0).length >= 5,
    hard3: entries.filter(([k]) => levelOf(k) === 'h').length >= 3,
    streak3: streak >= 3,
    streak7: streak >= 7,
    owl: times.some((t) => new Date(t).getHours() < 5),
    sprint: times.some((t, i) => i >= 2 && t - times[i - 2] <= 10 * 60000),
  };
  return (Object.keys(EMOJI) as (keyof typeof EMOJI)[]).map((id) => ({
    id,
    emoji: EMOJI[id],
    ...strings.achievements[id],
    unlocked: unlocked[id],
  }));
}
