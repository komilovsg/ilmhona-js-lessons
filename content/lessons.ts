export type PagerLink = { slug: string; text: string; kicker?: string };

export type Lesson = {
  slug: string;
  num: number;
  title: string;
  /** Title as shown in the pager of the previous lesson (when it differs from `title`). */
  pagerTitle?: string;
  /** Source fragment in content/lessons/. */
  file: string;
  /** Pager links exactly as they were in the static pages. */
  pager: { prev?: PagerLink; next?: PagerLink };
};

export const lessons: Lesson[] = [
  {
    slug: 'functions',
    num: 1,
    title: 'Функции',
    file: '01-functions.html',
    pager: { next: { slug: 'arrays', text: 'Массивы и их методы' } },
  },
  {
    slug: 'arrays',
    num: 2,
    title: 'Массивы',
    pagerTitle: 'Массивы и их методы',
    file: '02-arrays.html',
    pager: {
      prev: { slug: 'functions', text: 'Функции' },
      next: { slug: 'objects', text: 'Объекты' },
    },
  },
  {
    slug: 'objects',
    num: 3,
    title: 'Объекты',
    file: '03-objects.html',
    pager: {
      prev: { slug: 'arrays', text: 'Массивы и методы' },
      next: { slug: 'functions', text: 'К началу блока', kicker: 'Повторить блок →' },
    },
  },
];

export const getLesson = (slug: string) => lessons.find((l) => l.slug === slug);
