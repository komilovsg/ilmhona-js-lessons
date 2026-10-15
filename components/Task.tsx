'use client';

import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { markSolved, noteHint, unmark, useProgress } from '@/lib/progress';
import { TaskContext, type TaskContextValue } from './TaskContext';

type Props = { id: string; lessonSlug: string; level: TaskContextValue['level']; children: ReactNode };

export default function Task({ id, lessonSlug, level, children }: Props) {
  const ref = useRef<HTMLElement>(null);
  const done = !!useProgress().solved[`${lessonSlug}:${id}`];

  const ctx = useMemo<TaskContextValue>(
    () => ({ taskId: id, lessonSlug, level, onRunResult: () => {} }),
    [id, lessonSlug, level],
  );

  // `toggle` does not bubble: catch it in the capture phase on the article.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onToggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (!(d instanceof HTMLDetailsElement) || !d.classList.contains('hint') || !d.open) return;
      const index = [...el.querySelectorAll('details.hint')].indexOf(d);
      if (index >= 0) noteHint(lessonSlug, id, index);
    };
    el.addEventListener('toggle', onToggle, true);
    return () => el.removeEventListener('toggle', onToggle, true);
  }, [lessonSlug, id]);

  return (
    <TaskContext.Provider value={ctx}>
      <article ref={ref} className={'task' + (done ? ' done' : '')} id={id}>
        {children}
        <button
          type="button"
          className="done-toggle"
          onClick={() => (done ? unmark(lessonSlug, id) : markSolved(lessonSlug, id))}
        >
          {done ? '✓ Решено' : '○ Отметить как решённую'}
        </button>
      </article>
    </TaskContext.Provider>
  );
}
