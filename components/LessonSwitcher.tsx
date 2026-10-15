'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react';
import { course, modules } from '@/content/course';
import { courseItems, type CourseItem, type CourseStatus } from '@/lib/course-status';
import { fmt, toUrlLocale } from '@/lib/i18n';
import { useProgress } from '@/lib/progress';
import { useT } from './I18nProvider';
import { CheckIcon, DotIcon, LockIcon } from './roadmap/icons';

const STATUS_ICON: Record<CourseStatus, React.ReactNode> = {
  done: <CheckIcon />,
  progress: <DotIcon />,
  available: <DotIcon />,
  soon: <LockIcon />,
};

export default function LessonSwitcher({
  currentSlug,
  solved,
  total,
}: {
  currentSlug: string | null;
  solved: number;
  total: number;
}) {
  const { t, locale } = useT();
  const progress = useProgress();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const items = useMemo(() => courseItems(progress.solved), [progress]);
  const lesson = currentSlug ? course.find((l) => l.slug === currentSlug) : undefined;

  const close = useCallback(() => setOpen(false), []);

  // Close when the route changes (the link inside was followed).
  const [seenSlug, setSeenSlug] = useState(currentSlug);
  if (seenSlug !== currentSlug) {
    setSeenSlug(currentSlug);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const cur = panel.current?.querySelector<HTMLElement>('[aria-current="page"]');
    if (cur && panel.current) {
      const p = panel.current;
      p.scrollTop = Math.max(0, cur.offsetTop - p.clientHeight / 2 + cur.offsetHeight / 2);
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  const statusLabel = (i: CourseItem) =>
    i.status === 'done'
      ? t.roadmap.statusDone
      : i.status === 'progress'
        ? fmt(t.roadmap.statusProgress, { n: i.solved, m: i.total })
        : i.status === 'available'
          ? t.roadmap.statusAvailable
          : t.roadmap.statusSoon;

  const label = lesson ? fmt(t.nav.lesson, { num: lesson.num }) : t.nav.lessons;

  return (
    <div
      className="lsw"
      ref={wrap}
      onBlur={(e) => {
        if (open && e.relatedTarget && !wrap.current?.contains(e.relatedTarget as Node)) setOpen(false);
      }}
    >
      <button
        ref={btn}
        type="button"
        className="lsw-btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={lesson ? `${t.nav.pickLesson}: ${label} · ${lesson.title[locale]}` : t.nav.pickLesson}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="lsw-label">{label}</span>
        {lesson && <span className="lsw-title"> · {lesson.title[locale]}</span>}
        {lesson && total > 0 && (
          <span className="lsw-count" aria-hidden="true">
            {solved}/{total}
          </span>
        )}
        <svg className="lsw-caret" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>
      {open && (
        <div ref={panel} id={panelId} className="lsw-panel" role="region" aria-label={t.nav.pickLesson}>
          {modules.map((m) => (
            <section key={m.id} aria-labelledby={`${panelId}-m${m.id}`}>
              <h2 className="lsw-mod" id={`${panelId}-m${m.id}`}>
                {fmt(t.roadmap.moduleLabel, { n: m.id })} · {m.title[locale]}
              </h2>
              <ul className="lsw-list">
                {items
                  .filter((i) => i.module === m.id)
                  .map((i) => {
                    const here = !!i.slug && i.slug === currentSlug;
                    const body = (
                      <>
                        <span className="lsw-num">{i.num}</span>
                        <span className="lsw-row-main">
                          <span className="lsw-row-title">{i.title[locale]}</span>
                          <span className={`lsw-st lsw-st-${i.status}`}>
                            {STATUS_ICON[i.status]}
                            {statusLabel(i)}
                          </span>
                        </span>
                      </>
                    );
                    return (
                      <li key={i.num}>
                        {i.status === 'soon' ? (
                          <span className="lsw-row is-soon" aria-disabled="true">
                            {body}
                          </span>
                        ) : (
                          <Link
                            className={`lsw-row${here ? ' is-current' : ''}`}
                            href={`/${toUrlLocale(locale)}/lessons/${i.slug}`}
                            aria-current={here ? 'page' : undefined}
                            onClick={close}
                          >
                            {body}
                          </Link>
                        )}
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
