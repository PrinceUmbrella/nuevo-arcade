import { VICTORY_LINE } from '../data/constellations';
import { formatDuration } from '../hooks/useNow';

interface Props {
  team: string;
  masterKey: string;
  totalMs: number;
  sectorRestarts: number;
}

export function VictoryScreen({ team, masterKey, totalMs, sectorRestarts }: Props) {
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
        </div>
        {sectorRestarts > 0 && (
          <div className="restarts">
            {sectorRestarts} sector {sectorRestarts === 1 ? 'restart' : 'restarts'}.
          </div>
        )}
        <div className="victory-note">Take this key to the final terminal.</div>
      </div>
    </div>
  );
}
