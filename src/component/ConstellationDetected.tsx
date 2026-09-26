import { useEffect } from 'react';
import type { Round } from '../game/types';
import { ConstellationReveal3D } from './three/ConstellationReveal3D';

export const REVEAL_DURATION_MS = 4200;

/** Full-screen flash + 3D constellation fly-in + "CONSTELLATION DETECTED" title. */
export function ConstellationDetected({ round, onDone }: { round: Round; onDone: () => void }) {
  useEffect(() => {
    const id = window.setTimeout(onDone, REVEAL_DURATION_MS);
    return () => window.clearTimeout(id);
  }, [onDone]);

  return (
    <div className="reveal-overlay" style={{ animationDuration: `${REVEAL_DURATION_MS}ms` }}>
      <div className="reveal-canvas">
        <ConstellationReveal3D round={round} />
      </div>
      <div className="reveal-flash" />
      <h2 className="reveal-title">
        <span className="detected">CONSTELLATION DETECTED:</span>
        <span className="name">{round.name}</span>
      </h2>
    </div>
  );
}
