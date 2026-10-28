'use client';

import { useState } from 'react';
import { fmt } from '@/lib/i18n';
import { useT } from './I18nProvider';

const ID_RE = /^[A-Za-z0-9_-]{11}$/;

/** Click-to-load YouTube (no-cookie): until the click only the thumbnail from i.ytimg.com is requested. */
export default function YouTube({ id, title = '', start }: { id: string; title?: string; start?: number }) {
  const { t } = useT();
  const [playing, setPlaying] = useState(false);
  if (!ID_RE.test(id)) return null;
  const from = start && start > 0 ? `&start=${Math.floor(start)}` : '';
  return (
    <figure className="yt">
      <div className="yt-frame">
        {playing ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0${from}`}
            title={title || 'YouTube'}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <button type="button" className="yt-play" aria-label={fmt(t.practice.ytPlay, { title })} onClick={() => setPlaying(true)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" width={480} height={360} loading="lazy" />
            <span className="yt-btn" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </button>
        )}
      </div>
      <figcaption>
        {title && <>{title} · </>}
        <a href={`https://www.youtube.com/watch?v=${id}${from}`} target="_blank" rel="noopener noreferrer">
          {t.practice.ytOpen}
        </a>
      </figcaption>
    </figure>
  );
}
