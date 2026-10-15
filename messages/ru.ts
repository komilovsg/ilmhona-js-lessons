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
  roadmap: {
    metaTitle: 'Карта курса — Ilmhona',
    nav: 'Карта курса',
    kicker: 'Курс · Frontend + ИИ',
    title: 'Карта курса',
    lead: '24 урока от первой функции до первого React-приложения. Выберите урок на карте — доступные открываются сразу, остальные можно изучить в программе заранее.',
    summaryLabel: 'Ваш прогресс',
    statDone: 'Пройдено',
    statProgress: 'В процессе',
    statXp: 'Опыт',
    of: '{n} из {total}',
    levelLine: 'Ур. {level} · {rank}',
    ctaStart: 'Начать: Урок {num} · {title}',
    ctaContinue: 'Продолжить: Урок {num} · {title}',
    ctaAllDone: 'Все доступные уроки пройдены. Новые уже скоро!',
    mapLabel: 'Уроки курса',
    here: 'Вы здесь',
    lessonLabel: 'Урок {num}',
    moduleLabel: 'Модуль {n}',
    range: 'Уроки {from}–{to}',
    statusDone: 'Пройден',
    statusProgress: 'В процессе · {n}/{m}',
    statusAvailable: 'Доступен',
    statusSoon: 'Скоро',
    kindProject: 'Мини-проект',
    kindFinal: 'Финальный проект',
    open: 'Открыть урок',
    more: 'Подробнее',
    moreSoon: 'О чём урок',
    topics: 'Темы',
    ai: 'ИИ-навык',
    classwork: 'Классная работа',
    homework: 'Домашнее задание',
    result: 'Результат',
    tbd: 'Программа этого урока уточняется.',
    finalKicker: 'Финиш',
    finalText: 'Здесь курс заканчивается — и начинается серьёзный разговор о профессии.',
  },
} as const;

type Widen<T> = T extends string ? string : { -readonly [K in keyof T]: Widen<T[K]> };
/** Shape every locale dictionary must satisfy (derived from `ru`). */
export type Messages = Widen<typeof ru>;
