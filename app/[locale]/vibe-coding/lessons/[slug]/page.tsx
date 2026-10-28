import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LessonBody from '@/components/LessonBody';
import JsonLd from '@/components/JsonLd';
import { COURSES, courseHome, lessonHref } from '@/lib/courses';
import { fmt, fromUrlLocale, urlLocales } from '@/lib/i18n';
import { SITE_NAME, absUrl, buildMeta, clip, lessonTitle, pagePath } from '@/lib/site';
import { availableLessons, getLesson } from '@/lib/lessons.server';

const c = COURSES['vibe-coding'];

export const dynamicParams = false;

export function generateStaticParams() {
  return urlLocales.flatMap((locale) => availableLessons(c).map((l) => ({ locale, slug: l.slug })));
}

type Params = Promise<{ locale: string; slug: string }>;

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { locale: seg, slug } = await params;
  const locale = fromUrlLocale(seg);
  const lesson = getLesson(slug, c);
  if (!lesson || !locale) return {};
  const T = c.texts![locale];
  return buildMeta({
    locale,
    sub: `${c.base}/lessons/${slug}`,
    title: lessonTitle(locale, lesson),
    description: clip(`${fmt(T.lessonDesc, { num: lesson.num })}: ${lesson.topics[locale].replace(/\.$/, '')}`, 200),
    type: 'article',
  });
}

export default async function LessonPage({ params }: { params: Params }) {
  const { locale: seg, slug } = await params;
  const locale = fromUrlLocale(seg);
  const lesson = getLesson(slug, c);
  if (!lesson || !locale) notFound();
  const T = c.texts![locale];
  const lang = locale === 'ru' ? 'ru' : 'tg';
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'LearningResource',
    name: lessonTitle(locale, lesson),
    description: clip(`${fmt(T.lessonDesc, { num: lesson.num })}: ${lesson.topics[locale].replace(/\.$/, '')}`, 200),
    url: absUrl(lessonHref(c, locale, lesson.slug)),
    position: lesson.num,
    inLanguage: lang,
    educationalLevel: 'Beginner',
    learningResourceType: 'lesson',
    isAccessibleForFree: true,
    teaches: lesson.topics[locale],
    isPartOf: {
      '@type': 'Course',
      name: `${SITE_NAME}: ${T.name}`,
      url: absUrl(courseHome(c, locale)),
      provider: { '@type': 'Organization', name: SITE_NAME, url: absUrl(pagePath('ru')) },
    },
  };
  return (
    <>
      <JsonLd data={ld} />
      <LessonBody lesson={lesson} locale={locale} courseId="vibe-coding" />
    </>
  );
}
