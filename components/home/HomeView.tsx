'use client';

import { useCallback, useState } from 'react';
import type { CourseId } from '@/lib/courses';
import { useT } from '../I18nProvider';
import ContinueCard from './ContinueCard';
import CourseBoard from './CourseBoard';
import CoursePicker from './CoursePicker';
import HeroArt from './HeroArt';
import HowItWorks from './HowItWorks';
import HowVideo from './HowVideo';
import MiniLeaderboard from './MiniLeaderboard';
import YourStats from './YourStats';

const scrollTo = (id: string) => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: id.startsWith('course-') ? 'center' : 'start' });
};

/** The course board (home page). Blocks 2 and 7 render only with progress. */
export default function HomeView() {
  const { t } = useT();
  const [picked, setPicked] = useState<CourseId | null>(null);
  const onPick = useCallback((id: CourseId | null) => {
    setPicked(id);
    if (id) setTimeout(() => scrollTo(`course-${id}`), 0);
  }, []);
  return (
    <main className="hm">
      <section className="hm-hero" aria-labelledby="hm-h1">
        <div className="hm-hero-copy">
          <p className="hm-kicker">{t.home.kicker}</p>
          <h1 id="hm-h1">{t.home.title}</h1>
          <p className="hm-lead">{t.home.lead}</p>
          <div className="hm-cta-row">
            <a
              className="hm-btn hm-btn-solid hm-btn-lg"
              href="#courses"
              onClick={(e) => (e.preventDefault(), scrollTo('courses'))}
            >
              {t.home.choose}
            </a>
            <a className="hm-link" href="#quiz" onClick={(e) => (e.preventDefault(), scrollTo('quiz'))}>
              {t.home.unsure}
            </a>
          </div>
        </div>
        <HeroArt />
      </section>
      <ContinueCard />
      <CourseBoard picked={picked} />
      <CoursePicker onPick={onPick} />
      <HowItWorks />
      <HowVideo />
      <div className="hm-duo">
        <MiniLeaderboard />
        <YourStats />
      </div>
    </main>
  );
}
