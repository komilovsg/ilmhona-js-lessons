import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import JsonLd from '@/components/JsonLd';
import RoadmapView from '@/components/roadmap/RoadmapView';
import { availableCourse } from '@/content/course';
import { COURSES, courseHome } from '@/lib/courses';
import { fromUrlLocale } from '@/lib/i18n';
import { SITE_NAME, absUrl, buildMeta, courseName, pagePath, siteTexts } from '@/lib/site';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) return {};
  const title = siteTexts[locale].homeTitle;
  // the old home page had no " — MakeFirstStep" suffix in <title>: keep it
  return { ...buildMeta({ locale, sub: COURSES.frontend.base, title }), title: { absolute: title } };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) notFound();
  const t = siteTexts[locale];
  const lang = locale === 'ru' ? 'ru' : 'tg';
  const provider = { '@type': 'Organization', '@id': absUrl('/#org'), name: SITE_NAME, url: absUrl(pagePath('ru')) };
  const lessons = availableCourse();
  const courseLd = {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': absUrl(`${courseHome(COURSES.frontend, locale)}#course`),
    name: `${SITE_NAME}: ${courseName[locale]}`,
    description: t.description,
    url: absUrl(courseHome(COURSES.frontend, locale)),
    inLanguage: lang,
    provider,
    educationalLevel: 'Beginner',
    isAccessibleForFree: true,
    numberOfLessons: lessons.length,
    teaches: 'JavaScript',
    hasCourseInstance: { '@type': 'CourseInstance', courseMode: 'online', inLanguage: lang },
    hasPart: lessons.map((c) => ({
      '@type': 'LearningResource',
      name: c.title[locale],
      position: c.num,
      url: absUrl(pagePath(locale, `/lessons/${c.slug}`)),
    })),
  };
  return (
    <>
      <JsonLd data={courseLd} />
      <RoadmapView />
    </>
  );
}
