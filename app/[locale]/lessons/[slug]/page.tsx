import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LessonBody from '@/components/LessonBody';
import { fmt, getMessages, isLocale, locales } from '@/lib/i18n';
import { availableLessons, getLesson } from '@/lib/lessons.server';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.flatMap((locale) => availableLessons().map((l) => ({ locale, slug: l.slug })));
}

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale, slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson || !isLocale(locale)) return {};
  return {
    title: fmt(getMessages(locale).meta.lessonTitle, { num: lesson.num, title: lesson.title[locale] }),
  };
}

export default async function LessonPage({ params }: { params: Params }) {
  const { locale, slug } = await params;
  const lesson = getLesson(slug);
  if (!lesson || !isLocale(locale)) notFound();
  return <LessonBody lesson={lesson} locale={locale} />;
}
