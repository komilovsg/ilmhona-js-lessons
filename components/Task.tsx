'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { diffLines, diffMessage, normalizeOutput, normalizeText } from '@/lib/check';
import { confetti, reducedMotion } from '@/lib/confetti';
import { calcXp, hintPenaltyPct } from '@/lib/game';
import { openMentor, readTaskContext } from '@/lib/mentor-client';
import { getSnapshot, markSolved, noteHint, unmark, useProgress } from '@/lib/progress';
import { useT } from './I18nProvider';
import { TaskContext, type TaskContextValue } from './TaskContext';


type Props = { id: string; lessonSlug: string; level: TaskContextValue['level']; children: ReactNode };
type Feedback = { kind: 'ok' | 'again' | 'diff'; text: string };
type Chip = { xp: number; top: number; left: number };

const CONFETTI = { easy: 28, mid: 50, hard: 90 } as const;

export default function Task({ id, lessonSlug, level, children }: Props) {
  const { t } = useT();
  const ref = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const lastWrap = useRef<Element | null>(null);
  const timers = useRef<number[]>([]);
  const key = `${lessonSlug}:${id}`;
  const progress = useProgress();
  const rec = progress.solved[key];
  const done = !!rec;
  const hintCount = progress.hintsOpened[key]?.length ?? 0;

  const [host, setHost] = useState<HTMLElement | null>(null);
  const [fb, setFb] = useState<Feedback | null>(null);
  const [pulse, setPulse] = useState(false);
  const [chip, setChip] = useState<Chip | null>(null);

  const later = (fn: () => void, ms: number) => void timers.current.push(window.setTimeout(fn, ms));
  useEffect(() => {
    const t = timers.current;
    return () => t.forEach(clearTimeout);
  }, []);

  /** Solve the task: record XP, pulse the card, float the XP chip over `anchor`. */
  const award = useCallback(
    (auto: boolean, anchor: Element | null) => {
      const el = ref.current;
      const hints = getSnapshot().hintsOpened[key]?.length ?? 0;
      const xp = calcXp(level, hints, auto);
      markSolved(lessonSlug, id, { auto, xp });
      if (reducedMotion() || !el) return xp;
      setPulse(true);
      later(() => setPulse(false), 800);
      const box = el.getBoundingClientRect();
      const a = (anchor ?? el).getBoundingClientRect();
      setChip({ xp, top: a.top - box.top, left: a.left - box.left + a.width / 2 });
      later(() => setChip(null), 1500);
      if (auto) confetti(a.left + a.width / 2, a.top, CONFETTI[level ?? 'mid']);
      return xp;
    },
    [key, level, lessonSlug, id],
  );

  const onRunResult = useCallback<TaskContextValue['onRunResult']>(
    (r) => {
      const el = ref.current;
      if (!el || lastWrap.current?.closest('details')) return;
      const exp = el.querySelector('.expected pre');
      const expected = exp ? normalizeText(exp.textContent ?? '') : [];
      if (!expected.length) return;
      if (r.hadError) return setFb(null);
      const d = diffLines(expected, normalizeOutput(r.lines));
      if (!d.ok) return setFb({ kind: 'diff', text: diffMessage(d, t.check) });
      if (getSnapshot().solved[key]) return setFb({ kind: 'again', text: t.check.okAgain });
      const xp = award(true, el.querySelector('.code-wrap:not(details *) .run'));
      setFb({ kind: 'ok', text: `${t.check.ok} ${t.task.xpSuffix(xp)}` });
    },
    [award, key, t],
  );

  const solve = useCallback<TaskContextValue['solve']>(
    (auto, anchor) => {
      if (!getSnapshot().solved[key]) award(auto, anchor);
    },
    [award, key],
  );

  const ctx = useMemo<TaskContextValue>(
    () => ({ taskId: id, lessonSlug, level, onRunResult, done, solve }),
    [id, lessonSlug, level, onRunResult, done, solve],
  );

  // Feedback line goes right after the task's first runnable (non-hint) code block.
  useEffect(() => {
    const el = ref.current;
    const wraps = el ? [...el.querySelectorAll('.code-wrap')].filter((w) => !w.closest('details')) : [];
    const wrap = wraps.find((w) => w.querySelector('button.run')) ?? wraps[0];
    if (!wrap) return;
    const div = document.createElement('div');
    wrap.after(div);
    setHost(div);
    return () => {
      div.remove();
      setHost(null);
    };
  }, []);

  // Hint cost notes: "−25% XP" on opened hints of an unsolved task.
  const syncCosts = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const s = getSnapshot();
    const opened = s.hintsOpened[key] ?? [];
    el.querySelectorAll<HTMLDetailsElement>('details.hint').forEach((d, i) => {
      const pos = opened.indexOf(i);
      const pct = pos < 0 ? 0 : hintPenaltyPct(pos + 1) - hintPenaltyPct(pos);
      const sum = d.querySelector('summary');
      if (!sum) return;
      if (d.open && pct > 0 && !s.solved[key]) sum.dataset.cost = t.task.hintCost(pct);
      else delete sum.dataset.cost;
    });
  }, [key, t]);

  useEffect(syncCosts, [syncCosts, done, hintCount]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // `toggle` does not bubble: catch it in the capture phase on the article.
    const onToggle = (e: Event) => {
      const d = e.target as HTMLDetailsElement;
      if (!(d instanceof HTMLDetailsElement) || !d.classList.contains('hint')) return;
      if (d.open) {
        const index = [...el.querySelectorAll('details.hint')].indexOf(d);
        if (index >= 0) noteHint(lessonSlug, id, index);
      }
      syncCosts();
    };
    // Remember which code block the student last touched (runs inside hints are not checked).
    const onTouch = (e: Event) => {
      const w = (e.target as Element).closest?.('.code-wrap');
      if (w) lastWrap.current = w;
    };
    el.addEventListener('toggle', onToggle, true);
    el.addEventListener('click', onTouch, true);
    el.addEventListener('keydown', onTouch, true);
    return () => {
      el.removeEventListener('toggle', onToggle, true);
      el.removeEventListener('click', onTouch, true);
      el.removeEventListener('keydown', onTouch, true);
    };
  }, [lessonSlug, id, syncCosts]);

  const manualXp = calcXp(level, hintCount, false);
  return (
    <TaskContext.Provider value={ctx}>
      <article ref={ref} className={'task' + (done ? ' done' : '') + (pulse ? ' pulse' : '')} id={id}>
        {children}
        <button
          ref={toggleRef}
          type="button"
          className="done-toggle"
          title={done ? undefined : t.task.manualTitle(manualXp)}
          onClick={() => {
            if (done) {
              unmark(lessonSlug, id);
              setFb(null);
            } else {
              award(false, toggleRef.current);
            }
          }}
        >
          {done ? t.task.solved + (rec.xp ? ` · ${t.task.xpSuffix(rec.xp)}` : '') : t.task.markAsSolved}
        </button>
        <button
          type="button"
          className="done-toggle ask-mentor"
          onClick={() => {
            const c = ref.current ? readTaskContext(ref.current) : { code: '', output: '' };
            openMentor({ taskId: id, ...c, prefill: t.mentor.prefillTask });
          }}
        >
          {t.mentor.askTask}
        </button>
        {chip && (
          <span className="xp-chip" style={{ top: chip.top, left: chip.left }} aria-hidden="true">
            {t.task.xpSuffix(chip.xp)}
          </span>
        )}
        {host &&
          createPortal(
            fb && (
              <p className={'check-fb ' + fb.kind} role="status">
                {fb.text}
              </p>
            ),
            host,
          )}
      </article>
    </TaskContext.Provider>
  );
}
