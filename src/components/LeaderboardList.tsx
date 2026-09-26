import { formatDuration } from '../hooks/useNow';
import type { LeaderboardEntry } from '../game/leaderboard';

interface Props {
  entries: LeaderboardEntry[];
  limit?: number;
  highlight?: LeaderboardEntry | null;
  emptyText?: string;
}

export function LeaderboardList({ entries, limit = 5, highlight, emptyText = 'No crews yet. Be the first.' }: Props) {
  if (entries.length === 0) return <p className="board-empty">{emptyText}</p>;
  return (
    <ol className="leaderboard">
      {entries.slice(0, limit).map((e, i) => {
        const mine = !!highlight && e.at === highlight.at && e.team === highlight.team;
        return (
          <li key={`${e.at}-${e.team}`} className={mine ? 'mine' : undefined}>
            <span className="rank">{i + 1}</span>
            <span className="team">{e.team}</span>
            <span className="time">{formatDuration(e.ms)}</span>
          </li>
        );
      })}
    </ol>
  );
}
