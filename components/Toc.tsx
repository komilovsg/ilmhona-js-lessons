'use client';

import { useEffect, useState } from 'react';
import { lessonCounts } from '@/lib/course-status';
import { useProgress } from '@/lib/progress';
import { useT } from './I18nProvider';

export type TocItem = { id: string; label: string; taskIds: string[] };

export default function Toc({ items, lessonSlug }: { items: TocItem[]; lessonSlug: string }) {
  const progress = useProgress();
  const { t } = useT();
  const { solved, total } = lessonCounts(lessonSlug, progress.solved);
  const [active, setActive] = useState<string | null>(null);

  useEffect(() => {
    const els = items.map((i) => document.getElementById(i.id)).filter((e): e is HTMLElement => !!e);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) setActive(en.target.id);
        });
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    els.forEach((e) => io.observe(e));
    return () => io.disconnect();
  }, [items]);

  return (
    <>
      {total > 0 && (
        <div className="toc-stat">
          <div className="toc-stat-row">
            <span>{t.header.solved}</span>
            <b>
              {solved}/{total}
            </b>
          </div>
          <div className="toc-stat-bar" role="presentation">
            <i style={{ width: (solved / total) * 100 + '%' }} />
          </div>
        </div>
      )}
      <p>{t.toc.title}</p>
      <ol>
        {items.map((it) => {
          const n = it.taskIds.filter((t) => progress.solved[`${lessonSlug}:${t}`]).length;
          return (
            <li key={it.id}>
              <a href={'#' + it.id} className={active === it.id ? 'active' : undefined}>
                {it.label}
                <span className="toc-count">{it.taskIds.length ? ` · ${n}/${it.taskIds.length}` : ''}</span>
              </a>
            </li>
          );
        })}
      </ol>
    </>
  );
}
