import { notFound, redirect } from 'next/navigation';
import { isLocale } from '@/lib/i18n';

// Temporary: a roadmap home page will replace this redirect.
export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  redirect(`/${locale}/lessons/functions`);
}
