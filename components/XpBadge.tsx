'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { confetti } from '@/lib/confetti';
import { useCourseProgress } from '@/lib/course-status';
import { availableEntries, COURSES, lessonKey, type CourseId } from '@/lib/courses';
import { achievements, currentStreak, levelInfo, totalXp, type Achievement } from '@/lib/game';
import { pushToast } from '@/lib/toast';
import { useT } from './I18nProvider';
import Toasts from './Toasts';


const unlockedIds = (list: Achievement[]) => new Set(list.filter((a) => a.unlocked).map((a) => a.id));

export default function XpBadge({ courseId = 'frontend' }: { courseId?: CourseId }) {
  const { t, locale } = useT();
  const c = COURSES[courseId];
  const progress = useCourseProgress(c);
  const [now, setNow] = useState(0); // 0 until mounted: hydration-safe zero state
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const prev = useRef<{ level: number; ach: Set<string> } | null>(null);
  const panelId = useId();

  useEffect(() => {
    const tick = () => setNow(Date.now());
    const t0 = setTimeout(tick, 0);
    const t = setInterval(tick, 60_000);
    return () => (clearTimeout(t0), clearInterval(t));
  }, []);

  const xp = totalXp(progress);
  const lvl = levelInfo(xp, t.game.ranks);
  const streak = currentStreak(progress, now);
  const ach = achievements(progress, c.meta, t.game);

  // Diff before/after each state change: toast new achievements and level-ups.
  useEffect(() => {
    if (!now) return;
    const cur = { level: lvl.level, ach: unlockedIds(ach) };
    const before = prev.current;
    prev.current = cur;
    if (!before) return;
    for (const a of ach) {
      if (a.unlocked && !before.ach.has(a.id)) pushToast({ emoji: a.emoji, title: a.title, text: t.xp.achievementToast });
    }
    if (cur.level > before.level) {
      pushToast({ emoji: '🚀', title: t.xp.levelUp(cur.level), text: lvl.rank });
      const r = btn.current?.getBoundingClientRect();
      confetti(r ? r.left + r.width / 2 : innerWidth / 2, r ? r.bottom + 10 : 80, 140);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [progress, now > 0]);

  // Popover: Esc closes, outside click closes, focus moves in and returns to the button.
  useEffect(() => {
    if (!open) return;
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        btn.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);

  return (
    <div
      className="xp"
      ref={wrap}
      onBlur={(e) => {
        if (open && !wrap.current?.contains(e.relatedTarget as Node | null) && e.relatedTarget) setOpen(false);
      }}
    >
      <button
        ref={btn}
        type="button"
        className="xp-chip-btn"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={`${t.xp.open}: ${t.xp.levelFull(lvl.level)}, ${lvl.rank}, ${xp} XP`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="xp-lvl">{t.xp.level(lvl.level)}</span>
        <span className="xp-rank">{lvl.rank}</span>
        <span className="xp-mini" aria-hidden="true">
          <i style={{ width: lvl.pct + '%' }} />
        </span>
        {streak >= 1 && (
          <span className="xp-streak" title={t.xp.streakTitle(streak)}>
            🔥 {streak}
          </span>
        )}
      </button>
      {open && (
        <div ref={panel} id={panelId} className="xp-panel" role="dialog" aria-label={t.xp.open} tabIndex={-1}>
          <div className="xp-panel-head">
            <div>
              <div className="xp-big">
                {t.xp.levelFull(lvl.level)} · {lvl.rank}
              </div>
              <div className="xp-sub">
                {t.xp.totalXp}: <b>{xp}</b>
              </div>
            </div>
            <button type="button" className="xp-close" aria-label={t.xp.close} onClick={() => (setOpen(false), btn.current?.focus())}>
              ✕
            </button>
          </div>
          <div className="xp-bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={lvl.pct}>
            <i style={{ width: lvl.pct + '%' }} />
          </div>
          <div className="xp-sub">
            {lvl.next === null ? t.xp.maxLevel : t.xp.toNext(lvl.level + 1, lvl.next - xp)}
          </div>
          <div className="xp-row">
            <span>🔥 {t.xp.streak}</span>
            <b>{streak ? t.xp.streakDays(streak) : t.xp.streakHint}</b>
          </div>
          <p className="xp-h">{t.xp.lessons}</p>
          <ul className="xp-lessons">
            {availableEntries(c).map((l) => {
              const key = lessonKey(c, l.slug);
              const ids = Object.keys(c.meta[key] ?? {});
              const n = ids.filter((t) => progress.solved[`${key}:${t}`]).length;
              return (
                <li key={l.slug}>
                  <span>{`${l.num}. ${l.title[locale]}`}</span>
                  <b>
                    {n}/{ids.length}
                  </b>
                </li>
              );
            })}
          </ul>
          <p className="xp-h">
            {t.xp.achievements} · {ach.filter((a) => a.unlocked).length}/{ach.length}
          </p>
          <ul className="xp-ach">
            {ach.map((a) => (
              <li key={a.id} className={a.unlocked ? 'on' : 'off'}>
                <span className="xp-ach-emoji" aria-hidden="true">
                  {a.unlocked ? a.emoji : '🔒'}
                </span>
                <span>
                  <b>{a.title}</b>
                  <small>{a.unlocked ? a.desc : a.how}</small>
                </span>
                {!a.unlocked && <span className="sr-only">{t.xp.locked}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <Toasts />
    </div>
  );
}
