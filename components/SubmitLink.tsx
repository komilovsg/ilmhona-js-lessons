'use client';

import { useContext, useRef, useState } from 'react';
import { fmt } from '@/lib/i18n';
import { useLocal, writeLocal } from '@/lib/mfs-local';
import { useT } from './I18nProvider';
import { TaskContext } from './TaskContext';

/** https URL whose host equals or is a subdomain of one of `hosts` (no hosts = any https URL). */
function validate(value: string, hosts: string[]): 'ok' | 'invalid' | 'host' {
  let u: URL;
  try {
    u = new URL(value);
  } catch {
    return 'invalid';
  }
  if (u.protocol !== 'https:') return 'invalid';
  if (!hosts.length) return 'ok';
  const h = u.hostname.toLowerCase();
  return hosts.some((x) => h === x || h.endsWith('.' + x)) ? 'ok' : 'host';
}

/** `<div class="submit-link" data-hosts="…">` inside a task: stores the homework link locally; saving solves the task (half XP). */
export default function SubmitLink({ lessonKey, hosts, placeholder }: { lessonKey: string; hosts: string[]; placeholder?: string }) {
  const { t } = useT();
  const ctx = useContext(TaskContext);
  const saveBtn = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState('');
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const key = `mfs:link:${lessonKey}:${ctx?.taskId}`;
  const stored = useLocal(key);
  if (!ctx) return null;
  const saved = stored && validate(stored, hosts) === 'ok' ? stored : null;

  const save = () => {
    const v = draft.trim();
    const r = validate(v, hosts);
    if (r !== 'ok') return setErr(r === 'host' ? fmt(t.practice.linkHost, { hosts: hosts.join(', ') }) : t.practice.linkInvalid);
    setErr(null);
    setEditing(false);
    writeLocal(key, v);
    ctx.solve(false, saveBtn.current);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(saved!);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
  };

  if (saved && !editing) {
    return (
      <div className="submit-link">
        <a href={saved} target="_blank" rel="noopener noreferrer nofollow" className="submit-url">
          {saved}
        </a>
        <button type="button" className="done-toggle" onClick={copy}>
          {copied ? t.prompt.copied : t.prompt.copy}
        </button>
        <button
          type="button"
          className="done-toggle"
          onClick={() => {
            setDraft(saved);
            setEditing(true);
          }}
        >
          {t.practice.edit}
        </button>
      </div>
    );
  }
  return (
    <div className="submit-link">
      <input
        type="url"
        value={draft}
        placeholder={placeholder || 'https://…'}
        aria-label={t.practice.linkLabel}
        aria-invalid={!!err}
        onChange={(e) => (setDraft(e.target.value), setErr(null))}
        onKeyDown={(e) => e.key === 'Enter' && save()}
      />
      <button ref={saveBtn} type="button" className="done-toggle" onClick={save}>
        {t.practice.save}
      </button>
      {err && (
        <p className="check-fb diff" role="alert">
          {err}
        </p>
      )}
    </div>
  );
}
