import { useEffect, useState } from 'react';
import { loadLeaderboard, subscribeLeaderboard } from '../game/leaderboard';
import { LeaderboardList } from './LeaderboardList';

/** ?view=leaderboard: a second screen that updates live as crews finish (same machine). */
export function LeaderboardView() {
  const [entries, setEntries] = useState(loadLeaderboard);

  useEffect(() => {
    const refresh = () => setEntries(loadLeaderboard());
    const unsubscribe = subscribeLeaderboard(refresh);
    const id = window.setInterval(refresh, 5000);
    return () => {
      unsubscribe();
      window.clearInterval(id);
    };
  }, []);

  return (
    <main className="leaderboard-view">
      <h1>FASTEST CREWS</h1>
      <p>The Constellation Grid. Times include hint penalties.</p>
      <LeaderboardList entries={entries} limit={12} emptyText="No crews have finished yet." />
    </main>
  );
}
