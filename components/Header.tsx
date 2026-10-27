'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { lessonCounts } from '@/lib/course-status';
import { availableEntries, boardHome, courseFromPath, courseHome, isBoardPath, lessonHref, lessonKey } from '@/lib/courses';
import { useProgress } from '@/lib/progress';
import AccountMenu from './AccountMenu';
import { useT } from './I18nProvider';
import Logo from './Logo';
import LessonSwitcher from './LessonSwitcher';
import XpBadge from './XpBadge';

export default function Header() {
  const pathname = usePathname();
  const progress = useProgress();
  const { t, locale } = useT();
  const c = courseFromPath(pathname);
  const home = courseHome(c, locale);
  const board = isBoardPath(pathname); // the course board has no current course
  const current = availableEntries(c).find((l) => pathname === lessonHref(c, locale, l.slug));
  const { solved, total } = current ? lessonCounts(lessonKey(c, current.slug), progress.solved) : { solved: 0, total: 0 };
  const pct = total ? (solved / total) * 100 : 0;

  return (
    <header className="topbar">
      <Link className="brand" href={boardHome(locale)} aria-label={`MakeFirstStep — ${t.home.nav}`} aria-current={board ? 'page' : undefined}>
        <Logo />
        <span className="brand-name">
          <span className="brand-word">
            <span>Make</span>
            <span>First</span>
            <span>Step</span>
          </span>
          {!board && <small>{c.texts?.[locale].brandSub ?? t.header.brandSub}</small>}
        </span>
      </Link>
      <nav className="topnav" aria-label={t.header.lessonsNav}>
        {!board && (
          <>
            <Link className="map-link" href={home} aria-current={pathname === home ? 'page' : undefined}>
              {t.roadmap.nav}
            </Link>
            <LessonSwitcher currentSlug={current?.slug ?? null} solved={solved} total={total} courseId={c.id} />
          </>
        )}
      </nav>
      <div className="topbar-end">
        {!board && <XpBadge key={c.id} courseId={c.id} />}
        <AccountMenu />
      </div>
      {current && total > 0 && (
        <div
          className="topbar-line"
          role="progressbar"
          aria-label={t.header.solved}
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={solved}
        >
          <i style={{ width: pct + '%' }} />
        </div>
      )}
    </header>
  );
}
