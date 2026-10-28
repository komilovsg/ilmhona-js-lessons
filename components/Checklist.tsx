'use client';

import { useContext, useRef, type ReactNode } from 'react';
import { fmt } from '@/lib/i18n';
import { useLocal, writeLocal } from '@/lib/mfs-local';
import { useT } from './I18nProvider';
import { TaskContext } from './TaskContext';

function parse(raw: string | null): number[] {
  try {
    const v = JSON.parse(raw ?? '[]');
    return Array.isArray(v) ? v.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}

/** `<ul class="checklist" id>`: a checkbox per item, state in localStorage. Inside a task, all ticked = solved (half XP). */
export default function Checklist({ id, lessonKey, items }: { id: string; lessonKey: string; items: ReactNode[] }) {
  const { t } = useT();
  const ctx = useContext(TaskContext);
  const ref = useRef<HTMLUListElement>(null);
  const key = `mfs:checklist:${lessonKey}:${id}`;
  const checked = parse(useLocal(key)).filter((i) => i < items.length);

  const toggle = (i: number) => {
    const next = checked.includes(i) ? checked.filter((x) => x !== i) : [...checked, i];
    writeLocal(key, JSON.stringify(next));
    if (next.length === items.length && ctx && !ctx.done) ctx.solve(false, ref.current);
  };

  return (
    <>
      <ul className="checklist" id={id} ref={ref}>
        {items.map((it, i) => (
          <li key={i}>
            <label>
              <input type="checkbox" checked={checked.includes(i)} onChange={() => toggle(i)} />
              <span>{it}</span>
            </label>
          </li>
        ))}
      </ul>
      <p className="cl-count" aria-live="polite">
        {fmt(t.practice.done, { n: checked.length, m: items.length })}
      </p>
    </>
  );
}
