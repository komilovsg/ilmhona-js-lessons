'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useT } from './I18nProvider';

export default function Prompt({ className, text, children }: { className: string; text: string; children: ReactNode }) {
  const { t } = useT();
  // null = idle (show the localized default label)
  const [state, setState] = useState<'copied' | 'failed' | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setState('copied');
    } catch {
      setState('failed');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState(null), 1800);
  };

  return (
    <div className={className}>
      {children}
      <button type="button" className="copy" onClick={copy}>
        {state === 'copied' ? t.prompt.copied : state === 'failed' ? t.prompt.copyFailed : t.prompt.copy}
      </button>
    </div>
  );
}
