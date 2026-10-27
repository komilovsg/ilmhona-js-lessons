import Link from 'next/link';
import type { CourseEntry } from '@/content/course';
import { COURSES, lessonHref, type CourseId } from '@/lib/courses';
import { getMessages, type Locale } from '@/lib/i18n';

export default function Pager({
  prev,
  next,
  locale,
  courseId = 'frontend',
}: {
  prev?: CourseEntry;
  next?: CourseEntry;
  locale: Locale;
  courseId?: CourseId;
}) {
  const t = getMessages(locale);
  const c = COURSES[courseId];
  return (
    <nav className="pager">
      {prev && (
        <Link className="prev" href={lessonHref(c, locale, prev.slug)}>
          <span>{t.pager.prev}</span>
          {prev.title[locale]}
        </Link>
      )}
      {next && (
        <Link className="next" href={lessonHref(c, locale, next.slug)}>
          <span>{t.pager.next}</span>
          {next.title[locale]}
        </Link>
      )}
    </nav>
  );
}
