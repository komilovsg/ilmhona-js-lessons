import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Leaderboard from '@/components/Leaderboard';
import { getMessages, isLocale } from '@/lib/i18n';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  return { title: getMessages(locale).leaderboard.metaTitle };
}

export default async function LeaderboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main className="lb-page">
      <Leaderboard />
    </main>
  );
}
