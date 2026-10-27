// tg: review by a native speaker pending
// Board card copy of the three courses (the home page). Names come from each course's `texts`
// (the old course: lib/site `courseName`); level badges are `messages.home.levels`.
import type { L10n } from '@/content/course';

export type BoardCourseText = { forWhom: L10n; outcome: L10n; weeks: number };

const l = (ru: string, tg: string): L10n => ({ ru, tg });

/** Ladder order: Vibe Coding -> Frontend + ИИ -> React Pro + Next.js. */
export const boardTexts: Record<'vibe-coding' | 'frontend' | 'react-next', BoardCourseText> = {
  'vibe-coding': {
    forWhom: l(
      'Для тех, кто никогда не программировал и хочет собирать продукты с ИИ',
      'Барои онҳое, ки ҳеҷ гоҳ барномасозӣ накардаанд ва мехоҳанд бо зеҳни сунъӣ маҳсулот созанд',
    ),
    outcome: l(
      'Свой веб-продукт в продакшене: база данных, вход и AI-функции',
      'Маҳсулоти веби худӣ дар истеҳсолот: пойгоҳи дода, воридшавӣ ва функсияҳои AI',
    ),
    weeks: 8,
  },
  frontend: {
    forWhom: l(
      'Для тех, кто знает основы и хочет стать фронтенд-разработчиком',
      'Барои онҳое, ки асосҳоро медонанд ва мехоҳанд фронтенд-коркунанда шаванд',
    ),
    outcome: l(
      'Уверенный JavaScript, первое React-приложение и ИИ в ежедневной работе',
      'JavaScript-и боэътимод, аввалин барномаи React ва зеҳни сунъӣ дар кори ҳаррӯза',
    ),
    weeks: 8,
  },
  'react-next': {
    forWhom: l(
      'Для тех, кто уверенно пишет на JavaScript и идёт в профессиональный React',
      'Барои онҳое, ки бо JavaScript боэътимод менависанд ва ба React-и касбӣ мераванд',
    ),
    outcome: l(
      'Production-приложение на React и Next.js: данные, сервер, деплой',
      'Барномаи истеҳсолӣ бо React ва Next.js: додаҳо, сервер, ҷойгиркунӣ',
    ),
    weeks: 8,
  },
};
