'use client';

import { useT } from '../I18nProvider';
import { BoltIcon, CheckIcon, TrophyIcon } from '../roadmap/icons';

/** Block 5: three steps on a stair motif, plus a note about the AI mentor. */
export default function HowItWorks() {
  const { t } = useT();
  const T = t.home.how;
  const icons = [<BoltIcon key="b" />, <CheckIcon key="c" />, <TrophyIcon key="t" />];
  return (
    <section className="hm-sec" aria-labelledby="hm-how-t">
      <h2 id="hm-how-t">{T.title}</h2>
      <ol className="hm-how">
        {T.steps.map((s, i) => (
          <li key={i} className={`hm-how-step hm-how-${i}`}>
            <span className="hm-how-n" aria-hidden="true">
              {i + 1}
            </span>
            <span className="hm-how-ic" aria-hidden="true">
              {icons[i]}
            </span>
            <h3>{s.t}</h3>
            <p>{s.d}</p>
          </li>
        ))}
      </ol>
      <p className="hm-mentor">{T.mentor}</p>
    </section>
  );
}
