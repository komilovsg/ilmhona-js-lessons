import fs from 'node:fs';
import path from 'node:path';
import { lessons } from '@/content/lessons';

export function readFragment(file: string): string {
  return fs.readFileSync(path.join(process.cwd(), 'content', 'lessons', file), 'utf8');
}

/** Task ids per lesson slug, read at build time (the header needs totals on every page). */
export function getTaskIds(): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const l of lessons) {
    const html = readFragment(l.file);
    out[l.slug] = [...html.matchAll(/<article class="task"[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
  }
  return out;
}
