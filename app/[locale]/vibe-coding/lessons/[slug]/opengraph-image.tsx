import { notFound } from 'next/navigation';
import { COURSES } from '@/lib/courses';
import { fromUrlLocale, urlLocales } from '@/lib/i18n';
import { availableLessons, getLesson } from '@/lib/lessons.server';
import { lessonOg, ogContentType, ogSize } from '@/lib/og';

const c = COURSES['vibe-coding'];

export const size = ogSize;
export const contentType = ogContentType;
export const alt = 'MakeFirstStep — Vibe Coding';

export function generateStaticParams() {
  return urlLocales.flatMap((locale) => availableLessons(c).map((l) => ({ locale, slug: l.slug })));
}

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: seg, slug } = await params;
  const locale = fromUrlLocale(seg);
  const lesson = getLesson(slug, c);
  if (!locale || !lesson) notFound();
  return lessonOg(locale, lesson, 'vibe-coding');
}
