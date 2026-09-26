import { VICTORY_LINE } from '../data/constellations';
import type { LeaderboardEntry } from '../game/leaderboard';
import { formatDuration } from '../hooks/useNow';
import { LeaderboardList } from './LeaderboardList';

interface Props {
  team: string;
  masterKey: string;
  totalMs: number;
  penaltyMs: number;
  sectorRestarts: number;
  rank: number | null;
  entries: LeaderboardEntry[];
  mine: LeaderboardEntry | null;
}

export function VictoryScreen({ team, masterKey, totalMs, penaltyMs, sectorRestarts, rank, entries, mine }: Props) {
  return (
    <div className="victory" role="dialog" aria-labelledby="victory-title">
      <div className="victory-main">
        <h2 id="victory-title" className="victory-title">
          MISSION COMPLETE
        </h2>
        <div className="victory-team">CREW {team}</div>
        <div className="victory-label">MASTER KEY</div>
        <div className="victory-key">{masterKey}</div>
        <div className="victory-line">{VICTORY_LINE}</div>
        <div className="victory-time">
          FINAL TIME {formatDuration(totalMs)}
          {rank !== null && <span className="victory-rank"> RANK #{rank}</span>}
        </div>
        {(penaltyMs > 0 || sectorRestarts > 0) && (
          <div className="restarts">
            {penaltyMs > 0 && <span className="penalty">Includes +{formatDuration(penaltyMs)} of hint penalties. </span>}
            {sectorRestarts > 0 && `${sectorRestarts} sector ${sectorRestarts === 1 ? 'restart' : 'restarts'}.`}
          </div>
        )}
        <div className="victory-note">Take this key to the final terminal.</div>
      </div>
      <aside className="victory-board" aria-label="Fastest crews">
        <h3>FASTEST CREWS</h3>
        <LeaderboardList entries={entries} limit={8} highlight={mine} />
      </aside>
    </div>
  );
}
