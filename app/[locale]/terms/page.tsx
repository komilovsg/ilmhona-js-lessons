import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LegalPage from '@/components/LegalPage';
import { fromUrlLocale, urlLocales } from '@/lib/i18n';
import { legalDoc } from '@/lib/legal';
import { SITE_NAME, buildMeta } from '@/lib/site';

export function generateStaticParams() {
  return urlLocales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) return {};
  const d = legalDoc(locale, 'terms');
  return buildMeta({ locale, sub: '/terms', title: d.metaTitle.replace(` — ${SITE_NAME}`, ''), description: d.metaDescription });
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) notFound();
  return <LegalPage locale={locale} kind="terms" />;
}
