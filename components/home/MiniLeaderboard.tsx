'use client';

import Link from 'next/link';
import { useState } from 'react';
import { signInWithGoogle } from '@/components/AccountMenu';
import { isSafeAvatar } from '@/lib/avatar';
import { toUrlLocale } from '@/lib/i18n';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { useLeaderboard } from '@/lib/use-leaderboard';
import { useT } from '../I18nProvider';

/** Block 6: all-time top 5 from the same RPC as the full page (signed-in only; same pseudonyms and opt-in as there). */
export default function MiniLeaderboard() {
  const { t, locale } = useT();
  return (
    <section className="hm-panel" aria-labelledby="hm-top-t">
      <div className="hm-panel-head">
        <h2 id="hm-top-t">{t.home.top.title}</h2>
        <Link className="hm-link" href={`/${toUrlLocale(locale)}/leaderboard`}>
          {t.home.top.all} <span aria-hidden="true">→</span>
        </Link>
      </div>
      {isSupabaseConfigured ? <TopFive /> : <p className="hm-note">{t.leaderboard.noServer}</p>}
    </section>
  );
}

function TopFive() {
  const { t } = useT();
  const T = t.leaderboard;
  const { userId, rows, listed, failed, retry } = useLeaderboard(5);
  const [busy, setBusy] = useState(false);

  if (userId === null) {
    return (
      <div className="hm-signin">
        <p className="hm-signin-t">{t.home.top.signIn}</p>
        <p className="hm-note">{t.home.top.signInHint}</p>
        <button
          type="button"
          className="hm-btn hm-btn-solid"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (!(await signInWithGoogle())) setBusy(false);
          }}
        >
          {t.home.top.signInBtn}
        </button>
      </div>
    );
  }
  if (failed)
    return (
      <p className="hm-note">
        {T.error}{' '}
        <button type="button" className="hm-link" onClick={retry}>
          {T.retry}
        </button>
      </p>
    );
  if (!rows) return <p className="hm-note" aria-busy="true">{T.loading}</p>;
  return (
    <>
      {!listed && <p className="hm-note">{T.notListed}</p>}
      {rows.length ? (
        <ol className="hm-top">
          {rows.map((r, i) => (
            <li key={`${r.rank}-${i}`} className={r.is_me ? 'me' : undefined} aria-current={r.is_me ? 'true' : undefined}>
              <span className="hm-top-rank">{r.rank}</span>
              {isSafeAvatar(r.avatar_url) ? (
                // eslint-disable-next-line @next/next/no-img-element -- external OAuth avatar, tiny
                <img src={r.avatar_url} alt="" width={28} height={28} loading="lazy" referrerPolicy="no-referrer" />
              ) : (
                <span className="auth-initial" aria-hidden="true">
                  {r.display_name.charAt(0).toUpperCase()}
                </span>
              )}
              <span className="hm-top-name">
                {r.display_name}
                {r.is_me && <em className="lb-you">{T.you}</em>}
              </span>
              <b>{r.xp_total} XP</b>
            </li>
          ))}
        </ol>
      ) : (
        <p className="hm-note">{T.empty}</p>
      )}
    </>
  );
}
