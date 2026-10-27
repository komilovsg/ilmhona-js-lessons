'use client';

import { createContext } from 'react';
import type { OutLine } from '@/lib/runner';

export type TaskContextValue = {
  taskId: string;
  lessonSlug: string;
  level: 'easy' | 'mid' | 'hard' | null;
  /**
   * Hook point, called by CodeBlock after every run inside this task.
   * No-op for now; future auto-check / XP logic plugs in here.
   */
  onRunResult: (r: { lines: OutLine[]; hadError: boolean }) => void;
  /** Task already solved. */
  done: boolean;
  /** Mark the task solved (auto = full XP, else half) unless it already is; `anchor` positions the XP chip. */
  solve: (auto: boolean, anchor: Element | null) => void;
};

export const TaskContext = createContext<TaskContextValue | null>(null);
