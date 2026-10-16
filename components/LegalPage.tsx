import { CONTACT_EMAIL, legalDoc, type Block, type LegalKind } from '@/lib/legal';
import type { Locale } from '@/lib/i18n';

function inline(s: string) {
  return s.split(/(\*\*[^*]+\*\*|\{email\})/).map((part, i) => {
    if (part === '{email}') return <a key={i} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
    if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return part;
  });
}

function renderBlock(b: Block, i: number) {
  if ('p' in b) return <p key={i}>{inline(b.p)}</p>;
  if ('ul' in b) return <ul key={i}>{b.ul.map((li, j) => <li key={j}>{inline(li)}</li>)}</ul>;
  return (
    <div key={i} className={`callout${b.callout === 'info' ? '' : ` ${b.callout}`}`}>
      <b>{b.title}</b>
      <p>{inline(b.text)}</p>
    </div>
  );
}

export default function LegalPage({ locale, kind }: { locale: Locale; kind: LegalKind }) {
  const d = legalDoc(locale, kind);
  return (
    <main className="legal-page">
      <header className="hero">
        <p className="kicker">{d.kicker}</p>
        <h1>{d.title}</h1>
        <p className="lead">{d.lead}</p>
        <p className="legal-date">{d.updated}</p>
      </header>
      {d.sections.map((s, i) => (
        <section key={i} className="topic legal-sec">
          <h2>
            <span className="num">{String(i + 1).padStart(2, '0')}</span>
            {s.h}
          </h2>
          {s.blocks.map(renderBlock)}
        </section>
      ))}
    </main>
  );
}
