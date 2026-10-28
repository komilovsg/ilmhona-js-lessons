'use client';

// Hero variant A: isometric stairs, a walking figure that celebrates on the summit.
// Ported from the approved prototype (steps-anim-v2/a.html): geometry, content and timings are constants;
// one timeline-level onUpdate (draw) redraws the rig. Course texts are HTML laid over the SVG (>= 12px on phones).
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import './hero.css';
import { COURSE_XP, GLYPHS, appendMarkup, chipShift, el, glyphDefs, h, rosette, sparkPath, watchVisibility, type HeroProps } from './hero-shared';

gsap.registerPlugin(useGSAP);

// ---- static SVG skeleton (ids prefixed `ha-` where variant B uses the same names) ----
const DEFS = `<linearGradient id="gLeft" class="face-left-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient>
    <linearGradient id="gRight" class="face-right-g" x1="0" y1="0" x2="0" y2="1"><stop offset="0"/><stop offset="1"/></linearGradient>
    <linearGradient id="gTop" class="face-top-g" x1="0" y1="1" x2="1" y2="0"><stop offset="0"/><stop offset="1"/></linearGradient>
    <linearGradient id="gLit" class="lit-g" x1="0" y1="1" x2="1" y2="0"><stop offset="0"/><stop offset="1"/></linearGradient>
    <linearGradient id="ha-gGold" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" style="stop-color:color-mix(in oklab, var(--gold) 60%, #fff)"/>
      <stop offset=".55" style="stop-color:var(--gold)"/>
      <stop offset="1" style="stop-color:color-mix(in oklab, var(--gold) 75%, #000)"/>
    </linearGradient>
    <linearGradient id="gBeam" class="beam" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0" stop-opacity=".0"/><stop offset=".25" stop-opacity=".28"/><stop offset="1" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="ha-gHalo"><stop offset="0" style="stop-color:var(--gold);stop-opacity:.45"/><stop offset=".45" style="stop-color:var(--gold);stop-opacity:.14"/><stop offset="1" style="stop-color:var(--gold);stop-opacity:0"/></radialGradient>
    <radialGradient id="ha-gSpot" cx=".5" cy=".5" r=".5"><stop offset="0" style="stop-color:var(--floor-spot)"/><stop offset="1" style="stop-color:var(--floor-spot);stop-opacity:0"/></radialGradient>
    <radialGradient id="gGridMask" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset=".55" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <mask id="mGrid" maskUnits="userSpaceOnUse" x="-200" y="200" width="1100" height="600"><ellipse id="gridMaskEl" fill="url(#gGridMask)"/></mask>
    <filter id="fShadowSoft" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="14"/></filter>
    <filter id="fShadowTight" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="2.5"/></filter>
    <filter id="fGlow" x="-30%" y="-60%" width="160%" height="220%"><feGaussianBlur stdDeviation="4"/></filter>
    <filter id="fBlur2" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.6"/></filter>
    <filter id="ha-fCard" x="-40%" y="-70%" width="180%" height="260%">
      <feDropShadow dx="0" dy="1" stdDeviation="1" style="flood-color:var(--card-shadow)" flood-opacity=".9"/>
      <feDropShadow dx="0" dy="8" stdDeviation="8" style="flood-color:var(--card-shadow)" flood-opacity=".8"/>
    </filter>` + glyphDefs('ha-');
const SCENE = `<g id="scene">
    <g id="floor">
      <ellipse id="floorSpot" fill="url(#ha-gSpot)"/>
      <g class="grid" id="grid" mask="url(#mGrid)"></g>
    </g>
    <g id="shadowWrap">
      <g id="shadows" filter="url(#fShadowSoft)"></g>
      <g id="contact" filter="url(#fShadowTight)"></g>
    </g>
    <g id="blocks"></g>
    <g id="labels"></g>
    <g id="badges"></g>
    <g id="goal"></g>
    <g id="ripples"></g>
    <g id="figWrap"><g id="fig" aria-hidden="true"></g>
    <g id="figFront" aria-hidden="true"></g></g>
    <g id="xps"></g>
    <g id="reward"></g>
  </g>`;

/** Config: world geometry (iso units). */
const G = {
  O: [196, 506] as [number, number], // screen origin of world (0,0,0)
  W: 200, D: 110, H: 36, // block width (x), depth (y), riser height (z)
  LANE: 150, Y0: 70, // walker lane (x) and start reference (y)
  S: 110 / 3, DUTY: 0.6, // stride (3 steps per block), stance fraction
  BS: 1.2, // body scale of the walker rig
  THIGH: 27.6, SHIN: 27.6, HIP: 52.2, // leg rig
  UARM: 16.2, LARM: 15.6,
};
/** Config: timing (seconds). */
const TIME = { intro: 1.1, speed: 66, s0: 16, settle: 0.5, rewardDelay: -0.1, hold: 2.2, out: 0.6, sEnd: 0, sLin: 0 };
const VB = { desktop: [36, 70, 664, 580] } as const;

type P2 = [number, number];
const C30 = Math.cos(Math.PI / 6);
const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
const sineIO = (x: number) => -(Math.cos(Math.PI * clamp(x)) - 1) / 2;
const rad = (d: number) => (d * Math.PI) / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const iso = (x: number, y: number, z = 0): P2 => [G.O[0] + (x - y) * C30, G.O[1] + (x + y) * 0.5 - z];
const pts = (a: number[][]) => a.map((p) => iso(p[0], p[1], p[2]).map((n) => n.toFixed(2)).join(',')).join(' ');

export default function StepsHero(props: HeroProps) {
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
      const $ = (id: string) => svg.querySelector<SVGElement>('#' + id)!;
      const COURSES = props.names.map((name, k) => ({ name, cap: props.caps[k], xp: COURSE_XP[k], glyph: GLYPHS[k] }));
      const GOAL_TEXT = props.goal;

      const RISERS = COURSES.map((_, k) => G.Y0 + k * G.D); // walker-u of each riser
      const PLANT0 = (((RISERS[0] - G.S / 2) % G.S) + G.S) % G.S; // foot plants sit mid-way between risers
      const ground = (u: number) => RISERS.reduce((hh, r) => (u >= r ? hh + G.H : hh), 0);
      const groundSmooth = (s: number) => RISERS.reduce((hh, r) => hh + G.H * smooth((s - (r - 0.4 * G.S)) / (1.15 * G.S)), 0);
      // final resting stride: both feet planted, front foot ~half-way into the summit block
      TIME.sEnd = PLANT0 + Math.floor((RISERS[2] + 0.3 * G.D - PLANT0) / G.S) * G.S + G.S / 2;
      TIME.sLin = TIME.sEnd - G.S * 0.8;
      const climbBump = (s: number) => RISERS.reduce((m, r) => Math.max(m, Math.sin(Math.PI * clamp((s - (r - 0.4 * G.S)) / (1.4 * G.S)))), 0);

      // ---- overlay (HTML text) bookkeeping: svg coords -> % of the current viewBox ----
      let vb: readonly number[] = VB.desktop;
      const items: { pos: HTMLElement; x: number; y: number; chip?: HTMLElement }[] = [];
      const addOv = (cls: string, x: number, y: number) => {
        const pos = h('div', 'hx-pos ' + cls, ov);
        items.push({ pos, x, y });
        return pos;
      };
      const place = () => {
        const bw = box.clientWidth;
        for (const it of items) {
          const left = ((it.x - vb[0]) / vb[2]) * 100;
          it.pos.style.left = left + '%';
          it.pos.style.top = ((it.y - vb[1]) / vb[3]) * 100 + '%';
          if (it.pos.classList.contains('is-label')) it.pos.style.maxWidth = Math.max(60, (left / 100) * bw - 6) + 'px'; // long names wrap instead of leaving the box
          if (it.chip) it.pos.style.setProperty('--dx', chipShift(bw, (left / 100) * bw, it.chip.offsetWidth) + 'px');
        }
      };
      const setVb = () => {
        const bw = box.clientWidth;
        const mobile = (box.parentElement?.clientWidth ?? 999) < 480;
        vb = VB.desktop;
        if (mobile) {
          // phones: widen the left margin of the viewBox just enough that the widest course name fits left of its riser on one line
          let m = 30;
          for (const it of items) {
            const n = it.pos.querySelector<HTMLElement>('.ha-name');
            if (!n) continue;
            const w = n.scrollWidth + 10; // (it.x + m) * bw / (700 + m) >= w
            if (w < bw) m = Math.max(m, (w * 700 - it.x * bw) / (bw - w));
          }
          m = Math.min(260, m);
          vb = [-m, 70, 700 + m, 580];
        }
        svg.setAttribute('viewBox', vb.join(' '));
        box.style.setProperty('--r', String(vb[2] / vb[3]));
        box.style.setProperty('--u', `calc(100cqw / ${vb[2]})`);
        place();
      };

      // ---- static scene build ----
      function buildFloor() {
        const grid = $('grid');
        const step = 40;
        const line = (a: P2, b: P2) => el('line', { x1: a[0], y1: a[1], x2: b[0], y2: b[1] }, grid);
        for (let x = -280; x <= 480; x += step) line(iso(x, -520), iso(x, 240));
        for (let y = -520; y <= 240; y += step) line(iso(-280, y), iso(480, y));
        const c = iso(100, -140);
        Object.entries({ cx: c[0] + 10, cy: c[1] + 40, rx: 380, ry: 200 }).forEach(([k, v]) => $('gridMaskEl').setAttribute(k, String(v)));
        Object.entries({ cx: c[0], cy: c[1] + 30, rx: 330, ry: 170 }).forEach(([k, v]) => $('floorSpot').setAttribute(k, String(v)));
      }
      function buildBlocks() {
        const { W, D, H } = G;
        const sh = $('shadows'), ct = $('contact'), bl = $('blocks');
        COURSES.forEach((_, k) => {
          const f = -k * D, b = -(k + 1) * D, z = (k + 1) * H, dx = z * 0.9, dy = z * 0.25;
          el('polygon', { points: pts([[0, f + 4, 0], [W, f + 4, 0], [W + dx, f + dy, 0], [W + dx, b + dy, 0], [W, b, 0]]), fill: 'var(--hx-shadow)' }, sh);
        });
        sh.style.opacity = 'var(--shadow-o)';
        el('polygon', { points: pts([[-2, 3, 0], [W + 3, 3, 0], [W + 3, -3 * D, 0], [-2, -3 * D, 0]]), fill: 'var(--hx-shadow)' }, ct);
        ct.style.opacity = 'calc(var(--shadow-o) * 1.3)';
        for (let k = COURSES.length - 1; k >= 0; k--) {
          const f = -k * D, b = -(k + 1) * D, z = (k + 1) * H;
          const g = el('g', { id: `block-${k}`, class: 'block' }, bl);
          el('polygon', { points: pts([[0, f, z], [W, f, z], [W, f, 0], [0, f, 0]]), fill: 'url(#gLeft)' }, g);
          el('polygon', { points: pts([[W, f, z], [W, b, z], [W, b, 0], [W, f, 0]]), fill: 'url(#gRight)' }, g);
          el('polygon', { points: pts([[0, f, z], [W, f, z], [W, b, z], [0, b, z]]), fill: 'url(#gTop)' }, g);
          el('polygon', { id: `lit-${k}`, points: pts([[0, f, z], [W, f, z], [W, b, z], [0, b, z]]), fill: 'url(#gLit)', opacity: 0 }, g);
          const edge = [[0, b, z], [0, f, z], [W, f, z], [W, b, z]];
          el('polyline', { class: 'edge-hi', points: pts(edge) }, g);
          el('polyline', { class: 'edge-glow', id: `glow-${k}`, points: pts([[0, b, z], [0, f, z], [W, f, z], [W, b, z], [0, b, z]]), filter: 'url(#fGlow)' }, g);
          el('polyline', { class: 'edge-lit', id: `edge-${k}`, points: pts([[0, b, z], [0, f, z], [W, f, z], [W, b, z], [0, b, z]]), opacity: 0 }, g);
        }
      }
      function buildLabels() {
        const L = $('labels');
        COURSES.forEach((c, k) => {
          const [cx, cy] = iso(0, -k * G.D, (k + 1) * G.H);
          const g = el('g', { id: `label-${k}`, class: 'ha-label', 'data-k': k }, L);
          const ax = cx - 24;
          el('line', { class: 'ha-lead', x1: ax + 8, y1: cy, x2: cx - 5, y2: cy }, g);
          el('circle', { class: 'lead-dot', cx, cy, r: 3.4 }, g);
          el('circle', { class: 'lead-dot-on', id: `dot-${k}`, cx, cy, r: 3.4, opacity: 0 }, g);
          // text: HTML, right-aligned to (ax, cy + 10)
          const pos = addOv('is-label', ax, cy + 10);
          const t = h('div', 'ha-ltxt ha-label', pos);
          t.dataset.k = String(k);
          h('span', 'ha-cap', t, c.cap);
          h('span', 'ha-name', t, c.name);
        });
      }
      const badgePos = (k: number) => iso(46, -(k + 0.4) * G.D, (k + 1) * G.H);
      function buildBadges() {
        const B = $('badges');
        COURSES.forEach((c, k) => {
          const [x, y] = badgePos(k);
          const wrap = el('g', { transform: `translate(${x.toFixed(2)},${y.toFixed(2)})` }, B);
          el('ellipse', { cx: 0, cy: 0, rx: 15, ry: 7.5, fill: 'var(--fig-shadow)', filter: 'url(#fBlur2)', opacity: 0.35, class: 'tile-shadow', id: `tshadow-${k}` }, wrap);
          const g = el('g', { id: `badge-${k}`, class: 'ha-badge' }, wrap);
          const t = el('g', { transform: 'translate(-22,-62)' }, g);
          el('rect', { class: 'tile-bg', x: 0, y: 0, width: 44, height: 44, rx: 12, filter: 'url(#ha-fCard)' }, t);
          el('path', { class: 'tile-hi', d: 'M10 1.2H34' }, t);
          el('use', { href: `#ha-glyph-${c.glyph}`, x: 10, y: 10 }, t);
        });
      }
      const MEDAL = { world: [128, -352, 3 * G.H] as [number, number, number], lift: 118 };
      const medalXY = (): P2 => {
        const [x, y] = iso(...MEDAL.world);
        return [x, y - MEDAL.lift];
      };
      function buildGoal() {
        const [mx, my] = medalXY();
        const goal = $('goal');
        el('circle', { class: 'ghost', id: 'ghost', cx: mx, cy: my, r: 30 }, goal);
        const R = $('reward');
        const m = el('g', { transform: `translate(${mx},${my})` }, R);
        el('circle', { id: 'halo', r: 96, fill: 'url(#ha-gHalo)' }, m);
        const parts = el('g', { id: 'parts' }, m);
        for (let i = 0; i < 12; i++) el('path', { class: 'spark' + (i % 3 === 0 ? ' g' : ''), d: sparkPath(i % 2 ? 4.2 : 6), opacity: 0 }, parts);
        const medal = el('g', { id: 'medal' }, m);
        el('path', { class: 'medal-ring', d: rosette(31, 28, 16), 'stroke-linejoin': 'round', stroke: 'url(#ha-gGold)', 'stroke-width': 3, filter: 'url(#ha-fCard)' }, medal);
        el('circle', { class: 'medal-in', r: 21.5 }, medal);
        el('circle', { r: 21.5, fill: 'none', stroke: 'var(--gold)', 'stroke-opacity': 0.35, 'stroke-width': 1 }, medal);
        el('path', { class: 'medal-glyph', d: 'M-9 .5l6.2 6.2L10-6.5' }, medal);
        // goal chip: HTML, centred 66 units above the medal centre, kept inside the art box
        const pos = addOv('is-chip', mx, my - 66);
        const chip = h('div', 'ha-goal', pos, GOAL_TEXT);
        chip.id = 'goalChip';
        items[items.length - 1].chip = chip;
      }

      // ---- walker rig: procedural gait with planted feet + 2-bone IK ----
      type Foot = { u: number; v: number; g: number; f: number; sw: boolean };
      function foot(s: number, par: number): Foot {
        const { S, DUTY } = G;
        let n = Math.floor((s + DUTY * S - PLANT0) / S);
        if ((((n - par) % 2) + 2) % 2) n -= 1;
        const u0 = n * S + PLANT0, v0 = ground(u0), stEnd = u0 + DUTY * S;
        if (s <= stEnd) return { u: u0, v: v0, g: v0, f: 0, sw: false };
        const f = clamp((s - stEnd) / ((2 - 2 * DUTY) * S)), u1 = u0 + 2 * S, v1 = ground(u1), dv = v1 - v0;
        const u = u0 + (u1 - u0) * sineIO(f);
        const vf = dv > 0 ? smooth(f / 0.5) : smooth((f - 0.5) / 0.5);
        return { u, v: v0 + dv * vf + (4.5 + 0.4 * Math.abs(dv)) * Math.sin(Math.PI * f), g: ground(u), f, sw: true };
      }
      function ik(hp: P2, a: number, b: number, t0: P2) {
        let t = t0;
        let dx = t[0] - hp[0], dy = t[1] - hp[1], d = Math.hypot(dx, dy);
        const max = a + b - 0.01;
        if (d > max) {
          t = [hp[0] + (dx / d) * max, hp[1] + (dy / d) * max];
          d = max;
          dx = t[0] - hp[0];
          dy = t[1] - hp[1];
        }
        const base = Math.atan2(dy, dx), A = Math.acos(clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1));
        const ang = base + A;
        return { k: [hp[0] + a * Math.cos(ang), hp[1] + a * Math.sin(ang)] as P2, t };
      }
      const rot = (p: P2, deg: number): P2 => {
        const c = Math.cos(rad(deg)), s = Math.sin(rad(deg));
        return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c];
      };
      function pose(s: number, st: number) {
        const A = foot(s, 0), B = foot(s, 1);
        let hipU = s;
        if (st > 0) {
          const fr = A.u >= B.u ? A : B, bk = fr === A ? B : A, e = sineIO(st);
          hipU = s + (fr.u - s) * smooth(st);
          bk.u = bk.u + (fr.u - 1.5 - bk.u) * e;
          bk.v = bk.v + (fr.v - bk.v) * e + 7 * Math.sin(Math.PI * clamp(st));
          bk.g = fr.g;
          bk.sw = st < 1;
          bk.f = st;
        }
        const bob = 1.1 * Math.cos((2 * Math.PI * (hipU - PLANT0)) / G.S) * (1 - st);
        const hip: P2 = [hipU, groundSmooth(hipU) + G.HIP + bob + 1.2 * st];
        const lean = (4 + 7 * climbBump(hipU)) * (1 - 0.6 * st);
        const L = (fp: Foot) => {
          const r = ik(hip, G.THIGH, G.SHIN, [fp.u, fp.v + 3 * G.BS]);
          const p = fp.sw ? -18 * Math.sin(2 * Math.PI * fp.f) : 0;
          const heel = rot([-3.5 * G.BS, -2.3 * G.BS], p), toe = rot([8 * G.BS, -2.6 * G.BS], p);
          return { knee: r.k, ank: r.t, heel: [r.t[0] + heel[0], r.t[1] + heel[1]] as P2, toe: [r.t[0] + toe[0], r.t[1] + toe[1]] as P2, g: fp.g };
        };
        const legN = L(A), legF = L(B);
        const off = (p: P2): P2 => {
          const r = rot([p[0] * G.BS, p[1] * G.BS], lean);
          return [hip[0] + r[0], hip[1] + r[1]];
        };
        const arm = (theta: number) => {
          const sh = off([0.2, 25.5]);
          const th = theta + lean * 0.6, fl = 16 + 0.5 * Math.max(0, theta);
          const e: P2 = [sh[0] + G.UARM * Math.sin(rad(th)), sh[1] - G.UARM * Math.cos(rad(th))];
          const hd: P2 = [e[0] + G.LARM * Math.sin(rad(th + fl)), e[1] - G.LARM * Math.cos(rad(th + fl))];
          return { sh, e, h: hd };
        };
        const sw = (k: number) => 26 * clamp(k / (0.9 * G.S), -1, 1) * (1 - st) + 3 * st;
        return {
          hip, lean, legN, legF, A, B,
          armN: arm(sw(B.u - hipU)), armF: arm(sw(A.u - hipU)),
          torso: ([[-6.5, -1], [6, -1], [7.2, 12], [6.6, 21.5], [3.6, 28.6], [-3.6, 29.6], [-7.6, 24], [-8.2, 10]] as P2[]).map(off),
          pelvis: ([[-6, 1.5], [5.6, 1.5], [5.2, -6.5], [-5.6, -6.5]] as P2[]).map(off),
          pack: ([[-7.6, 24.5], [-14.6, 23], [-15.6, 9.5], [-8.2, 8.4]] as P2[]).map(off),
          hood: ([[-3, 28.4], [-8.2, 30], [-7.2, 34], [-1.6, 31.5]] as P2[]).map(off),
          neck: [off([1.2, 28]), off([2, 32.5])],
          head: off([2.7, 38.6]),
        };
      }
      const FIG: Record<string, Element> = {};
      function buildFigure() {
        const g = $('fig');
        const mk = (name: string, tag: string, attrs: Record<string, string | number>) => (FIG[name] = el(tag, attrs, g));
        mk('shA', 'ellipse', { class: 'fshadow', rx: 10.8, ry: 5.28, filter: 'url(#fBlur2)' });
        mk('shB', 'ellipse', { class: 'fshadow', rx: 10.8, ry: 5.28, filter: 'url(#fBlur2)' });
        mk('armF', 'polyline', { class: 'limb', stroke: 'var(--fig-top-far)', 'stroke-width': 6.72 });
        mk('handF', 'circle', { class: 'skin', r: 3.12 });
        mk('shoeFo', 'polyline', { class: 'limb', stroke: 'var(--fig-shoe-line)', 'stroke-width': 7.92 });
        mk('shoeF', 'polyline', { class: 'limb', stroke: 'var(--fig-shoe)', 'stroke-width': 5.04, opacity: 0.85 });
        mk('legF', 'polyline', { class: 'limb', stroke: 'var(--fig-pants-far)', 'stroke-width': 8.88 });
        mk('pelvis', 'polygon', { fill: 'var(--fig-pants)', stroke: 'var(--fig-pants)', 'stroke-width': 3.6, 'stroke-linejoin': 'round' });
        mk('shoeNo', 'polyline', { class: 'limb', stroke: 'var(--fig-shoe-line)', 'stroke-width': 7.92 });
        mk('shoeN', 'polyline', { class: 'limb', stroke: 'var(--fig-shoe)', 'stroke-width': 5.04 });
        mk('legN', 'polyline', { class: 'limb', stroke: 'var(--fig-pants)', 'stroke-width': 9.12 });
        mk('pack', 'polygon', { fill: 'var(--fig-pack)', stroke: 'var(--fig-pack)', 'stroke-width': 4.8, 'stroke-linejoin': 'round' });
        mk('hood', 'polygon', { fill: 'var(--fig-top-far)', stroke: 'var(--fig-top-far)', 'stroke-width': 3.0, 'stroke-linejoin': 'round' });
        mk('torso', 'polygon', { fill: 'var(--fig-top)', stroke: 'var(--fig-top)', 'stroke-width': 2.88, 'stroke-linejoin': 'round' });
        mk('neck', 'polyline', { class: 'limb', stroke: 'var(--fig-skin)', 'stroke-width': 5.52 });
        mk('hair', 'circle', { class: 'hair', r: 9.12 });
        mk('face', 'circle', { class: 'skin', r: 7.4 });
        mk('armN', 'polyline', { class: 'limb', stroke: 'var(--fig-top)', 'stroke-width': 6.96 });
        mk('handN', 'circle', { class: 'skin', r: 3.24 });
      }
      const LAT: Record<string, number> = { legN: 5, legF: -5, armN: 8.6, armF: -8.6 };
      const proj = (p: P2, l = 0): P2 => iso(G.LANE + l, G.Y0 - p[0], p[1]);
      const S2 = (a: P2[]) => a.map((p) => p.map((n) => n.toFixed(2)).join(',')).join(' ');
      const set = (e: Element, k: string, v: string | number) => e.setAttribute(k, typeof v === 'number' ? v.toFixed(2) : v);
      function drawFigure(s: number, st: number) {
        const P = pose(s, st);
        const leg = (k: 'legN' | 'legF', lg: typeof P.legN) => {
          const l = LAT[k];
          set(FIG[k], 'points', S2([proj(P.hip, l), proj(lg.knee, l), proj(lg.ank, l)]));
          const sh = k === 'legN' ? ['shoeN', 'shoeNo'] : ['shoeF', 'shoeFo'];
          const pp = S2([proj(lg.heel, l), proj(lg.toe, l)]);
          set(FIG[sh[0]], 'points', pp);
          set(FIG[sh[1]], 'points', pp);
        };
        leg('legN', P.legN);
        leg('legF', P.legF);
        ([['shA', P.legN, LAT.legN, P.A], ['shB', P.legF, LAT.legF, P.B]] as const).forEach(([id, lg, l, fp]) => {
          const c = iso(G.LANE + l, G.Y0 - (lg.ank[0] + 2), fp.g);
          const hh = clamp(1 - (lg.ank[1] - 3 - fp.g) / 16);
          set(FIG[id], 'cx', c[0]);
          set(FIG[id], 'cy', c[1]);
          set(FIG[id], 'opacity', (hh * 0.9).toFixed(3));
        });
        const arm = (k: string, hand: string, a: { sh: P2; e: P2; h: P2 }) => {
          const l = LAT[k];
          set(FIG[k], 'points', S2([proj(a.sh, l), proj(a.e, l), proj(a.h, l)]));
          const hp = proj(a.h, l);
          set(FIG[hand], 'cx', hp[0]);
          set(FIG[hand], 'cy', hp[1]);
        };
        arm('armN', 'handN', P.armN);
        arm('armF', 'handF', P.armF);
        set(FIG.pelvis, 'points', S2(P.pelvis.map((p) => proj(p))));
        set(FIG.torso, 'points', S2(P.torso.map((p) => proj(p))));
        set(FIG.pack, 'points', S2(P.pack.map((p) => proj(p, -1))));
        set(FIG.hood, 'points', S2(P.hood.map((p) => proj(p))));
        set(FIG.neck, 'points', S2(P.neck.map((p) => proj(p))));
        const hd = proj(P.head);
        set(FIG.hair, 'cx', hd[0]);
        set(FIG.hair, 'cy', hd[1]);
        // face shifted toward walking direction (screen up-right) and slightly down
        set(FIG.face, 'cx', hd[0] + 2.5);
        set(FIG.face, 'cy', hd[1] + 1.5);
        return P;
      }

      // ---- front-facing rig (celebration): screen-space, same proportions as the walker ----
      const C = { turn: 0, squat: 0, lift: 0, arms: 0, pack: 0, bob: 0, tilt: 0 };
      const FR: Record<string, Element> = {};
      function buildFront() {
        const g = $('figFront');
        const mk = (n: string, tag: string, a: Record<string, string | number>) => (FR[n] = el(tag, a, g));
        const stroke = (c: string, w: number) => ({ stroke: c, 'stroke-width': w, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
        mk('sh', 'ellipse', { class: 'fshadow', rx: 17, ry: 7, filter: 'url(#fBlur2)' });
        mk('pack', 'rect', { fill: 'var(--fig-pack)', rx: 4.5, width: 19, height: 25 });
        mk('legL', 'polyline', { class: 'limb', ...stroke('var(--fig-pants-far)', 8.9) });
        mk('legR', 'polyline', { class: 'limb', ...stroke('var(--fig-pants)', 8.9) });
        ['L', 'R'].forEach((k) => {
          mk('shoeO' + k, 'polyline', { stroke: 'var(--fig-shoe-line)', 'stroke-width': 8.2, fill: 'none', 'stroke-linecap': 'round' });
          mk('shoe' + k, 'polyline', { stroke: 'var(--fig-shoe)', 'stroke-width': 5.2, fill: 'none', 'stroke-linecap': 'round' });
        });
        mk('pelvis', 'polygon', { fill: 'var(--fig-pants)', stroke: 'var(--fig-pants)', 'stroke-width': 3, 'stroke-linejoin': 'round' });
        mk('armL', 'polyline', stroke('var(--fig-top-far)', 6.8));
        mk('armR', 'polyline', stroke('var(--fig-top)', 6.8));
        mk('torso', 'polygon', { fill: 'var(--fig-top)', stroke: 'var(--fig-top)', 'stroke-width': 2.6, 'stroke-linejoin': 'round' });
        mk('strapL', 'polyline', { stroke: 'var(--fig-pack)', 'stroke-width': 2.6, fill: 'none', 'stroke-linecap': 'round' });
        mk('strapR', 'polyline', { stroke: 'var(--fig-pack)', 'stroke-width': 2.6, fill: 'none', 'stroke-linecap': 'round' });
        mk('neck', 'polyline', { stroke: 'var(--fig-skin)', 'stroke-width': 5.5, fill: 'none', 'stroke-linecap': 'round' });
        mk('hair', 'circle', { class: 'hair', r: 9.3 });
        mk('face', 'circle', { class: 'skin', r: 7.9 });
        mk('handL', 'circle', { class: 'skin', r: 3.3 });
        mk('handR', 'circle', { class: 'skin', r: 3.3 });
      }
      let GP: P2 = [0, 0]; // ground point under the body (screen), refreshed from the walker
      function drawFront() {
        const [gx, gy] = GP, sq = C.squat, lift = Math.max(0, C.lift) + 2.4 * Math.abs(Math.sin(Math.PI * C.bob));
        const tuck = clamp(C.lift / 24) * 0.6;
        const legExt = 52.2 - 13 * sq - 15 * tuck;
        const footY = gy - lift, hipY = footY - legExt;
        const Pt = (x: number, y: number) => `${(gx + x).toFixed(2)},${y.toFixed(2)}`;
        const leg = (side: number, id: string) => {
          const hx = side * 5.4, kx = side * (5.8 + 6 * sq + 5 * tuck), fx = side * (6.6 + 1.6 * sq + 3 * tuck);
          set(FR[id], 'points', [Pt(hx, hipY), Pt(kx, hipY + legExt * 0.5), Pt(fx, footY - 3.4)].join(' '));
          const sh = [Pt(fx - 3.2 + side * 0.6, footY - 1.2), Pt(fx + 3.2 + side * 0.6, footY - 1.2)].join(' ');
          set(FR['shoe' + (side < 0 ? 'L' : 'R')], 'points', sh);
          set(FR['shoeO' + (side < 0 ? 'L' : 'R')], 'points', sh);
        };
        leg(-1, 'legL');
        leg(1, 'legR');
        set(FR.pelvis, 'points', [Pt(-7, hipY - 2), Pt(7, hipY - 2), Pt(6.6, hipY + 6), Pt(-6.6, hipY + 6)].join(' '));
        const ty = hipY + 1; // torso base
        set(FR.torso, 'points', [Pt(-7.4, ty), Pt(7.4, ty), Pt(8.8, ty - 20), Pt(9.6, ty - 30), Pt(6, ty - 34.5), Pt(-6, ty - 34.5), Pt(-9.6, ty - 30), Pt(-8.8, ty - 20)].join(' '));
        set(FR.pack, 'x', gx - 9.5);
        set(FR.pack, 'y', ty - 37.5 + C.pack);
        set(FR.strapL, 'points', [Pt(-5.6, ty - 33.5), Pt(-6.4, ty - 17 + C.pack * 0.3)].join(' '));
        set(FR.strapR, 'points', [Pt(5.6, ty - 33.5), Pt(6.4, ty - 17 + C.pack * 0.3)].join(' '));
        set(FR.neck, 'points', [Pt(0, ty - 33), Pt(0, ty - 38)].join(' '));
        const hx = gx + C.tilt * 1.2, hy = ty - 46.6;
        set(FR.hair, 'cx', hx);
        set(FR.hair, 'cy', hy);
        set(FR.face, 'cx', hx + C.tilt * 0.8);
        set(FR.face, 'cy', hy + 1.9);
        const arm = (side: number, id: string, hid: string) => {
          const a = rad(lerp(9, 152, C.arms) + (side < 0 ? 2 : 0)), b = rad(lerp(10, -20, clamp(C.arms)));
          const sx = side * 9.2, sy = ty - 30.5;
          const ex = sx + side * G.UARM * Math.sin(a), ey = sy + G.UARM * Math.cos(a);
          const hx2 = ex + side * G.LARM * Math.sin(a + b), hy2 = ey + G.LARM * Math.cos(a + b);
          set(FR[id], 'points', [Pt(sx, sy), Pt(ex, ey), Pt(hx2, hy2)].join(' '));
          set(FR[hid], 'cx', gx + hx2);
          set(FR[hid], 'cy', hy2);
        };
        arm(-1, 'armL', 'handL');
        arm(1, 'armR', 'handR');
        const k = 1 - clamp(lift / 40) * 0.45;
        set(FR.sh, 'cx', gx);
        set(FR.sh, 'cy', gy + 1);
        set(FR.sh, 'rx', 17 * k);
        set(FR.sh, 'ry', 7 * k);
        set(FR.sh, 'opacity', (0.75 * k).toFixed(3));
      }
      // 2D "turn": profile squeezes out, front squeezes in, around the body axis
      function drawTurn() {
        const t = C.turn, cx = GP[0];
        const sp = Math.max(0, 1 - smooth(t / 0.5)), sf = smooth((t - 0.5) / 0.5);
        const fig = $('fig'), front = $('figFront');
        fig.setAttribute('transform', `translate(${cx} 0) scale(${Math.max(sp, 0.001).toFixed(3)} 1) translate(${-cx} 0)`);
        fig.style.visibility = sp <= 0.001 ? 'hidden' : 'visible';
        front.setAttribute('transform', `translate(${cx} 0) scale(${Math.max(sf, 0.001).toFixed(3)} 1) translate(${-cx} 0)`);
        front.style.visibility = sf <= 0.001 ? 'hidden' : 'visible';
      }
      const headScreen = (s: number) => proj(pose(s, 0).head);

      // ---- XP chips + ripples (positions precomputed from the rig) ----
      const LAND = RISERS.map((r) => r - (G.DUTY - 0.5) * G.S); // body-s when lead foot plants on the new step
      function buildFx() {
        const R = $('ripples');
        COURSES.forEach((c, k) => {
          const [hx, hy] = headScreen(LAND[k]);
          const pos = addOv('', hx - 6, hy - 40);
          pos.style.translate = '-50% -50%';
          const chip = h('div', 'ha-xp', pos, `+${c.xp} XP`);
          chip.id = `xp-${k}`;
          const u = RISERS[k] + G.S / 2;
          const [rx, ry] = iso(G.LANE + 4, G.Y0 - u - 2, (k + 1) * G.H);
          el('ellipse', { class: 'ripple', id: `rip-${k}`, cx: rx, cy: ry, rx: 30, ry: 17, opacity: 0 }, R);
        });
      }

      buildFloor(); buildBlocks(); buildLabels(); buildBadges(); buildGoal(); buildFigure(); buildFront(); buildFx();
      setVb();

      const W = { s: TIME.s0, settle: 0 };
      const draw = () => {
        const P = drawFigure(W.s, W.settle);
        GP = iso(G.LANE, G.Y0 - P.hip[0], ground(P.hip[0]));
        drawFront();
        drawTurn();
      };
      draw();

      // ---- timelines ----
      const blocks = COURSES.map((_, k) => $(`block-${k}`));
      const introTl = gsap
        .timeline({ defaults: { ease: 'expo.out' } })
        .fromTo('#floor', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: 'power1.out' }, 0)
        .fromTo('#shadowWrap', { autoAlpha: 0 }, { autoAlpha: 1, duration: 1.1, ease: 'power1.out' }, 0.25)
        .fromTo(blocks, { y: 26, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.1, stagger: 0.11 }, 0.05)
        .fromTo('.ha-label', { autoAlpha: 0, x: -8 }, { autoAlpha: 0.42, x: 0, duration: 0.9, stagger: 0.11 }, 0.35)
        .fromTo('#ghost', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.8, ease: 'power1.out' }, 0.7);

      const vLin = TIME.speed, tWalk = 0.15;
      const tAt = (s: number) => tWalk + (s - TIME.s0) / vLin;
      const decel = (2 * (TIME.sEnd - TIME.sLin)) / vLin;
      const tEnd = tAt(TIME.sLin) + decel;
      // lazy:false + callbacks on every seek: a paused or reduced-motion frame must redraw (tl.seek(label, false) fires onUpdate)
      const tl = gsap.timeline({ repeat: -1, delay: TIME.intro * 0.7, defaults: { ease: 'power3.out', lazy: false }, onRepeat: () => loop.current() });
      tl.addLabel('walk', 0)
        .fromTo('#figWrap', { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.45, ease: 'power1.out' }, 0)
        .fromTo(C, { turn: 0, squat: 0, lift: 0, arms: 0, pack: 0, bob: 0, tilt: 0 }, { turn: 0, duration: 0.01 }, 0)
        .fromTo(W, { s: TIME.s0, settle: 0 }, { s: TIME.sLin, duration: (TIME.sLin - TIME.s0) / vLin, ease: 'none' }, tWalk)
        .to(W, { s: TIME.sEnd, duration: decel, ease: 'power2.out' })
        .fromTo(W, { settle: 0 }, { settle: 1, duration: TIME.settle, ease: 'power2.inOut', immediateRender: false });

      gsap.set('.ha-badge', { transformOrigin: '50% 100%' });
      COURSES.forEach((_, k) => {
        const t = tAt(LAND[k]);
        const rip = $(`rip-${k}`);
        tl.addLabel(`land${k}`, t)
          .fromTo(`#lit-${k}`, { opacity: 0 }, { keyframes: [{ opacity: 1, duration: 0.7, ease: 'power2.out' }, { opacity: 0.55, duration: 1.4, ease: 'power2.inOut', delay: 0.5 }] }, t)
          .fromTo(`#edge-${k}`, { opacity: 0 }, { keyframes: [{ opacity: 1, duration: 0.35, ease: 'power2.out' }, { opacity: 0.4, duration: 1.4, ease: 'power2.inOut', delay: 0.6 }] }, t)
          .fromTo(`#glow-${k}`, { opacity: 0 }, { keyframes: [{ opacity: 0.75, duration: 0.25, ease: 'power2.out' }, { opacity: 0, duration: 1.6, ease: 'power2.inOut' }] }, t)
          .fromTo(rip, { opacity: 0, scale: 0.25, svgOrigin: `${rip.getAttribute('cx')} ${rip.getAttribute('cy')}` }, { scale: 1.9, duration: 1.1, ease: 'expo.out' }, t)
          .fromTo(rip, { opacity: 0 }, { keyframes: [{ opacity: 0.9, duration: 0.01 }, { opacity: 0, duration: 1.1, ease: 'power2.out' }] }, t)
          .fromTo(`#badge-${k}`, { autoAlpha: 0, scale: 0.55, y: 14 }, { autoAlpha: 1, scale: 1, y: 0, duration: 0.75, ease: 'back.out(1.5)' }, t + 0.08)
          .fromTo(`#tshadow-${k}`, { opacity: 0 }, { opacity: 0.35, duration: 0.6 }, t + 0.08)
          .fromTo(`.ha-label[data-k="${k}"]`, { opacity: 0.42 }, { opacity: 1, duration: 0.45, ease: 'power2.out' }, t)
          .fromTo(`#dot-${k}`, { opacity: 0, scale: 0.3, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, t)
          .fromTo(`#xp-${k}`, { autoAlpha: 0, y: 10, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.6)' }, t + 0.05)
          .to(`#xp-${k}`, { autoAlpha: 0, y: -26, duration: 0.7, ease: 'power2.in' }, t + 1.05);
      });

      // summit: turn to the viewer, anticipation, 3 joyful jumps (arms in a V), then a happy idle
      const CEL = { turn: 0.3, antic: 0.2, jumps: [{ h: 24, up: 0.3, down: 0.27 }, { h: 18, up: 0.27, down: 0.25 }, { h: 12, up: 0.23, down: 0.21 }], gap: 0.2 };
      const tC = tEnd + TIME.settle - 0.05;
      tl.addLabel('celebrate', tC)
        .to(C, { turn: 1, duration: CEL.turn, ease: 'power2.inOut' }, tC)
        .to(C, { squat: 1, arms: -0.08, pack: 2, duration: CEL.antic, ease: 'power2.out' }, tC + CEL.turn - 0.02);
      let j = tC + CEL.turn + CEL.antic;
      const tJump1 = j;
      CEL.jumps.forEach((J, i) => {
        const last = i === CEL.jumps.length - 1;
        tl.to(C, { squat: 0, duration: 0.12, ease: 'power3.out' }, j)
          .to(C, { lift: J.h, duration: J.up, ease: 'power2.out' }, j)
          .to(C, { lift: 0, duration: J.down, ease: 'power2.in' }, j + J.up)
          // backpack follow-through: lags on launch, overshoots at apex, slaps on landing
          .to(C, { keyframes: [{ pack: 3.5, duration: J.up * 0.45, ease: 'power1.out' }, { pack: -3, duration: J.up * 0.55 + J.down * 0.6, ease: 'sine.inOut' }, { pack: 2.5, duration: J.down * 0.4 + 0.08, ease: 'power2.in' }, { pack: 0, duration: 0.3, ease: 'power2.out' }] }, j)
          .to(C, { tilt: i % 2 ? -1 : 1, duration: J.up, ease: 'sine.inOut' }, j);
        if (i === 0) tl.to(C, { arms: 1, duration: 0.42, ease: 'back.out(1.7)' }, j);
        else tl.to(C, { keyframes: [{ arms: 1.06, duration: J.up * 0.6, ease: 'power2.out' }, { arms: 1, duration: J.up * 0.4, ease: 'power1.inOut' }] }, j);
        const land = j + J.up + J.down;
        // landing squash: knees absorb, arms dip slightly (follow-through)
        tl.to(C, { squat: last ? 0.5 : 0.55, duration: 0.1, ease: 'power2.out' }, land)
          .to(C, { arms: 0.86, duration: 0.1, ease: 'power2.out' }, land)
          .to(C, { arms: 1, duration: 0.28, ease: 'power2.out' }, land + 0.1);
        if (last) tl.to(C, { squat: 0, tilt: 0, duration: 0.36, ease: 'power2.out' }, land + 0.1);
        else tl.to(C, { squat: 0.75, duration: CEL.gap - 0.1, ease: 'power2.out' }, land + 0.1);
        j = land + (last ? 0 : CEL.gap);
      });
      const tCheer = j + 0.42; // grounded, arms up: also the reduced-motion frame
      tl.addLabel('cheer', tCheer)
        .to(C, { arms: 0, duration: 0.6, ease: 'power2.inOut' }, tCheer + 0.5)
        .to(C, { bob: 3, duration: 1.65, ease: 'none' }, tCheer + 0.75)
        .to(C, { keyframes: [{ squat: 0.12, duration: 0.12 }, { squat: 0, duration: 0.2 }], repeat: 2 }, tCheer + 0.75);

      // reward synced with the first jump
      const tR = tJump1 - 0.02;
      tl.addLabel('reward', tR)
        .to('#ghost', { autoAlpha: 0, scale: 1.25, transformOrigin: '50% 50%', duration: 0.5, ease: 'power2.out' }, tR)
        .fromTo('#halo', { opacity: 0, scale: 0.4, transformOrigin: '50% 50%' }, { opacity: 1, scale: 1, duration: 1.2, ease: 'expo.out' }, tR + 0.1)
        .fromTo('#medal', { autoAlpha: 0, scale: 0.35, rotation: -25, transformOrigin: '50% 50%' }, { autoAlpha: 1, scale: 1, rotation: 0, duration: 0.95, ease: 'back.out(1.7)' }, tR + 0.08)
        .fromTo('#goalChip', { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, tR + 0.5);
      gsap.utils.toArray<SVGElement>('#parts path', box).forEach((p, i, arr) => {
        const a = -Math.PI / 2 + (i / arr.length) * Math.PI * 2 + (i % 2 ? 0.18 : 0), Rr = (i % 2 ? 52 : 74) + (i % 3) * 6;
        tl.fromTo(p, { opacity: 0, scale: 0.4 }, { keyframes: [{ opacity: 1, scale: 1, duration: 0.18, ease: 'power1.out' }, { opacity: 0, scale: 0.3, duration: 0.9, ease: 'power1.in' }] }, tR + 0.25)
          .fromTo(p, { x: 0, y: 0, rotation: 0 }, { x: Math.cos(a) * Rr, y: Math.sin(a) * Rr * 0.85, rotation: i % 2 ? 45 : -45, duration: 1.1, ease: 'expo.out' }, tR + 0.25);
      });
      tl.addLabel('hold', tCheer)
        .to({}, { duration: TIME.hold + 0.4 }, tCheer)
        .addLabel('out')
        .to(['#figWrap', '#reward', '.ha-badge', '.lead-dot-on', '#goalChip', ...COURSES.flatMap((_, k) => [`#lit-${k}`, `#edge-${k}`, `#glow-${k}`])], { opacity: 0, duration: TIME.out, ease: 'power2.inOut' }, 'out')
        .to('.ha-label', { opacity: 0.42, duration: TIME.out, ease: 'power2.inOut' }, 'out')
        .to('#ghost', { autoAlpha: 1, scale: 1, duration: TIME.out }, 'out')
        .to('.tile-shadow', { opacity: 0, duration: TIME.out }, 'out');

      // redraw the rig once per timeline render (robust to seeks / reversed playback)
      tl.eventCallback('onUpdate', draw);

      // ---- reduced motion, visibility, responsive ----
      const vis = watchVisibility(box, tl);
      const mm = gsap.matchMedia();
      mm.add('(prefers-reduced-motion: reduce)', () => {
        vis.state.reduced = true;
        introTl.progress(1);
        tl.pause();
        tl.seek('cheer', false); // callbacks must fire, otherwise the static frame stays stale
        draw();
        return () => {
          vis.state.reduced = false;
          tl.restart(true);
          vis.sync();
        };
      });
      const ro = new ResizeObserver(() => setVb());
      ro.observe(box.parentElement ?? box);
      document.fonts?.ready.then(setVb);
      vis.sync();
      return () => {
        ro.disconnect();
        vis.stop();
        mm.revert();
      };
    },
    { scope: root, dependencies: [props.names.join('|'), props.caps.join('|'), props.goal] },
  );

  return (
    <div className="hx hxa" ref={root} style={{ width: 'min(100cqw, calc(100cqh * var(--r, 1.145)))', height: 'min(100cqh, calc(100cqw / var(--r, 1.145)))' }}>
      <svg ref={svgRef} className="hx-svg" viewBox="36 70 664 580" role="img" aria-labelledby="hxaT hxaD">
        <title id="hxaT">{props.title}</title>
        <desc id="hxaD">{props.desc}</desc>
      </svg>
      <div ref={ovRef} className="hx-ov" aria-hidden="true" />
    </div>
  );
}
