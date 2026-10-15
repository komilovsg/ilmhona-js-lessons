// Source of truth for UI strings. `tg.ts` must satisfy the same shape.
export const ru = {
  meta: {
    siteTitle: 'Ilmhona',
    lessonTitle: 'Урок {num} · {title} — Ilmhona',
  },
  header: {
    brandSub: '· Frontend + ИИ',
    solved: 'Решено',
    lessonsNav: 'Уроки',
  },
  lang: {
    label: 'Язык',
    ru: 'RU',
    tg: 'TJ',
    ruName: 'Русский',
    tgName: 'Тоҷикӣ',
  },
  theme: {
    label: 'Тема оформления: {current}. Нажмите, чтобы сменить',
    system: 'авто',
    light: 'светлая',
    dark: 'тёмная',
  },
  toc: {
    title: 'Содержание',
  },
  pager: {
    prev: '← Предыдущий урок',
    next: 'Следующий урок →',
  },
  prompt: {
    copy: 'Копировать',
    copied: 'Скопировано ✓',
    copyFailed: 'Выделите и скопируйте',
  },
  lesson: {
    fallbackNotice: 'Перевод этого урока пока не готов — текст на русском языке.',
  },
} as const;

type Widen<T> = T extends string ? string : { -readonly [K in keyof T]: Widen<T[K]> };
/** Shape every locale dictionary must satisfy (derived from `ru`). */
export type Messages = Widen<typeof ru>;
