import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LessonBody from '@/components/LessonBody';
import JsonLd from '@/components/JsonLd';
import { fromUrlLocale, urlLocales } from '@/lib/i18n';
import { SITE_NAME, absUrl, buildMeta, courseName, lessonDescription, lessonTitle, pagePath } from '@/lib/site';
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
  return buildMeta({
    locale,
    sub: `/lessons/${slug}`,
    title: lessonTitle(locale, lesson),
    description: lessonDescription(locale, lesson),
    type: 'article',
  });
}

export default async function LessonPage({ params }: { params: Params }) {
  const { locale: seg, slug } = await params;
  const locale = fromUrlLocale(seg);
  const lesson = getLesson(slug);
  if (!lesson || !locale) notFound();
  const lang = locale === 'ru' ? 'ru' : 'tg';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: lessonTitle(locale, lesson),
    description: lessonDescription(locale, lesson),
    url: absUrl(pagePath(locale, `/lessons/${lesson.slug}`)),
    position: lesson.num,
    inLanguage: lang,
    educationalLevel: 'Beginner',
    learningResourceType: 'lesson',
    isAccessibleForFree: true,
    teaches: lesson.topics[locale],
    isPartOf: {
      '@type': 'Course',
      name: `${SITE_NAME}: ${courseName[locale]}`,
      url: absUrl(pagePath(locale)),
      provider: { '@type': 'Organization', name: SITE_NAME, url: absUrl(pagePath('ru')) },
    },
  };
  return (
    <>
      <JsonLd data={ld} />
      <LessonBody lesson={lesson} locale={locale} />
    </>
  );
}
