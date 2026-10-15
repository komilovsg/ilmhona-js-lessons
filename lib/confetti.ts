// Tiny canvas confetti burst. No-op under prefers-reduced-motion.
const COLORS = ['#0e7a55', '#3ccf95', '#b7791f', '#f0b54a', '#c2410c', '#1d5fd1', '#7c3aed'];

export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

type P = { x: number; y: number; vx: number; vy: number; w: number; h: number; r: number; vr: number; c: string };

/** Burst `count` pieces from viewport point (x, y). */
export function confetti(x: number, y: number, count = 40) {
  if (typeof document === 'undefined' || reducedMotion()) return;
  const canvas = document.createElement('canvas');
  const dpr = window.devicePixelRatio || 1;
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:100';
  document.body.appendChild(canvas);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas.remove();
  ctx.scale(dpr, dpr);

  const ps: P[] = Array.from({ length: count }, () => {
    const a = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.9;
    const v = 6 + Math.random() * 8;
    return {
      x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
      w: 5 + Math.random() * 5, h: 3 + Math.random() * 4,
      r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.4,
      c: COLORS[(Math.random() * COLORS.length) | 0],
    };
  });

  const t0 = performance.now();
  const frame = (t: number) => {
    const age = t - t0;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of ps) {
      p.vy += 0.28;
      p.vx *= 0.985;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - Math.max(0, age - 900) / 700);
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (age < 1600) requestAnimationFrame(frame);
    else canvas.remove();
  };
  requestAnimationFrame(frame);
}
