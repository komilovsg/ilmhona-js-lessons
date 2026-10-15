'use client';

import { useCallback, useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { flushSync } from 'react-dom';
import { highlightLang, type Lang } from '@/lib/highlight';
import type { MountedEditor } from '@/lib/cm';

export type CodeEditorHandle = { getValue: () => string };

export const EDITOR_STRINGS = {
  label: 'Редактор кода. Нажмите, чтобы редактировать.',
};

type Props = {
  value: string;
  /** Called with the edited text when the editor loses focus. */
  onChange: (value: string) => void;
  /** Called with the current text on Ctrl/Cmd+Enter. */
  onRun: (value: string) => void;
  readOnly?: boolean;
  lang?: Lang;
  handle?: Ref<CodeEditorHandle>;
};

let cmModule: Promise<typeof import('@/lib/cm')> | null = null;
const loadCm = () => (cmModule ??= import('@/lib/cm'));

/**
 * Code editor. SSR / first paint is the static highlighted <pre class="code"> (no layout shift,
 * works without JS). On the first pointer/focus/key interaction CodeMirror 6 is loaded lazily
 * (separate chunk) and swapped in place with identical metrics (see the runner block in globals.css).
 * Read-only blocks never load CodeMirror.
 */
export default function CodeEditor({ value, onChange, onRun, readOnly, lang = 'js', handle }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const cm = useRef<MountedEditor | null>(null);
  const starting = useRef(false);
  const [ready, setReady] = useState(false);
  // latest callbacks without re-creating the editor
  const cb = useRef({ onChange, onRun, value });
  useEffect(() => {
    cb.current = { onChange, onRun, value };
  });

  useImperativeHandle(handle, () => ({ getValue: () => cm.current?.getValue() ?? cb.current.value }));

  const activate = useCallback(
    async (from?: { x: number; y: number }, viaFocus = false) => {
      if (cm.current) return;
      if (starting.current) return;
      starting.current = true;
      try {
        const mod = await loadCm();
        const host = hostRef.current;
        if (!host) return;
        const ed = mod.mountEditor({
          parent: host,
          doc: cb.current.value,
          lang,
          onRun: (v) => cb.current.onRun(v),
          onBlur: (v) => cb.current.onChange(v),
        });
        cm.current = ed;
        if (viaFocus) ed.release();
        flushSync(() => setReady(true));
        ed.view.requestMeasure();
        if (from) {
          const pos = ed.view.posAtCoords(from);
          if (pos != null) ed.view.dispatch({ selection: { anchor: pos } });
        }
        ed.focus();
      } finally {
        starting.current = false;
      }
    },
    [lang],
  );

  // Reset (or any external value change) -> replace the document
  useEffect(() => {
    cm.current?.setValue(value);
  }, [value]);

  useEffect(
    () => () => {
      cm.current?.destroy();
      cm.current = null;
    },
    [],
  );

  if (readOnly) return <pre className="code">{highlightLang(value, lang)}</pre>;

  return (
    <>
      {!ready && (
        <pre
          className="code"
          data-editable=""
          tabIndex={0}
          aria-label={EDITOR_STRINGS.label}
          onPointerEnter={() => void loadCm()}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            // let the browser finish the press (text selection start etc.), then swap
            void activate({ x: e.clientX, y: e.clientY });
          }}
          onFocus={(e) => {
            // keyboard arrival: load, and let the first Tab move on (no focus trap)
            if (e.currentTarget.matches(':focus-visible')) void activate(undefined, true);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onRun(value);
            } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey) {
              void activate();
            }
          }}
        >
          {highlightLang(value, lang)}
        </pre>
      )}
      <div className="cm-host" ref={hostRef} hidden={!ready} />
    </>
  );
}
