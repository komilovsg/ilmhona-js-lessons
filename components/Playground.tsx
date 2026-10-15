'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Lang } from '@/lib/highlight';
import { startRun, type Job, type OutLine, type RunSpec } from '@/lib/runner';
import CodeEditor, { type CodeEditorHandle } from './CodeEditor';
import { useT } from './I18nProvider';
import { TaskContext } from './TaskContext';

export type PlaygroundFile = { name: string; lang: Lang; code: string };


const MIN_H = 80;
const MAX_H = 420;
const BLANK = '<!doctype html><title></title>';

type Props = { mode: 'dom' | 'react'; title?: string; files: PlaygroundFile[] };

export default function Playground({ mode, title, files }: Props) {
  const { t } = useT();
  const S = t.playground;
  const task = useContext(TaskContext);
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(files.map((f) => [f.name, f.code])));
  const [active, setActive] = useState(files[0].name);
  const [out, setOut] = useState<OutLine[]>([]);
  const [ran, setRan] = useState(false);
  const [running, setRunning] = useState(false);
  const [height, setHeight] = useState(120);
  const [open, setOpen] = useState(true);
  const frame = useRef<HTMLIFrameElement>(null);
  const handles = useRef<Record<string, CodeEditorHandle | null>>({});
  const seq = useRef(0);
  const job = useRef<Job | null>(null);

  useEffect(() => () => job.current?.stop(), []);

  const get = (name: string) => handles.current[name]?.getValue() ?? values[name] ?? '';

  const doRun = async () => {
    if (!frame.current) return;
    job.current?.stop();
    const my = ++seq.current;
    flushSync(() => {
      // the frame must be visible (laid out) before its page loads, so the height report is right
      setOut([]);
      setRan(true);
      setOpen(true);
      setRunning(true);
    });
    const spec: RunSpec =
      mode === 'react'
        ? { mode: 'react', jsx: get('App.jsx'), css: get('style.css') }
        : { mode: 'dom', html: get('index.html'), css: get('style.css'), js: get('script.js') };
    const j = startRun(spec, {
      strings: { runner: t.runner, explain: t.explain },
      frame: frame.current,
      onLines: (lines) => my === seq.current && setOut(lines),
      onHeight: (h) => my === seq.current && setHeight(Math.min(MAX_H, Math.max(MIN_H, h))),
    });
    job.current = j;
    const res = await j.result;
    if (my !== seq.current) return;
    setRunning(false);
    setOut(res.lines);
    task?.onRunResult(res);
  };

  const reset = () => {
    job.current?.stop();
    seq.current++;
    setRunning(false);
    setValues(Object.fromEntries(files.map((f) => [f.name, f.code])));
    setOut([]);
    setRan(false);
    if (frame.current) frame.current.srcdoc = BLANK;
  };

  return (
    <div className={'code-wrap playground-wrap ' + mode}>
      <div className="code-head">
        <span className="dots">
          <i />
          <i />
          <i />
        </span>
        <span className="hint-edit">
          {title || (mode === 'react' ? S.hintReact : S.hintDom)}
          <span className="kbd-hint"> · Ctrl + Enter</span>
        </span>
        <button type="button" className="reset" title={t.codeBlock.resetTitle} onClick={reset}>
          {t.codeBlock.reset}
        </button>
        <button type="button" className={'run' + (running ? ' busy' : '')} aria-busy={running} onClick={doRun}>
          {running ? t.codeBlock.running : t.codeBlock.run}
        </button>
      </div>

      <div className="pg-tabs" role="tablist" aria-label={S.tabs}>
        {files.map((f) => (
          <button
            key={f.name}
            type="button"
            role="tab"
            id={`pgtab-${f.name}`}
            aria-selected={f.name === active}
            className={'pg-tab' + (f.name === active ? ' on' : '')}
            onClick={() => setActive(f.name)}
          >
            {f.name}
          </button>
        ))}
      </div>

      {files.map((f) => (
        <div key={f.name} hidden={f.name !== active} role="tabpanel" aria-labelledby={`pgtab-${f.name}`}>
          <CodeEditor
            value={values[f.name]}
            onChange={(v) => setValues((s) => ({ ...s, [f.name]: v }))}
            onRun={doRun}
            lang={f.lang}
            handle={(h) => {
              handles.current[f.name] = h;
            }}
          />
        </div>
      ))}

      <div className="pg-preview">
        <div className="pg-bar">
          <span>{S.preview}</span>
          <button type="button" className="pg-toggle" aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? S.hide : S.show}
          </button>
        </div>
        {!ran && open && <div className="pg-empty">{S.empty}</div>}
        <div className="pg-stage" hidden={!ran || !open}>
          <iframe
            ref={frame}
            className="pg-frame"
            sandbox="allow-scripts"
            title={S.previewAria}
            style={{ height }}
          />
        </div>
      </div>

      <div className={'output' + (out.length ? ' show' : '')}>
        {out.map((l, i) => (
          <div key={i} className={'line' + (l.cls ? ' ' + l.cls : '')}>
            {l.text}
          </div>
        ))}
      </div>
    </div>
  );
}
