/**
 * Static task metadata per lesson (task id -> level), so progress/achievements can be derived
 * anywhere without reading lesson HTML. Kept in sync with content/lessons by lib/check.test.mjs.
 * Level: e = easy, m = mid, h = hard (tasks without a level badge count as mid).
 */
export type LessonMeta = Record<string, Record<string, 'e' | 'm' | 'h'>>;

export const LESSON_META: LessonMeta = {
  functions: {
    't1-1': 'e', 't1-2': 'e', 't1-3': 'm', 't2-1': 'e',
    't2-2': 'm', 't2-3': 'm', 't3-1': 'e', 't3-2': 'e',
    't3-3': 'm', 't4-1': 'e', 't4-2': 'm', 't4-3': 'h',
    't5-1': 'e', 't5-2': 'm', 't5-3': 'h', 't6-1': 'e',
    't6-2': 'm', 't6-3': 'h', 't7-1': 'm', 't7-2': 'm',
    't7-3': 'h',
  },
  arrays: {
    't1-1': 'e', 't1-2': 'm', 't1-3': 'h', 't2-1': 'e',
    't2-2': 'm', 't2-3': 'h', 't3-1': 'e', 't3-2': 'm',
    't3-3': 'h', 't4-1': 'e', 't4-2': 'm', 't4-3': 'h',
    't5-1': 'e', 't5-2': 'm', 't5-3': 'h', 't6-1': 'e',
    't6-2': 'm', 't6-3': 'h', 't7-1': 'e', 't7-2': 'm',
    't7-3': 'h', 't8-1': 'e', 't8-2': 'm', 't8-3': 'h',
    't9-1': 'e', 't9-2': 'm', 't9-3': 'h', 't10-1': 'e',
    't10-2': 'm', 't10-3': 'h', 't11-1': 'e', 't11-2': 'm',
    't11-3': 'h', 't12-1': 'e', 't12-2': 'm', 't12-3': 'h',
  },
  objects: {
    't1-1': 'e', 't1-2': 'm', 't1-3': 'h', 't2-1': 'e',
    't2-2': 'm', 't2-3': 'h', 't3-1': 'e', 't3-2': 'm',
    't3-3': 'h', 't4-1': 'e', 't4-2': 'm', 't4-3': 'h',
    't5-1': 'e', 't5-2': 'm', 't5-3': 'h', 't6-1': 'e',
    't6-2': 'm', 't6-3': 'h', 't7-1': 'e', 't7-2': 'm',
    't7-3': 'h', 't8-1': 'e', 't8-2': 'm', 't8-3': 'h',
    't9-1': 'e', 't9-2': 'm', 't9-3': 'h',
  },
};
