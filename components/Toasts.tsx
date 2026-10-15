'use client';

import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { getServerToasts, getToasts, subscribeToasts } from '@/lib/toast';

const emptySub = () => () => {};

/** Toast stack, portaled to <body> (the sticky header's backdrop-filter would trap `position: fixed`). */
export default function Toasts() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getServerToasts);
  const client = useSyncExternalStore(emptySub, () => true, () => false);
  if (!client) return null;
  return createPortal(
    <div className="toasts" aria-live="polite" role="status">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span className="toast-emoji" aria-hidden="true">
            {t.emoji}
          </span>
          <span>
            <b>{t.title}</b>
            {t.text && <small>{t.text}</small>}
          </span>
        </div>
      ))}
    </div>,
    document.body,
  );
}
