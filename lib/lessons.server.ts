import fs from 'node:fs';
import path from 'node:path';
import { course, lessonFile, type CourseEntry } from '@/content/course';
import { defaultLocale, type Locale } from '@/lib/i18n';

const dir = (locale: Locale) => path.join(process.cwd(), 'content', 'lessons', locale);

/** A course entry is a lesson page iff content/lessons/ru/NN-slug.html exists. */
const hasFragment = (c: CourseEntry) => fs.existsSync(path.join(dir(defaultLocale), lessonFile(c)));

/** Available lessons in course order. */
export const availableLessons = (): CourseEntry[] => course.filter(hasFragment);

export const getLesson = (slug: string): CourseEntry | undefined => availableLessons().find((c) => c.slug === slug);

/** Previous and next available lessons (course order). */
export function neighbours(slug: string): { prev?: CourseEntry; next?: CourseEntry } {
  const list = availableLessons();
  const i = list.findIndex((c) => c.slug === slug);
  return { prev: list[i - 1], next: list[i + 1] };
}

/** Reads the lesson fragment for `locale`, falling back to the default locale when it is missing. */
export function readFragment(lesson: CourseEntry, locale: Locale): { html: string; isFallback: boolean } {
  const file = lessonFile(lesson);
  const p = path.join(dir(locale), file);
  if (fs.existsSync(p)) return { html: fs.readFileSync(p, 'utf8'), isFallback: false };
  return { html: fs.readFileSync(path.join(dir(defaultLocale), file), 'utf8'), isFallback: locale !== defaultLocale };
}
