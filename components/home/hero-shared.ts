import gsap from 'gsap';

export const NS = 'http://www.w3.org/2000/svg';

/** Create an SVG element with attributes and append it. */
export const el = (tag: string, attrs: Record<string, string | number> = {}, parent?: Element) => {
  const e = document.createElementNS(NS, tag);
  for (const k in attrs) e.setAttribute(k, String(attrs[k]));
  if (parent) parent.appendChild(e);
  return e;
};

/** Create an HTML element with a class and optional text. */
export const h = (tag: string, cls: string, parent?: Element, text?: string) => {
  const e = document.createElement(tag);
  e.className = cls;
  if (text !== undefined) e.textContent = text;
  if (parent) parent.appendChild(e);
  return e;
};

/** Hero props shared by both variants. Texts come from the localised course registry / messages. */
export type HeroProps = {
  names: [string, string, string];
  caps: [string, string, string];
  goal: string;
  xpLabel: string;
  title: string;
  desc: string;
  /** Drag hint of the 3D variant. */
  hint?: string;
  /** Called at the end of every loop (the parent decides whether to switch variant). */
  onLoop: () => void;
};

export const COURSE_XP = [150, 250, 400] as const;
export const GLYPHS = ['spark', 'code', 'orbit'] as const;

/** Glyph paths (24x24) shared by both variants; ids get a per-variant prefix. */
export const glyphDefs = (p: string) => `
<g id="${p}glyph-spark"><path class="hx-glyph-f" d="M10 3.5c.55 3.6 2.4 5.45 6 6-3.6.55-5.45 2.4-6 6-.55-3.6-2.4-5.45-6-6 3.6-.55 5.45-2.4 6-6z"/><path class="hx-glyph-f" d="M18 14.2c.27 1.7 1.13 2.56 2.8 2.8-1.67.27-2.53 1.13-2.8 2.8-.27-1.67-1.13-2.53-2.8-2.8 1.67-.24 2.53-1.1 2.8-2.8z"/><circle class="hx-glyph-f" cx="18.6" cy="5.4" r="1.2"/></g>
<g id="${p}glyph-code"><path class="hx-glyph" d="M8.3 7.6 3.9 12l4.4 4.4M15.7 7.6l4.4 4.4-4.4 4.4M13.3 5.4l-2.6 13.2"/></g>
<g id="${p}glyph-orbit"><ellipse class="hx-glyph" cx="12" cy="12" rx="9.6" ry="3.9" transform="rotate(32 12 12)" style="stroke-width:1.7"/><ellipse class="hx-glyph" cx="12" cy="12" rx="9.6" ry="3.9" transform="rotate(-32 12 12)" style="stroke-width:1.7"/><circle class="hx-glyph-f" cx="12" cy="12" r="2.1"/><circle class="hx-glyph-f" cx="19.6" cy="15.9" r="1.35"/></g>`;

export function rosette(r1: number, r2: number, n: number) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? r2 : r1;
    const a = (Math.PI * i) / n - Math.PI / 2;
    d += (i ? 'L' : 'M') + (r * Math.cos(a)).toFixed(2) + ' ' + (r * Math.sin(a)).toFixed(2);
  }
  return d + 'Z';
}

export function sparkPath(r: number) {
  const q = r * 0.18;
  return `M0 ${-r}C${q} ${-q} ${q} ${-q} ${r} 0C${q} ${q} ${q} ${q} 0 ${r}C${-q} ${q} ${-q} ${q} ${-r} 0C${-q} ${-q} ${-q} ${-q} 0 ${-r}Z`;
}

/**
 * Pause the timeline while the hero is off-screen or the tab is hidden; keep it paused under reduced motion.
 * Returns `sync` (call after changing `state.reduced`) and a cleanup.
 */
export function watchVisibility(root: Element, tl: gsap.core.Timeline) {
  const state = { inView: true, hidden: typeof document !== 'undefined' && document.hidden, reduced: false };
  const sync = () => {
    if (state.reduced || !state.inView || state.hidden) tl.pause();
    else tl.play();
  };
  const io = new IntersectionObserver((e) => {
    state.inView = e[e.length - 1].isIntersecting;
    sync();
  });
  io.observe(root);
  const onVis = () => {
    state.hidden = document.hidden;
    sync();
  };
  document.addEventListener('visibilitychange', onVis);
  return {
    state,
    sync,
    stop: () => {
      io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
    },
  };
}

/** Horizontal shift (px) that keeps a centred chip of width `w` inside a box of width `boxW`. */
export const chipShift = (boxW: number, leftPx: number, w: number) =>
  Math.min(boxW - w / 2 - 2, Math.max(w / 2 + 2, leftPx)) - leftPx;

/** Append static SVG markup (a trusted constant of this module family) to `parent`; top-level nodes are tagged for cleanup. */
export function appendMarkup(parent: Element, markup: string) {
  parent.querySelectorAll('[data-built]').forEach((n) => n.remove());
  const doc = new DOMParser().parseFromString(`<svg xmlns="${NS}">${markup}</svg>`, 'image/svg+xml');
  Array.from(doc.documentElement.childNodes).forEach((n) => {
    const c = document.importNode(n, true);
    if (c instanceof Element) c.setAttribute('data-built', '1');
    parent.appendChild(c);
  });
}
