'use client';

import { useContext, useRef, useState } from 'react';
import { run, type OutLine } from '@/lib/runner';
import CodeEditor, { type CodeEditorHandle } from './CodeEditor';
import { TaskContext } from './TaskContext';

type Props = { code: string; run?: boolean; title?: string };

export default function CodeBlock({ code, run: runnable = false, title }: Props) {
  const task = useContext(TaskContext);
  const [value, setValue] = useState(code);
  const [out, setOut] = useState<{ lines: OutLine[] } | null>(null);
  const [visible, setVisible] = useState(false);
  const editor = useRef<CodeEditorHandle>(null);
  const seq = useRef(0);

  const doRun = async (text: string) => {
    const my = ++seq.current;
    setOut({ lines: [] });
    setVisible(true);
    const res = await run(text);
    if (my !== seq.current) return;
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
              {title || 'Можно редактировать'}
              <span className="kbd-hint"> · Ctrl + Enter</span>
            </span>
            <button
              type="button"
              className="reset"
              title="Вернуть исходный код"
              onClick={() => {
                setValue(code);
                setVisible(false);
              }}
            >
              ↺ Сброс
            </button>
            <button type="button" className="run" onClick={() => doRun(editor.current?.getValue() ?? value)}>
              ▶ Запустить
            </button>
          </>
        ) : (
          <span className="hint-edit">{title || 'JavaScript'}</span>
        )}
      </div>
      <CodeEditor value={value} onChange={setValue} onRun={doRun} readOnly={!runnable} handle={editor} />
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
