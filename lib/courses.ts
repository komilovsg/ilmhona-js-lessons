import * as fe from '@/content/course';
import * as vc from '@/content/vibe-coding/course';
import * as rn from '@/content/react-next/course';
import type { CourseEntry, CourseModule, L10n } from '@/content/course';
import { AVAILABLE, LESSON_META, VC_AVAILABLE, VC_LESSON_META, RN_AVAILABLE, RN_LESSON_META, type LessonMeta } from './lesson-meta.generated';
import { toUrlLocale, type Locale } from './i18n';

export type CourseId = 'frontend' | 'vibe-coding' | 'react-next';

/** One course: URL base, progress-key prefix, fragment dir and registry data. Client and server safe (no fs). */
export type Course = {
  id: CourseId;
  /** Roadmap URL segment. Lesson URLs of the old course stay `/lessons/<slug>` (see `lessonHref`). */
  base: '/frontend-ai' | '/vibe-coding' | '/react-next';
  keyPrefix: '' | 'vc-' | 'rn-';
  dir: string;
  entries: CourseEntry[];
  modules: CourseModule[];
  destination: { title: L10n };
  available: readonly string[];
  meta: LessonMeta;
  /** Course whose roadmap continues this one (the finish card links to it). */
  next?: CourseId;
  texts?: typeof vc.texts;
};

export const COURSES: Record<CourseId, Course> = {
  frontend: {
    id: 'frontend', base: '/frontend-ai', keyPrefix: '', dir: 'content/lessons',
    entries: fe.course, modules: fe.modules, destination: fe.destination, available: AVAILABLE, meta: LESSON_META, next: 'react-next',
  },
  'vibe-coding': {
    id: 'vibe-coding', base: '/vibe-coding', keyPrefix: 'vc-', dir: 'content/vibe-coding/lessons',
    entries: vc.course, modules: vc.modules, destination: vc.destination, available: VC_AVAILABLE, meta: VC_LESSON_META, texts: vc.texts,
  },
  'react-next': {
    id: 'react-next', base: '/react-next', keyPrefix: 'rn-', dir: 'content/react-next/lessons',
    entries: rn.course, modules: rn.modules, destination: rn.destination, available: RN_AVAILABLE, meta: RN_LESSON_META, texts: rn.texts,
  },
};

/** Task levels of every course, by progress key. */
export const ALL_META: LessonMeta = { ...LESSON_META, ...VC_LESSON_META, ...RN_LESSON_META };

/** Course of a locale-prefixed pathname (`/ru/vibe-coding/...`); `/lessons/*` and `/frontend-ai` are the old course. */
export const courseFromPath = (pathname: string): Course => {
  const seg = pathname.split('/')[2];
  return Object.values(COURSES).find((c) => c.base === `/${seg}`) ?? COURSES.frontend;
};

/** The course board (`/ru`, `/tj`): there is no current course on it. */
export const isBoardPath = (pathname: string) => /^\/[a-z]{2}\/?$/.test(pathname);
export const boardHome = (locale: Locale) => `/${toUrlLocale(locale)}`;

/** Progress key of a lesson: the plain slug for the old course, `vc-<slug>` / `rn-<slug>` for the others. */
export const lessonKey = (c: Course, slug: string) => c.keyPrefix + slug;
/** Roadmap URL of a course. */
export const courseHome = (c: Course, locale: Locale) => `/${toUrlLocale(locale)}${c.base}`;
/** Lesson URL: the old course keeps `/lessons/<slug>` (progress links, SEO, shared links); the others live under their base. */
export const lessonHref = (c: Course, locale: Locale, slug: string) =>
  `/${toUrlLocale(locale)}${c.id === 'frontend' ? '' : c.base}/lessons/${slug}`;
export const availableEntries = (c: Course) => c.entries.filter((e) => c.available.includes(e.slug));

const PREFIXES = ['vc-', 'rn-'];
/** Does a progress key (`<lessonKey>` or `<lessonKey>:<taskId>`) belong to this course? */
export const ownsKey = (c: Course, key: string) =>
  c.keyPrefix ? key.startsWith(c.keyPrefix) : !PREFIXES.some((p) => key.startsWith(p));
export const otherCourses = (c: Course) => Object.values(COURSES).filter((o) => o.id !== c.id);

/** Ladder order of the board: from zero up. */
export const LADDER: CourseId[] = ['vibe-coding', 'frontend', 'react-next'];
