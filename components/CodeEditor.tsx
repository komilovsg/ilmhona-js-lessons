'use client';

import { useCallback, useImperativeHandle, useState, useRef, type Ref } from 'react';
import { highlight } from '@/lib/highlight';

export type CodeEditorHandle = { getValue: () => string };

type Props = {
  value: string;
  /** Called with the edited text when the editor loses focus. */
  onChange: (value: string) => void;
  /** Called with the current text on Ctrl/Cmd+Enter. */
  onRun: (value: string) => void;
  readOnly?: boolean;
  handle?: Ref<CodeEditorHandle>;
};

/**
 * Minimal editor: a contentEditable <pre>. Self-contained so it can be swapped
 * for CodeMirror later (keep the props contract).
 * The DOM is edited freely by the browser while focused; on blur we commit the text
 * and remount the <pre> (key bump) so React re-highlights from clean state.
 */
export default function CodeEditor({ value, onChange, onRun, readOnly, handle }: Props) {
  const preRef = useRef<HTMLPreElement | null>(null);
  const [rev, setRev] = useState(0);

  // NBSP -> space, same as the old inline script
  const read = () => (preRef.current?.innerText ?? value).replace(/ /g, ' ');
  useImperativeHandle(handle, () => ({ getValue: read }));

  const setRef = useCallback((el: HTMLPreElement | null) => {
    preRef.current = el;
    // browsers without `plaintext-only` fall back to plain contentEditable
    if (el && el.contentEditable !== 'plaintext-only') el.contentEditable = 'true';
  }, []);

  if (readOnly) return <pre className="code">{highlight(value)}</pre>;

  return (
    <pre
      key={`${rev}:${value}`}
      ref={setRef}
      className="code"
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      spellCheck={false}
      onBlur={() => {
        onChange(read());
        setRev((r) => r + 1);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          onRun(read());
        } else if (e.key === 'Tab') {
          e.preventDefault();
          document.execCommand('insertText', false, '  ');
        }
      }}
    >
      {highlight(value)}
    </pre>
  );
}
