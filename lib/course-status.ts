import { course, isAvailable, type CourseEntry } from '@/content/course';
import { LESSON_META } from './lesson-meta';

export type CourseStatus = 'done' | 'progress' | 'available' | 'soon';
export type CourseItem = CourseEntry & { status: CourseStatus; solved: number; total: number };

type SolvedMap = Record<string, unknown>;

/** Solved/total task counts of one lesson (keys are `${slug}:${taskId}`). */
export function lessonCounts(slug: string, solvedMap: SolvedMap): { solved: number; total: number } {
  const ids = Object.keys(LESSON_META[slug] ?? {});
  return { solved: ids.filter((id) => solvedMap[`${slug}:${id}`]).length, total: ids.length };
}

export function courseItem(c: CourseEntry, solvedMap: SolvedMap): CourseItem {
  const avail = isAvailable(c);
  const { solved, total } = avail ? lessonCounts(c.slug, solvedMap) : { solved: 0, total: 0 };
  const status: CourseStatus = !avail ? 'soon' : total > 0 && solved === total ? 'done' : solved > 0 ? 'progress' : 'available';
  return { ...c, status, solved, total };
}

export const courseItems = (solvedMap: SolvedMap): CourseItem[] => course.map((c) => courseItem(c, solvedMap));
