import fs from 'node:fs';
import path from 'node:path';
import { lessons } from '@/content/lessons';
import { defaultLocale, type Locale } from '@/lib/i18n';

const dir = (locale: Locale) => path.join(process.cwd(), 'content', 'lessons', locale);

/** Reads the lesson fragment for `locale`, falling back to the default locale when it is missing. */
export function readFragment(file: string, locale: Locale): { html: string; isFallback: boolean } {
  const p = path.join(dir(locale), file);
  if (fs.existsSync(p)) return { html: fs.readFileSync(p, 'utf8'), isFallback: false };
  return { html: fs.readFileSync(path.join(dir(defaultLocale), file), 'utf8'), isFallback: locale !== defaultLocale };
}

/** Task ids per lesson slug, read at build time (the header needs totals on every page). Same for every locale. */
export function getTaskIds(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const l of lessons) {
    const { html } = readFragment(l.file, defaultLocale);
    out[l.slug] = [...html.matchAll(/<article class="task"[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
  }
  return out;
}
