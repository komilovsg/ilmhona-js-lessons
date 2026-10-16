'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Locale } from '@/lib/i18n';

// Owner-only page: strings live here instead of messages/*.ts so the student bundle does not carry them.
const S = {
  ru: {
    title: 'Наставник: статус',
    tokenLabel: 'Токен администратора',
    tokenHint: 'Значение MENTOR_ADMIN_TOKEN. Хранится только в этой вкладке (sessionStorage).',
    enter: 'Открыть',
    logout: 'Выйти',
    refresh: 'Обновить',
    loading: 'Загрузка…',
    wrong: 'Неверный токен.',
    tooMany: 'Слишком много неудачных попыток. Попробуйте позже.',
    off: 'Админ-доступ выключен: MENTOR_ADMIN_TOKEN не задан на сервере.',
    failed: 'Не удалось загрузить статус.',
    supabase: 'Хранилище: Supabase (общее для всех инстансов)',
    notConnected: 'Хранилище не подключено — показан только этот инстанс сервера (память).',
    storageError: 'Хранилище недоступно — показан только этот инстанс сервера (память).',
    models: 'Модели',
    model: 'Модель',
    state: 'Состояние',
    minute: 'Эта минута',
    today: 'Сегодня',
    available: 'доступна',
    minuteLimited: 'лимит минуты',
    exhausted: 'исчерпана',
    until: 'до',
    totals: 'Сегодня по итогам',
    totalsNote: 'День по тихоокеанскому времени (так сбрасывается дневная квота).',
    none: 'Пока пусто.',
    logs: 'Последние 50 запросов',
    time: 'Время',
    lesson: 'Урок',
    outcome: 'Итог',
    latency: 'мс',
    question: 'Вопрос (без личных данных)',
    updated: 'Обновлено',
    outcomes: { ok: 'ответ', off_topic: 'не по теме', identity: 'о себе', busy: 'занято', daily_limit: 'дневной лимит', error: 'ошибка', rejected: 'отклонён' },
  },
  tg: {
    title: 'Роҳнамо: ҳолат',
    tokenLabel: 'Токени администратор',
    tokenHint: 'Қимати MENTOR_ADMIN_TOKEN. Танҳо дар ҳамин варақа нигоҳ дошта мешавад (sessionStorage).',
    enter: 'Кушодан',
    logout: 'Баромадан',
    refresh: 'Навсозӣ',
    loading: 'Бор шуда истодааст…',
    wrong: 'Токен нодуруст аст.',
    tooMany: 'Кӯшишҳои ноком хеле зиёд. Баъдтар кӯшиш кунед.',
    off: 'Дастрасии администратор хомӯш аст: MENTOR_ADMIN_TOKEN дар сервер муқаррар нашудааст.',
    failed: 'Ҳолатро бор кардан нашуд.',
    supabase: 'Анбор: Supabase (барои ҳамаи инстансҳо умумӣ)',
    notConnected: 'Анбор пайваст нест — танҳо ҳамин инстанси сервер (хотира) нишон дода мешавад.',
    storageError: 'Анбор дастнорас аст — танҳо ҳамин инстанси сервер (хотира) нишон дода мешавад.',
    models: 'Моделҳо',
    model: 'Модел',
    state: 'Ҳолат',
    minute: 'Ҳамин дақиқа',
    today: 'Имрӯз',
    available: 'дастрас',
    minuteLimited: 'лимити дақиқа',
    exhausted: 'тамом шуд',
    until: 'то',
    totals: 'Имрӯз аз рӯи натиҷа',
    totalsNote: 'Рӯз аз рӯи вақти Уқёнуси Ором (квотаи рӯзона ҳамин тавр нав мешавад).',
    none: 'Ҳоло холӣ.',
    logs: '50 дархости охирин',
    time: 'Вақт',
    lesson: 'Дарс',
    outcome: 'Натиҷа',
    latency: 'мс',
    question: 'Савол (бе маълумоти шахсӣ)',
    updated: 'Навсозӣ шуд',
    outcomes: { ok: 'ҷавоб', off_topic: 'берун аз мавзӯъ', identity: 'дар бораи худ', busy: 'банд', daily_limit: 'лимити рӯзона', error: 'хато', rejected: 'рад шуд' },
  },
} as const;

type Outcome = keyof (typeof S)['ru']['outcomes'];
type Model = { key: string; id: string; rpm: number; rpd: number; minuteCount: number; dayCount: number; state: 'available' | 'minute' | 'exhausted'; until: number | null };
type Log = { created_at: string; lesson_slug: string | null; task_id: string | null; outcome: Outcome; model: string | null; latency_ms: number | null; redacted_question: string | null; pii_redacted: boolean };
type Status = { storage: 'supabase' | 'memory'; storageError: boolean; configured: boolean; now: number; models: Model[]; totals: Partial<Record<Outcome, number>>; logs: Log[] };

const KEY = 'mentor-admin-token';
const read = () => {
  try {
    return sessionStorage.getItem(KEY) ?? '';
  } catch {
    return '';
  }
};
const write = (v: string) => {
  try {
    if (v) sessionStorage.setItem(KEY, v);
    else sessionStorage.removeItem(KEY);
  } catch {}
};

export default function MentorAdmin({ locale }: { locale: Locale }) {
  const T = S[locale];
  const [token, setToken] = useState<string | null>(null); // null = not read yet
  const [draft, setDraft] = useState('');
  const [data, setData] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    // sessionStorage exists only in the browser: read it after hydration
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToken(read());
  }, []);

  const load = useCallback(
    async (tok: string) => {
      setBusy(true);
      try {
        const res = await fetch('/api/mentor/status', { headers: { Authorization: `Bearer ${tok}` }, cache: 'no-store' });
        if (res.ok) {
          setData((await res.json()) as Status);
          setError('');
          return;
        }
        if (res.status === 401 || res.status === 404) {
          write('');
          setToken('');
          setData(null);
        }
        setError(res.status === 401 ? T.wrong : res.status === 429 ? T.tooMany : res.status === 404 ? T.off : T.failed);
      } catch {
        setError(T.failed);
      } finally {
        setBusy(false);
      }
    },
    [T],
  );

  useEffect(() => {
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(token);
    const id = setInterval(() => void load(token), 30_000);
    return () => clearInterval(id);
  }, [token, load]);

  const time = (t: number | string) =>
    new Date(t).toLocaleString('ru-RU', { hour: '2-digit', minute: '2-digit', second: '2-digit', day: '2-digit', month: '2-digit' });

  if (token === null) return null;

  if (!token) {
    return (
      <section className="lb">
        <h1>{T.title}</h1>
        <form
          className="adm-login"
          onSubmit={(e) => {
            e.preventDefault();
            const v = draft.trim();
            if (!v) return;
            write(v);
            setDraft('');
            setToken(v);
          }}
        >
          <label>
            <span>{T.tokenLabel}</span>
            <input type="password" autoComplete="off" spellCheck={false} value={draft} onChange={(e) => setDraft(e.target.value)} required />
            <small>{T.tokenHint}</small>
          </label>
          <button type="submit" className="auth-primary">
            {T.enter}
          </button>
        </form>
        {error && (
          <p className="lb-note adm-error" role="alert">
            {error}
          </p>
        )}
      </section>
    );
  }

  return (
    <section className="lb">
      <div className="adm-head">
        <h1>{T.title}</h1>
        <div className="adm-actions">
          <button type="button" className="auth-ghost" onClick={() => void load(token)} disabled={busy}>
            {T.refresh}
          </button>
          <button
            type="button"
            className="auth-ghost"
            onClick={() => {
              write('');
              setToken('');
              setData(null);
              setError('');
            }}
          >
            {T.logout}
          </button>
        </div>
      </div>
      {error && (
        <p className="lb-note adm-error" role="alert">
          {error}
        </p>
      )}
      {!data ? (
        !error && (
          <p className="lb-note" aria-busy="true">
            {T.loading}
          </p>
        )
      ) : (
        <>
          <p className={`adm-storage ${data.storage === 'supabase' ? 'ok' : 'warn'}`}>
            {data.storage === 'supabase' ? T.supabase : data.storageError ? T.storageError : T.notConnected}
            <small>
              {' '}
              · {T.updated} {time(data.now)}
            </small>
          </p>

          <h2>{T.models}</h2>
          <div className="table-wrap">
            <table className="lb-table">
              <thead>
                <tr>
                  <th scope="col">{T.model}</th>
                  <th scope="col">{T.state}</th>
                  <th scope="col" className="num">
                    {T.minute}
                  </th>
                  <th scope="col" className="num">
                    {T.today}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.models.map((m) => (
                  <tr key={m.key}>
                    <td>
                      <code>{m.id}</code>
                    </td>
                    <td>
                      <span className={`adm-state ${m.state}`}>
                        {m.state === 'available' ? T.available : m.state === 'minute' ? T.minuteLimited : T.exhausted}
                      </span>
                      {m.until && m.state !== 'available' && (
                        <small className="adm-until">
                          {' '}
                          {T.until} {time(m.until)}
                        </small>
                      )}
                    </td>
                    <td className="num">
                      {m.minuteCount} / {m.rpm}
                    </td>
                    <td className="num">
                      {m.dayCount} / {m.rpd}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h2>{T.totals}</h2>
          {Object.keys(data.totals).length ? (
            <ul className="adm-totals">
              {(Object.keys(T.outcomes) as Outcome[])
                .filter((o) => data.totals[o])
                .map((o) => (
                  <li key={o} className={`adm-o-${o}`}>
                    <span>{T.outcomes[o]}</span>
                    <b>{data.totals[o]}</b>
                  </li>
                ))}
            </ul>
          ) : (
            <p className="lb-note">{T.none}</p>
          )}
          <p className="adm-small">{T.totalsNote}</p>

          <h2>{T.logs}</h2>
          {data.logs.length ? (
            <div className="table-wrap">
              <table className="lb-table adm-logs">
                <thead>
                  <tr>
                    <th scope="col">{T.time}</th>
                    <th scope="col">{T.lesson}</th>
                    <th scope="col">{T.outcome}</th>
                    <th scope="col">{T.model}</th>
                    <th scope="col" className="num">
                      {T.latency}
                    </th>
                    <th scope="col">{T.question}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.logs.map((l, i) => (
                    <tr key={`${l.created_at}-${i}`}>
                      <td className="adm-nowrap">{time(l.created_at)}</td>
                      <td className="adm-nowrap">
                        {l.lesson_slug ?? '—'}
                        {l.task_id && <small> #{l.task_id}</small>}
                      </td>
                      <td>
                        <span className={`adm-state adm-o-${l.outcome}`}>{T.outcomes[l.outcome] ?? l.outcome}</span>
                      </td>
                      <td className="adm-nowrap">{l.model ? <code>{l.model}</code> : '—'}</td>
                      <td className="num">{l.latency_ms ?? '—'}</td>
                      <td className="adm-q">{l.redacted_question ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="lb-note">{T.none}</p>
          )}
        </>
      )}
    </section>
  );
}
