'use client';

import { useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useT } from './I18nProvider';
import { TaskContext } from './TaskContext';

/** `<div class="quiz" data-answer="2">`: radios (one answer) or checkboxes (several), 1-based, unlimited tries. */
export default function Quiz({
  answer,
  question,
  options,
  explain,
}: {
  answer: number[];
  question: ReactNode;
  options: ReactNode[];
  explain: ReactNode;
}) {
  const { t } = useT();
  const ctx = useContext(TaskContext);
  const name = useId();
  const root = useRef<HTMLDivElement>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const [sel, setSel] = useState<number[]>([]);
  const [ok, setOk] = useState(false);
  const [tried, setTried] = useState(false);
  const multi = answer.length > 1;
  const solved = ok || !!ctx?.done; // a solved task shows its quizzes solved
  const shown = solved ? answer : sel;

  // The task is solved when every quiz inside it is.
  useEffect(() => {
    if (!ok || !ctx || ctx.done) return;
    const quizzes = [...(root.current?.closest('article.task')?.querySelectorAll('.quiz') ?? [])];
    if (quizzes.every((q) => q.hasAttribute('data-ok'))) ctx.solve(true, btn.current);
  }, [ok, ctx]);

  const pick = (n: number) => {
    setTried(false);
    setSel(multi ? (sel.includes(n) ? sel.filter((x) => x !== n) : [...sel, n]) : [n]);
  };
  const check = () => {
    const good = sel.length === answer.length && answer.every((n) => sel.includes(n));
    setOk(good);
    setTried(!good);
  };

  return (
    <div className="quiz" ref={root} data-ok={solved ? '' : undefined}>
      {question}
      <p className="cl-count">{multi ? t.practice.pickMany : t.practice.pickOne}</p>
      <ol className="options">
        {options.map((o, i) => (
          <li key={i}>
            <label>
              <input
                type={multi ? 'checkbox' : 'radio'}
                name={name}
                checked={shown.includes(i + 1)}
                disabled={solved}
                onChange={() => pick(i + 1)}
              />
              <span>{o}</span>
            </label>
          </li>
        ))}
      </ol>
      {!solved && (
        <button ref={btn} type="button" className="done-toggle" disabled={!sel.length} onClick={check}>
          {t.practice.check}
        </button>
      )}
      {(solved || tried) && (
        <p className={'check-fb ' + (solved ? 'ok' : 'diff')} role="status">
          {solved ? t.practice.correct : t.practice.wrong}
        </p>
      )}
      {solved && explain}
    </div>
  );
}
