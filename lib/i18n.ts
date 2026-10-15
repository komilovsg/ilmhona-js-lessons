import { type Messages } from '@/messages/ru';
import { ru } from '@/messages/ru';
import { tg } from '@/messages/tg';

export const locales = ['ru', 'tg'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ru';
export const LOCALE_COOKIE = 'NEXT_LOCALE';

export const isLocale = (v: string | undefined | null): v is Locale => !!v && (locales as readonly string[]).includes(v);

/** URL segment <-> internal locale. Only the URL says 'tj'; everything internal stays 'tg'. */
export const urlLocales = ['ru', 'tj'] as const;
const toUrl: Record<Locale, string> = { ru: 'ru', tg: 'tj' };
export const toUrlLocale = (l: Locale): string => toUrl[l];
export const fromUrlLocale = (seg: string | undefined | null): Locale | null =>
  seg === 'ru' ? 'ru' : seg === 'tj' ? 'tg' : null;

const dictionaries: Record<Locale, Messages> = { ru, tg };

export const getMessages = (locale: Locale): Messages => dictionaries[locale];

/** Replace `{name}` placeholders in a dictionary string. */
export const fmt = (s: string, vars: Record<string, string | number>) =>
  s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ''));
