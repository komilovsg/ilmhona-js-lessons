import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Leaderboard from '@/components/Leaderboard';
import { getMessages, fromUrlLocale } from '@/lib/i18n';
import { SITE_NAME, buildMeta } from '@/lib/site';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) return {};
  return buildMeta({ locale, sub: '/leaderboard', title: getMessages(locale).leaderboard.metaTitle.replace(` — ${SITE_NAME}`, '') });
}

export default async function LeaderboardPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) notFound();
  return (
    <main className="lb-page">
      <Leaderboard />
    </main>
  );
}
