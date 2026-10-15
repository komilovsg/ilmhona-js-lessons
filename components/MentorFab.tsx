'use client';

import { useEffect, useRef, useState } from 'react';
import MentorBot from './MentorBot';

const POS_KEY = 'mentor-fab-pos';
const TIP_KEY = 'mentor-fab-tip';
const MARGIN = 12;
const DRAG_PX = 6;
const EYE_MAX = 2.4;

export const FAB_RESET_EVENT = 'mentor-fab-reset';

export function hasFabPos(): boolean {
  try {
    return !!localStorage.getItem(POS_KEY);
  } catch {
    return false;
  }
}
export function resetFabPos() {
  try {
    localStorage.removeItem(POS_KEY);
  } catch {}
  window.dispatchEvent(new Event(FAB_RESET_EVENT));
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const noMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const canHover = () => window.matchMedia('(hover: hover)').matches;

/** Floating, draggable launcher. Everything per-pointermove is written straight to the DOM (no React re-render). */
export default function MentorFab({ onOpen, label }: { onOpen: () => void; label: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ id: number; sx: number; sy: number; ox: number; oy: number; moved: boolean } | null>(null);
  const dragged = useRef(false);
  const [tip, setTip] = useState(false);
  const [wave, setWave] = useState(false);

  // Place from stored fractions (0..1 of the free area); re-clamp on resize.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const place = (fx: number, fy: number) => {
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const x = MARGIN + clamp(fx, 0, 1) * Math.max(0, innerWidth - w - 2 * MARGIN);
      const y = MARGIN + clamp(fy, 0, 1) * Math.max(0, innerHeight - h - 2 * MARGIN);
      setXY(x, y);
    };
    const setXY = (x: number, y: number) => {
      el.style.left = x + 'px';
      el.style.top = y + 'px';
      el.style.right = 'auto';
      el.style.bottom = 'auto';
      el.dataset.h = x + el.offsetWidth / 2 < innerWidth / 2 ? 'l' : 'r';
      el.dataset.v = y < 90 ? 't' : 'b';
    };
    const apply = () => {
      let p: { x: number; y: number } | null = null;
      try {
        p = JSON.parse(localStorage.getItem(POS_KEY) ?? 'null');
      } catch {}
      if (p && typeof p.x === 'number' && typeof p.y === 'number') place(p.x, p.y);
    };
    const reset = () => {
      for (const k of ['left', 'top', 'right', 'bottom'] as const) el.style[k] = '';
      el.dataset.h = 'r';
      el.dataset.v = 'b';
    };
    el.dataset.h = 'r';
    el.dataset.v = 'b';
    apply();
    addEventListener('resize', apply);
    addEventListener(FAB_RESET_EVENT, reset);
    return () => {
      removeEventListener('resize', apply);
      removeEventListener(FAB_RESET_EVENT, reset);
    };
  }, []);

  // Pupils follow the cursor (hover-capable devices, no reduced motion); rest after 2 s.
  useEffect(() => {
    const el = ref.current;
    if (!el || noMotion() || !canHover()) return;
    let raf = 0;
    let idle = 0;
    let ev: PointerEvent | null = null;
    const look = (dx: number, dy: number, dist: number) => {
      const k = Math.min(1, dist / 70);
      const a = Math.atan2(dy, dx);
      el.style.setProperty('--px', (Math.cos(a) * EYE_MAX * k).toFixed(2));
      el.style.setProperty('--py', (Math.sin(a) * EYE_MAX * k).toFixed(2));
    };
    const frame = () => {
      raf = 0;
      if (!ev || drag.current?.moved) return;
      const r = el.getBoundingClientRect();
      const dx = ev.clientX - (r.left + r.width / 2);
      const dy = ev.clientY - (r.top + r.height / 2);
      look(dx, dy, Math.hypot(dx, dy));
      clearTimeout(idle);
      idle = window.setTimeout(() => {
        el.style.setProperty('--px', '0');
        el.style.setProperty('--py', '0');
      }, 2000);
    };
    const move = (e: PointerEvent) => {
      ev = e;
      if (!raf) raf = requestAnimationFrame(frame);
    };
    addEventListener('pointermove', move, { passive: true });
    return () => {
      removeEventListener('pointermove', move);
      cancelAnimationFrame(raf);
      clearTimeout(idle);
    };
  }, []);

  // First visit: a short wave plus the speech bubble, then remembered.
  useEffect(() => {
    let seen = true;
    try {
      seen = !!localStorage.getItem(TIP_KEY);
      if (!seen) localStorage.setItem(TIP_KEY, '1');
    } catch {}
    if (seen) return;
    const a = window.setTimeout(() => (setTip(true), setWave(true)), 1200);
    const b = window.setTimeout(() => (setTip(false), setWave(false)), 6500);
    return () => (clearTimeout(a), clearTimeout(b));
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const el = e.currentTarget;
    const r = el.getBoundingClientRect();
    drag.current = { id: e.pointerId, sx: e.clientX, sy: e.clientY, ox: r.left, oy: r.top, moved: false };
    dragged.current = false;
    el.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    const el = ref.current;
    if (!d || !el || d.id !== e.pointerId) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    if (!d.moved) {
      if (Math.hypot(dx, dy) <= DRAG_PX) return;
      d.moved = true;
      el.classList.remove('snap');
      el.classList.add('dragging');
      setTip(false);
    }
    const x = clamp(d.ox + dx, MARGIN, innerWidth - el.offsetWidth - MARGIN);
    const y = clamp(d.oy + dy, MARGIN, innerHeight - el.offsetHeight - MARGIN);
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    const n = Math.hypot(dx, dy) || 1;
    el.style.setProperty('--px', ((dx / n) * EYE_MAX).toFixed(2));
    el.style.setProperty('--py', ((dy / n) * EYE_MAX).toFixed(2));
  };

  const end = (e: React.PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    const el = ref.current;
    drag.current = null;
    if (!d || !el || d.id !== e.pointerId) return;
    if (!d.moved) return;
    dragged.current = true; // swallow the click that follows this pointerup
    setTimeout(() => (dragged.current = false), 0);
    el.classList.remove('dragging');
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const r = el.getBoundingClientRect();
    const toRight = r.left + w / 2 >= innerWidth / 2;
    const x = toRight ? innerWidth - w - MARGIN : MARGIN;
    const y = clamp(r.top, MARGIN, innerHeight - h - MARGIN);
    if (!noMotion()) el.classList.add('snap');
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    el.dataset.h = toRight ? 'r' : 'l';
    el.dataset.v = y < 90 ? 't' : 'b';
    el.style.setProperty('--px', '0');
    el.style.setProperty('--py', '0');
    try {
      const W = Math.max(1, innerWidth - w - 2 * MARGIN);
      const H = Math.max(1, innerHeight - h - 2 * MARGIN);
      localStorage.setItem(POS_KEY, JSON.stringify({ x: (x - MARGIN) / W, y: (y - MARGIN) / H }));
    } catch {}
  };

  const click = () => {
    if (dragged.current) return;
    // Touch: a brief wave + glow before the panel opens.
    if (!canHover() && !noMotion()) {
      setWave(true);
      setTimeout(() => (setWave(false), onOpen()), 650);
    } else onOpen();
  };

  return (
    <button
      ref={ref}
      type="button"
      className={'mentor-fab' + (wave ? ' waving' : '')}
      aria-haspopup="dialog"
      aria-label={label}
      onClick={click}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
    >
      <MentorBot />
      <span className={'mentor-tip' + (tip ? ' show' : '')} aria-hidden="true">
        {label}
      </span>
    </button>
  );
}
