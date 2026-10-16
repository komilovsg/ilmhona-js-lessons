import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import MentorAdmin from '@/components/MentorAdmin';
import { fromUrlLocale } from '@/lib/i18n';

// Owner-only mentor status. Not linked anywhere, not indexed (robots.ts disallows /*/admin/); the data comes from
// /api/mentor/status, which requires MENTOR_ADMIN_TOKEN. The page itself holds nothing secret.
export const metadata: Metadata = { title: 'Mentor status', robots: { index: false, follow: false } };

export default async function MentorAdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const locale = fromUrlLocale((await params).locale);
  if (!locale) notFound();
  return (
    <main className="lb-page adm">
      <MentorAdmin locale={locale} />
    </main>
  );
}
