import { notFound } from 'next/navigation';
import { fromUrlLocale, urlLocales } from '@/lib/i18n';
import { homeOg, ogContentType, ogSize } from '@/lib/og';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = 'MakeFirstStep — Frontend + ИИ';

export function generateStaticParams() {
  return urlLocales.map((locale) => ({ locale }));
}

export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) notFound();
  return homeOg(locale);
}
