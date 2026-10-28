'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { COURSES } from '@/lib/courses';
import { courseName } from '@/lib/site';
import { useT } from '../I18nProvider';
import type { HeroProps } from './hero-shared';

// Each variant is its own chunk: only the chosen one is downloaded and mounted.
const StepsHero = dynamic(() => import('./StepsHero'), { ssr: false });
const StepsLine = dynamic(() => import('./StepsLine'), { ssr: false });

type Variant = 'a' | 'b';
type Layer = { id: number; v: Variant; show: boolean };

/** Local hour parity picks the variant: even hour -> A (stairs), odd -> B (line). `?hero=a|b` forces one (QA). */
const wanted = (): Variant => {
  try {
    const q = new URLSearchParams(location.search).get('hero');
    if (q === 'a' || q === 'b') return q;
  } catch {}
  return new Date().getHours() % 2 === 0 ? 'a' : 'b';
};
const forced = () => {
  try {
    const q = new URLSearchParams(location.search).get('hero');
    return q === 'a' || q === 'b';
  } catch {
    return false;
  }
};

/**
 * Reserved box (fixed aspect ratio, no layout shift). The server renders it empty; after mount the chosen variant
 * fades in. At the end of a loop (or every 30 s when motion is reduced) the hour is re-checked and a changed
 * parity crossfades to the other variant.
 */
export default function HeroArt() {
  const { t, locale } = useT();
  const [layers, setLayers] = useState<Layer[]>([]);
  const current = useRef<Variant | null>(null);
  const seq = useRef(0);

  const swap = useCallback((v: Variant) => {
    if (current.current === v) return;
    current.current = v;
    const id = ++seq.current;
    setLayers((ls) => [...ls.map((l) => ({ ...l, show: false })), { id, v, show: false }]);
    requestAnimationFrame(() => requestAnimationFrame(() => setLayers((ls) => ls.map((l) => (l.id === id ? { ...l, show: true } : l)))));
    setTimeout(() => setLayers((ls) => ls.filter((l) => l.id === id)), 900);
  }, []);

  const check = useCallback(() => {
    if (!forced()) swap(wanted());
  }, [swap]);

  useEffect(() => {
    swap(wanted());
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const iv = setInterval(() => reduced.matches && check(), 30_000);
    return () => clearInterval(iv);
  }, [swap, check]);

  const props: HeroProps = {
    names: [COURSES['vibe-coding'].texts![locale].name, courseName[locale], COURSES['react-next'].texts![locale].name],
    caps: [...t.home.tags] as [string, string, string],
    goal: t.home.artGoal,
    xpLabel: t.home.artXp,
    title: t.home.artTitle,
    desc: t.home.artDesc,
    onLoop: check,
  };

  return (
    <div className="hm-art">
      {layers.map((l) => (
        <div key={l.id} className={`hm-art-layer${l.show ? ' is-in' : ''}`}>
          {l.v === 'a' ? <StepsHero {...props} /> : <StepsLine {...props} />}
        </div>
      ))}
    </div>
  );
}
