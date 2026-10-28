import fs from 'node:fs';
import path from 'node:path';
import { lessonFile, type CourseEntry } from '@/content/course';
import { COURSES, type Course } from '@/lib/courses';
import { defaultLocale, type Locale } from '@/lib/i18n';

const dir = (c: Course, locale: Locale) => path.join(process.cwd(), c.dir, locale);

/** A course entry is a lesson page iff <course dir>/ru/NN-slug.html exists. */
const hasFragment = (c: Course) => (e: CourseEntry) => fs.existsSync(path.join(dir(c, defaultLocale), lessonFile(e)));

/** Available lessons in course order. */
export const availableLessons = (c: Course = COURSES.frontend): CourseEntry[] => c.entries.filter(hasFragment(c));

export const getLesson = (slug: string, c: Course = COURSES.frontend): CourseEntry | undefined =>
  availableLessons(c).find((e) => e.slug === slug);

/** Previous and next available lessons (course order). */
export function neighbours(slug: string, c: Course = COURSES.frontend): { prev?: CourseEntry; next?: CourseEntry } {
  const list = availableLessons(c);
  const i = list.findIndex((e) => e.slug === slug);
  return { prev: list[i - 1], next: list[i + 1] };
}

/** Reads the lesson fragment for `locale`, falling back to the default locale when it is missing. */
export function readFragment(lesson: CourseEntry, locale: Locale, c: Course = COURSES.frontend): { html: string; isFallback: boolean } {
  const file = lessonFile(lesson);
  const p = path.join(dir(c, locale), file);
  if (fs.existsSync(p)) return { html: fs.readFileSync(p, 'utf8'), isFallback: false };
  return { html: fs.readFileSync(path.join(dir(c, defaultLocale), file), 'utf8'), isFallback: locale !== defaultLocale };
}

/** Course and lesson of a progress key (`<slug>` or `vc-<slug>`). */
export function lessonByKey(key: string): { course: Course; lesson: CourseEntry } | undefined {
  const course = Object.values(COURSES).find((c) => c.keyPrefix && key.startsWith(c.keyPrefix)) ?? COURSES.frontend;
  const lesson = getLesson(key.slice(course.keyPrefix.length), course);
  return lesson ? { course, lesson } : undefined;
}
