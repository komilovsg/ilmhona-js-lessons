'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import type { Lang } from '@/lib/highlight';
import { startRun, type Job, type OutLine } from '@/lib/runner';
import CodeEditor, { type CodeEditorHandle } from './CodeEditor';
import { TaskContext } from './TaskContext';

export const CODEBLOCK_STRINGS = {
  editable: 'Можно редактировать',
  readonly: 'JavaScript',
  resetTitle: 'Вернуть исходный код',
  reset: '↺ Сброс',
  run: '▶ Запустить',
  running: '… выполняется',
};

type Props = { code: string; run?: boolean; title?: string; lang?: Lang };

export default function CodeBlock({ code, run: runnable = false, title, lang = 'js' }: Props) {
  const task = useContext(TaskContext);
  const [value, setValue] = useState(code);
  const [out, setOut] = useState<{ lines: OutLine[] } | null>(null);
  const [visible, setVisible] = useState(false);
  const [running, setRunning] = useState(false);
  const editor = useRef<CodeEditorHandle>(null);
  const seq = useRef(0);
  const job = useRef<Job | null>(null);

  useEffect(() => () => job.current?.stop(), []);

  const doRun = async (text: string) => {
    job.current?.stop();
    const my = ++seq.current;
    setOut({ lines: [] });
    setVisible(true);
    setRunning(true);
    const j = startRun({ mode: 'console', code: text }, { onLines: (lines) => my === seq.current && setOut({ lines }) });
    job.current = j;
    const res = await j.result;
    if (my !== seq.current) return;
    setRunning(false);
    setOut({ lines: res.lines });
    task?.onRunResult(res);
  };

  return (
    <div className="code-wrap">
      <div className="code-head">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        {runnable ? (
          <>
            <span className="hint-edit">
              {title || CODEBLOCK_STRINGS.editable}
              <span className="kbd-hint"> · Ctrl + Enter</span>
            </span>
            <button
              type="button"
              className="reset"
              title={CODEBLOCK_STRINGS.resetTitle}
              onClick={() => {
                job.current?.stop();
                seq.current++;
                setRunning(false);
                setValue(code);
                setVisible(false);
              }}
            >
              {CODEBLOCK_STRINGS.reset}
            </button>
            <button
              type="button"
              className={'run' + (running ? ' busy' : '')}
              aria-busy={running}
              onClick={() => doRun(editor.current?.getValue() ?? value)}
            >
              {running ? CODEBLOCK_STRINGS.running : CODEBLOCK_STRINGS.run}
            </button>
          </>
        ) : (
          <span className="hint-edit">{title || CODEBLOCK_STRINGS.readonly}</span>
        )}
      </div>
      <CodeEditor value={value} onChange={setValue} onRun={doRun} readOnly={!runnable} lang={lang} handle={editor} />
      {runnable && (
        <div className={'output' + (visible ? ' show' : '')}>
          {out?.lines.map((l, i) => (
            <div key={i} className={'line' + (l.cls ? ' ' + l.cls : '')}>
              {l.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
