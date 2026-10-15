// Self-check: `node lib/check.test.mjs` (Node >= 22.6 strips TS types natively).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { diffLines, diffMessage, matches, normalizeOutput, normalizeText } from './check.ts';
import { achievements, calcXp, currentStreak, hintPenaltyPct, levelInfo, longestStreak, totalXp } from './game.ts';
import { LESSON_META } from './lesson-meta.ts';

let n = 0;
const t = (name, fn) => (fn(), n++, console.log('ok -', name));

// ---- check.ts ----
t('normalize text', () => {
  assert.deepEqual(normalizeText('\n\n  a   b \n\tc\n\n'), ['a b', 'c']);
  assert.deepEqual(normalizeText('a\n\nb'), ['a', '', 'b']);
});
t('normalize output ignores empty placeholder', () => {
  assert.deepEqual(normalizeOutput([{ text: '(ничего не выведено)', cls: 'empty' }]), []);
  assert.deepEqual(normalizeOutput([{ text: ' x  y ', cls: '' }, { text: 'z' }]), ['x y', 'z']);
});
t('match / mismatch', () => {
  assert.equal(matches(['a', 'b'], ['a', 'b'], false), true);
  assert.equal(matches(['a', 'b'], ['a', 'b'], true), false);
  assert.equal(matches(['a', 'b'], ['a'], false), false);
});
t('diff messages', () => {
  assert.equal(diffMessage(diffLines(['a', 'b'], ['a', 'x'])), 'Почти! Строка 2: ожидалось «b», получено «x»');
  assert.equal(diffMessage(diffLines(['a', 'b', 'c'], ['a', 'b'])), 'Не хватает строк: ожидалось 3, получено 2');
  assert.equal(diffMessage(diffLines(['a'], ['a', 'b'])), 'Лишние строки: ожидалось 1, получено 2');
});

// ---- game.ts ----
t('xp table', () => {
  assert.deepEqual([calcXp('easy', 0, true), calcXp('mid', 0, true), calcXp('hard', 0, true)], [10, 20, 40]);
  assert.equal(calcXp('mid', 1, true), 15);
  assert.equal(calcXp('mid', 2, true), 10);
  assert.equal(calcXp('hard', 9, true), 10); // floor 25%
  assert.equal(calcXp('mid', 0, false), 10); // manual = 50%
  assert.equal(calcXp('hard', 2, false), 10); // 40 * .5 * .5
  assert.equal(calcXp(null, 0, true), 20);
  assert.equal(hintPenaltyPct(0) + hintPenaltyPct(1) + hintPenaltyPct(2) + hintPenaltyPct(5), 0 + 25 + 50 + 75);
});
t('levels', () => {
  assert.equal(levelInfo(0).level, 1);
  assert.equal(levelInfo(49).level, 1);
  assert.equal(levelInfo(50).level, 2);
  assert.equal(levelInfo(3000).level, 10);
  assert.equal(levelInfo(3000).next, null);
  assert.equal(levelInfo(100).pct, 50);
  assert.equal(levelInfo(100).rank, 'Джуниор');
});

const rec = (iso, extra = {}) => ({ solvedAt: new Date(iso).toISOString(), auto: true, hints: [], xp: 10, ...extra });
const state = (solved) => ({ version: 2, solved, hintsOpened: {}, updatedAt: '' });
const day = (d, h = 12, m = 0) => new Date(2026, 0, d, h, m).toISOString();

t('total xp', () => assert.equal(totalXp(state({ 'a:1': rec(day(1)), 'a:2': rec(day(1), { xp: 5 }) })), 15));
t('streaks', () => {
  const s = state({ 'a:1': rec(day(1)), 'a:2': rec(day(2)), 'a:3': rec(day(3)), 'a:4': rec(day(5)) });
  assert.equal(longestStreak(s), 3);
  assert.equal(currentStreak(s, new Date(2026, 0, 5, 20).getTime()), 1);
  assert.equal(currentStreak(s, new Date(2026, 0, 6, 9).getTime()), 1); // yesterday still counts
  assert.equal(currentStreak(s, new Date(2026, 0, 8, 9).getTime()), 0);
  assert.equal(currentStreak(state({ 'a:1': rec(day(1)), 'a:2': rec(day(2)), 'a:3': rec(day(3)) }), new Date(2026, 0, 3, 23).getTime()), 3);
  assert.equal(currentStreak(s, 0), 0);
});
t('achievements', () => {
  const meta = { a: { 1: 'h', 2: 'h', 3: 'h', 4: 'e' } };
  const ids = (s) => achievements(s, meta).filter((a) => a.unlocked).map((a) => a.id);
  assert.deepEqual(ids(state({})), []);
  assert.deepEqual(ids(state({ 'a:1': rec(day(1)) })), ['first']);
  const all = state({
    'a:1': rec(day(1, 0, 30)), 'a:2': rec(day(1, 0, 35)), 'a:3': rec(day(1, 0, 38)), 'a:4': rec(day(2)),
  });
  const got = ids(all);
  for (const id of ['first', 'lesson', 'hard3', 'owl', 'sprint']) assert.ok(got.includes(id), id);
  assert.ok(!got.includes('streak3') && !got.includes('nohints'));
  const slow = ids(state({ 'a:1': rec(day(1, 10, 0)), 'a:2': rec(day(1, 10, 6)), 'a:3': rec(day(1, 10, 12)) }));
  assert.ok(!slow.includes('sprint') && !slow.includes('owl'));
  const hinted = state(Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`b:${i}`, rec(day(1), { hints: [0] })])));
  assert.ok(!ids(hinted).includes('nohints'));
  const clean = state(Object.fromEntries([1, 2, 3, 4, 5].map((i) => [`b:${i}`, rec(day(1))])));
  assert.ok(ids(clean).includes('nohints'));
  const week = state(Object.fromEntries([1, 2, 3, 4, 5, 6, 7].map((i) => [`b:${i}`, rec(day(i))])));
  assert.ok(ids(week).includes('streak3') && ids(week).includes('streak7'));
});

// ---- lesson-meta.ts stays in sync with the lesson HTML ----
t('lesson meta matches content/lessons', () => {
  const files = { functions: '01-functions.html', arrays: '02-arrays.html', objects: '03-objects.html' };
  for (const [slug, f] of Object.entries(files)) {
    const html = fs.readFileSync(new URL(`../content/lessons/${f}`, import.meta.url), 'utf8');
    const found = [...html.matchAll(/<article class="task"[^>]*\sid="([^"]+)"[\s\S]*?<\/header>/g)].map((m) => [
      m[1],
      (m[0].match(/class="level (easy|mid|hard)"/)?.[1] ?? 'mid')[0],
    ]);
    assert.deepEqual(LESSON_META[slug], Object.fromEntries(found), slug);
  }
});

console.log(`\n${n} checks passed`);
