'use client';

import { Fragment, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { closeMentor, getMentor, getServerMentor, openMentor, splitSigned, subscribeMentor } from '@/lib/mentor-client';
import { fmt } from '@/lib/i18n';
import { redactCodeField, redactMessage } from '@/lib/redact';
import { useT } from './I18nProvider';
import MentorBot from './MentorBot';
import MentorFab, { hasFabPos, resetFabPos } from './MentorFab';

type Msg = { role: 'user' | 'model'; text: string; red?: boolean; sig?: string };
type Turn = { role: Msg['role']; text: string; sig?: string };
type Ctx = { taskId?: string; code?: string; output?: string };

const storeKey = (slug: string) => `mentor:${slug}`;

function load(slug: string): Msg[] {
  try {
    const v = JSON.parse(sessionStorage.getItem(storeKey(slug)) ?? '[]');
    return Array.isArray(v)
      ? v
          .filter((m) => m && (m.role === 'user' || m.role === 'model') && typeof m.text === 'string' && m.text.trim())
          .map((m) => ({ role: m.role, text: m.text, red: m.red === true, sig: typeof m.sig === 'string' ? m.sig : undefined }))
      : [];
  } catch {
    return [];
  }
}

const BODY_BUDGET = 56 * 1024; // server rejects bodies over 64 KB

/**
 * What goes upstream: no empty turns, consecutive user turns merged (a failed turn leaves two), starts with a user turn.
 * Model turns are sent verbatim with their signature (the server drops unsigned ones), so they are never cut.
 */
function history(msgs: Msg[], extraBytes: number): Turn[] {
  const out: Turn[] = [];
  for (const m of msgs) {
    if (!m.text.trim()) continue;
    const last = out[out.length - 1];
    if (m.role === 'model') {
      if (m.sig && m.text.length <= 4000) out.push({ role: 'model', text: m.text, sig: m.sig });
    } else if (last?.role === 'user') last.text += '\n' + m.text;
    else out.push({ role: 'user', text: m.text });
  }
  let h = out.map((x) => (x.role === 'user' ? { ...x, text: x.text.slice(-2000) } : x)).slice(-12);
  const size = (t: Turn[]) => new TextEncoder().encode(JSON.stringify(t)).length + extraBytes;
  while (h.length > 1 && (h[0].role === 'model' || size(h) > BODY_BUDGET)) h = h.slice(1);
  return h;
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
  const [canRetry, setCanRetry] = useState(false);
  const [off, setOff] = useState(false);
  const [wait, setWait] = useState(0); // seconds until retry is allowed after a "busy" answer
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
      sessionStorage.setItem(storeKey(lessonSlug), JSON.stringify(messages.filter((x) => x.text.trim()).slice(-24)));
    } catch {}
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, lessonSlug, err]);

  useEffect(() => () => abort.current?.abort(), []);

  useEffect(() => {
    if (wait <= 0) return;
    const id = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  function close() {
    closeMentor();
    opener.current?.focus();
  }

  function resetChat() {
    abort.current?.abort();
    setMessages([]);
    setCtx({});
    setErr(null);
    setCanRetry(false);
    setBusy(false);
    setInput('');
    inputRef.current?.focus();
  }

  /** Send the typed text, or (retry) re-ask the last user message without adding a new one. */
  async function send(retry = false) {
    if (busy || wait > 0) return;
    let base = messages.filter((x) => x.text.trim());
    if (retry) {
      if (base[base.length - 1]?.role !== 'user') return;
    } else {
      const text = input.trim();
      if (!text) return;
      const r = redactMessage(text.slice(0, 2000));
      base = [...base, { role: 'user', text: r.text, red: r.hit }];
      setInput('');
    }
    setMessages([...base, { role: 'model', text: '' }]);
    setErr(null);
    setCanRetry(false);
    setBusy(true);
    const ac = new AbortController();
    abort.current = ac;
    let got = '';
    let failed = false;
    try {
      const code = ctx.code ? redactCodeField(ctx.code.slice(0, 6000)).text : undefined;
      const output = ctx.output ? redactCodeField(ctx.output.slice(-3000)).text : undefined;
      const extra = new TextEncoder().encode(`${code ?? ''}${output ?? ''}`).length + 512;
      const res = await fetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, lessonSlug, taskId: ctx.taskId, code, output, messages: history(base, extra) }),
        signal: ac.signal,
      });
      if (!res.ok || !res.body) {
        failed = true;
        const j = await res.json().catch(() => ({}));
        if (res.status === 503 && j.error === 'not_configured') {
          setOff(true);
        } else if (res.status === 503 && j.error === 'busy') {
          setErr(S.busy);
          setCanRetry(true);
          setWait(Math.min(300, Math.max(1, Number(res.headers.get('Retry-After')) || Number(j.retryAfter) || 30)));
        } else {
          const limited = res.status === 429 ? j.messages?.[locale] : undefined;
          setErr(typeof limited === 'string' ? limited : S.errGeneric);
          setCanRetry(res.status !== 400);
        }
      } else {
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          got += dec.decode(value, { stream: true });
          const snap = splitSigned(got);
          setMessages((cur) => [...cur.slice(0, -1), { role: 'model', text: snap.text, sig: snap.sig }]);
        }
        if (!splitSigned(got).text.trim()) {
          failed = true;
          setErr(S.errGeneric);
          setCanRetry(true);
        }
      }
    } catch {
      if (ac.signal.aborted) return;
      failed = true;
      setErr(S.errGeneric);
      setCanRetry(true);
    }
    if (failed) setMessages((cur) => (cur[cur.length - 1]?.role === 'model' && !cur[cur.length - 1].text ? cur.slice(0, -1) : cur));
    setBusy(false);
  }

  const ctxLabel = ctx.taskId ? fmt(S.ctxTask, { id: ctx.taskId }) : ctx.code || ctx.output ? S.ctxCode : '';

  return (
    <>
      <MentorFab label={S.fab} onOpen={() => openMentor()} />
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
              <span className="mentor-av lg">
                <MentorBot />
              </span>
              <h2 id="mentor-title">{S.title}</h2>
              {hasFabPos() && (
                <button type="button" className="mentor-link" onClick={resetFabPos} title={S.resetPos}>
                  ⌖
                </button>
              )}
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
                  {messages.map((x, i) =>
                    x.role === 'user' ? (
                      <Fragment key={i}>
                        <div className="mentor-msg me">{x.text}</div>
                        {x.red && <small className="mentor-red">{S.redacted}</small>}
                      </Fragment>
                    ) : (
                      <div key={i} className="mentor-row">
                        <span className="mentor-av">
                          <MentorBot />
                        </span>
                        <div className="mentor-msg bot">{x.text ? <Rich text={x.text} /> : <span className="mentor-dots">{S.thinking}</span>}</div>
                      </div>
                    ),
                  )}
                  {err && (
                    <p className="mentor-err" role="alert">
                      {err}
                      {canRetry && (
                        <button type="button" className="mentor-retry" onClick={() => void send(true)} disabled={wait > 0}>
                          {wait > 0 ? `${S.retry} (${wait})` : S.retry}
                        </button>
                      )}
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
              <button type="submit" disabled={off || busy || wait > 0 || !input.trim()}>
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
