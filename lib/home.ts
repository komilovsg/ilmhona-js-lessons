// Home board logic: "continue where you left off" and the course picker. Pure functions, no storage.
import type { CourseEntry } from '@/content/course';
import { COURSES, lessonHref, lessonKey, courseHome, type Course, type CourseId } from './courses';
import { lessonCounts } from './course-status';
import type { Locale } from './i18n';
import type { ProgressState } from './progress';

export type ContinueTarget = {
  course: Course;
  /** null: nothing left to open in the course, link to its roadmap. */
  entry: CourseEntry | null;
  solved: number;
  total: number;
  href: string;
};

/** Course and lesson key of a progress key (`<lessonKey>:<taskId>`): the prefix decides the course. */
const courseOfKey = (lessonKeyStr: string): Course =>
  Object.values(COURSES).find((c) => c.keyPrefix && lessonKeyStr.startsWith(c.keyPrefix)) ?? COURSES.frontend;

/**
 * The most recent `solvedAt` across all keys -> its course and lesson. If that lesson still has unsolved tasks, continue
 * it; otherwise the next available lesson of that course; if there is none, the course roadmap. null without progress.
 */
export function continueTarget(s: ProgressState, locale: Locale): ContinueTarget | null {
  let best: { key: string; at: number } | null = null;
  for (const [k, r] of Object.entries(s.solved)) {
    const at = new Date(r.solvedAt).getTime();
    if (isNaN(at) || k.indexOf(':') < 1) continue;
    if (!best || at > best.at) best = { key: k, at };
  }
  if (!best) return null;
  const key = best.key.slice(0, best.key.indexOf(':'));
  const course = courseOfKey(key);
  const slug = key.slice(course.keyPrefix.length);
  const roadmap = (): ContinueTarget => ({ course, entry: null, solved: 0, total: 0, href: courseHome(course, locale) });
  const idx = course.entries.findIndex((e) => e.slug === slug);
  if (idx < 0) return roadmap();
  const open = (e: CourseEntry): ContinueTarget => ({
    course,
    entry: e,
    ...lessonCounts(lessonKey(course, e.slug), s.solved),
    href: lessonHref(course, locale, e.slug),
  });
  const cur = course.entries[idx];
  const c = lessonCounts(key, s.solved);
  if (course.available.includes(cur.slug) && c.solved < c.total) return open(cur);
  const next = course.entries.slice(idx + 1).find((e) => course.available.includes(e.slug));
  return next ? open(next) : roadmap();
}

/** Solved / total tasks over the available lessons of a course (personal progress %). */
export function courseDone(s: ProgressState, c: Course): { solved: number; total: number } {
  let solved = 0;
  let total = 0;
  for (const slug of c.available) {
    const n = lessonCounts(lessonKey(c, slug), s.solved);
    solved += n.solved;
    total += n.total;
  }
  return { solved, total };
}

/** Quiz answers (indexes): experience 0 none / 1 a little / 2 yes; known 0 nothing / 1 HTML+CSS / 2 +JS / 3 +React; goal 0 products with AI / 1 frontend dev / 2 professional React + Next.js. */
export type QuizAnswers = { exp: number; known: number; goal: number };

/**
 * Deterministic rule:
 *  1. React known, or JS known and goal = professional React -> react-next.
 *  2. HTML/CSS or JS known and goal = frontend (or the pro goal with only HTML/CSS: tie goes to the lower level) -> frontend.
 *  3. Otherwise (goal = products, or no experience) -> vibe-coding.
 * Programming experience alone never moves the result: what you know decides, the goal only chooses between neighbours.
 */
export function pickCourse({ known, goal }: QuizAnswers): CourseId {
  if (known === 3 || (known === 2 && goal === 2)) return 'react-next';
  if (known >= 1 && goal >= 1) return 'frontend';
  return 'vibe-coding';
}
