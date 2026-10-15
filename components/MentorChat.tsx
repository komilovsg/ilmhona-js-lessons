'use client';

import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { closeMentor, getMentor, getServerMentor, openMentor, subscribeMentor } from '@/lib/mentor-client';
import { fmt } from '@/lib/i18n';
import { useT } from './I18nProvider';

type Msg = { role: 'user' | 'model'; text: string };
type Ctx = { taskId?: string; code?: string; output?: string };

const storeKey = (slug: string) => `mentor:${slug}`;

function load(slug: string): Msg[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(storeKey(slug)) ?? '[]');
    return Array.isArray(v) ? v.filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string') : [];
  } catch {
    return [];
  }
}

/** Plain-text answer with `code` and ``` blocks. Everything is a React text node, so it is escaped. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/```/);
  return (
    <>
      {parts.map((p, i) => {
        if (i % 2 === 1) {
          const body = p.replace(/^[A-Za-z0-9_+-]*\n/, '').replace(/\n$/, '');
          return (
            <pre key={i} className="mentor-pre">
              <code>{body}</code>
            </pre>
          );
        }
        if (parts.length > 1) p = p.replace(i > 0 ? /^\n/ : /$^/, '').replace(i < parts.length - 1 ? /\n$/ : /$^/, '');
        return (
          <Fragment key={i}>
            {p.split(/`([^`\n]+)`/).map((s, j): ReactNode => (j % 2 ? <code key={j}>{s}</code> : <Fragment key={j}>{s}</Fragment>))}
          </Fragment>
        );
      })}
    </>
  );
}

export default function MentorChat({ lessonSlug }: { lessonSlug: string }) {
  const { t, locale } = useT();
  const S = t.mentor;
  const m = useSyncExternalStore(subscribeMentor, getMentor, getServerMentor);
  const [messages, setMessages] = useState<Msg[]>(() => (typeof window === 'undefined' ? [] : load(lessonSlug)));
  const [input, setInput] = useState('');
  const [ctx, setCtx] = useState<Ctx>({});
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [off, setOff] = useState(false);
  const [seen, setSeen] = useState(m.seq);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const abort = useRef<AbortController | null>(null);

  // A new open request carries context (task / code / error) and an optional prefilled message.
  if (m.seq !== seen) {
    setSeen(m.seq);
    if (m.req) {
      setCtx({ taskId: m.req.taskId, code: m.req.code, output: m.req.output });
      if (m.req.prefill) setInput(m.req.prefill);
    }
  }

  useEffect(() => {
    if (!m.open) return;
    if (!panelRef.current?.contains(document.activeElement)) opener.current = document.activeElement as HTMLElement | null;
    inputRef.current?.focus();
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [m.open, m.seq]);

  useEffect(() => {
    try {
      sessionStorage.setItem(storeKey(lessonSlug), JSON.stringify(messages.slice(-24)));
    } catch {}
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, lessonSlug, err]);

  useEffect(() => () => abort.current?.abort(), []);

  function close() {
    closeMentor();
    opener.current?.focus();
  }

  function resetChat() {
    abort.current?.abort();
    setMessages([]);
    setCtx({});
    setErr(null);
    setBusy(false);
    setInput('');
    inputRef.current?.focus();
  }

  async function send() {
    const text = input.trim().slice(0, 2000);
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: 'user', text }];
    setMessages([...next, { role: 'model', text: '' }]);
    setInput('');
    setErr(null);
    setBusy(true);
    let hist = next.slice(-12).map((x) => ({ role: x.role, text: x.text.slice(0, 2000) }));
    if (hist[0].role === 'model') hist = hist.slice(1);
    const ac = new AbortController();
    abort.current = ac;
    let got = '';
    try {
      const res = await fetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, lessonSlug, ...ctx, messages: hist }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        const j = await res.json().catch(() => ({}));
        if (res.status === 503 && j.error === 'not_configured') setOff(true);
        else setErr(res.status === 429 && typeof j.message === 'string' ? j.message : S.errGeneric);
      } else {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          got += dec.decode(value, { stream: true });
          const snap = got;
          setMessages((cur) => [...cur.slice(0, -1), { role: 'model', text: snap }]);
        }
        if (!got.trim()) setErr(S.errGeneric);
      }
    } catch {
      if (!ac.signal.aborted) setErr(S.errGeneric);
    } finally {
      if (ac.signal.aborted) return;
      if (!got.trim()) setMessages((cur) => (cur[cur.length - 1]?.role === 'model' && !cur[cur.length - 1].text ? cur.slice(0, -1) : cur));
      setBusy(false);
    }
  }

  const ctxLabel = ctx.taskId ? fmt(S.ctxTask, { id: ctx.taskId }) : ctx.code || ctx.output ? S.ctxCode : '';

  return (
    <>
      <button
        type="button"
        className="mentor-fab"
        aria-haspopup="dialog"
        aria-expanded={m.open}
        onClick={() => openMentor()}
      >
        <span aria-hidden="true">💬</span> {S.fab}
      </button>
      {m.open && (
        <>
          <div className="mentor-backdrop" onClick={close} aria-hidden="true" />
          <section
            ref={panelRef}
            className="mentor-panel"
            role="dialog"
            aria-modal="false"
            aria-labelledby="mentor-title"
            onKeyDown={(e) => {
              if (e.key !== 'Tab') return;
              const f = panelRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), textarea:not([disabled])');
              if (!f?.length) return;
              const first = f[0];
              const last = f[f.length - 1];
              const wrapTo = e.shiftKey ? (document.activeElement === first ? last : null) : document.activeElement === last ? first : null;
              if (wrapTo) {
                e.preventDefault();
                wrapTo.focus();
              }
            }}
          >
            <header>
              <h2 id="mentor-title">{S.title}</h2>
              <button type="button" className="mentor-link" onClick={resetChat} disabled={!messages.length && !ctxLabel}>
                {S.newChat}
              </button>
              <button type="button" className="mentor-x" onClick={close} aria-label={S.close}>
                ×
              </button>
            </header>
            <div className="mentor-list" ref={listRef} aria-live="polite">
              {off ? (
                <p className="mentor-note">{S.notConfigured}</p>
              ) : (
                <>
                  {!messages.length && <p className="mentor-note">{S.empty}</p>}
                  {messages.map((x, i) => (
                    <div key={i} className={'mentor-msg ' + (x.role === 'user' ? 'me' : 'bot')}>
                      {x.text ? <Rich text={x.text} /> : <span className="mentor-dots">{S.thinking}</span>}
                    </div>
                  ))}
                  {err && (
                    <p className="mentor-err" role="alert">
                      {err}
                    </p>
                  )}
                </>
              )}
            </div>
            {ctxLabel && !off && (
              <div className="mentor-ctx">
                <span>{ctxLabel}</span>
                <button type="button" className="mentor-link" onClick={() => setCtx({})}>
                  {S.ctxRemove}
                </button>
              </div>
            )}
            <form
              className="mentor-form"
              onSubmit={(e) => {
                e.preventDefault();
                void send();
              }}
            >
              <textarea
                ref={inputRef}
                rows={2}
                maxLength={2000}
                value={input}
                disabled={off}
                placeholder={S.placeholder}
                aria-label={S.placeholder}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    void send();
                  }
                }}
              />
              <button type="submit" disabled={off || busy || !input.trim()}>
                {S.send}
              </button>
            </form>
            <p className="mentor-privacy">{S.privacy}</p>
          </section>
        </>
      )}
    </>
  );
}
