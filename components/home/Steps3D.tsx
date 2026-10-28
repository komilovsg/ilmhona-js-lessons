'use client';

// Hero variant A as real 3D (Three.js): the same isometric stairs, walker and summit celebration as StepsHero,
// but the camera is orthographic and can be dragged around the scene. Loaded lazily by HeroArt (three is not in the
// first-load bundle); the SVG StepsHero stays as the loading / no-WebGL / error fallback.
//
// World frame (same numbers as StepsHero): x = along a step, y = depth (stairs climb towards -y), z = up.
// Three.js frame: X = x, Y = z, Z = y. The default camera sits at (+X, +Y, +Z) with the true-isometric angles.
import gsap from 'gsap';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import './hero.css';
import { COURSE_XP, GLYPHS, NS, chipShift, glyphDefs, h, rosette, sparkPath, type HeroProps } from './hero-shared';

type Props = HeroProps & { onReady?: () => void; onFail?: () => void };
type P2 = [number, number];
type V3 = THREE.Vector3;

// ---------------------------------------------------------------- config (same numbers as StepsHero)
const G = { O: [196, 506] as P2, W: 200, D: 110, H: 36, LANE: 150, Y0: 70, S: 110 / 3, DUTY: 0.6, BS: 1.2, THIGH: 27.6, SHIN: 27.6, HIP: 52.2, UARM: 16.2, LARM: 15.6 };
const TIME = { intro: 1.1, speed: 66, s0: 16, settle: 0.5, hold: 2.2, out: 0.6 };
const N = 3;
const C30 = Math.cos(Math.PI / 6);
const KB = Math.sqrt(2 / 3); // camera units per svg px (true isometric foreshortening)
const VB_DESKTOP = [36, 70, 664, 580] as const;
const PIVOT = new THREE.Vector3(100, 60, -165); // orbit centre (middle of the stairs)
const DEF_YAW = Math.PI / 4;
const DEF_PITCH = Math.atan(1 / Math.SQRT2); // 35.264 deg
const PITCH_MIN = (5 * Math.PI) / 180;
const PITCH_MAX = (80 * Math.PI) / 180;
const IDLE_RETURN_MS = 2500;
const MEDAL = new THREE.Vector3(128, 3 * G.H + 118, -352);

const clamp = (x: number, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const smooth = (x: number) => {
  x = clamp(x);
  return x * x * (3 - 2 * x);
};
const sineIO = (x: number) => -(Math.cos(Math.PI * clamp(x)) - 1) / 2;
const rad = (d: number) => (d * Math.PI) / 180;
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const iso = (x: number, y: number, z = 0): P2 => [G.O[0] + (x - y) * C30, G.O[1] + (x + y) * 0.5 - z];

// ---------------------------------------------------------------- walker rig (2D profile, ported from StepsHero)
const RISERS = [0, 1, 2].map((k) => G.Y0 + k * G.D);
const PLANT0 = (((RISERS[0] - G.S / 2) % G.S) + G.S) % G.S;
const ground = (u: number) => RISERS.reduce((hh, r) => (u >= r ? hh + G.H : hh), 0);
const groundSmooth = (s: number) => RISERS.reduce((hh, r) => hh + G.H * smooth((s - (r - 0.4 * G.S)) / (1.15 * G.S)), 0);
const S_END = PLANT0 + Math.floor((RISERS[2] + 0.3 * G.D - PLANT0) / G.S) * G.S + G.S / 2;
const S_LIN = S_END - G.S * 0.8;
const climbBump = (s: number) => RISERS.reduce((m, r) => Math.max(m, Math.sin(Math.PI * clamp((s - (r - 0.4 * G.S)) / (1.4 * G.S)))), 0);
const LAND = RISERS.map((r) => r - (G.DUTY - 0.5) * G.S);

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
const rot2 = (p: P2, deg: number): P2 => {
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
    const heel = rot2([-3.5 * G.BS, -2.3 * G.BS], p), toe = rot2([8 * G.BS, -2.6 * G.BS], p);
    return { knee: r.k, ank: r.t, heel: [r.t[0] + heel[0], r.t[1] + heel[1]] as P2, toe: [r.t[0] + toe[0], r.t[1] + toe[1]] as P2, g: fp.g };
  };
  const legN = L(A), legF = L(B);
  const off = (p: P2): P2 => {
    const r = rot2([p[0] * G.BS, p[1] * G.BS], lean);
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
  return { hip, lean, legN, legF, A, B, armN: arm(sw(B.u - hipU)), armF: arm(sw(A.u - hipU)) };
}

// ---------------------------------------------------------------- figure pose in figure space (X lateral, Y up, Z = -forward)
type Joint = { hip: V3; knee: V3; ank: V3; heel: V3; toe: V3 };
type Arm = { sh: V3; el: V3; hd: V3 };
type Pose3 = { legs: [Joint, Joint]; arms: [Arm, Arm]; torsoY: number; lean: number; tilt: number; pack: number };
const v3 = () => new THREE.Vector3();
const mkPose = (): Pose3 => ({
  legs: [0, 1].map(() => ({ hip: v3(), knee: v3(), ank: v3(), heel: v3(), toe: v3() })) as [Joint, Joint],
  arms: [0, 1].map(() => ({ sh: v3(), el: v3(), hd: v3() })) as [Arm, Arm],
  torsoY: 0, lean: 0, tilt: 0, pack: 0,
});
const LAT = [5, -5]; // near leg, far leg
const ALAT = [8.6, -8.6];

/** Walking pose from the 2D rig. Local Z = hipU - u (forward is -Z). */
function walkPose(s: number, st: number, out: Pose3) {
  const P = pose(s, st);
  const hu = P.hip[0];
  const at = (v: V3, p: P2, l: number) => v.set(l, p[1], hu - p[0]);
  [P.legN, P.legF].forEach((lg, i) => {
    const o = out.legs[i];
    o.hip.set(LAT[i], P.hip[1], 0);
    at(o.knee, lg.knee, LAT[i]);
    at(o.ank, lg.ank, LAT[i]);
    at(o.heel, lg.heel, LAT[i]);
    at(o.toe, lg.toe, LAT[i]);
  });
  [P.armN, P.armF].forEach((a, i) => {
    at(out.arms[i].sh, a.sh, ALAT[i]);
    at(out.arms[i].el, a.e, ALAT[i]);
    at(out.arms[i].hd, a.h, ALAT[i]);
  });
  out.torsoY = P.hip[1];
  out.lean = P.lean;
  out.tilt = 0;
  out.pack = 0;
  return { hipU: hu, P };
}

type Cel = { turn: number; squat: number; lift: number; arms: number; pack: number; bob: number; tilt: number };
/** Front-facing celebration pose (same proportions as the SVG front rig). */
function frontPose(C: Cel, g: number, out: Pose3) {
  const sq = C.squat, lift = Math.max(0, C.lift) + 2.4 * Math.abs(Math.sin(Math.PI * C.bob));
  const tuck = clamp(C.lift / 24) * 0.6;
  const legExt = 52.2 - 13 * sq - 15 * tuck;
  const footY = g + lift, hipY = footY + legExt;
  [1, -1].forEach((side, i) => {
    const o = out.legs[i];
    const fx = side * (6.6 + 1.6 * sq + 3 * tuck);
    o.hip.set(side * 5.4, hipY, 0);
    o.knee.set(side * (5.8 + 6 * sq + 5 * tuck), hipY - legExt * 0.5, -(2 + 5 * (sq + tuck)));
    o.ank.set(fx, footY + 3.4, 0);
    o.heel.set(fx, footY + 0.7, 3.5 * G.BS);
    o.toe.set(fx, footY + 0.7, -8 * G.BS);
    const a = rad(lerp(9, 152, C.arms) + (side < 0 ? 2 : 0)), b = rad(lerp(10, -20, clamp(C.arms)));
    const ar = out.arms[i];
    const sx = side * 9.2, sy = hipY + 31.5;
    const ex = sx + side * G.UARM * Math.sin(a), ey = sy - G.UARM * Math.cos(a);
    ar.sh.set(sx, sy, 0);
    ar.el.set(ex, ey, 0);
    ar.hd.set(ex + side * G.LARM * Math.sin(a + b), ey - G.LARM * Math.cos(a + b), 0);
  });
  out.torsoY = hipY + 1;
  out.lean = 0;
  out.tilt = C.tilt;
  out.pack = C.pack;
}
function blendPose(a: Pose3, b: Pose3, e: number, out: Pose3) {
  for (let i = 0; i < 2; i++) {
    const [x, y, o] = [a.legs[i], b.legs[i], out.legs[i]];
    (['hip', 'knee', 'ank', 'heel', 'toe'] as const).forEach((k) => o[k].lerpVectors(x[k], y[k], e));
    const [p, q, r] = [a.arms[i], b.arms[i], out.arms[i]];
    (['sh', 'el', 'hd'] as const).forEach((k) => r[k].lerpVectors(p[k], q[k], e));
  }
  out.torsoY = lerp(a.torsoY, b.torsoY, e);
  out.lean = lerp(a.lean, b.lean, e);
  out.tilt = lerp(a.tilt, b.tilt, e);
  out.pack = lerp(a.pack, b.pack, e);
}

// ---------------------------------------------------------------- palette (theme tokens resolved to rgba)
type Col = { css: string; c: THREE.Color; a: number; rgb: string };
const TOKENS = [
  'top-a', 'top-b', 'left-a', 'left-b', 'right-a', 'right-b', 'edge-hi', 'lit-a', 'accent', 'gold', 'ink', 'ink-3', 'paper', 'bg', 'grid', 'floor-spot',
  'glass', 'glass-stroke', 'card-shadow', 'hx-shadow', 'fig-skin', 'fig-hair', 'fig-top', 'fig-top-far', 'fig-pants', 'fig-pants-far', 'fig-shoe', 'fig-shoe-line',
  'fig-pack', 'fig-shadow',
] as const;
type Pal = Record<(typeof TOKENS)[number], Col>;

function readPalette(root: HTMLElement): { pal: Pal; shadowO: number } {
  const probe = document.createElement('span');
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
  root.appendChild(probe);
  const cv = document.createElement('canvas');
  cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true })!;
  const pal = {} as Pal;
  for (const t of TOKENS) {
    probe.style.color = `var(--${t})`;
    const raw = getComputedStyle(probe).color;
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = 'rgba(0,0,0,0)';
    cx.fillStyle = raw;
    cx.fillRect(0, 0, 1, 1);
    const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data;
    pal[t] = { css: `rgba(${r},${g},${b},${(a / 255).toFixed(3)})`, rgb: `${r},${g},${b}`, c: new THREE.Color().setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace), a: a / 255 };
  }
  const shadowO = parseFloat(getComputedStyle(root).getPropertyValue('--shadow-o')) || 0.16;
  probe.remove();
  return { pal, shadowO };
}

const mixCol = (a: Col, b: Col, t: number) => a.c.clone().lerp(b.c, t);

// ---------------------------------------------------------------- canvas helpers
/** Draw one of the shared 24x24 glyphs (hero-shared glyphDefs) into a 2D canvas. */
function drawGlyph(ctx: CanvasRenderingContext2D, name: string, color: string) {
  const doc = new DOMParser().parseFromString(`<svg xmlns="${NS}">${glyphDefs('t-')}</svg>`, 'image/svg+xml');
  const g = doc.querySelector(`[id="t-glyph-${name}"]`);
  if (!g) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const n of Array.from(g.children)) {
    const filled = n.getAttribute('class') === 'hx-glyph-f';
    ctx.lineWidth = parseFloat((n.getAttribute('style') ?? '').match(/stroke-width:\s*([\d.]+)/)?.[1] ?? '2');
    const num = (a: string) => parseFloat(n.getAttribute(a) ?? '0');
    const path = new Path2D();
    if (n.tagName === 'path') path.addPath(new Path2D(n.getAttribute('d') ?? ''));
    else if (n.tagName === 'circle') path.arc(num('cx'), num('cy'), num('r'), 0, Math.PI * 2);
    else if (n.tagName === 'ellipse') path.ellipse(num('cx'), num('cy'), num('rx'), num('ry'), 0, 0, Math.PI * 2);
    ctx.save();
    const tr = (n.getAttribute('transform') ?? '').match(/rotate\(([-\d.]+)\s+([-\d.]+)\s+([-\d.]+)\)/);
    if (tr) {
      ctx.translate(+tr[2], +tr[3]);
      ctx.rotate(rad(+tr[1]));
      ctx.translate(-tr[2], -tr[3]);
    }
    if (filled) ctx.fill(path);
    else ctx.stroke(path);
    ctx.restore();
  }
  ctx.restore();
}

const roundRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, hh: number, r: number) => {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + hh, r);
  ctx.arcTo(x + w, y + hh, x, y + hh, r);
  ctx.arcTo(x, y + hh, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
};

// ---------------------------------------------------------------- geometry helpers
/** Flat quad strips (XZ plane at height y) along the sides of a rectangle, width w centred on the edge. */
function stripGeom(x0: number, x1: number, z0: number, z1: number, y: number, w: number, sides: [boolean, boolean, boolean, boolean]) {
  // sides: left (x0), front (z1), right (x1), back (z0)
  const q = [
    [x0 - w / 2, z0 - w / 2, x0 + w / 2, z1 + w / 2],
    [x0 - w / 2, z1 - w / 2, x1 + w / 2, z1 + w / 2],
    [x1 - w / 2, z0 - w / 2, x1 + w / 2, z1 + w / 2],
    [x0 - w / 2, z0 - w / 2, x1 + w / 2, z0 + w / 2],
  ];
  const pos: number[] = [];
  q.forEach((r, i) => {
    if (!sides[i]) return;
    const [a, b, c, d] = r;
    pos.push(a, y, b, c, y, b, c, y, d, a, y, b, c, y, d, a, y, d);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  return g;
}

/** Side-profile polygon (forward u, up v; scaled by the body scale) extruded across the body. u maps to -Z. */
function extrudeProfile(pts: P2[], depth: number, bevel: number) {
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p[0] * G.BS, p[1] * G.BS)));
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 1, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  g.rotateY(Math.PI / 2);
  return g;
}

type Limb = { cyl: THREE.Mesh; s0: THREE.Mesh; s1: THREE.Mesh; r: number };

// ================================================================= component
export default function Steps3D(props: Props) {
  const root = useRef<HTMLDivElement>(null);
  const ovRef = useRef<HTMLDivElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const cb = useRef({ loop: props.onLoop, ready: props.onReady, fail: props.onFail });
  useEffect(() => {
    cb.current = { loop: props.onLoop, ready: props.onReady, fail: props.onFail };
  });

  useEffect(() => {
    const box = root.current!;
    // fresh canvas per mount (a context lost via forceContextLoss cannot be reused, e.g. React strict mode remounts)
    const canvas = document.createElement('canvas');
    canvas.className = 'hx3-canvas';
    canvas.tabIndex = 0;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', `${props.title}. ${props.hint ?? ''}`);
    box.insertBefore(canvas, box.firstChild);
    const ov = ovRef.current!;
    const hint = hintRef.current;
    const disposables: { dispose(): void }[] = [];
    const cleanups: (() => void)[] = [];
    const track = <T extends { dispose(): void }>(o: T) => {
      disposables.push(o);
      return o;
    };

    // ---------- renderer (bail out to the SVG fallback when WebGL is missing)
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      canvas.remove();
      cb.current.fail?.();
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x000000, 0);
    const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    let lost = false;
    const onLost = (e: Event) => {
      e.preventDefault();
      lost = true;
      cb.current.fail?.();
    };
    canvas.addEventListener('webglcontextlost', onLost);

    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 10, 4000);
    scene.add(new THREE.AmbientLight(0xffffff, 1.9));
    const sun = new THREE.DirectionalLight(0xffffff, 2.1);
    sun.position.set(0.9, 1.4, 0.7);
    scene.add(sun);

    const reducedMq = matchMedia('(prefers-reduced-motion: reduce)');
    let reduced = reducedMq.matches;
    let needs = true;

    // ---------- palette + redraw registry
    let { pal, shadowO } = readPalette(box);
    const redraws: (() => void)[] = [];
    const recolors: (() => void)[] = [];
    const texOf = (w: number, hh: number, draw: (ctx: CanvasRenderingContext2D) => void, aniso = false) => {
      const cv = document.createElement('canvas');
      cv.width = w;
      cv.height = hh;
      const c2 = cv.getContext('2d')!;
      const tex = track(new THREE.CanvasTexture(cv));
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = aniso ? maxAniso : 1;
      const redraw = () => {
        c2.clearRect(0, 0, w, hh);
        c2.save();
        draw(c2);
        c2.restore();
        tex.needsUpdate = true;
      };
      redraws.push(redraw);
      redraw();
      return tex;
    };
    const basic = (opts: THREE.MeshBasicMaterialParameters) => track(new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, ...opts }));
    const lambert = (key: keyof Pal) => {
      const m = track(new THREE.MeshLambertMaterial({ flatShading: true }));
      recolors.push(() => m.color.copy(pal[key].c));
      return m;
    };

    // ---------- floor: spot + masked grid, and baked block shadows
    const FX0 = -280, FY0 = -520, FSZ = 760;
    const planeXZ = (w: number, hh: number, x: number, y: number, z: number) => {
      const g = track(new THREE.PlaneGeometry(w, hh));
      g.rotateX(-Math.PI / 2);
      g.translate(x, y, z);
      return g;
    };
    const FS = 1536;
    const floorSc = FS / FSZ;
    const floorTex = texOf(FS, FS, (c2) => {
      const wx = (x: number) => (x - FX0) * floorSc, wy = (y: number) => (y - FY0) * floorSc;
      const sp = c2.createRadialGradient(wx(100), wy(-150), 0, wx(100), wy(-150), 300 * floorSc);
      sp.addColorStop(0, pal['floor-spot'].css);
      sp.addColorStop(1, `rgba(${pal['floor-spot'].rgb},0)`);
      c2.fillStyle = sp;
      c2.fillRect(0, 0, FS, FS);
      const gc = document.createElement('canvas');
      gc.width = gc.height = FS;
      const g = gc.getContext('2d')!;
      g.strokeStyle = pal.grid.css;
      g.lineWidth = 1.6;
      g.beginPath();
      for (let x = -280; x <= 480; x += 40) {
        g.moveTo(wx(x), 0);
        g.lineTo(wx(x), FS);
      }
      for (let y = -520; y <= 240; y += 40) {
        g.moveTo(0, wy(y));
        g.lineTo(FS, wy(y));
      }
      g.stroke();
      g.globalCompositeOperation = 'destination-in';
      const m = g.createRadialGradient(wx(100), wy(-130), 0, wx(100), wy(-130), 330 * floorSc);
      m.addColorStop(0, 'rgba(255,255,255,.9)');
      m.addColorStop(0.55, 'rgba(255,255,255,.35)');
      m.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = m;
      g.fillRect(0, 0, FS, FS);
      c2.drawImage(gc, 0, 0);
    }, true);
    const floorMat = basic({ map: floorTex });
    const floor = new THREE.Mesh(planeXZ(FSZ, FSZ, 100, -0.4, -140), floorMat);
    floor.renderOrder = 0;
    scene.add(floor);

    const SS = 1024;
    const shSc = SS / FSZ;
    const shadowTex = texOf(SS, SS, (c2) => {
      const wx = (x: number) => (x - FX0) * shSc, wy = (y: number) => (y - FY0) * shSc;
      const layer = (polys: P2[][], blur: number, alpha: number) => {
        const c = document.createElement('canvas');
        c.width = c.height = SS;
        const g = c.getContext('2d')!;
        g.shadowColor = pal['hx-shadow'].css;
        g.shadowBlur = blur * shSc * 2;
        g.shadowOffsetX = 4000; // draw the shape off-canvas, keep only its blurred shadow
        g.fillStyle = '#000';
        for (const poly of polys) {
          g.beginPath();
          poly.forEach((p, i) => (i ? g.lineTo(wx(p[0]) - 4000, wy(p[1])) : g.moveTo(wx(p[0]) - 4000, wy(p[1]))));
          g.closePath();
          g.fill();
        }
        c2.globalAlpha = alpha;
        c2.drawImage(c, 0, 0);
      };
      const { W, D, H } = G;
      const polys: P2[][] = [0, 1, 2].map((k) => {
        const f = -k * D, b = -(k + 1) * D, z = (k + 1) * H, dx = z * 0.9, dy = z * 0.25;
        return [[0, f + 4], [W, f + 4], [W + dx, f + dy], [W + dx, b + dy], [W, b]];
      });
      layer(polys, 14, shadowO);
      layer([[[-2, 3], [W + 3, 3], [W + 3, -3 * D], [-2, -3 * D]]], 2.5, Math.min(1, shadowO * 1.3));
    });
    const shadowMat = basic({ map: shadowTex });
    const shadow = new THREE.Mesh(planeXZ(FSZ, FSZ, 100, -0.2, -140), shadowMat);
    shadow.renderOrder = 1;
    scene.add(shadow);

    // ---------- stair blocks
    type Blk = { mat: THREE.MeshBasicMaterial; geo: THREE.BufferGeometry; litMat: THREE.MeshBasicMaterial; litGeo: THREE.BufferGeometry; edgeMat: THREE.MeshBasicMaterial; glow: THREE.MeshBasicMaterial[]; hiMat: THREE.MeshBasicMaterial; grp: THREE.Group };
    const blk: Blk[] = [];
    for (let k = 0; k < N; k++) {
      const hgt = (k + 1) * G.H, z0 = -(k + 1) * G.D, z1 = -k * G.D;
      const grp = new THREE.Group();
      const geo = track(new THREE.BoxGeometry(G.W, hgt, G.D).toNonIndexed());
      geo.translate(G.W / 2, hgt / 2, (z0 + z1) / 2);
      geo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(geo.attributes.position.count * 3), 3));
      const mat = basic({ vertexColors: true, depthWrite: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.renderOrder = 2;
      grp.add(mesh);
      // lit overlay on the top face (gradient alpha)
      const litGeo = track(new THREE.PlaneGeometry(G.W, G.D, 1, 1));
      litGeo.rotateX(-Math.PI / 2);
      litGeo.translate(G.W / 2, hgt + 0.15, (z0 + z1) / 2);
      litGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(litGeo.attributes.position.count * 4), 4));
      const litMat = basic({ vertexColors: true, opacity: 0 });
      const lit = new THREE.Mesh(litGeo, litMat);
      lit.renderOrder = 3;
      grp.add(lit);
      // edges
      const hiMat = basic({ opacity: 1, side: THREE.DoubleSide });
      const hi = new THREE.Mesh(track(stripGeom(0, G.W, z0, z1, hgt + 0.3, 1.5, [true, true, true, false])), hiMat);
      hi.renderOrder = 4;
      const edgeMat = basic({ opacity: 0, side: THREE.DoubleSide });
      const edge = new THREE.Mesh(track(stripGeom(0, G.W, z0, z1, hgt + 0.45, 2.2, [true, true, true, true])), edgeMat);
      edge.renderOrder = 5;
      const glowA = basic({ opacity: 0, side: THREE.DoubleSide }), glowB = basic({ opacity: 0, side: THREE.DoubleSide });
      const gA = new THREE.Mesh(track(stripGeom(0, G.W, z0, z1, hgt + 0.35, 7, [true, true, true, true])), glowA);
      const gB = new THREE.Mesh(track(stripGeom(0, G.W, z0, z1, hgt + 0.32, 14, [true, true, true, true])), glowB);
      gA.renderOrder = gB.renderOrder = 4;
      grp.add(hi, edge, gA, gB);
      scene.add(grp);
      blk.push({ mat, geo, litMat, litGeo, edgeMat, glow: [glowA, glowB], hiMat, grp });
    }
    const paintBlocks = () => {
      const face = new THREE.Color();
      blk.forEach((b, k) => {
        const hgt = (k + 1) * G.H, z1 = -k * G.D;
        const pos = b.geo.attributes.position, nor = b.geo.attributes.normal, col = b.geo.attributes.color as THREE.BufferAttribute;
        for (let i = 0; i < pos.count; i++) {
          const nx = nor.getX(i), ny = nor.getY(i), nz = nor.getZ(i);
          const ty = clamp(pos.getY(i) / hgt);
          if (ny > 0.5) face.copy(mixCol(pal['top-a'], pal['top-b'], clamp((pos.getX(i) / G.W + (z1 - pos.getZ(i)) / G.D) / 2)));
          else if (ny < -0.5) face.copy(pal['left-b'].c);
          else if (nx > 0.5) face.copy(mixCol(pal['right-a'], pal['right-b'], 1 - ty));
          else if (nx < -0.5) face.copy(mixCol(pal['right-a'], pal['right-b'], 1 - ty)).multiplyScalar(0.92);
          else if (nz > 0.5) face.copy(mixCol(pal['left-a'], pal['left-b'], 1 - ty)); // front: the visible "left" face
          else face.copy(mixCol(pal['left-a'], pal['left-b'], 1 - ty)).multiplyScalar(0.92);
          col.setXYZ(i, face.r, face.g, face.b);
        }
        col.needsUpdate = true;
        const lp = b.litGeo.attributes.position, lc = b.litGeo.attributes.color as THREE.BufferAttribute;
        const la = pal['lit-a'].c;
        for (let i = 0; i < lp.count; i++) {
          const t = clamp((lp.getX(i) / G.W + (z1 - lp.getZ(i)) / G.D) / 2);
          lc.setXYZW(i, la.r, la.g, la.b, lerp(1, 0.35, t));
        }
        lc.needsUpdate = true;
        b.hiMat.color.copy(pal['edge-hi'].c);
        b.hiMat.userData.a = pal['edge-hi'].a;
        b.edgeMat.color.copy(pal.accent.c);
        b.glow.forEach((m) => m.color.copy(pal.accent.c));
      });
    };

    // ---------- billboards: tiles, medal, halo, sparks, ghost; blob shadows; ripples
    const bbGroups: THREE.Object3D[] = [];
    const quad = track(new THREE.PlaneGeometry(1, 1));
    const bill = (map: THREE.Texture, size: number, order: number, extra: THREE.MeshBasicMaterialParameters = {}) => {
      const grp = new THREE.Group();
      const mat = basic({ map, ...extra });
      const mesh = new THREE.Mesh(quad, mat);
      mesh.scale.set(size * KB, size * KB, 1);
      mesh.renderOrder = order;
      grp.add(mesh);
      scene.add(grp);
      bbGroups.push(grp);
      return { grp, mesh, mat };
    };
    const tiles = [0, 1, 2].map((k) => {
      const tex = texOf(128, 128, (c2) => {
        c2.translate(64, 64);
        c2.scale(2, 2);
        c2.shadowColor = pal['card-shadow'].css;
        c2.shadowBlur = 16;
        c2.shadowOffsetY = 6;
        roundRect(c2, -22, -22, 44, 44, 12);
        c2.fillStyle = pal.glass.css;
        c2.fill();
        c2.shadowColor = 'transparent';
        c2.lineWidth = 1;
        c2.strokeStyle = pal['glass-stroke'].css;
        c2.stroke();
        c2.beginPath();
        c2.moveTo(-12, -21.2);
        c2.lineTo(12, -21.2);
        c2.strokeStyle = pal['edge-hi'].css;
        c2.stroke();
        c2.translate(-12, -12);
        drawGlyph(c2, GLYPHS[k], pal.accent.css);
      });
      const b = bill(tex, 64, 20);
      b.mesh.position.y = 22 * KB; // pivot at the tile's bottom edge
      return b;
    });
    const blobTex = texOf(128, 128, (c2) => {
      const g = c2.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, 'rgba(255,255,255,1)');
      g.addColorStop(0.5, 'rgba(255,255,255,.55)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      c2.fillStyle = g;
      c2.fillRect(0, 0, 128, 128);
    });
    const blobGeo = track(planeXZ(1, 1, 0, 0, 0));
    const mkBlob = () => {
      const mat = basic({ map: blobTex, opacity: 0 });
      const mesh = new THREE.Mesh(blobGeo, mat);
      mesh.renderOrder = 6;
      scene.add(mesh);
      return { mesh, mat };
    };
    const tileBlobs = [0, 1, 2].map(mkBlob);
    const footBlobs = [mkBlob(), mkBlob()];
    const bodyBlob = mkBlob();

    const ringGeo = track(new THREE.RingGeometry(28.6, 30, 48));
    ringGeo.rotateX(-Math.PI / 2);
    const rips = [0, 1, 2].map((k) => {
      const mat = basic({ opacity: 0, side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(ringGeo, mat);
      mesh.position.set(G.LANE + 4, (k + 1) * G.H + 0.6, G.Y0 - (RISERS[k] + G.S / 2) - 2);
      mesh.renderOrder = 7;
      scene.add(mesh);
      return { mesh, mat };
    });

    const ghostTex = texOf(128, 128, (c2) => {
      c2.translate(64, 64);
      c2.scale(1.75, 1.75);
      c2.setLineDash([2, 6]);
      c2.lineCap = 'round';
      c2.lineWidth = 1.5;
      c2.strokeStyle = pal['ink-3'].css;
      c2.beginPath();
      c2.arc(0, 0, 30, 0, Math.PI * 2);
      c2.stroke();
    });
    const ghost = bill(ghostTex, 73, 30);
    const haloTex = texOf(256, 256, (c2) => {
      const g = c2.createRadialGradient(128, 128, 0, 128, 128, 128);
      g.addColorStop(0, `rgba(${pal.gold.rgb},.45)`);
      g.addColorStop(0.45, `rgba(${pal.gold.rgb},.14)`);
      g.addColorStop(1, `rgba(${pal.gold.rgb},0)`);
      c2.fillStyle = g;
      c2.fillRect(0, 0, 256, 256);
    });
    const halo = bill(haloTex, 192, 31);
    const medalTex = texOf(256, 256, (c2) => {
      c2.translate(128, 128);
      c2.scale(3.2, 3.2);
      const gold = pal.gold.c;
      const toCss = (c: THREE.Color) => `#${c.clone().convertLinearToSRGB().getHexString()}`;
      const gr = c2.createLinearGradient(-31, -31, 31, 31);
      gr.addColorStop(0, toCss(gold.clone().lerp(new THREE.Color(1, 1, 1), 0.4)));
      gr.addColorStop(0.55, toCss(gold));
      gr.addColorStop(1, toCss(gold.clone().lerp(new THREE.Color(0, 0, 0), 0.25)));
      const ring = new Path2D(rosette(31, 28, 16));
      c2.shadowColor = pal['card-shadow'].css;
      c2.shadowBlur = 14;
      c2.shadowOffsetY = 5;
      c2.fillStyle = gr;
      c2.strokeStyle = gr;
      c2.lineWidth = 3;
      c2.lineJoin = 'round';
      c2.fill(ring);
      c2.stroke(ring);
      c2.shadowColor = 'transparent';
      c2.beginPath();
      c2.arc(0, 0, 21.5, 0, Math.PI * 2);
      c2.fillStyle = pal.paper.css;
      c2.fill();
      c2.lineWidth = 1;
      c2.strokeStyle = `rgba(${pal.gold.rgb},.35)`;
      c2.stroke();
      c2.lineWidth = 3.4;
      c2.lineCap = 'round';
      c2.lineJoin = 'round';
      c2.strokeStyle = pal.gold.css;
      c2.stroke(new Path2D('M-9 .5l6.2 6.2L10-6.5'));
    });
    const medal = bill(medalTex, 80, 33);
    const sparkTex = [0, 1].map((i) =>
      texOf(64, 64, (c2) => {
        c2.translate(32, 32);
        c2.scale(4, 4);
        c2.fillStyle = (i ? pal.accent : pal.gold).css;
        c2.fill(new Path2D(sparkPath(6)));
      }),
    );
    const sparks = Array.from({ length: 12 }, (_, i) => ({ ...bill(sparkTex[i % 3 === 0 ? 1 : 0], 16, 34, { opacity: 0 }), base: i % 2 ? 0.7 : 1 }));

    // ---------- figure
    const fig = new THREE.Group();
    scene.add(fig);
    const sphereGeo = track(new THREE.SphereGeometry(1, 10, 8));
    const cylGeo = track(new THREE.CylinderGeometry(1, 1, 1, 8, 1));
    const mSkin = lambert('fig-skin'), mHair = lambert('fig-hair'), mTop = lambert('fig-top'), mTopFar = lambert('fig-top-far');
    const mPants = lambert('fig-pants'), mPantsFar = lambert('fig-pants-far'), mShoe = lambert('fig-shoe'), mSole = lambert('fig-shoe-line'), mPack = lambert('fig-pack');
    const figMats = [mSkin, mHair, mTop, mTopFar, mPants, mPantsFar, mShoe, mSole, mPack];
    const mkLimb = (r: number, mat: THREE.Material): Limb => {
      const cyl = new THREE.Mesh(cylGeo, mat);
      const s0 = new THREE.Mesh(sphereGeo, mat), s1 = new THREE.Mesh(sphereGeo, mat);
      s0.scale.setScalar(r);
      s1.scale.setScalar(r);
      fig.add(cyl, s0, s1);
      return { cyl, s0, s1, r };
    };
    const UPV = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, -1), tmp = new THREE.Vector3();
    const setLimb = (l: Limb, a: V3, b: V3) => {
      l.cyl.position.copy(a).add(b).multiplyScalar(0.5);
      tmp.subVectors(b, a);
      const len = tmp.length();
      l.cyl.scale.set(l.r, Math.max(len, 0.001), l.r);
      if (len > 1e-4) l.cyl.quaternion.setFromUnitVectors(UPV, tmp.divideScalar(len));
      l.s0.position.copy(a);
      l.s1.position.copy(b);
    };
    const legs = [0, 1].map((i) => ({ thigh: mkLimb(i ? 4.3 : 4.5, i ? mPantsFar : mPants), shin: mkLimb(i ? 3.9 : 4.1, i ? mPantsFar : mPants) }));
    const shoeGeo = track(new THREE.BoxGeometry(6.2, 4.4, 1));
    const soleGeo = track(new THREE.BoxGeometry(6.6, 1.3, 1));
    const shoes = [0, 1].map(() => {
      const g = new THREE.Group();
      g.add(new THREE.Mesh(shoeGeo, mShoe));
      const sole = new THREE.Mesh(soleGeo, mSole);
      sole.position.y = -2.4;
      g.add(sole);
      fig.add(g);
      return g;
    });
    const arms = [0, 1].map(() => {
      const hand = new THREE.Mesh(sphereGeo, mSkin);
      hand.scale.setScalar(3.3);
      fig.add(hand);
      return { up: mkLimb(3.4, mTop), lo: mkLimb(3.1, mTop), hand };
    });
    // torso group (rigid: pelvis, torso, pack, straps, hood, neck, head); geometry is pre-scaled by the body scale
    const torsoG = new THREE.Group();
    fig.add(torsoG);
    torsoG.add(new THREE.Mesh(track(extrudeProfile([[-6.5, -1], [6, -1], [7.2, 12], [6.6, 21.5], [3.6, 28.6], [-3.6, 29.6], [-7.6, 24], [-8.2, 10]], 16, 1.4)), mTop));
    torsoG.add(new THREE.Mesh(track(extrudeProfile([[-6, 1.5], [5.6, 1.5], [5.2, -6.5], [-5.6, -6.5]], 14, 1)), mPants));
    const packM = new THREE.Mesh(track(extrudeProfile([[-7.6, 24.5], [-14.6, 23], [-15.6, 9.5], [-8.2, 8.4]], 14, 1.6)), mPack);
    torsoG.add(packM);
    torsoG.add(new THREE.Mesh(track(extrudeProfile([[-3, 28.4], [-8.2, 30], [-7.2, 34], [-1.6, 31.5]], 12, 0.8)), mTopFar));
    const strapGeo = track(new THREE.BoxGeometry(2.4, 1, 1.4));
    [1, -1].forEach((side) => {
      const s = new THREE.Mesh(strapGeo, mPack);
      s.position.set(side * 5.6, 22, -8.7);
      s.scale.set(1, 26, 1);
      s.rotation.x = rad(10);
      torsoG.add(s);
    });
    const neck = new THREE.Mesh(cylGeo, mSkin);
    neck.scale.set(2.8, 7, 2.8);
    neck.position.set(0, 36, -3);
    torsoG.add(neck);
    const head = new THREE.Group();
    head.position.set(0, 47.5, -2.2);
    const hair = new THREE.Mesh(sphereGeo, mHair);
    hair.scale.set(8.7, 8.7, 8.9);
    hair.position.set(0, 0.6, 1.4);
    const face = new THREE.Mesh(sphereGeo, mSkin);
    face.scale.set(7.3, 7.6, 7.2);
    face.position.set(0, -0.6, -2.6);
    head.add(hair, face);
    torsoG.add(head);

    const posW = mkPose(), posF = mkPose(), posL = mkPose();

    // ---------- state driven by the GSAP timeline
    const S = {
      floor: { v: 0 }, shadow: { v: 0 }, blk: [0, 1, 2].map(() => ({ v: 0 })),
      lit: [0, 1, 2].map(() => ({ v: 0 })), edge: [0, 1, 2].map(() => ({ v: 0 })), glow: [0, 1, 2].map(() => ({ v: 0 })),
      rip: [0, 1, 2].map(() => ({ o: 0, s: 0.25 })), tile: [0, 1, 2].map(() => ({ a: 0, s: 0.55, y: 14 })), tsh: [0, 1, 2].map(() => ({ v: 0 })),
      ghost: { a: 0, s: 1 }, halo: { o: 0, s: 0.4 }, medal: { a: 0, s: 0.35, rot: -25 }, rw: { v: 1 },
      parts: sparks.map(() => ({ o: 0, s: 0.4, x: 0, y: 0, r: 0 })),
      figA: { v: 0 }, W: { s: TIME.s0, settle: 0 }, C: { turn: 0, squat: 0, lift: 0, arms: 0, pack: 0, bob: 0, tilt: 0 } as Cel,
    };

    // ---------- HTML overlay (labels, XP chips, goal chip) anchored to 3D points
    type Item = { pos: HTMLElement; p: V3; ox: number; oy: number; svgX: number; chip?: HTMLElement; label?: boolean; fade?: boolean };
    const items: Item[] = [];
    const addOv = (cls: string, p: V3, ox: number, oy: number, svgX = 0) => {
      const pos = h('div', 'hx-pos ' + cls, ov);
      pos.style.left = '0';
      pos.style.top = '0';
      const it: Item = { pos, p, ox, oy, svgX };
      items.push(it);
      return it;
    };
    props.names.forEach((name, k) => {
      const ap = new THREE.Vector3(0, (k + 1) * G.H, -k * G.D);
      const [cx] = iso(0, -k * G.D, (k + 1) * G.H);
      const lead = addOv('', ap, 0, 0);
      lead.fade = true;
      const wrap = h('div', 'h3-lead ha-label', lead.pos);
      wrap.dataset.k = String(k);
      h('i', 'h3-line', wrap);
      h('i', 'h3-dot', wrap);
      h('i', 'h3-dot h3-dot-on', wrap).dataset.k = String(k);
      const txt = addOv('is-label', ap, -24, 10, cx - 24);
      txt.label = true;
      txt.fade = true;
      const t = h('div', 'ha-ltxt ha-label', txt.pos);
      t.dataset.k = String(k);
      h('span', 'ha-cap', t, props.caps[k]);
      h('span', 'ha-name', t, name);
    });
    props.names.forEach((_, k) => {
      const hp = pose(LAND[k], 0).hip; // chip floats above the head at the moment of landing
      const it = addOv('', new THREE.Vector3(G.LANE, hp[1] + 38.6 * G.BS, G.Y0 - hp[0] - 3), -6, -40);
      it.pos.style.translate = '-50% -50%';
      h('div', 'ha-xp', it.pos, `+${COURSE_XP[k]} XP`).dataset.k = String(k);
    });
    const goal = addOv('is-chip', MEDAL, 0, -66);
    const goalChip = h('div', 'ha-goal', goal.pos, props.goal);
    goal.chip = goalChip;

    // ---------- viewport (same box / aspect as the SVG variant)
    let vb: readonly number[] = VB_DESKTOP;
    let bw = 1, bh = 1, chipW = 0;
    const setFrustum = () => {
      const [vx, vy, vw, vh] = vb;
      const [px, py] = iso(PIVOT.x, PIVOT.z, PIVOT.y);
      camera.left = -(px - vx) * KB;
      camera.right = camera.left + vw * KB;
      camera.top = (py - vy) * KB;
      camera.bottom = camera.top - vh * KB;
      camera.updateProjectionMatrix();
    };
    const setVb = () => {
      bw = box.clientWidth;
      const mobile = (box.parentElement?.clientWidth ?? 999) < 480;
      vb = VB_DESKTOP;
      if (mobile) {
        // phones: widen the left margin just enough that the widest course name fits left of its riser on one line
        let m = 30;
        for (const it of items) {
          if (!it.label) continue;
          const n = it.pos.querySelector<HTMLElement>('.ha-name');
          if (!n) continue;
          const w = n.scrollWidth + 10;
          if (w < bw) m = Math.max(m, (w * 700 - it.svgX * bw) / (bw - w));
        }
        m = Math.min(260, m);
        vb = [-m, 70, 700 + m, 580];
      }
      box.style.setProperty('--r', String(vb[2] / vb[3]));
      box.style.setProperty('--u', `calc(100cqw / ${vb[2]})`);
      bw = box.clientWidth;
      bh = box.clientHeight;
      renderer.setSize(Math.max(1, bw), Math.max(1, bh), false);
      chipW = goalChip.offsetWidth;
      setFrustum();
      needs = true;
    };

    // ---------- camera orbit: drag / keys / inertia / return to the default view
    const cam = { yaw: DEF_YAW, pitch: DEF_PITCH, vy: 0, vp: 0 };
    let dragging = false, lastX = 0, lastY = 0, lastT = 0, lastInteract = -1e9, pid = -1, touch = false, hinted = false;
    const bump = () => {
      lastInteract = performance.now();
      needs = true;
    };
    const hideHint = () => {
      if (hinted) return;
      hinted = true;
      hint?.classList.add('is-gone');
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      dragging = true;
      touch = e.pointerType === 'touch';
      pid = e.pointerId;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = e.timeStamp;
      cam.vy = cam.vp = 0;
      try {
        canvas.setPointerCapture(e.pointerId);
      } catch {}
      canvas.style.cursor = 'grabbing';
      bump();
    };
    const onMove = (e: PointerEvent) => {
      if (!dragging || e.pointerId !== pid) return;
      const dx = e.clientX - lastX, dy = e.clientY - lastY;
      const dt = Math.max(1, e.timeStamp - lastT) / 1000;
      lastX = e.clientX;
      lastY = e.clientY;
      lastT = e.timeStamp;
      const dyaw = -dx * 0.0085, dpit = touch ? 0 : dy * 0.006; // touch: horizontal only (vertical = page scroll)
      cam.yaw += dyaw;
      cam.pitch = clamp(cam.pitch + dpit, PITCH_MIN, PITCH_MAX);
      cam.vy = lerp(cam.vy, dyaw / dt, 0.5);
      cam.vp = lerp(cam.vp, dpit / dt, 0.5);
      if (dx || dy) hideHint();
      bump();
    };
    const onUp = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      dragging = false;
      canvas.style.cursor = 'grab';
      if (e.timeStamp - lastT > 90 || reduced) cam.vy = cam.vp = 0; // paused before release: no fling
      try {
        canvas.releasePointerCapture(e.pointerId);
      } catch {}
      bump();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') cam.yaw += 0.16;
      else if (e.key === 'ArrowRight') cam.yaw -= 0.16;
      else if (e.key === 'ArrowUp') cam.pitch = clamp(cam.pitch - 0.1, PITCH_MIN, PITCH_MAX);
      else if (e.key === 'ArrowDown') cam.pitch = clamp(cam.pitch + 0.1, PITCH_MIN, PITCH_MAX);
      else return;
      e.preventDefault();
      hideHint();
      bump();
    };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', onUp);
    canvas.addEventListener('keydown', onKey);

    const stepCamera = (dt: number, now: number) => {
      if (dragging) return;
      if (Math.abs(cam.vy) > 0.002 || Math.abs(cam.vp) > 0.002) {
        cam.yaw += cam.vy * dt;
        cam.pitch = clamp(cam.pitch + cam.vp * dt, PITCH_MIN, PITCH_MAX);
        const d = Math.exp(-dt * 3.2);
        cam.vy *= d;
        cam.vp *= d;
        needs = true;
        lastInteract = now;
      } else if (now - lastInteract > IDLE_RETURN_MS) {
        const two = Math.PI * 2;
        let dy = (DEF_YAW - cam.yaw) % two;
        if (dy > Math.PI) dy -= two;
        if (dy < -Math.PI) dy += two;
        const dp = DEF_PITCH - cam.pitch;
        if (Math.abs(dy) > 1e-4 || Math.abs(dp) > 1e-4) {
          const k = reduced ? 1 : 1 - Math.exp(-dt * 2.6); // reduced motion: jump back instantly
          cam.yaw += dy * k;
          cam.pitch += dp * k;
          if (Math.abs(dy) < 5e-4 && Math.abs(dp) < 5e-4) {
            cam.yaw = DEF_YAW;
            cam.pitch = DEF_PITCH;
          }
          needs = true;
        }
      }
    };

    // ---------- per-frame application of state -> scene
    const Vv = new THREE.Vector3(), Rv = new THREE.Vector3(), Uv = new THREE.Vector3(), dirV = new THREE.Vector3();
    const setOpacity = (mat: THREE.Material, o: number) => {
      mat.opacity = o;
      mat.visible = o > 0.003;
    };
    const apply = () => {
      const { C, W } = S;
      setOpacity(floorMat, S.floor.v);
      setOpacity(shadowMat, S.shadow.v);
      blk.forEach((b, k) => {
        const f = S.blk[k].v;
        b.grp.position.y = -26 * (1 - f);
        setOpacity(b.mat, f);
        setOpacity(b.hiMat, f * ((b.hiMat.userData.a as number) ?? 1));
        setOpacity(b.litMat, S.lit[k].v * f);
        setOpacity(b.edgeMat, S.edge[k].v * f);
        setOpacity(b.glow[0], S.glow[k].v * 0.5);
        setOpacity(b.glow[1], S.glow[k].v * 0.22);
      });

      // walker + celebration
      const wk = walkPose(W.s, W.settle, posW);
      const hipU = wk.hipU;
      const gEnd = ground(hipU);
      frontPose(C, gEnd, posF);
      const turn = smooth(C.turn);
      blendPose(posW, posF, turn, posL);
      fig.position.set(G.LANE, 0, G.Y0 - hipU);
      fig.rotation.y = -rad(135) * turn; // turns to face the default camera
      const p = posL;
      legs.forEach((lg, i) => {
        const j = p.legs[i];
        setLimb(lg.thigh, j.hip, j.knee);
        setLimb(lg.shin, j.knee, j.ank);
        const sh = shoes[i];
        sh.position.copy(j.heel).add(j.toe).multiplyScalar(0.5);
        sh.position.y += 1.6;
        tmp.subVectors(j.toe, j.heel);
        const len = tmp.length();
        sh.scale.set(1, 1, len + 5.5);
        sh.quaternion.setFromUnitVectors(FWD, tmp.divideScalar(len || 1));
      });
      arms.forEach((a, i) => {
        const r = p.arms[i];
        setLimb(a.up, r.sh, r.el);
        setLimb(a.lo, r.el, r.hd);
        a.hand.position.copy(r.hd);
      });
      torsoG.position.set(0, p.torsoY, 0);
      torsoG.rotation.set(-rad(p.lean), 0, -p.tilt * rad(4));
      packM.position.y = -p.pack * 0.6;
      head.rotation.z = -p.tilt * rad(7);
      const fa = S.figA.v;
      fig.visible = fa > 0.01;
      figMats.forEach((m) => {
        m.transparent = fa < 0.995;
        m.opacity = fa;
      });
      const fsh = pal['fig-shadow'];
      const fadeW = 1 - smooth(C.turn * 2);
      [wk.P.legN, wk.P.legF].forEach((lg, i) => {
        const fp = i ? wk.P.B : wk.P.A;
        const b = footBlobs[i];
        b.mesh.position.set(G.LANE + LAT[i], fp.g + 0.5, G.Y0 - (lg.ank[0] + 2));
        b.mesh.scale.set(24, 1, 22);
        b.mat.color.copy(fsh.c);
        setOpacity(b.mat, clamp(1 - (lg.ank[1] - 3 - fp.g) / 16) * 0.9 * fadeW * fa * Math.min(1, fsh.a * 2.2));
      });
      const k2 = 1 - clamp(Math.max(0, C.lift) / 40) * 0.45;
      bodyBlob.mesh.position.set(G.LANE, gEnd + 0.5, G.Y0 - hipU);
      bodyBlob.mesh.scale.set(40 * k2, 1, 34 * k2);
      bodyBlob.mat.color.copy(fsh.c);
      setOpacity(bodyBlob.mat, 0.75 * k2 * smooth((C.turn - 0.4) / 0.6) * fa * Math.min(1, fsh.a * 2.2));

      // tile badges + their shadows on the steps
      tiles.forEach((t, k) => {
        const st = S.tile[k];
        const ax = 46, az = -(k + 0.4) * G.D, ay = (k + 1) * G.H;
        t.grp.position.set(ax, ay + 18 - st.y, az);
        t.grp.scale.setScalar(Math.max(0.001, st.s));
        setOpacity(t.mat, st.a);
        const tb = tileBlobs[k];
        tb.mesh.position.set(ax, ay + 0.5, az);
        tb.mesh.scale.set(30, 1, 26);
        tb.mat.color.copy(fsh.c);
        setOpacity(tb.mat, S.tsh[k].v * Math.min(1, fsh.a * 2));
      });
      rips.forEach((r, k) => {
        r.mesh.scale.set(S.rip[k].s, 1, S.rip[k].s);
        r.mat.color.copy(pal.accent.c);
        setOpacity(r.mat, S.rip[k].o);
      });
      // reward
      const rw = S.rw.v;
      ghost.grp.position.copy(MEDAL);
      ghost.grp.scale.setScalar(S.ghost.s);
      setOpacity(ghost.mat, S.ghost.a * 0.55);
      halo.grp.position.copy(MEDAL);
      halo.grp.scale.setScalar(Math.max(0.001, S.halo.s));
      setOpacity(halo.mat, S.halo.o * rw);
      medal.grp.position.copy(MEDAL);
      medal.grp.scale.setScalar(Math.max(0.001, S.medal.s));
      medal.mesh.rotation.z = -rad(S.medal.rot);
      setOpacity(medal.mat, S.medal.a * rw);
    };

    const updateBillboards = () => {
      for (const g of bbGroups) g.quaternion.copy(camera.quaternion);
      Rv.setFromMatrixColumn(camera.matrixWorld, 0);
      Uv.setFromMatrixColumn(camera.matrixWorld, 1);
      sparks.forEach((sp, i) => {
        const st = S.parts[i];
        sp.grp.position.copy(MEDAL).addScaledVector(Rv, st.x * KB).addScaledVector(Uv, -st.y * KB);
        sp.grp.scale.setScalar(Math.max(0.001, st.s * sp.base));
        sp.mesh.rotation.z = -rad(st.r);
        setOpacity(sp.mat, st.o * S.rw.v);
      });
    };

    const placeOverlay = () => {
      const u = bw / vb[2];
      // course labels belong to the default view: fade them out while the scene is turned away
      const two = Math.PI * 2;
      let dy = (cam.yaw - DEF_YAW) % two;
      if (dy > Math.PI) dy -= two;
      if (dy < -Math.PI) dy += two;
      const lab = String(+(1 - smooth((Math.abs(dy) + Math.abs(cam.pitch - DEF_PITCH) * 0.6 - 0.25) / 0.45)).toFixed(2));
      for (const it of items) {
        if (it.fade) it.pos.style.opacity = lab;
        Vv.copy(it.p).project(camera);
        const x = (Vv.x * 0.5 + 0.5) * bw + it.ox * u;
        const y = (-Vv.y * 0.5 + 0.5) * bh + it.oy * u;
        it.pos.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px)`;
        if (it.label) it.pos.style.maxWidth = Math.max(60, Math.round(x) - 6) + 'px';
        if (it.chip) it.pos.style.setProperty('--dx', chipShift(bw, x, chipW) + 'px');
      }
    };

    const render = () => {
      const cp = Math.cos(cam.pitch);
      dirV.set(Math.sin(cam.yaw) * cp, Math.sin(cam.pitch), Math.cos(cam.yaw) * cp);
      camera.position.copy(PIVOT).addScaledVector(dirV, 1500);
      camera.lookAt(PIVOT);
      camera.updateMatrixWorld();
      updateBillboards();
      placeOverlay();
      renderer.render(scene, camera);
    };

    // ---------- timeline (same choreography and timings as StepsHero)
    const ctx = gsap.context(() => {
      const introTl = gsap.timeline({ defaults: { ease: 'expo.out' } });
      introTl
        .fromTo(S.floor, { v: 0 }, { v: 1, duration: 0.8, ease: 'power1.out' }, 0)
        .fromTo(S.shadow, { v: 0 }, { v: 1, duration: 1.1, ease: 'power1.out' }, 0.25)
        .fromTo(S.blk, { v: 0 }, { v: 1, duration: 1.1, stagger: 0.11 }, 0.05)
        .fromTo('.ha-label', { autoAlpha: 0, x: -8 }, { autoAlpha: 0.42, x: 0, duration: 0.9, stagger: 0.11 }, 0.35)
        .fromTo(S.ghost, { a: 0 }, { a: 1, duration: 0.8, ease: 'power1.out' }, 0.7);
      gsap.set('.h3-dot-on', { opacity: 0 });
      gsap.set('.ha-xp', { autoAlpha: 0 });
      gsap.set(goalChip, { autoAlpha: 0 });

      const vLin = TIME.speed, tWalk = 0.15;
      const tAt = (s: number) => tWalk + (s - TIME.s0) / vLin;
      const decel = (2 * (S_END - S_LIN)) / vLin;
      const tEnd = tAt(S_LIN) + decel;
      const tl = gsap.timeline({ repeat: -1, delay: 0.25, defaults: { ease: 'power3.out', lazy: false }, onRepeat: () => cb.current.loop() });
      tl.addLabel('walk', 0)
        .fromTo(S.figA, { v: 0 }, { v: 1, duration: 0.45, ease: 'power1.out' }, 0)
        .fromTo(S.C, { turn: 0, squat: 0, lift: 0, arms: 0, pack: 0, bob: 0, tilt: 0 }, { turn: 0, duration: 0.01 }, 0)
        .fromTo(S.W, { s: TIME.s0, settle: 0 }, { s: S_LIN, duration: (S_LIN - TIME.s0) / vLin, ease: 'none' }, tWalk)
        .to(S.W, { s: S_END, duration: decel, ease: 'power2.out' })
        .fromTo(S.W, { settle: 0 }, { settle: 1, duration: TIME.settle, ease: 'power2.inOut', immediateRender: false });

      LAND.forEach((ls, k) => {
        const t = tAt(ls);
        tl.addLabel(`land${k}`, t)
          .fromTo(S.lit[k], { v: 0 }, { keyframes: [{ v: 1, duration: 0.7, ease: 'power2.out' }, { v: 0.55, duration: 1.4, ease: 'power2.inOut', delay: 0.5 }] }, t)
          .fromTo(S.edge[k], { v: 0 }, { keyframes: [{ v: 1, duration: 0.35, ease: 'power2.out' }, { v: 0.4, duration: 1.4, ease: 'power2.inOut', delay: 0.6 }] }, t)
          .fromTo(S.glow[k], { v: 0 }, { keyframes: [{ v: 0.75, duration: 0.25, ease: 'power2.out' }, { v: 0, duration: 1.6, ease: 'power2.inOut' }] }, t)
          .fromTo(S.rip[k], { s: 0.25 }, { s: 1.9, duration: 1.1, ease: 'expo.out' }, t)
          .fromTo(S.rip[k], { o: 0 }, { keyframes: [{ o: 0.9, duration: 0.01 }, { o: 0, duration: 1.1, ease: 'power2.out' }] }, t)
          .fromTo(S.tile[k], { a: 0, s: 0.55, y: 14 }, { a: 1, s: 1, y: 0, duration: 0.75, ease: 'back.out(1.5)' }, t + 0.08)
          .fromTo(S.tsh[k], { v: 0 }, { v: 0.35, duration: 0.6 }, t + 0.08)
          .fromTo(`.ha-label[data-k="${k}"]`, { opacity: 0.42 }, { opacity: 1, duration: 0.45, ease: 'power2.out' }, t)
          .fromTo(`.h3-dot-on[data-k="${k}"]`, { opacity: 0, scale: 0.3 }, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, t)
          .fromTo(`.ha-xp[data-k="${k}"]`, { autoAlpha: 0, y: 10, scale: 0.9 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'back.out(1.6)' }, t + 0.05)
          .to(`.ha-xp[data-k="${k}"]`, { autoAlpha: 0, y: -26, duration: 0.7, ease: 'power2.in' }, t + 1.05);
      });

      // summit: turn to the viewer, anticipation, 3 joyful jumps (arms in a V), then a happy idle
      const C = S.C;
      const CEL = { turn: 0.45, antic: 0.2, jumps: [{ h: 24, up: 0.3, down: 0.27 }, { h: 18, up: 0.27, down: 0.25 }, { h: 12, up: 0.23, down: 0.21 }], gap: 0.2 };
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
          .to(C, { keyframes: [{ pack: 3.5, duration: J.up * 0.45, ease: 'power1.out' }, { pack: -3, duration: J.up * 0.55 + J.down * 0.6, ease: 'sine.inOut' }, { pack: 2.5, duration: J.down * 0.4 + 0.08, ease: 'power2.in' }, { pack: 0, duration: 0.2, ease: 'power2.out' }] }, j)
          .to(C, { tilt: i % 2 ? -1 : 1, duration: J.up, ease: 'sine.inOut' }, j);
        if (i === 0) tl.to(C, { arms: 1, duration: 0.42, ease: 'back.out(1.7)' }, j);
        else tl.to(C, { keyframes: [{ arms: 1.06, duration: J.up * 0.6, ease: 'power2.out' }, { arms: 1, duration: J.up * 0.4, ease: 'power1.inOut' }] }, j);
        const land = j + J.up + J.down;
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
        .to(S.ghost, { a: 0, s: 1.25, duration: 0.5, ease: 'power2.out' }, tR)
        .fromTo(S.halo, { o: 0, s: 0.4 }, { o: 1, s: 1, duration: 1.2, ease: 'expo.out' }, tR + 0.1)
        .fromTo(S.medal, { a: 0, s: 0.35, rot: -25 }, { a: 1, s: 1, rot: 0, duration: 0.95, ease: 'back.out(1.7)' }, tR + 0.08)
        .fromTo(goalChip, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: 0.6, ease: 'power3.out' }, tR + 0.5);
      S.parts.forEach((st, i, arr) => {
        const a = -Math.PI / 2 + (i / arr.length) * Math.PI * 2 + (i % 2 ? 0.18 : 0), Rr = (i % 2 ? 52 : 74) + (i % 3) * 6;
        tl.fromTo(st, { o: 0, s: 0.4 }, { keyframes: [{ o: 1, s: 1, duration: 0.18, ease: 'power1.out' }, { o: 0, s: 0.3, duration: 0.9, ease: 'power1.in' }] }, tR + 0.25)
          .fromTo(st, { x: 0, y: 0, r: 0 }, { x: Math.cos(a) * Rr, y: Math.sin(a) * Rr * 0.85, r: i % 2 ? 45 : -45, duration: 1.1, ease: 'expo.out' }, tR + 0.25);
      });
      tl.addLabel('hold', tCheer)
        .to({}, { duration: TIME.hold + 0.4 }, tCheer)
        .addLabel('out')
        .to([S.figA, S.rw, ...S.lit, ...S.edge, ...S.glow], { v: 0, duration: TIME.out, ease: 'power2.inOut' }, 'out')
        .to(S.tile, { a: 0, duration: TIME.out, ease: 'power2.inOut' }, 'out')
        .to([goalChip, '.h3-dot-on'], { opacity: 0, duration: TIME.out, ease: 'power2.inOut' }, 'out')
        .to('.ha-label', { opacity: 0.42, duration: TIME.out, ease: 'power2.inOut' }, 'out')
        .to(S.ghost, { a: 1, s: 1, duration: TIME.out }, 'out')
        .to(S.tsh, { v: 0, duration: TIME.out }, 'out');
      tl.eventCallback('onUpdate', () => {
        needs = true;
      });
      // the SVG fallback is already on screen with its own intro: start 3D straight at the walk
      introTl.progress(1);

      // ---------- visibility, motion preference
      const vis = { inView: true, hidden: document.hidden };
      let raf = 0, last = 0, firstDone = false;
      const frame = (now: number) => {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(0.05, last ? (now - last) / 1000 : 0.016);
        last = now;
        stepCamera(dt, performance.now());
        if (!needs && reduced) return;
        needs = false;
        apply();
        render();
        if (!firstDone) {
          firstDone = true;
          cb.current.ready?.();
        }
      };
      const sync = () => {
        if (vis.inView && !vis.hidden && !lost) {
          if (!raf) {
            last = 0;
            raf = requestAnimationFrame(frame);
          }
          if (!reduced) tl.play();
        } else {
          if (raf) cancelAnimationFrame(raf);
          raf = 0;
          tl.pause();
        }
      };
      const showFinal = () => {
        tl.pause();
        tl.seek('cheer', false); // figure on the summit with the badge
        needs = true;
      };
      const onMotion = () => {
        reduced = reducedMq.matches;
        if (reduced) showFinal();
        else {
          tl.restart(true);
          sync();
        }
      };
      const io = new IntersectionObserver((e) => {
        vis.inView = e[e.length - 1].isIntersecting;
        sync();
      });
      io.observe(box);
      const onVis = () => {
        vis.hidden = document.hidden;
        sync();
      };
      document.addEventListener('visibilitychange', onVis);
      reducedMq.addEventListener('change', onMotion);

      // theme: re-read the tokens when data-theme or prefers-color-scheme changes
      const retheme = () => {
        ({ pal, shadowO } = readPalette(box));
        recolors.forEach((f) => f());
        paintBlocks();
        redraws.forEach((f) => f());
        needs = true;
      };
      const mo = new MutationObserver(retheme);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
      const dark = matchMedia('(prefers-color-scheme: dark)');
      dark.addEventListener('change', retheme);

      const ro = new ResizeObserver(() => setVb());
      ro.observe(box.parentElement ?? box);
      document.fonts?.ready.then(setVb);

      recolors.forEach((f) => f());
      paintBlocks();
      setVb();
      if (reduced) showFinal();
      sync();

      cleanups.push(() => {
        if (raf) cancelAnimationFrame(raf);
        raf = 0;
        io.disconnect();
        mo.disconnect();
        ro.disconnect();
        dark.removeEventListener('change', retheme);
        reducedMq.removeEventListener('change', onMotion);
        document.removeEventListener('visibilitychange', onVis);
      });
    }, box);

    return () => {
      cleanups.forEach((f) => f());
      ctx.revert();
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      canvas.removeEventListener('keydown', onKey);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.geometry) m.geometry.dispose();
      });
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
      ov.replaceChildren();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.names.join('|'), props.caps.join('|'), props.goal]);

  return (
    <div className="hx hxa hx3" ref={root} style={{ width: 'min(100cqw, calc(100cqh * var(--r, 1.145)))', height: 'min(100cqh, calc(100cqw / var(--r, 1.145)))' }}>
      <div ref={ovRef} className="hx-ov" aria-hidden="true" />
      {props.hint ? (
        <div ref={hintRef} className="hx3-hint" aria-hidden="true">
          {props.hint}
        </div>
      ) : null}
    </div>
  );
}
