'use client';

import Link from 'next/link';
import { fmt } from '@/lib/i18n';
import { continueTarget } from '@/lib/home';
import { useProgress } from '@/lib/progress';
import { courseName } from '@/lib/site';
import { useT } from '../I18nProvider';

/** Block 2: only with progress. The store's server snapshot is empty, so the card appears after hydration. */
export default function ContinueCard() {
  const { t, locale } = useT();
  const progress = useProgress();
  const target = continueTarget(progress, locale);
  if (!target) return null;
  const T = t.home.cont;
  const { course, entry, solved, total, href } = target;
  const name = course.texts?.[locale].name ?? courseName[locale];
  const pct = total ? Math.round((solved / total) * 100) : 0;
  return (
    <section className="hm-continue" aria-labelledby="hm-continue-t">
      <div className="hm-continue-body">
        <p className="hm-chip">{name}</p>
        <h2 id="hm-continue-t">{T.title}</h2>
        {entry ? (
          <>
            <p className="hm-continue-lesson">{fmt(T.lesson, { num: entry.num, title: entry.title[locale] })}</p>
            <div className="hm-continue-meta">
              <span>{fmt(T.solved, { n: solved, m: total })}</span>
              <div className="hm-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={T.title}>
                <i style={{ width: `${pct}%` }} />
              </div>
            </div>
          </>
        ) : null}
      </div>
      <Link className="hm-btn" href={href}>
        {entry ? T.cta : T.roadmap}
        <span aria-hidden="true"> →</span>
      </Link>
    </section>
  );
}
