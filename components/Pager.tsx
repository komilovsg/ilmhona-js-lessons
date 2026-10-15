import Link from 'next/link';
import type { Lesson } from '@/content/lessons';

export default function Pager({ lesson }: { lesson: Lesson }) {
  const { prev, next } = lesson.pager;
  return (
    <nav className="pager">
      {prev && (
        <Link className="prev" href={`/lessons/${prev.slug}`}>
          <span>{prev.kicker ?? '← Предыдущий урок'}</span>
          {prev.text}
        </Link>
      )}
      {next && (
        <Link className="next" href={`/lessons/${next.slug}`}>
          <span>{next.kicker ?? 'Следующий урок →'}</span>
          {next.text}
        </Link>
      )}
    </nav>
  );
}
