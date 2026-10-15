import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LessonBody from '@/components/LessonBody';
import { fmt, fromUrlLocale, getMessages, urlLocales } from '@/lib/i18n';
import { availableLessons, getLesson } from '@/lib/lessons.server';

export const dynamicParams = false;

export function generateStaticParams() {
  return urlLocales.flatMap((locale) => availableLessons().map((l) => ({ locale, slug: l.slug })));
}

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: seg, slug } = await params;
  const locale = fromUrlLocale(seg);
  const lesson = getLesson(slug);
  if (!lesson || !locale) return {};
  return {
    title: fmt(getMessages(locale).meta.lessonTitle, { num: lesson.num, title: lesson.title[locale] }),
  };
}

export default async function LessonPage({ params }: { params: Params }) {
  const { locale: seg, slug } = await params;
  const locale = fromUrlLocale(seg);
  const lesson = getLesson(slug);
  if (!lesson || !locale) notFound();
  return <LessonBody lesson={lesson} locale={locale} />;
}
