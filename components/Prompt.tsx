'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export default function Prompt({ className, text, children }: { className: string; text: string; children: ReactNode }) {
  const [label, setLabel] = useState('Копировать');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setLabel('Скопировано ✓');
    } catch {
      setLabel('Выделите и скопируйте');
    }
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setLabel('Копировать'), 1800);
  };

  return (
    <div className={className}>
      {children}
      <button type="button" className="copy" onClick={copy}>
        {label}
      </button>
    </div>
  );
}
