'use client';

import { useEffect, useState } from 'react';

export type LeaderboardEntry = {
  rank: number;
  display_name: string;
  avatar_url: string | null;
  xp_total: number;
  solved_count: number;
  is_me: boolean;
};

/**
 * All-time leaderboard via the `leaderboard` RPC. Signed-in students only (the RPC is not executable by anon):
 * `userId` is undefined while the auth state loads and null when signed out. Shared by the full page and the board.
 */
export function useLeaderboard(limit: number) {
  const [userId, setUserId] = useState<string | null | undefined>(undefined); // undefined = loading
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  const [listed, setListed] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    let unsub: (() => void) | undefined;
    (async () => {
      const { getBrowserSupabase } = await import('@/lib/supabase/client');
      const sb = getBrowserSupabase();
      if (!alive || !sb) return;
      const { data } = sb.auth.onAuthStateChange((_event, session) => {
        // Don't await Supabase calls inside this callback (auth lock); defer instead.
        setTimeout(() => alive && setUserId(session?.user.id ?? null), 0);
      });
      unsub = () => data.subscription.unsubscribe();
    })();
    return () => {
      alive = false;
      unsub?.();
    };
  }, []);

  useEffect(() => {
    if (!userId) return;
    let alive = true;
    (async () => {
      const { getBrowserSupabase } = await import('@/lib/supabase/client');
      const sb = getBrowserSupabase();
      if (!sb) return;
      const [board, me] = await Promise.all([
        sb.rpc('leaderboard', { limit_n: limit }),
        sb.from('profiles').select('show_on_leaderboard').eq('id', userId).maybeSingle(),
      ]);
      if (!alive) return;
      if (board.error) setFailed(true);
      else {
        setRows((board.data ?? []) as LeaderboardEntry[]);
        setListed(!!(me.data as { show_on_leaderboard?: boolean } | null)?.show_on_leaderboard);
      }
    })();
    return () => {
      alive = false;
    };
  }, [userId, attempt, limit]);

  const retry = () => {
    setFailed(false);
    setAttempt((a) => a + 1);
  };
  return { userId, rows, listed, failed, retry };
}
