'use client';

import { useEffect, useState } from 'react';
import { courseProgress } from '@/lib/course-status';
import { ALL_META, COURSES, LADDER } from '@/lib/courses';
import { achievements, currentStreak, levelInfo, totalXp } from '@/lib/game';
import { fmt } from '@/lib/i18n';
import { useProgress } from '@/lib/progress';
import { courseName } from '@/lib/site';
import { useT } from '../I18nProvider';

/** Block 7: only with progress. Existing game helpers over the full store (all courses), plus XP per course. */
export default function YourStats() {
  const { t, locale } = useT();
  const progress = useProgress();
  const [now, setNow] = useState(0); // 0 until mounted, like the header XP badge
  useEffect(() => {
    const t0 = setTimeout(() => setNow(Date.now()), 0);
    return () => clearTimeout(t0);
  }, []);
  if (!Object.keys(progress.solved).length) return null;
  const T = t.home.stats;
  const xp = totalXp(progress);
  const lvl = levelInfo(xp, t.game.ranks);
  const streak = currentStreak(progress, now);
  const ach = achievements(progress, ALL_META, t.game);
  return (
    <section className="hm-panel" aria-labelledby="hm-stats-t">
      <div className="hm-panel-head">
        <h2 id="hm-stats-t">{T.title}</h2>
      </div>
      <dl className="hm-stats">
        <div>
          <dt>{T.xp}</dt>
          <dd>{xp}</dd>
        </div>
        <div>
          <dt>{T.level}</dt>
          <dd>
            {lvl.level}
            <small>{lvl.rank}</small>
          </dd>
        </div>
        <div>
          <dt>{T.streak}</dt>
          <dd>{streak ? fmt(T.streakDays, { n: streak }) : '—'}</dd>
        </div>
        <div>
          <dt>{T.achievements}</dt>
          <dd>
            {ach.filter((a) => a.unlocked).length}/{ach.length}
          </dd>
        </div>
      </dl>
      <p className="hm-stats-h">{T.perCourse}</p>
      <ul className="hm-percourse">
        {LADDER.map((id) => {
          const c = COURSES[id];
          return (
            <li key={id}>
              <span>{c.texts?.[locale].name ?? courseName[locale]}</span>
              <b>{totalXp(courseProgress(progress, c))} XP</b>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
