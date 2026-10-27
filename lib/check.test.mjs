// Self-check: `node lib/check.test.mjs` (Node >= 22.6 strips TS types natively).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { diffLines, diffMessage, matches, normalizeOutput, normalizeText } from './check.ts';
import { achievements, calcXp, currentStreak, hintPenaltyPct, levelInfo, longestStreak, totalXp } from './game.ts';
import { LESSON_META, RN_AVAILABLE, RN_LESSON_META, VC_AVAILABLE, VC_LESSON_META } from './lesson-meta.generated.ts';
import { ru } from '../messages/ru.ts';

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
  assert.equal(diffMessage(diffLines(['a', 'b'], ['a', 'x']), ru.check), 'Почти! Строка 2: ожидалось «b», получено «x»');
  assert.equal(diffMessage(diffLines(['a', 'b', 'c'], ['a', 'b']), ru.check), 'Не хватает строк: ожидалось 3, получено 2');
  assert.equal(diffMessage(diffLines(['a'], ['a', 'b']), ru.check), 'Лишние строки: ожидалось 1, получено 2');
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
  assert.equal(levelInfo(0, ru.game.ranks).level, 1);
  assert.equal(levelInfo(49, ru.game.ranks).level, 1);
  assert.equal(levelInfo(50, ru.game.ranks).level, 2);
  assert.equal(levelInfo(3000, ru.game.ranks).level, 10);
  assert.equal(levelInfo(3000, ru.game.ranks).next, null);
  assert.equal(levelInfo(100, ru.game.ranks).pct, 50);
  assert.equal(levelInfo(100, ru.game.ranks).rank, 'Джуниор');
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
  const ids = (s) => achievements(s, meta, ru.game).filter((a) => a.unlocked).map((a) => a.id);
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
  for (const f of fs.readdirSync(new URL('../content/lessons/ru/', import.meta.url)).filter((f) => f.endsWith('.html'))) {
    const slug = f.replace(/^\d+-/, '').replace(/\.html$/, '');
    const html = fs.readFileSync(new URL(`../content/lessons/ru/${f}`, import.meta.url), 'utf8');
    const found = [...html.matchAll(/<article class="task"[^>]*\sid="([^"]+)"[\s\S]*?<\/header>/g)].map((m) => [
      m[1],
      (m[0].match(/class="level (easy|mid|hard)"/)?.[1] ?? 'mid')[0],
    ]);
    assert.deepEqual(LESSON_META[slug], Object.fromEntries(found), slug);
  }
});

// ---- lesson file names match the course plan (NN = num, slug = slug) ----
t('lesson files match content/course.ts', () => {
  const src = fs.readFileSync(new URL('../content/course.ts', import.meta.url), 'utf8');
  const plan = [...src.matchAll(/num: (\d+), module: \d+, kind: '\w+', slug: '([^']+)'/g)].map((m) => [Number(m[1]), m[2]]);
  assert.equal(plan.length, 24);
  assert.deepEqual(plan.map(([num]) => num), Array.from({ length: 24 }, (_, i) => i + 1));
  assert.equal(new Set(plan.map(([, slug]) => slug)).size, 24);
  const bySlug = Object.fromEntries(plan.map(([num, slug]) => [slug, num]));
  for (const f of fs.readdirSync(new URL('../content/lessons/ru/', import.meta.url)).filter((f) => f.endsWith('.html'))) {
    const m = f.match(/^(\d{2})-(.+)\.html$/);
    assert.ok(m && bySlug[m[2]] === Number(m[1]), `${f} does not match a course entry`);
  }
});

console.log(`\n${n} checks passed`);

// ---- explain ReDoS ----
import { explain } from './explain.ts';
import { cleanProgress } from './supabase/merge.ts';
t('explain on 300k input is fast', () => {
  for (const big of ['a'.repeat(300000), ' '.repeat(300000) + 'x', 'x'.repeat(300000) + ' is not defined', '$.['.repeat(100000)]) {
    const t0 = performance.now();
    explain(big, ru.explain);
    assert.ok(performance.now() - t0 < 50, 'explain too slow');
  }
  assert.equal(explain('foo is not defined', ru.explain), ru.explain.notDefined('foo'));
  assert.equal(explain('obj.run is not a function', ru.explain), ru.explain.notFunction('obj.run'));
});

// ---- progress validation ----
t('cleanProgress rejects/cleans malformed state', () => {
  assert.equal(cleanProgress(null), null);
  assert.equal(cleanProgress('x'), null);
  assert.equal(cleanProgress({ version: 1, solved: {} }), null);
  assert.equal(cleanProgress({ version: 2, solved: [] }), null);
  const c = cleanProgress({
    version: 2,
    solved: { 'a:b': { solvedAt: 's', auto: 1, hints: 'zzz', xp: 'x' }, 'bad key': { hints: [] }, 'c:d': { hints: [2, -1, 1.5, 'q', 2, 1] } },
    hintsOpened: { 'a:b': 'str', 'c:d': [3] },
  });
  assert.deepEqual(Object.keys(c.solved), ['a:b', 'c:d']);
  assert.deepEqual(c.solved['a:b'].hints, []);
  assert.equal(c.solved['a:b'].auto, false);
  assert.equal(c.solved['a:b'].xp, 0);
  assert.deepEqual(c.solved['c:d'].hints, [1, 2]);
  assert.deepEqual(c.hintsOpened['a:b'], []);
  assert.deepEqual(Object.keys(cleanProgress({ version: 2, solved: {}, hintsOpened: 'x' }).hintsOpened), []);
});
t('cleanProgress ignores __proto__ keys', () => {
  const c = cleanProgress(JSON.parse('{"version":2,"solved":{"__proto__":{"polluted":1},"a:b":{}},"hintsOpened":{"__proto__":[1]}}'));
  assert.deepEqual(Object.keys(c.solved), ['a:b']);
  assert.equal(Object.getPrototypeOf(c.solved), null);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(Object.keys(c.hintsOpened), []);
});

// ---- Vibe Coding and React Pro + Next.js courses ----
const regEntries = (file) => [...fs.readFileSync(new URL(file, import.meta.url), 'utf8').matchAll(/num: (\d+), module: \d+, kind: '\w+', slug: '([^']+)'/g)].map((m) => ({ num: +m[1], slug: m[2] }));
const feEntries = regEntries('../content/course.ts');
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const courses = [
  { id: 'vc', prefix: 'vc-', reg: '../content/vibe-coding/course.ts', dir: new URL('../content/vibe-coding/lessons/', import.meta.url), available: VC_AVAILABLE, meta: VC_LESSON_META, maxTasks: 15 },
  { id: 'rn', prefix: 'rn-', reg: '../content/react-next/course.ts', dir: new URL('../content/react-next/lessons/', import.meta.url), available: RN_AVAILABLE, meta: RN_LESSON_META, maxTasks: 30 },
];

for (const { id, prefix, reg, dir, available, meta, maxTasks } of courses) {
  const entries = regEntries(reg);
  const files = (l) => (fs.existsSync(new URL(`${l}/`, dir)) ? fs.readdirSync(new URL(`${l}/`, dir)).filter((f) => f.endsWith('.html')) : []);

  t(`${id} registry: 24 entries, nums 1..24, unique slugs`, () => {
    assert.deepEqual(entries.map((e) => e.num), Array.from({ length: 24 }, (_, i) => i + 1));
    const slugs = entries.map((e) => e.slug);
    assert.equal(new Set(slugs).size, 24);
    for (const s of slugs) assert.match(s, /^[a-z0-9-]{1,37}$/);
  });
  t(`no frontend slug collides with the ${prefix} key prefix`, () => {
    assert.ok(feEntries.length > 0);
    for (const e of feEntries) assert.ok(!e.slug.startsWith(prefix), e.slug);
  });
  t(`${id} meta matches fragments`, () => {
    const ru = files('ru');
    assert.deepEqual([...available], ru.map((f) => f.replace(/^\d+-/, '').replace(/\.html$/, '')));
    for (const f of ru) {
      const m = f.match(/^(\d{2})-(.+)\.html$/);
      assert.ok(entries.some((e) => e.num === +m[1] && e.slug === m[2]), `fragment ${f} is not in the registry`);
      const html = fs.readFileSync(new URL(`ru/${f}`, dir), 'utf8');
      const ids = [...html.matchAll(/<article class="task"[^>]*\sid="([^"]+)"/g)].map((x) => x[1]);
      assert.deepEqual(Object.keys(meta[`${prefix}${m[2]}`]), ids);
    }
  });
  t(`${id} task limits`, () => {
    for (const [k, tasks] of Object.entries(meta)) {
      const c = Object.keys(tasks).length;
      assert.ok(c <= maxTasks, `${k}: ${c} tasks`);
    }
  });
  t(`${id} fragments: images, video, quizzes, checklists, links`, () => {
    for (const l of ['ru', 'tg']) {
      for (const f of files(l)) {
        const html = fs.readFileSync(new URL(`${l}/${f}`, dir), 'utf8');
        const where = `${l}/${f}`;
        for (const m of html.matchAll(/src="(\/lessons\/[^"]+)"/g)) {
          assert.ok(fs.existsSync(new URL(`../public${m[1]}`, import.meta.url)), `${where}: missing ${m[1]}`);
        }
        for (const m of html.matchAll(/<img\b[^>]*>/g)) {
          for (const a of ['alt', 'width', 'height']) assert.ok(attr(m[0], a), `${where}: <img> without ${a}`);
        }
        for (const m of html.matchAll(/<div class="yt"[^>]*>/g)) assert.match(attr(m[0], 'data-id') ?? '', /^[A-Za-z0-9_-]{11}$/, `${where}: bad yt id`);
        for (const m of html.matchAll(/<div class="quiz" data-answer="([^"]+)">([\s\S]*?<\/ol>)/g)) {
          const count = (m[2].match(/<li>/g) ?? []).length;
          for (const a of m[1].split(',')) assert.ok(+a >= 1 && +a <= count, `${where}: quiz answer ${a} of ${count}`);
        }
        const cl = [...html.matchAll(/<ul class="checklist" id="([^"]+)"/g)].map((m) => m[1]);
        assert.equal(new Set(cl).size, cl.length, `${where}: duplicate checklist ids`);
        const sl = (html.match(/class="submit-link"/g) ?? []).length;
        const inTask = [...html.matchAll(/<article class="task"[\s\S]*?<\/article>/g)].reduce((n, m) => n + (m[0].match(/class="submit-link"/g) ?? []).length, 0);
        assert.equal(inTask, sl, `${where}: submit-link outside article.task`);
      }
    }
  });
}
t('total tasks over all courses <= 2000', () => {
  const total = [LESSON_META, VC_LESSON_META, RN_LESSON_META].reduce((n, m) => n + Object.values(m).reduce((k, tasks) => k + Object.keys(tasks).length, 0), 0);
  assert.ok(total <= 2000, `${total} tasks`);
});
