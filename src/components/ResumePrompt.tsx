import { useEffect, useRef, useState } from 'react';
import type { SavedGame } from '../game/save';
import { currentRound, sectorLabel } from '../game/state';

interface Props {
  save: SavedGame;
  onContinue: () => void;
  onStartOver: () => void;
}

function savedAgo(savedAt: number) {
  const minutes = Math.floor((Date.now() - savedAt) / 60000);
  if (minutes < 1) return 'saved just now';
  if (minutes < 60) return `saved ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  return `saved ${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
}

/**
 * Redesign only: shown instead of the lobby when this browser has a saved game, usually after an
 * accidental refresh. CONTINUE is focused, and starting over needs a second, explicit confirm.
 */
export function ResumePrompt({ save, onContinue, onStartOver }: Props) {
  const [confirming, setConfirming] = useState(false);
  const continueRef = useRef<HTMLButtonElement>(null);
  const backRef = useRef<HTMLButtonElement>(null);
  const { state } = save;
  const round = currentRound(state);

  useEffect(() => {
    (confirming ? backRef : continueRef).current?.focus();
  }, [confirming]);

  const progress =
    state.phase === 'victory'
      ? 'Mission complete'
      : `Sector ${state.roundIndex + 1}: ${sectorLabel(state)} · ${state.hits.length} of ${round.targets.length} stars`;

  return (
    <div className="lobby resume" role="dialog" aria-modal="true" aria-labelledby="resume-title">
      <div className="lobby-main">
        <h1 id="resume-title" className="lobby-title">
          {confirming ? 'START OVER?' : 'RESUME MISSION?'}
        </h1>
        <p className="lobby-brief">
          Crew {state.team} · {progress}
        </p>
        <p className="lobby-note">
          {confirming
            ? 'Are you sure? Progress will be lost: stars, hints, scans, marks, and the pairing board.'
            : `This computer has a mission in progress (${savedAgo(save.savedAt)}).`}
        </p>
        <div className="resume-actions">
          {confirming ? (
            <>
              <button type="button" className="lobby-start" ref={backRef} onClick={() => setConfirming(false)}>
                BACK
              </button>
              <button type="button" className="resume-danger" onClick={onStartOver}>
                YES, START OVER
              </button>
            </>
          ) : (
            <>
              <button type="button" className="lobby-start" ref={continueRef} onClick={onContinue}>
                CONTINUE
              </button>
              <button type="button" className="resume-secondary" onClick={() => setConfirming(true)}>
                START OVER
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
