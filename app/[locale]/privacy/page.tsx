import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import LegalPage from '@/components/LegalPage';
import { fromUrlLocale, urlLocales } from '@/lib/i18n';
import { legalDoc } from '@/lib/legal';

export function generateStaticParams() {
  return urlLocales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) return {};
  const d = legalDoc(locale, 'privacy');
  return { title: d.metaTitle, description: d.metaDescription, robots: { index: true, follow: true } };
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) notFound();
  return <LegalPage locale={locale} kind="privacy" />;
}
