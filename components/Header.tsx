'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { lessons } from '@/content/lessons';
import { useProgress } from '@/lib/progress';
import HeaderExtras from './HeaderExtras';
import { useT } from './I18nProvider';
import LanguageSwitcher from './LanguageSwitcher';

export default function Header({ taskIds }: { taskIds: Record<string, string[]> }) {
  const pathname = usePathname();
  const progress = useProgress();
  const { t, locale } = useT();
  const current = lessons.find((l) => pathname === `/${locale}/lessons/${l.slug}`);
  const ids = current ? (taskIds[current.slug] ?? []) : [];
  const solved = current ? ids.filter((id) => progress.solved[`${current.slug}:${id}`]).length : 0;
  const pct = ids.length ? (solved / ids.length) * 100 : 0;

  return (
    <header className="topbar">
      <Link className="brand" href={`/${locale}/lessons/functions`}>
        <span className="brand-mark">I</span>
        <span>
          Ilmhona <small>{t.header.brandSub}</small>
        </span>
      </Link>
      <nav className="lessons" aria-label={t.header.lessonsNav}>
        {lessons.map((l) => (
          <Link key={l.slug} href={`/${locale}/lessons/${l.slug}`} aria-current={l === current ? 'page' : undefined}>
            {`${l.num}. ${l.title[locale]}`}
          </Link>
        ))}
      </nav>
      <div className="progress">
        <span>
          {t.header.solved} <b data-solved>{solved}</b>/<b data-total>{ids.length}</b>
        </span>
        <div className="progress-bar">
          <i style={{ width: pct + '%' }} />
        </div>
      </div>
      <LanguageSwitcher />
      <HeaderExtras />
    </header>
  );
}
