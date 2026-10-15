import Link from 'next/link';
import type { Lesson } from '@/content/lessons';
import { getMessages, type Locale } from '@/lib/i18n';

export default function Pager({ lesson, locale }: { lesson: Lesson; locale: Locale }) {
  const { prev, next } = lesson.pager;
  const t = getMessages(locale);
  return (
    <nav className="pager">
      {prev && (
        <Link className="prev" href={`/${locale}/lessons/${prev.slug}`}>
          <span>{prev.kicker?.[locale] ?? t.pager.prev}</span>
          {prev.text[locale]}
        </Link>
      )}
      {next && (
        <Link className="next" href={`/${locale}/lessons/${next.slug}`}>
          <span>{next.kicker?.[locale] ?? t.pager.next}</span>
          {next.text[locale]}
        </Link>
      )}
    </nav>
  );
}
