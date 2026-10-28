import { useMemo } from 'react';
import type { CourseEntry } from '@/content/course';
import { ALL_META, COURSES, lessonKey, ownsKey, type Course } from './courses';
import { useProgress, type ProgressState } from './progress';

export type CourseStatus = 'done' | 'progress' | 'available' | 'soon';
export type CourseItem = CourseEntry & { status: CourseStatus; solved: number; total: number };

type SolvedMap = Record<string, unknown>;

/** Solved/total task counts of one lesson (`key` is the progress key; solved keys are `${key}:${taskId}`). */
export function lessonCounts(key: string, solvedMap: SolvedMap): { solved: number; total: number } {
  const ids = Object.keys(ALL_META[key] ?? {});
  return { solved: ids.filter((id) => solvedMap[`${key}:${id}`]).length, total: ids.length };
}

export function courseItem(c: CourseEntry, solvedMap: SolvedMap, course: Course = COURSES.frontend): CourseItem {
  const avail = course.available.includes(c.slug);
  const { solved, total } = avail ? lessonCounts(lessonKey(course, c.slug), solvedMap) : { solved: 0, total: 0 };
  const status: CourseStatus = !avail ? 'soon' : total > 0 && solved === total ? 'done' : solved > 0 ? 'progress' : 'available';
  return { ...c, status, solved, total };
}

export const courseItems = (solvedMap: SolvedMap, c: Course = COURSES.frontend): CourseItem[] =>
  c.entries.map((e) => courseItem(e, solvedMap, c));

/** The shared progress store narrowed to one course (keys filtered by prefix). */
export function courseProgress(s: ProgressState, c: Course): ProgressState {
  const pick = <T,>(o: Record<string, T>) => Object.fromEntries(Object.entries(o).filter(([k]) => ownsKey(c, k)));
  return { ...s, solved: pick(s.solved), hintsOpened: pick(s.hintsOpened) };
}

export function useCourseProgress(c: Course): ProgressState {
  const s = useProgress();
  return useMemo(() => courseProgress(s, c), [s, c]);
}
