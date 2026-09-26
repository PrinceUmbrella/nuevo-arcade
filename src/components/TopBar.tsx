import { REDESIGN } from '../game/ruleset';
import { formatDuration } from '../hooks/useNow';

interface Props {
  sectorNumber: number;
  sectorCount: number;
  sectorName: string;
  hidden: boolean;
  elapsedMs: number;
  penaltyMs: number;
  started: boolean;
  hitsRemaining: number;
  misses: number;
  maxMisses: number;
}

export function TopBar({ sectorNumber, sectorCount, sectorName, hidden, elapsedMs, penaltyMs, started, hitsRemaining, misses, maxMisses }: Props) {
  const shieldsLeft = Math.max(0, maxMisses - misses);
  return (
    <header className={REDESIGN ? 'topbar no-timer' : 'topbar'}>
      <div className="topbar-block">
        <div className="label">SECTOR {sectorNumber} OF {sectorCount}</div>
        <div className={`value sector-name ${hidden ? 'classified' : ''}`}>{sectorName}</div>
      </div>
      <div className="topbar-block center">
        <div className="label">{REDESIGN ? 'STARS LEFT' : 'HITS LEFT'}</div>
        <div className="value hits">{hitsRemaining}</div>
      </div>
      <div className="topbar-block center">
        <div className="label">SHIELDS</div>
        <div
          className={`shields ${shieldsLeft <= 2 ? 'low' : ''}`}
          role="meter"
          aria-label="Shields"
          aria-valuemin={0}
          aria-valuemax={maxMisses}
          aria-valuenow={shieldsLeft}
          aria-valuetext={`${shieldsLeft} of ${maxMisses} misses left before the sector restarts`}
        >
          {Array.from({ length: maxMisses }, (_, i) => (
            <span key={i} className={i < shieldsLeft ? 'pip on' : 'pip'} />
          ))}
        </div>
      </div>
      {!REDESIGN && (
        <div className="topbar-block right">
          <div className="label">MISSION TIMER</div>
          <div className={started ? 'value timer' : 'value timer standby'}>
            {formatDuration(elapsedMs)}
            {penaltyMs > 0 && <span className="penalty">+{formatDuration(penaltyMs)}</span>}
          </div>
        </div>
      )}
    </header>
  );
}
