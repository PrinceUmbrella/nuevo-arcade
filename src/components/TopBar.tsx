import { REDESIGN } from '../game/ruleset';
import type { SectorStatus } from '../game/state';
import { formatDuration } from '../hooks/useNow';

export interface SectorTabInfo {
  name: string;
  status: SectorStatus;
  done: boolean;
}

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
  /** Redesign: one button per sector so crews can jump between them. */
  sectorTabs?: SectorTabInfo[];
  canSwitch?: boolean;
  onGoToSector?: (index: number) => void;
}

const STATUS_TEXT: Record<SectorStatus, string> = {
  current: 'you are here',
  complete: 'complete',
  started: 'in progress',
  new: 'not started',
};

export function TopBar(props: Props) {
  const { sectorNumber, sectorCount, sectorName, hidden, elapsedMs, penaltyMs, started, hitsRemaining, misses, maxMisses } = props;
  const shieldsLeft = Math.max(0, maxMisses - misses);
  return (
    <header className={REDESIGN ? 'topbar no-timer' : 'topbar'}>
      <div className="topbar-block">
        <div className="label sector-label-row">
          <span>
            SECTOR {sectorNumber} OF {sectorCount}
          </span>
          {props.sectorTabs && (
            <nav className="sector-tabs" aria-label="Jump to a sector">
              {props.sectorTabs.map((tab, i) => {
                const label = `Sector ${i + 1}: ${tab.name}, ${STATUS_TEXT[tab.status]}`;
                return (
                  <button
                    key={i}
                    type="button"
                    className={`sector-tab ${tab.status}${tab.done ? ' done' : ''}`}
                    disabled={tab.status === 'current' || !props.canSwitch}
                    aria-current={tab.status === 'current' ? 'step' : undefined}
                    aria-label={label}
                    title={label}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      props.onGoToSector?.(i);
                    }}
                  >
                    {i + 1}
                    {tab.done && <span aria-hidden="true">✓</span>}
                  </button>
                );
              })}
            </nav>
          )}
        </div>
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
