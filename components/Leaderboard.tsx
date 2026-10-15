'use client';

import { useEffect, useState } from 'react';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { useT } from './I18nProvider';


type Entry = {
  rank: number;
  display_name: string;
  avatar_url: string | null;
  xp_total: number;
  solved_count: number;
  is_me: boolean;
};

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function Leaderboard() {
  const T = useT().t.leaderboard;
  return (
    <section className="lb">
      <h1>{T.title}</h1>
      {isSupabaseConfigured ? (
        <>
          <p className="lb-lead">{T.lead}</p>
          <LeaderboardTable />
        </>
      ) : (
        <p className="lb-note">{T.noServer}</p>
      )}
    </section>
  );
}

function LeaderboardTable() {
  const T = useT().t.leaderboard;
  const [rows, setRows] = useState<Entry[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { getBrowserSupabase } = await import('@/lib/supabase/client');
      const sb = getBrowserSupabase();
      if (!sb) return;
      const { data, error } = await sb.rpc('leaderboard', { limit_n: 50 });
      if (!alive) return;
      if (error) setFailed(true);
      else setRows((data ?? []) as Entry[]);
    })();
    return () => {
      alive = false;
    };
  }, [attempt]);

  if (failed) {
    return (
      <p className="lb-note">
        {T.error}{' '}
        <button
          type="button"
          className="auth-link"
          onClick={() => {
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
        >
          {T.retry}
        </button>
      </p>
    );
  }
  if (!rows) return <p className="lb-note" aria-busy="true">{T.loading}</p>;
  if (!rows.length) return <p className="lb-note">{T.empty}</p>;

  return (
    <div className="table-wrap">
      <table className="lb-table">
        <thead>
          <tr>
            <th scope="col">{T.place}</th>
            <th scope="col">{T.name}</th>
            <th scope="col" className="num">
              {T.xp}
            </th>
            <th scope="col" className="num">
              {T.solved}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${r.rank}-${i}`} className={r.is_me ? 'me' : undefined} aria-current={r.is_me ? 'true' : undefined}>
              <td className="lb-rank">{MEDALS[r.rank] ? <span role="img" aria-label={String(r.rank)}>{MEDALS[r.rank]}</span> : r.rank}</td>
              <td>
                <div className="lb-name">
                  {r.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- external OAuth avatar, tiny
                    <img src={r.avatar_url} alt="" width={24} height={24} loading="lazy" referrerPolicy="no-referrer" />
                  ) : (
                    <span className="auth-initial" aria-hidden="true">
                      {r.display_name.charAt(0).toUpperCase()}
                    </span>
                  )}
                  <span>{r.display_name}</span>
                  {r.is_me && <em className="lb-you">{T.you}</em>}
                </div>
              </td>
              <td className="num">
                <b>{r.xp_total}</b>
              </td>
              <td className="num">{r.solved_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
