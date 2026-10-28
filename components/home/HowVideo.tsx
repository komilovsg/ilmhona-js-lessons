'use client';

import { useEffect, useRef } from 'react';
import { useT } from '../I18nProvider';

/**
 * «Как учиться на платформе»: a short screen recording of the real flow (laptop + phone).
 * Nothing is fetched until the video is ≥50% in view (preload="none" + poster); it plays muted while
 * visible and pauses when it leaves. With prefers-reduced-motion it never autoplays (poster + controls).
 */
export default function HowVideo() {
  const { t, locale } = useT();
  const T = t.home.walkthrough;
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === 'undefined') return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let inView = false;
    let manual = false; // the student paused it himself: do not restart on scroll
    const onPause = () => {
      if (!v.ended && inView) manual = true;
    };
    const io = new IntersectionObserver(
      ([e]) => {
        inView = e.isIntersecting;
        if (inView) {
          if (!manual) v.play().catch(() => {});
        } else {
          v.pause();
          manual = false;
        }
      },
      { threshold: 0.5 },
    );
    io.observe(v);
    v.addEventListener('pause', onPause);
    return () => {
      io.disconnect();
      v.removeEventListener('pause', onPause);
    };
  }, []);

  const base = `/media/how-it-works-${locale}`;
  return (
    <section className="hm-sec" aria-labelledby="hm-vid-t">
      <h2 id="hm-vid-t">{T.title}</h2>
      <p className="hm-sec-lead">{T.lead}</p>
      <div className="hm-vid">
        <video
          ref={ref}
          muted
          playsInline
          loop
          controls
          preload="none"
          poster={`${base}.webp`}
          aria-label={T.label}
          width={1920}
          height={1080}
        >
          <source src={`${base}.webm`} type="video/webm" />
          <source src={`${base}.mp4`} type="video/mp4" />
        </video>
      </div>
    </section>
  );
}
