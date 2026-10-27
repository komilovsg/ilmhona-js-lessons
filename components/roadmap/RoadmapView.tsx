'use client';

import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { courseItems, useCourseProgress, type CourseItem, type CourseStatus } from '@/lib/course-status';
import { COURSES, courseHome, lessonHref, otherCourse, type CourseId } from '@/lib/courses';
import { levelInfo, totalXp } from '@/lib/game';
import { fmt } from '@/lib/i18n';
import { courseName } from '@/lib/site';
import { useT } from '../I18nProvider';
import { BoltIcon, CheckIcon, ClockIcon, DotIcon, FlagIcon, LockIcon, PinIcon, TrophyIcon } from './icons';

gsap.registerPlugin(ScrollTrigger, useGSAP);

/** Smooth S-curves through the marker centres. */
function pathThrough(pts: [number, number][]): string {
  if (!pts.length) return '';
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1];
    const [x1, y1] = pts[i];
    const k = (y1 - y0) * 0.55;
    d += ` C${x0.toFixed(1)} ${(y0 + k).toFixed(1)} ${x1.toFixed(1)} ${(y1 - k).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return d;
}

export default function RoadmapView({ courseId = 'frontend' }: { courseId?: CourseId }) {
  const { t, locale } = useT();
  const c = COURSES[courseId];
  const r = { ...t.roadmap, ...(c.texts?.[locale].roadmap ?? {}) };
  const progress = useCourseProgress(c);
  const other = otherCourse(c);

  const items = useMemo(() => courseItems(progress.solved, c), [progress, c]);

  const doneCount = items.filter((i) => i.status === 'done').length;
  const progCount = items.filter((i) => i.status === 'progress').length;
  const anyStarted = items.some((i) => i.solved > 0);
  const xp = totalXp(progress);
  const lvl = levelInfo(xp, t.game.ranks);

  let hereIdx = items.findIndex((i) => i.status === 'available' || i.status === 'progress');
  const allAvailableDone = hereIdx === -1;
  if (allAvailableDone) hereIdx = Math.max(0, items.findIndex((i) => i.status === 'soon'));
  const hereItem = items[hereIdx];
  const ctaLesson = allAvailableDone ? null : hereItem;

  const root = useRef<HTMLElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const [tick, setTick] = useState(0);

  // Re-measure the path when the track changes size (fonts, details panels, breakpoints).
  useEffect(() => {
    const el = track.current;
    if (!el) return;
    let raf = 0;
    let last = '';
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const k = `${el.offsetWidth}x${el.offsetHeight}`;
        if (k !== last) {
          last = k;
          setTick((n) => n + 1);
        }
      });
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, []);

  // Entrance animations: hero, module headers, nodes (batched), final block, idle pulse.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap
          .timeline({ defaults: { ease: 'power3.out' } })
          .from('.rm-in', { autoAlpha: 0, y: 22, duration: 0.7, stagger: 0.09 });

        gsap.utils.toArray<HTMLElement>('.rm-modhead').forEach((el) => {
          gsap.from(el, {
            autoAlpha: 0,
            x: -48,
            duration: 0.7,
            ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 90%', once: true },
          });
        });

        const nodes = gsap.utils.toArray<HTMLElement>('.rm-node');
        gsap.set(nodes, { autoAlpha: 0, y: 34, scale: 0.97 });
        ScrollTrigger.batch(nodes, {
          start: 'top 90%',
          once: true,
          onEnter: (batch) =>
            gsap.to(batch, { autoAlpha: 1, y: 0, scale: 1, duration: 0.65, stagger: 0.1, ease: 'back.out(1.4)', overwrite: true }),
        });

        const fin = root.current?.querySelector('.rm-final');
        if (fin) {
          const tl = gsap.timeline({ scrollTrigger: { trigger: fin, start: 'top 82%', once: true } });
          tl.from(fin, { autoAlpha: 0, y: 40, scale: 0.96, duration: 0.7, ease: 'power3.out' })
            .from('.rm-final-icon', { scale: 0, rotate: -35, duration: 0.8, ease: 'back.out(2.2)' }, '-=0.3')
            .from('.rm-final-txt > *', { autoAlpha: 0, y: 14, stagger: 0.1, duration: 0.5 }, '-=0.5')
            .fromTo(
              '.rm-spark',
              { x: 0, y: 0, scale: 0.4, autoAlpha: 1 },
              {
                x: (i) => Math.cos((i / 10) * Math.PI * 2) * 86,
                y: (i) => Math.sin((i / 10) * Math.PI * 2) * 86,
                scale: 1,
                autoAlpha: 0,
                duration: 1.1,
                stagger: 0.02,
                ease: 'power2.out',
              },
              '-=1.0',
            );
        }
      });
      return () => mm.revert();
    },
    { scope: root },
  );

  // Pulse on the "you are here" marker; re-created whenever it moves.
  useGSAP(
    () => {
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.fromTo('.rm-pulse', { scale: 1, autoAlpha: 0.55 }, { scale: 1.9, autoAlpha: 0, duration: 1.8, ease: 'power1.out', repeat: -1 });
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [hereIdx], revertOnUpdate: true },
  );

  // The path: geometry from marker positions, drawn by scroll; accent part up to "you are here".
  useGSAP(
    () => {
      const tr = track.current;
      const svg = tr?.querySelector<SVGSVGElement>('.rm-path');
      if (!tr || !svg) return;
      const markers = Array.from(tr.querySelectorAll<HTMLElement>('[data-marker]'));
      const pts = markers.map((m): [number, number] => {
        let x = 0;
        let y = 0;
        let n: HTMLElement | null = m;
        while (n && n !== tr) {
          x += n.offsetLeft;
          y += n.offsetTop;
          n = n.offsetParent as HTMLElement | null;
        }
        return [x + m.offsetWidth / 2, y + m.offsetHeight / 2];
      });
      svg.setAttribute('viewBox', `0 0 ${tr.offsetWidth} ${tr.offsetHeight}`);
      const full = svg.querySelector<SVGPathElement>('.rm-path-full')!;
      const walked = svg.querySelector<SVGPathElement>('.rm-path-walked')!;
      const done = svg.querySelector<SVGPathElement>('.rm-path-done')!;
      const dFull = pathThrough(pts);
      full.setAttribute('d', dFull);
      walked.setAttribute('d', dFull);
      done.setAttribute('d', pathThrough(pts.slice(0, hereIdx + 1)));
      const L = walked.getTotalLength();
      const Ld = hereIdx > 0 ? done.getTotalLength() : 0;
      done.style.display = Ld > 0 ? '' : 'none';
      if (!L) return;

      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: no-preference)', () => {
        gsap.set(walked, { strokeDasharray: L, strokeDashoffset: L });
        if (Ld > 0) gsap.set(done, { strokeDasharray: `${Ld} ${L}`, strokeDashoffset: Ld });
        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: tr, start: 'top 70%', end: 'bottom 60%', scrub: 0.5 },
        });
        tl.to(walked, { strokeDashoffset: 0, duration: 1 }, 0);
        if (Ld > 0) tl.to(done, { strokeDashoffset: 0, duration: Ld / L }, 0);
      });
      mm.add('(prefers-reduced-motion: reduce)', () => {
        walked.style.display = 'none';
      });
      return () => mm.revert();
    },
    { scope: root, dependencies: [tick, hereIdx, locale], revertOnUpdate: true },
  );

  const statusLabel = (i: CourseItem) =>
    i.status === 'done'
      ? r.statusDone
      : i.status === 'progress'
        ? fmt(r.statusProgress, { n: i.solved, m: i.total })
        : i.status === 'available'
          ? r.statusAvailable
          : r.statusSoon;

  const StatusIcon = ({ s }: { s: CourseStatus }) =>
    s === 'done' ? <CheckIcon /> : s === 'soon' ? <ClockIcon /> : <DotIcon />;

  return (
    <main className="rm" ref={root}>
      <section className="hero rm-hero">
        <p className="kicker rm-in">{r.kicker}</p>
        <h1 className="rm-in">{r.title}</h1>
        <p className="lead rm-in">{r.lead}</p>
        <ul className="rm-stats rm-in" aria-label={r.summaryLabel}>
          <li>
            <span>{r.statDone}</span>
            <b>{fmt(r.of, { n: doneCount, total: items.length })}</b>
          </li>
          <li>
            <span>{r.statProgress}</span>
            <b>{progCount}</b>
          </li>
          <li>
            <span>{r.statXp}</span>
            <b>{xp} XP</b>
            <small>{fmt(r.levelLine, { level: lvl.level, rank: lvl.rank })}</small>
          </li>
        </ul>
        <div className="rm-in rm-cta-row">
          {ctaLesson ? (
            <Link className="rm-cta" href={lessonHref(c, locale, ctaLesson.slug)}>
              {fmt(anyStarted ? r.ctaContinue : r.ctaStart, { num: ctaLesson.num, title: ctaLesson.title[locale] })}
              <span aria-hidden="true"> →</span>
            </Link>
          ) : (
            <p className="rm-cta-note">{r.ctaAllDone}</p>
          )}
          <Link className="rm-alt" href={courseHome(other, locale)}>
            {fmt(t.roadmap.otherCourse, { name: other.texts?.[locale].name ?? courseName[locale] })} <span aria-hidden="true">→</span>
          </Link>
        </div>
      </section>

      <div className="rm-track" ref={track}>
        <svg className="rm-path" aria-hidden="true" focusable="false" preserveAspectRatio="none">
          <path className="rm-path-full" />
          <path className="rm-path-walked" />
          <path className="rm-path-done" />
        </svg>

        {c.modules.map((m) => (
          <section key={m.id} className="rm-module" aria-labelledby={`rm-m${m.id}`}>
            <header className="rm-modhead">
              <p>
                {fmt(r.moduleLabel, { n: m.id })} · {fmt(r.range, { from: m.from, to: m.to })}
              </p>
              <h2 id={`rm-m${m.id}`}>{m.title[locale]}</h2>
            </header>
            <ol className="rm-list" start={m.from} aria-label={`${r.mapLabel}: ${m.title[locale]}`}>
              {items
                .filter((i) => i.module === m.id)
                .map((i) => {
                  const here = i.num === hereItem.num;
                  const side = i.num % 2 === 1 ? 'rm-l' : 'rm-r';
                  const pct = i.total ? Math.round((i.solved / i.total) * 100) : 0;
                                    const detailsId = `rm-d${i.num}`;
                  return (
                    <li
                      key={i.num}
                      className={`rm-node rm-${i.status} rm-k-${i.kind} ${side}${here ? ' rm-here' : ''}`}
                      aria-current={here ? 'step' : undefined}
                    >
                      <span
                        className="rm-marker"
                        data-marker
                        style={{ ['--pct' as string]: `${pct}%` }}
                        aria-hidden="true"
                      >
                        {here && <span className="rm-pulse" />}
                        <span className="rm-marker-in">
                          {i.status === 'done' ? (
                            <CheckIcon />
                          ) : i.status === 'soon' && i.kind === 'lesson' ? (
                            <LockIcon />
                          ) : i.kind === 'project' ? (
                            <FlagIcon />
                          ) : i.kind === 'final' ? (
                            <TrophyIcon />
                          ) : (
                            i.num
                          )}
                        </span>
                      </span>

                      <article className="rm-card">
                        <div className="rm-meta">
                          <span className="rm-num">{fmt(r.lessonLabel, { num: i.num })}</span>
                          {i.kind === 'project' && <span className="rm-chip rm-chip-project">{r.kindProject}</span>}
                          {i.kind === 'final' && <span className="rm-chip rm-chip-final">{r.kindFinal}</span>}
                          {i.badge && (
                            <span className="rm-chip rm-chip-demo">
                              <BoltIcon />
                              {i.badge[locale]}
                            </span>
                          )}
                          {here && (
                            <span className="rm-chip rm-chip-here">
                              <PinIcon />
                              {r.here}
                            </span>
                          )}
                        </div>
                        <h3 className="rm-title">
                          {c.available.includes(i.slug) ? (
                            <Link className="rm-link" href={lessonHref(c, locale, i.slug)}>
                              {i.title[locale]}
                            </Link>
                          ) : (
                            i.title[locale]
                          )}
                        </h3>
                        <p className={`rm-status rm-st-${i.status}`}>
                          <StatusIcon s={i.status} />
                          {statusLabel(i)}
                        </p>
                        {i.status === 'progress' && (
                          <div className="rm-bar" role="presentation">
                            <i style={{ width: `${pct}%` }} />
                          </div>
                        )}
                        <details className="rm-details" id={detailsId}>
                          <summary>{i.status === 'soon' ? r.moreSoon : r.more}</summary>
                          <dl>
                            {(['topics', 'ai', 'classwork', 'homework', 'result'] as const).map((k) => (
                              <Fragment key={k}>
                                <dt>{r[k]}</dt>
                                <dd>{i[k][locale]}</dd>
                              </Fragment>
                            ))}
                          </dl>
                          {c.available.includes(i.slug) && (
                            <Link className="rm-open" href={lessonHref(c, locale, i.slug)}>
                              {r.open} →
                            </Link>
                          )}
                        </details>
                      </article>
                    </li>
                  );
                })}
            </ol>
          </section>
        ))}

        <section className="rm-final" aria-labelledby="rm-final-t">
          <span className="rm-marker rm-marker-final" data-marker aria-hidden="true">
            <span className="rm-marker-in">
              <TrophyIcon />
            </span>
          </span>
          <div className="rm-final-card">
            <span className="rm-final-icon" aria-hidden="true">
              <TrophyIcon />
              {Array.from({ length: 10 }, (_, k) => (
                <i key={k} className="rm-spark" />
              ))}
            </span>
            <div className="rm-final-txt">
              <p className="kicker">{r.finalKicker}</p>
              <h2 id="rm-final-t">{c.destination.title[locale]}</h2>
              <p>{r.finalText}</p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
