import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import HomeView from '@/components/home/HomeView';
import JsonLd from '@/components/JsonLd';
import { COURSES, LADDER, courseHome } from '@/lib/courses';
import { fromUrlLocale, getMessages } from '@/lib/i18n';
import { SITE_NAME, absUrl, buildMeta, courseName, pagePath } from '@/lib/site';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) return {};
  const m = getMessages(locale).home;
  const meta = buildMeta({ locale, title: m.metaTitle, description: m.metaDescription });
  // the full title is already branded: skip the " — MakeFirstStep" template
  return { ...meta, title: { absolute: m.metaTitle } };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) notFound();
  const m = getMessages(locale).home;
  const lang = locale === 'ru' ? 'ru' : 'tg';
  const provider = { '@type': 'Organization', '@id': absUrl('/#org'), name: SITE_NAME, url: absUrl(pagePath('ru')) };
  const listLd = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: m.metaTitle,
    itemListElement: LADDER.map((id, i) => {
      const c = COURSES[id];
      const name = c.texts?.[locale].name ?? courseName[locale];
      return {
        '@type': 'ListItem',
        position: i + 1,
        item: {
          '@type': 'Course',
          name: `${SITE_NAME}: ${name}`,
          url: absUrl(courseHome(c, locale)),
          inLanguage: lang,
          provider,
          isAccessibleForFree: true,
          numberOfLessons: c.entries.length,
        },
      };
    }),
  };
  const siteLd = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': absUrl('/#website'),
    name: SITE_NAME,
    url: absUrl(pagePath(locale)),
    description: m.metaDescription,
    inLanguage: ['ru', 'tg'],
    publisher: provider,
  };
  return (
    <>
      <JsonLd data={listLd} />
      <JsonLd data={siteLd} />
      <HomeView />
    </>
  );
}
