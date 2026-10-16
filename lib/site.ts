import type { Metadata } from 'next';
import type { CourseEntry } from '@/content/course';
import { toUrlLocale, type Locale } from '@/lib/i18n';

/** The one place that knows the public origin. Change NEXT_PUBLIC_SITE_URL (or the fallback) when the domain moves. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://ilmhona-js-lessons.vercel.app').replace(/\/+$/, '');
export const SITE_NAME = 'MakeFirstStep';

/** Absolute URL for a path like `/ru/lessons/loops` (no locale logic). */
export const absUrl = (path: string) => `${SITE_URL}${path}`;
/** Locale-prefixed path: `pagePath('tg', '/lessons/loops')` -> `/tj/lessons/loops`; `''` is the locale home. */
export const pagePath = (locale: Locale, sub = '') => `/${toUrlLocale(locale)}${sub}`;

const OG_LOCALE: Record<Locale, string> = { ru: 'ru_RU', tg: 'tg_TJ' };

export const courseName: Record<Locale, string> = { ru: 'Frontend + ИИ', tg: 'Frontend + зеҳни сунъӣ' };

export const siteTexts = {
  ru: {
    homeTitle: 'Курс «Frontend + ИИ»: JavaScript с нуля',
    description:
      'Бесплатный курс «Frontend + ИИ»: JavaScript с нуля и ИИ для быстрой разработки. 24 урока, редактор кода в браузере, автопроверка задач, XP и ментор-бот.',
    tagline: 'JavaScript с нуля и ИИ для ускорения разработки · 24 урока',
    keywords: ['JavaScript', 'курс JavaScript', 'frontend', 'обучение программированию', 'ИИ в разработке', 'React', 'MakeFirstStep', 'JavaScript с нуля'],
    lesson: 'Урок',
    moduleWord: 'Модуль',
    lessonsWord: 'уроков',
    lessonDesc: (num: number, topics: string) => `Урок ${num} курса «Frontend + ИИ»: ${topics}`,
  },
  tg: {
    homeTitle: 'Курси «Frontend + зеҳни сунъӣ»: JavaScript аз сифр',
    description:
      'Курси ройгони «Frontend + зеҳни сунъӣ»: JavaScript аз сифр ва зеҳни сунъӣ барои тезонидани коркард. 24 дарс, муҳаррири код дар браузер, санҷиши худкори вазифаҳо, XP ва ментор-бот.',
    tagline: 'JavaScript аз сифр ва зеҳни сунъӣ барои тезонидани коркард · 24 дарс',
    keywords: ['JavaScript', 'курси JavaScript', 'frontend', 'омӯзиши барномасозӣ', 'зеҳни сунъӣ дар коркард', 'React', 'MakeFirstStep', 'JavaScript аз сифр'],
    lesson: 'Дарси',
    moduleWord: 'Модули',
    lessonsWord: 'дарс',
    lessonDesc: (num: number, topics: string) => `Дарси ${num}-уми курси «Frontend + зеҳни сунъӣ»: ${topics}`,
  },
} as const;

export const lessonTitle = (locale: Locale, c: CourseEntry) => `${siteTexts[locale].lesson} ${c.num} · ${c.title[locale]}`;

const clip = (s: string, n: number) => (s.length <= n ? s : `${s.slice(0, n - 1).replace(/[\s,;:.]+\S*$/, '')}…`);

export const lessonDescription = (locale: Locale, c: CourseEntry) =>
  clip(siteTexts[locale].lessonDesc(c.num, c.topics[locale].replace(/\.$/, '')), 200);

/** canonical + hreflang (ru, tg -> /tj, x-default -> ru) for a locale-less sub path. */
export const alternatesFor = (locale: Locale, sub = ''): Metadata['alternates'] => ({
  canonical: pagePath(locale, sub),
  languages: { ru: pagePath('ru', sub), tg: pagePath('tg', sub), 'x-default': pagePath('ru', sub) },
});

/**
 * Per-page metadata. `title` is the short title (the root template adds " — MakeFirstStep").
 * openGraph/twitter are replaced wholesale by a child segment, so every field is repeated here;
 * the images come from the opengraph-image / twitter-image files of the segment.
 */
export function buildMeta(o: {
  locale: Locale;
  sub?: string;
  title: string;
  description?: string;
  type?: 'website' | 'article';
}): Metadata {
  const { locale, sub = '', title } = o;
  const description = o.description ?? siteTexts[locale].description;
  const other: Locale = locale === 'ru' ? 'tg' : 'ru';
  const full = `${title} — ${SITE_NAME}`;
  return {
    title,
    description,
    alternates: alternatesFor(locale, sub),
    openGraph: {
      type: o.type ?? 'website',
      siteName: SITE_NAME,
      title: full,
      description,
      url: pagePath(locale, sub),
      locale: OG_LOCALE[locale],
      alternateLocale: [OG_LOCALE[other]],
    },
    twitter: { card: 'summary_large_image', title: full, description },
  };
}
