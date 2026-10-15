'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import type { Lang } from '@/lib/highlight';
import { openMentor } from '@/lib/mentor-client';
import { startRun, type Job, type OutLine } from '@/lib/runner';
import CodeEditor, { type CodeEditorHandle } from './CodeEditor';
import { useT } from './I18nProvider';
import { TaskContext } from './TaskContext';


type Props = { code: string; run?: boolean; title?: string; lang?: Lang };

export default function CodeBlock({ code, run: runnable = false, title, lang = 'js' }: Props) {
  const { t } = useT();
  const S = t.codeBlock;
  const task = useContext(TaskContext);
  const [value, setValue] = useState(code);
  const [out, setOut] = useState<{ lines: OutLine[] } | null>(null);
  const [visible, setVisible] = useState(false);
  const [running, setRunning] = useState(false);
  const [fail, setFail] = useState<string | null>(null);
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
    setFail(null);
    const j = startRun({ mode: 'console', code: text }, { strings: { runner: t.runner, explain: t.explain }, onLines: (lines) => my === seq.current && setOut({ lines }) });
    job.current = j;
    const res = await j.result;
    if (my !== seq.current) return;
    setRunning(false);
    setOut({ lines: res.lines });
    setFail(res.hadError ? text : null);
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
              {title || S.editable}
              <span className="kbd-hint"> · Ctrl + Enter</span>
            </span>
            <button
              type="button"
              className="reset"
              title={S.resetTitle}
              onClick={() => {
                job.current?.stop();
                seq.current++;
                setRunning(false);
                setValue(code);
                setVisible(false);
              }}
            >
              {S.reset}
            </button>
            <button
              type="button"
              className={'run' + (running ? ' busy' : '')}
              aria-busy={running}
              onClick={() => doRun(editor.current?.getValue() ?? value)}
            >
              {running ? S.running : S.run}
            </button>
          </>
        ) : (
          <span className="hint-edit">{title || S.readonly}</span>
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
          {fail !== null && (
            <button
              type="button"
              className="explain-err"
              onClick={() =>
                openMentor({
                  taskId: task?.taskId,
                  code: fail.slice(0, 6000),
                  output: (out?.lines ?? []).map((l) => l.text).join('\n').slice(-3000),
                  prefill: t.mentor.prefillError,
                })
              }
            >
              {t.mentor.explainError}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
