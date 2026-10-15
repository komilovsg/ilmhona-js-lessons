import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import RoadmapView from '@/components/roadmap/RoadmapView';
import { getMessages, isLocale } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getMessages(locale).roadmap.metaTitle };
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return <RoadmapView />;
}
