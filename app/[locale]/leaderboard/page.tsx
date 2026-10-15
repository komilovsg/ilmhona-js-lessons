import type { Metadata } from 'next';
import Leaderboard from '@/components/Leaderboard';

export const metadata: Metadata = { title: 'Рейтинг — Ilmhona' };

export default function LeaderboardPage() {
  return (
    <main className="lb-page">
      <Leaderboard />
    </main>
  );
}
