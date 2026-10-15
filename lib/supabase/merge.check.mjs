// Self-check for the pure sync helpers. Run: `pnpm check:sync` (Node >= 22.18 strips TS types).
import assert from 'node:assert/strict';
import { diffSolved, mergeRecord, mergeSolved, sameSolved, solvedFromRows, toRow } from './merge.ts';

const T1 = '2026-01-01T10:00:00.000Z';
const T2 = '2026-01-02T10:00:00.000Z';
let n = 0;
const check = (name, fn) => {
  fn();
  n++;
  console.log('ok -', name);
};

check('merge: earliest solvedAt, auto OR, xp max, hints union sorted', () => {
  const a = { solvedAt: T2, auto: false, hints: [2, 0], xp: 10 };
  const b = { solvedAt: T1, auto: true, hints: [1, 2], xp: 25 };
  assert.deepEqual(mergeRecord(a, b), { solvedAt: T1, auto: true, hints: [0, 1, 2], xp: 25 });
  assert.deepEqual(mergeRecord(b, a), { solvedAt: T1, auto: true, hints: [0, 1, 2], xp: 25 });
});

check('merge: invalid solvedAt loses to a valid one', () => {
  const r = mergeRecord({ solvedAt: 'garbage', auto: false, hints: [], xp: 0 }, { solvedAt: T2, auto: false, hints: [], xp: 0 });
  assert.equal(r.solvedAt, T2);
});

check('merge: union by key, local-only and remote-only both kept', () => {
  const local = { 'functions:t1-1': { solvedAt: T1, auto: false, hints: [], xp: 5 }, 'weird key': { solvedAt: T1, auto: false, hints: [], xp: 1 } };
  const remote = { 'arrays:t2-1': { solvedAt: T2, auto: true, hints: [0], xp: 20 } };
  const m = mergeSolved(local, remote);
  assert.deepEqual(Object.keys(m).sort(), ['arrays:t2-1', 'functions:t1-1', 'weird key']);
  // unsyncable local entry is preserved locally but never uploaded
  const d = diffSolved(remote, m);
  assert.deepEqual(d.upserts.map((r) => r.task_id), ['t1-1']);
  assert.deepEqual(d.deletes, []);
});

check('merge result vs remote: nothing to upload when remote already matches', () => {
  const rows = [{ lesson_slug: 'functions', task_id: 't1-1', solved_at: '2026-01-01T10:00:00+00:00', auto: false, hints: [1], xp: 40 }];
  const remote = solvedFromRows(rows);
  const local = { 'functions:t1-1': { solvedAt: T1, auto: false, hints: [1], xp: 99 } }; // xp clamps to 40 on upload
  const m = mergeSolved(local, remote);
  assert.deepEqual(diffSolved(remote, m), { upserts: [], deletes: [] });
});

check('toRow: sanitises xp, hints, key, date', () => {
  assert.deepEqual(toRow('functions:t1-1', { solvedAt: T1, auto: 1, hints: [3, 3, -1, 1.5, 0, 9, 8, 7, 6, 5, 4, 2, 1], xp: 41.7 }), {
    lesson_slug: 'functions', task_id: 't1-1', solved_at: T1, auto: true, hints: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], xp: 40,
  });
  assert.equal(toRow('Functions:t1', { solvedAt: T1, auto: false, hints: [], xp: 0 }), null);
  assert.equal(toRow('functions:t 1', { solvedAt: T1, auto: false, hints: [], xp: 0 }), null);
  assert.equal(toRow('functions:t1', { solvedAt: 'nope', auto: false, hints: [], xp: 0 }), null);
});

check('diff: add, change, delete, unchanged', () => {
  const prev = {
    'functions:a': { solvedAt: T1, auto: false, hints: [], xp: 5 },
    'functions:b': { solvedAt: T1, auto: false, hints: [], xp: 5 },
    'arrays:c': { solvedAt: T1, auto: false, hints: [], xp: 5 },
  };
  const next = {
    'functions:a': { solvedAt: T1, auto: false, hints: [], xp: 5 }, // unchanged
    'functions:b': { solvedAt: T1, auto: false, hints: [0], xp: 5 }, // changed
    'objects:d': { solvedAt: T2, auto: true, hints: [], xp: 30 }, // added
  };
  const d = diffSolved(prev, next);
  assert.deepEqual(d.upserts.map((r) => `${r.lesson_slug}:${r.task_id}`), ['functions:b', 'objects:d']);
  assert.deepEqual(d.deletes, [{ lesson_slug: 'arrays', task_id: 'c' }]);
});

check('diff: identical maps produce nothing (no echo after replaceState)', () => {
  const s = { 'functions:a': { solvedAt: T1, auto: false, hints: [1, 0], xp: 5 } };
  assert.deepEqual(diffSolved(s, structuredClone(s)), { upserts: [], deletes: [] });
  assert.equal(sameSolved(s, structuredClone(s)), true);
  assert.equal(sameSolved(s, {}), false);
});

console.log(`\n${n} checks passed`);
