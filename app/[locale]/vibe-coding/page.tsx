import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import JsonLd from '@/components/JsonLd';
import RoadmapView from '@/components/roadmap/RoadmapView';
import { COURSES, courseHome, lessonHref } from '@/lib/courses';
import { fromUrlLocale } from '@/lib/i18n';
import { availableLessons } from '@/lib/lessons.server';
import { SITE_NAME, absUrl, buildMeta, pagePath } from '@/lib/site';

const c = COURSES['vibe-coding'];

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) return {};
  const T = c.texts![locale];
  return buildMeta({ locale, sub: c.base, title: T.homeTitle, description: T.description });
}

export default async function VibeCodingHome({ params }: { params: Promise<{ locale: string }> }) {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) notFound();
  const T = c.texts![locale];
  const lang = locale === 'ru' ? 'ru' : 'tg';
  const provider = { '@type': 'Organization', '@id': absUrl('/#org'), name: SITE_NAME, url: absUrl(pagePath('ru')) };
  const lessons = availableLessons(c);
  const courseLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': absUrl(`${courseHome(c, locale)}#course`),
    name: `${SITE_NAME}: ${T.name}`,
    description: T.description,
    url: absUrl(courseHome(c, locale)),
    inLanguage: lang,
    provider,
    educationalLevel: 'Beginner',
    isAccessibleForFree: true,
    numberOfLessons: lessons.length,
    teaches: 'Vibe Coding',
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', inLanguage: lang },
    hasPart: lessons.map((l) => ({
      '@type': 'LearningResource',
      name: l.title[locale],
      position: l.num,
      url: absUrl(lessonHref(c, locale, l.slug)),
    })),
  };
  return (
    <>
      <JsonLd data={courseLd} />
      <RoadmapView courseId="vibe-coding" />
    </>
  );
}
