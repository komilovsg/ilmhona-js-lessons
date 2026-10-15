import Link from 'next/link';
import type { CourseEntry } from '@/content/course';
import { getMessages, toUrlLocale, type Locale } from '@/lib/i18n';

export default function Pager({ prev, next, locale }: { prev?: CourseEntry; next?: CourseEntry; locale: Locale }) {
  const t = getMessages(locale);
  return (
    <nav className="pager">
      {prev && (
        <Link className="prev" href={`/${toUrlLocale(locale)}/lessons/${prev.slug}`}>
          <span>{t.pager.prev}</span>
          {prev.title[locale]}
        </Link>
      )}
      {next && (
        <Link className="next" href={`/${toUrlLocale(locale)}/lessons/${next.slug}`}>
          <span>{t.pager.next}</span>
          {next.title[locale]}
        </Link>
      )}
    </nav>
  );
}
