'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { COURSES, courseHome, type CourseId } from '@/lib/courses';
import { pickCourse, type QuizAnswers } from '@/lib/home';
import { fmt } from '@/lib/i18n';
import { courseName } from '@/lib/site';
import { useT } from '../I18nProvider';

/** Block 4: three single-choice questions, pure client. The rule itself lives in lib/home.ts (`pickCourse`). */
export default function CoursePicker({ onPick }: { onPick: (id: CourseId | null) => void }) {
  const { t, locale } = useT();
  const T = t.home.quiz;
  const uid = useId();
  const [ans, setAns] = useState<(number | null)[]>([null, null, null]);
  const [result, setResult] = useState<CourseId | null>(null);
  const ready = ans.every((a) => a !== null);

  const choose = (qi: number, oi: number) => {
    setAns((a) => a.map((v, i) => (i === qi ? oi : v)));
    if (result) {
      setResult(null);
      onPick(null);
    }
  };
  const show = () => {
    if (!ready) return;
    const id = pickCourse({ exp: ans[0]!, known: ans[1]!, goal: ans[2]! } satisfies QuizAnswers);
    setResult(id);
    onPick(id);
  };
  const again = () => {
    setAns([null, null, null]);
    setResult(null);
    onPick(null);
  };
  const c = result ? COURSES[result] : null;

  return (
    <section className="hm-sec" id="quiz" aria-labelledby="hm-quiz-t">
      <h2 id="hm-quiz-t">{T.title}</h2>
      <p className="hm-sec-lead">{T.lead}</p>
      <form className="hm-quiz" onSubmit={(e) => (e.preventDefault(), show())}>
        {T.questions.map((q, qi) => (
          <fieldset key={qi} className="hm-q">
            <legend>
              {qi + 1}. {q.q}
            </legend>
            <div className="hm-opts">
              {q.options.map((o, oi) => (
                <label key={oi} className={`hm-opt${ans[qi] === oi ? ' is-on' : ''}`}>
                  <input type="radio" name={`${uid}-${qi}`} checked={ans[qi] === oi} onChange={() => choose(qi, oi)} />
                  <span>{o}</span>
                </label>
              ))}
            </div>
          </fieldset>
        ))}
        <div className="hm-quiz-actions">
          <button type="submit" className="hm-btn hm-btn-solid" disabled={!ready}>
            {T.show}
          </button>
          {(ready || result) && (
            <button type="button" className="hm-link" onClick={again}>
              {T.again}
            </button>
          )}
        </div>
      </form>
      <div className="hm-result" aria-live="polite">
        {c && result && (
          <div className="hm-result-card">
            <h3>{fmt(T.result, { name: c.texts?.[locale].name ?? courseName[locale] })}</h3>
            <p>{T.reasons[result]}</p>
            <Link className="hm-btn hm-btn-solid" href={courseHome(c, locale)}>
              {T.open}
              <span aria-hidden="true"> →</span>
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
