'use client';

// Hero variant B: the logo stair line draws itself, a glowing dot climbs it, course cards open on each step.
// Ported from the approved prototype (steps-anim-v2/b.html): constants on top, one timeline-level onUpdate (render).
// Cards, XP meter and the goal chip are HTML laid over the SVG so text stays >= 12px on phones.
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import './hero.css';
import { COURSE_XP, GLYPHS, appendMarkup, chipShift, el, glyphDefs, h, rosette, sparkPath, watchVisibility, type HeroProps } from './hero-shared';

gsap.registerPlugin(useGSAP);

const DEFS = `    <pattern id="hb-pDots" width="24" height="24" patternUnits="userSpaceOnUse" x="6" y="2"><circle cx="12" cy="12" r="1.15" style="fill:var(--dots)"/></pattern>
    <radialGradient id="hb-gDotMask" cx=".55" cy=".5" r=".6"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".6" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <mask id="hb-mDots" maskUnits="userSpaceOnUse" x="0" y="0" width="680" height="520"><rect x="0" y="0" width="680" height="520" fill="url(#hb-gDotMask)"/></mask>
    <radialGradient id="hb-gSpot" cx=".5" cy=".5" r=".5"><stop offset="0" style="stop-color:var(--spot)"/><stop offset="1" style="stop-color:var(--spot);stop-opacity:0"/></radialGradient>
    <radialGradient id="hb-gSpot2" cx=".5" cy=".5" r=".5"><stop offset="0" style="stop-color:var(--spot-2)"/><stop offset="1" style="stop-color:var(--spot-2);stop-opacity:0"/></radialGradient>
    <linearGradient id="hb-gLine" gradientUnits="userSpaceOnUse" x1="150" y1="470" x2="558" y2="182">
      <stop offset="0" style="stop-color:var(--accent)"/><stop offset=".62" style="stop-color:var(--accent)"/><stop offset=".86" style="stop-color:var(--line-mid)"/><stop offset="1" style="stop-color:var(--gold)"/>
    </linearGradient>
    <linearGradient id="hb-gGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" style="stop-color:color-mix(in oklab, var(--gold) 60%, #fff)"/>
      <stop offset=".55" style="stop-color:var(--gold)"/>
      <stop offset="1" style="stop-color:color-mix(in oklab, var(--gold) 75%, #000)"/>
    </linearGradient>
    <radialGradient id="hb-gHalo"><stop offset="0" style="stop-color:var(--gold);stop-opacity:.42"/><stop offset=".45" style="stop-color:var(--gold);stop-opacity:.12"/><stop offset="1" style="stop-color:var(--gold);stop-opacity:0"/></radialGradient>
    <radialGradient id="hb-gHeadHalo"><stop offset="0" style="stop-color:var(--accent);stop-opacity:.5"/><stop offset="1" style="stop-color:var(--accent);stop-opacity:0"/></radialGradient>
    <filter id="hb-fTrail" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="7"/></filter>
    <filter id="hb-fCard" x="-40%" y="-70%" width="180%" height="260%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" style="flood-color:var(--card-shadow)" flood-opacity="1"/>
      <feDropShadow dx="0" dy="10" stdDeviation="12" style="flood-color:var(--card-shadow)" flood-opacity="1"/>
    </filter>` + glyphDefs('hb-');
const SCENE = `
<g id="scene">
  <g id="bg">
    <ellipse cx="520" cy="170" rx="300" ry="230" fill="url(#hb-gSpot)"/>
    <ellipse cx="570" cy="190" rx="140" ry="120" fill="url(#hb-gSpot2)" id="spotGold" opacity="0"/>
    <rect x="0" y="0" width="680" height="520" fill="url(#hb-pDots)" mask="url(#hb-mDots)"/>
  </g>
  <g id="stems"></g>
  <g id="line">
    <path id="track" class="track" d="M150 470H282V326H426V182H558"/>
    <path id="trail" class="trail" d="M150 470H282V326H426V182H558" filter="url(#hb-fTrail)"/>
    <path id="prog" class="prog" d="M150 470H282V326H426V182H558"/>
    <path id="sheen" class="sheen" d="M150 470H282V326H426V182H558"/>
    <g id="rivets"></g>
    <g id="rings"></g>
  </g>
  <g id="summit" transform="translate(558 182)">
    <circle id="halo" r="120" fill="url(#hb-gHalo)" opacity="0"/>
    <g id="parts"></g>
    <g id="medal" opacity="0"></g>
  </g>
  <g id="head">
    <circle r="30" fill="url(#hb-gHeadHalo)"/>
    <circle id="headRing" r="11" style="fill:var(--head-core)" stroke="var(--accent)" stroke-width="3"/>
    <circle r="4.2" style="fill:var(--accent)"/>
  </g>
</g>`;

/** Config: geometry. The logo stair "M7.5 24.5H13V18.5H19V12.5H24.5" scaled x24 gives the hero path. */
const PATH = { P: [[150, 470], [282, 470], [282, 326], [426, 326], [426, 182], [558, 182]] as [number, number][] };
const SEG = [0, 132, 276, 420, 564, 696]; // cumulative lengths at each corner
const CARD = { w: 264, h: 84, pos: [[8, 358], [144, 214], [270, 70]] as [number, number][] };
const VB = [0, 10, 680, 500] as const;
/** Config: timing (seconds). */
const TIME = { head: 0.35, tread: 0.95, riser: 0.6, pause: 0.22, cardLead: 0.0, summitHold: 1.5, hold: 2.2, out: 0.6, trailMax: 84 };

export default function StepsLine(props: HeroProps) {
  const root = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const ovRef = useRef<HTMLDivElement>(null);
  const loop = useRef(props.onLoop);
  useEffect(() => {
    loop.current = props.onLoop;
  });

  useGSAP(
    () => {
      const box = root.current!;
      const svg = svgRef.current!;
      const ov = ovRef.current!;
      appendMarkup(svg, `<defs>${DEFS}</defs>${SCENE}`);
      ov.replaceChildren();
      box.style.setProperty('--r', String(VB[2] / VB[3]));
      box.style.setProperty('--u', `calc(100cqw / ${VB[2]})`);
      const $ = (id: string) => svg.querySelector<SVGElement>('#' + id)!;
      const COURSES = props.names.map((name, k) => ({ name, cap: props.caps[k], xp: COURSE_XP[k], glyph: GLYPHS[k] }));
      const GOAL_TEXT = props.goal;
      const LEN = SEG[SEG.length - 1];
      const prog = $('prog') as unknown as SVGPathElement, trail = $('trail'), sheen = $('sheen'), track = $('track');
      prog.style.strokeDasharray = String(LEN);
      trail.style.strokeDasharray = `0 ${LEN * 2}`;

      // ---- overlay (HTML) positioned in % of the fixed viewBox ----
      const items: { pos: HTMLElement; x: number; y: number; chip?: HTMLElement }[] = [];
      const addOv = (cls: string, x: number, y: number) => {
        const pos = h('div', 'hx-pos ' + cls, ov);
        items.push({ pos, x, y });
        return pos;
      };
      const place = () => {
        const bw = box.clientWidth;
        for (const it of items) {
          const left = ((it.x - VB[0]) / VB[2]) * 100;
          it.pos.style.left = left + '%';
          it.pos.style.top = ((it.y - VB[1]) / VB[3]) * 100 + '%';
          if (it.chip) it.pos.style.setProperty('--dx', chipShift(bw, (left / 100) * bw, it.chip.offsetWidth) + 'px');
        }
      };

      // XP meter (HTML)
      const meter = addOv('hb-meter', 20, 28);
      const mInner = h('div', '', meter);
      mInner.id = 'xpMeter';
      h('span', 'hb-cap', mInner, props.xpLabel);
      const line = h('div', 'hb-xpline', mInner);
      const xpNum = h('span', 'hb-xp', line, '0');
      const xpUnit = h('span', 'hb-xpu', line, 'XP');
      xpUnit.id = 'xpUnit';
      const bar = h('div', 'hb-bar', mInner);
      const xpBar = h('i', '', bar);
      xpBar.id = 'xpBar';

      function buildCards() {
        const stems = $('stems');
        COURSES.forEach((c, k) => {
          const [x, y] = CARD.pos[k];
          // stem connects the card to its tread (starts under the card so a taller phone card still covers it)
          const sx = PATH.P[k * 2][0] + 26, ty = PATH.P[k * 2][1];
          el('line', { class: 'stem', id: `stem-${k}`, x1: sx, y1: y + CARD.h - 14, x2: sx, y2: ty - 12 }, stems);
          el('circle', { class: 'stem-dot', id: `stemdot-${k}`, cx: sx, cy: ty - 12, r: 2.6 }, stems);
          const pos = addOv('hb-cardpos', x, y + CARD.h);
          const card = h('div', 'hb-card', pos);
          card.id = `card-${k}`;
          const tile = h('div', 'hb-tile', card);
          const gs = el('svg', { viewBox: '0 0 24 24', 'aria-hidden': 'true' }, tile);
          el('use', { href: `#hb-glyph-${c.glyph}` }, gs);
          const txt = h('div', '', card);
          h('span', 'hb-cap', txt, c.cap);
          h('span', 'hb-name', txt, c.name);
        });
      }
      function buildRivets() {
        [0, 2, 4].forEach((i, k) => {
          const [x, y] = PATH.P[i];
          el('circle', { class: 'rivet', id: `rivet-${k}`, cx: x, cy: y, r: 3.2, opacity: 0.9 }, $('rivets'));
          el('circle', { class: 'ring', id: `ring-${k}`, cx: x, cy: y, r: 14, opacity: 0 }, $('rings'));
        });
      }
      function buildSummit() {
        const m = $('medal');
        el('path', { d: rosette(30, 27, 16), fill: 'url(#hb-gGold)', stroke: 'url(#hb-gGold)', 'stroke-width': 3, 'stroke-linejoin': 'round', filter: 'url(#hb-fCard)' }, m);
        el('circle', { class: 'medal-in', r: 20.5 }, m);
        el('circle', { r: 20.5, fill: 'none', stroke: 'var(--gold)', 'stroke-opacity': 0.35, 'stroke-width': 1 }, m);
        el('path', { class: 'medal-glyph', d: 'M-8.5 .5l6 6L9.5-6.2' }, m);
        // goal chip (HTML) below the medal, kept inside the art box
        const pos = addOv('hb-goalpos', 558, 182 + 61);
        const chip = h('div', 'hb-goal', pos, GOAL_TEXT);
        chip.id = 'goalChip';
        items[items.length - 1].chip = chip;
        for (let i = 0; i < 12; i++) el('path', { class: 'spark' + (i % 3 === 0 ? ' g' : ''), d: sparkPath(i % 2 ? 4.2 : 6), opacity: 0 }, $('parts'));
      }
      buildCards(); buildRivets(); buildSummit();
      place();

      // ---- render from proxies (one place, driven by the timeline's onUpdate) ----
      const S = { p: 0, xp: 0, sheen: -1 };
      const XP_MAX = COURSES.reduce((a, c) => a + c.xp, 0);
      const head = $('head');
      function render() {
        const p = S.p;
        prog.style.strokeDashoffset = String(LEN - p);
        // trail length peaks mid-segment, vanishes at each stop
        let i = 1;
        while (i < SEG.length - 1 && p > SEG[i]) i++;
        const local = (p - SEG[i - 1]) / (SEG[i] - SEG[i - 1]);
        const T = Math.max(0.01, TIME.trailMax * Math.sin(Math.PI * Math.min(1, Math.max(0, local))));
        trail.style.strokeDasharray = `${T} ${LEN * 2}`;
        trail.style.strokeDashoffset = String(T - p);
        const pt = prog.getPointAtLength(Math.min(LEN, Math.max(0, p)));
        gsap.set(head, { x: pt.x, y: pt.y });
        xpNum.textContent = String(Math.round(S.xp));
        gsap.set(xpBar, { scaleX: S.xp / XP_MAX });
        if (S.sheen >= 0) {
          sheen.style.strokeDasharray = `40 ${LEN * 2}`;
          sheen.style.strokeDashoffset = String(40 - S.sheen);
        }
      }

      // ---- timelines ----
      const introTl = gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .fromTo('#bg', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1, ease: 'power1.out' }, 0)
        .fromTo(track, { strokeDasharray: LEN, strokeDashoffset: LEN }, { strokeDashoffset: 0, duration: 1.1, ease: 'expo.inOut' }, 0)
        .fromTo('#rivets circle', { autoAlpha: 0, scale: 0, transformOrigin: '50% 50%' }, { autoAlpha: 0.9, scale: 1, duration: 0.5, stagger: 0.12, ease: 'back.out(2)' }, 0.5)
        .fromTo('#xpMeter', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: 0.8 }, 0.3);

      // lazy:false + callbacks on every seek: a paused or reduced-motion frame must redraw (tl.seek(label, false) fires onUpdate)
      const tl = gsap.timeline({ repeat: -1, delay: 0.85, defaults: { ease: 'power3.out', lazy: false }, onUpdate: render, onRepeat: () => loop.current() });
      tl.fromTo(head, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 0.5, ease: 'back.out(2.2)' }, 0)
        .fromTo(S, { p: 0, xp: 0, sheen: -1 }, { p: 0, duration: 0.01 }, 0);
      let t = TIME.head;
      const arrive = (k: number, at: number) => {
        tl.addLabel(`step${k}`, at)
          .fromTo(`#card-${k}`, { autoAlpha: 0, y: 16, scale: 0.94 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.75, ease: 'back.out(1.35)' }, at)
          .fromTo(`#stem-${k}`, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.4 }, at + 0.2)
          .fromTo(`#stemdot-${k}`, { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.5, ease: 'back.out(2.5)' }, at + 0.25)
          .fromTo(`#ring-${k}`, { opacity: 0.8, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 0, scale: 2.2, duration: 1, ease: 'expo.out', immediateRender: false }, at)
          .to(S, { xp: COURSES.slice(0, k + 1).reduce((a, c) => a + c.xp, 0), duration: 0.9, ease: 'power2.out' }, at + 0.1)
          .fromTo('#xpUnit', { scale: 1 }, { keyframes: [{ scale: 1.25, duration: 0.12, ease: 'power2.out' }, { scale: 1, duration: 0.4, ease: 'power2.inOut' }] }, at + 0.1);
      };
      arrive(0, t - 0.15);
      for (let k = 0; k < 3; k++) {
        t += TIME.pause;
        tl.to(S, { p: SEG[k * 2 + 1], duration: TIME.tread, ease: 'power2.inOut' }, t);
        t += TIME.tread;
        if (k < 2) {
          tl.to(S, { p: SEG[k * 2 + 2], duration: TIME.riser, ease: 'power3.inOut' }, t);
          t += TIME.riser;
          arrive(k + 1, t - 0.05);
        }
      }
      // summit: the student dot becomes the badge
      const tS = t;
      tl.addLabel('summit', tS)
        .to(head, { scale: 0, autoAlpha: 0, duration: 0.35, ease: 'power2.in' }, tS - 0.05)
        .fromTo('#halo', { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 1.3, ease: 'expo.out' }, tS)
        .fromTo('#spotGold', { opacity: 0 }, { opacity: 1, duration: 1.2 }, tS)
        .fromTo('#medal', { autoAlpha: 0, scale: 0.3, rotation: -30, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.95, ease: 'back.out(1.7)' }, tS + 0.05)
        .fromTo('#goalChip', { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.6 }, tS + 0.35)
        .fromTo(S, { sheen: -1 }, { sheen: LEN + 40, duration: 1.1, ease: 'power2.inOut', immediateRender: false }, tS + 0.2)
        .fromTo(sheen, { opacity: 0 }, { keyframes: [{ opacity: 0.55, duration: 0.2 }, { opacity: 0.55, duration: 0.6 }, { opacity: 0, duration: 0.3 }] }, tS + 0.2);
      gsap.utils.toArray<SVGElement>('#parts path', box).forEach((p, i, arr) => {
        const a = -Math.PI / 2 + (i / arr.length) * Math.PI * 2 + (i % 2 ? 0.2 : 0), R = (i % 2 ? 50 : 72) + (i % 3) * 6;
        tl.fromTo(p, { opacity: 0, scale: 0.4 }, { keyframes: [{ opacity: 1, scale: 1, duration: 0.18, ease: 'power1.out' }, { opacity: 0, scale: 0.3, duration: 0.9, ease: 'power1.in' }] }, tS + 0.12)
          .fromTo(p, { x: 0, y: 0, rotation: 0 }, { x: Math.cos(a) * R, y: Math.sin(a) * R, rotation: i % 2 ? 45 : -45, duration: 1.1, ease: 'expo.out' }, tS + 0.12);
      });
      const tHold = tS + TIME.summitHold;
      tl.addLabel('hold', tHold)
        .to({}, { duration: TIME.hold }, tHold)
        .addLabel('out')
        .to(['.hb-card', '#medal', '#goalChip', '#halo', '#spotGold', '#prog', '#trail', '#stems line', '#stems circle'], { opacity: 0, duration: TIME.out, ease: 'power2.inOut' }, 'out')
        .to('.hb-xp, #xpUnit', { opacity: 0, duration: TIME.out * 0.6 }, 'out');
      render();

      // ---- reduced motion, visibility ----
      const vis = watchVisibility(box, tl);
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: reduce)', () => {
        vis.state.reduced = true;
        introTl.progress(1);
        tl.pause();
        tl.seek('hold', false); // callbacks must fire, otherwise the static frame stays stale
        render();
        return () => {
          vis.state.reduced = false;
          tl.restart(true);
          vis.sync();
        };
      });
      const ro = new ResizeObserver(() => place());
      ro.observe(box);
      document.fonts?.ready.then(place);
      vis.sync();
      return () => {
        ro.disconnect();
        vis.stop();
        mm.revert();
      };
    },
    { scope: root, dependencies: [props.names.join('|'), props.caps.join('|'), props.goal, props.xpLabel] },
  );

  return (
    <div className="hx hxb" ref={root} style={{ width: 'min(100cqw, calc(100cqh * var(--r, 1.36)))', height: 'min(100cqh, calc(100cqw / var(--r, 1.36)))' }}>
      <svg ref={svgRef} className="hx-svg" viewBox={VB.join(' ')} role="img" aria-labelledby="hxbT hxbD">
        <title id="hxbT">{props.title}</title>
        <desc id="hxbD">{props.desc}</desc>
      </svg>
      <div ref={ovRef} className="hx-ov" aria-hidden="true" />
    </div>
  );
}
