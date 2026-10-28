'use client';

import Link from 'next/link';
import { boardTexts } from '@/content/board-texts';
import { COURSES, LADDER, courseHome } from '@/lib/courses';
import { courseDone } from '@/lib/home';
import { fmt } from '@/lib/i18n';
import { useProgress } from '@/lib/progress';
import { courseName } from '@/lib/site';
import { useT } from '../I18nProvider';

/** Block 3: the three independent courses side by side (a plain list on phones). */
export default function CourseBoard({ picked }: { picked: string | null }) {
  const { t, locale } = useT();
  const progress = useProgress();
  const T = t.home.courses;
  return (
    <section className="hm-sec" id="courses" aria-labelledby="hm-courses-t">
      <h2 id="hm-courses-t">{T.title}</h2>
      <p className="hm-sec-lead">{T.lead}</p>
      <ol className="hm-ladder">
        {LADDER.map((id) => {
          const c = COURSES[id];
          const bt = boardTexts[id];
          const name = c.texts?.[locale].name ?? courseName[locale];
          const { solved, total } = courseDone(progress, c);
          const started = solved > 0;
          const pct = total ? Math.max(started ? 1 : 0, Math.round((solved / total) * 100)) : 0;
          return (
            <li key={id} className={`hm-card${picked === id ? ' is-picked' : ''}`} id={`course-${id}`}>
              {picked === id && (
                <div className="hm-card-top">
                  <span className="hm-pick">{T.picked}</span>
                </div>
              )}
              <h3>{name}</h3>
              <dl className="hm-facts">
                <dt>{T.forWhom}</dt>
                <dd>{bt.forWhom[locale]}</dd>
                <dt>{T.outcome}</dt>
                <dd>{bt.outcome[locale]}</dd>
              </dl>
              <p className="hm-meta">
                <span>{fmt(T.volume, { n: c.entries.length, w: bt.weeks })}</span>
                <span>{fmt(T.available, { n: c.available.length, m: c.entries.length })}</span>
              </p>
              {started && (
                <div className="hm-card-progress">
                  <span>{fmt(T.progress, { pct })}</span>
                  <div className="hm-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={name}>
                    <i style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )}
              <Link className={`hm-btn${started ? '' : ' hm-btn-solid'}`} href={courseHome(c, locale)}>
                {started ? T.resume : T.start}
                <span aria-hidden="true"> →</span>
              </Link>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
