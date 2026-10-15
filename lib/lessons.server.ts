import fs from 'node:fs';
import path from 'node:path';
import { defaultLocale, type Locale } from '@/lib/i18n';

const dir = (locale: Locale) => path.join(process.cwd(), 'content', 'lessons', locale);

/** Reads the lesson fragment for `locale`, falling back to the default locale when it is missing. */
export function readFragment(file: string, locale: Locale): { html: string; isFallback: boolean } {
  const p = path.join(dir(locale), file);
  if (fs.existsSync(p)) return { html: fs.readFileSync(p, 'utf8'), isFallback: false };
  return { html: fs.readFileSync(path.join(dir(defaultLocale), file), 'utf8'), isFallback: locale !== defaultLocale };
}
