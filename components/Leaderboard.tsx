'use client';

import { isSafeAvatar } from '@/lib/avatar';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { useLeaderboard } from '@/lib/use-leaderboard';
import { useT } from './I18nProvider';


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
  const { userId, rows, listed, failed, retry } = useLeaderboard(50);

  if (userId === null) return <p className="lb-note">{T.signInPrompt}</p>;
  if (failed) {
    return (
      <p className="lb-note">
        {T.error}{' '}
        <button
          type="button"
          className="auth-link"
          onClick={retry}
        >
          {T.retry}
        </button>
      </p>
    );
  }
  if (!rows) return <p className="lb-note" aria-busy="true">{T.loading}</p>;
  const notListed = !listed && <p className="lb-note">{T.notListed}</p>;
  if (!rows.length)
    return (
      <>
        {notListed}
        <p className="lb-note">{T.empty}</p>
      </>
    );

  return (
    <>
      {notListed}
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
                    {isSafeAvatar(r.avatar_url) ? (
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
    </>
  );
}
