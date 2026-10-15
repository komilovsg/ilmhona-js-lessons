import type { Locale } from '@/lib/i18n';

export type L10n = Record<Locale, string>;

export type PagerLink = { slug: string; text: L10n; kicker?: L10n };

export type Lesson = {
  slug: string;
  num: number;
  title: L10n;
  /** Title as shown in the pager of the previous lesson (when it differs from `title`). */
  pagerTitle?: L10n;
  /** Source fragment in content/lessons/<locale>/. */
  file: string;
  /** Pager links exactly as they were in the static pages. */
  pager: { prev?: PagerLink; next?: PagerLink };
};

export const lessons: Lesson[] = [
  {
    slug: 'functions',
    num: 1,
    title: { ru: 'Функции', tg: 'Функсияҳо' },
    file: '01-functions.html',
    pager: { next: { slug: 'arrays', text: { ru: 'Массивы и их методы', tg: 'Массивҳо ва методҳои онҳо' } } },
  },
  {
    slug: 'arrays',
    num: 2,
    title: { ru: 'Массивы', tg: 'Массивҳо' },
    pagerTitle: { ru: 'Массивы и их методы', tg: 'Массивҳо ва методҳои онҳо' },
    file: '02-arrays.html',
    pager: {
      prev: { slug: 'functions', text: { ru: 'Функции', tg: 'Функсияҳо' } },
      next: { slug: 'objects', text: { ru: 'Объекты', tg: 'Объектҳо' } },
    },
  },
  {
    slug: 'objects',
    num: 3,
    title: { ru: 'Объекты', tg: 'Объектҳо' },
    file: '03-objects.html',
    pager: {
      prev: { slug: 'arrays', text: { ru: 'Массивы и методы', tg: 'Массивҳо ва методҳо' } },
      next: {
        slug: 'functions',
        text: { ru: 'К началу блока', tg: 'Ба оғози блок' },
        kicker: { ru: 'Повторить блок →', tg: 'Такрори блок →' },
      },
    },
  },
];

export const getLesson = (slug: string) => lessons.find((l) => l.slug === slug);
