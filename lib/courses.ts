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
  base: '' | '/vibe-coding' | '/react-next';
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
    id: 'frontend', base: '', keyPrefix: '', dir: 'content/lessons',
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

/** Course of a locale-prefixed pathname (`/ru/vibe-coding/...`). */
export const courseFromPath = (pathname: string): Course => {
  const seg = pathname.split('/')[2];
  return Object.values(COURSES).find((c) => c.base && c.base === `/${seg}`) ?? COURSES.frontend;
};

/** Progress key of a lesson: the plain slug for the old course, `vc-<slug>` / `rn-<slug>` for the others. */
export const lessonKey = (c: Course, slug: string) => c.keyPrefix + slug;
export const courseHome = (c: Course, locale: Locale) => `/${toUrlLocale(locale)}${c.base}`;
export const lessonHref = (c: Course, locale: Locale, slug: string) => `${courseHome(c, locale)}/lessons/${slug}`;
export const availableEntries = (c: Course) => c.entries.filter((e) => c.available.includes(e.slug));

const PREFIXES = ['vc-', 'rn-'];
/** Does a progress key (`<lessonKey>` or `<lessonKey>:<taskId>`) belong to this course? */
export const ownsKey = (c: Course, key: string) =>
  c.keyPrefix ? key.startsWith(c.keyPrefix) : !PREFIXES.some((p) => key.startsWith(p));
export const otherCourses = (c: Course) => Object.values(COURSES).filter((o) => o.id !== c.id);
