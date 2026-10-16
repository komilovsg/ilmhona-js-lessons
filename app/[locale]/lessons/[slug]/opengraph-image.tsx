import { notFound } from 'next/navigation';
import { fromUrlLocale, urlLocales } from '@/lib/i18n';
import { availableLessons, getLesson } from '@/lib/lessons.server';
import { lessonOg, ogContentType, ogSize } from '@/lib/og';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = 'MakeFirstStep';

export function generateStaticParams() {
  return urlLocales.flatMap((locale) => availableLessons().map((l) => ({ locale, slug: l.slug })));
}

export default async function Image({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const { locale: seg, slug } = await params;
  const locale = fromUrlLocale(seg);
  const lesson = getLesson(slug);
  if (!locale || !lesson) notFound();
  return lessonOg(locale, lesson);
}
