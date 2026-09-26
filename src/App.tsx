import { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { ROUNDS } from './data/constellations';
import { sound } from './game/audio';
import type { EngineHandlers, GameEngine } from './game/engine';
import { publishSector } from './game/sectorSync';
import {
  createInitialState,
  currentRound,
  gameReducer,
  isAcceptedName,
  isCorrectKey,
  masterKey,
  MAX_SCANS,
  MAX_WRONG_HITS,
  sectorLabel,
} from './game/state';
import type { TimedWait } from './game/state';
import type { Coord, Phase } from './game/types';
import { formatDuration, useNow } from './hooks/useNow';
import { useStageScale } from './hooks/useStageScale';
import { AstrometryLog } from './components/AstrometryLog';
import { Key } from './components/Key';
import { ConstellationDetected } from './components/ConstellationDetected';
import { ControlsLegend } from './components/ControlsLegend';
import { Lobby } from './components/Lobby';
import { PairingBoard } from './components/PairingBoard';
import { TargetingMatrix } from './components/TargetingMatrix';
import { TopBar } from './components/TopBar';
import { VictoryScreen } from './components/VictoryScreen';
import { SpaceBackground } from './components/three/SpaceBackground';

const VAULT_HOLD_MS = 1600;

const BANNERS: Partial<Record<Phase, string>> = {
  identify: 'NAME THIS CONSTELLATION IN THE LOG',
};

const isTypingTarget = (t: EventTarget | null) =>
  t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, () => createInitialState());
  const [engine, setEngine] = useState<GameEngine | null>(null);
  const [showTargets, setShowTargets] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showNavClues, setShowNavClues] = useState(false);
  const [boardOpen, setBoardOpen] = useState(false);
  const stageScale = useStageScale();
  const round = currentRound(state);
  const { phase, epoch, roundIndex, armed } = state;
  const started = state.startedAt !== null;

  const handlers = useMemo<EngineHandlers>(
    () => ({
      onInput: () => {},
      onFire: () => sound.laser(),
      onFireBlocked: () => sound.denied(),
      onCorrectHit: (x, y) => {
        sound.chime();
        dispatch({ type: 'CORRECT_HIT', x, y });
      },
      onWrongHit: (x, y, reason) => {
        sound.buzz();
        dispatch({ type: 'WRONG_HIT', x, y, reason, now: Date.now() });
      },
      onFlakHit: () => {
        sound.impact();
        dispatch({ type: 'FLAK_HIT' });
      },
      onLinesDrawn: () => dispatch({ type: 'LINES_DRAWN', now: Date.now() }),
      onGuideDrawn: () => dispatch({ type: 'GUIDE_DRAWN' }),
      onFinaleHit: () => {
        sound.fanfare();
        dispatch({ type: 'FINALE_HIT', now: Date.now() });
      },
      onFinaleMiss: (kind) => {
        sound.denied();
        dispatch({ type: 'FINALE_MISS', kind });
      },
    }),
    [],
  );

  // ---- sync React state -> canvas engine
  useEffect(() => {
    engine?.loadRound(ROUNDS[roundIndex]);
  }, [engine, epoch, roundIndex]);

  const modalOpen = (boardOpen && !!round.board && phase === 'playing') || showLegend;
  useEffect(() => {
    if (!engine) return;
    engine.setInputEnabled((phase === 'playing' || phase === 'finale') && !modalOpen);
    const finale = round.finale;
    const banner = phase === 'finale' && finale ? `SHOOT ${finale.label} OVER COLUMN ${finale.column}` : BANNERS[phase];
    engine.setBanner(banner ?? null);
  }, [engine, phase, epoch, modalOpen, round]);

  useEffect(() => {
    if (engine && phase === 'drawing') engine.drawLines();
  }, [engine, phase]);

  useEffect(() => {
    if (!engine || phase !== 'finale') return;
    engine.startFinale();
    return () => engine.stopFinale();
  }, [engine, phase]);

  useEffect(() => {
    engine?.setArmed(armed, state.armedScan);
  }, [engine, armed, state.armedScan]);

  useEffect(() => {
    engine?.setRevealed(state.scanned);
  }, [engine, state.scanned, epoch]);

  useEffect(() => {
    engine?.setShowTargets(showTargets);
  }, [engine, showTargets]);

  useEffect(() => {
    engine?.setFlakEnabled(started);
  }, [engine, started]);

  useEffect(() => {
    engine?.setWeaponCooldown(state.cooldown);
  }, [engine, state.cooldown]);

  useEffect(() => {
    publishSector(phase === 'lobby' ? -1 : roundIndex);
  }, [phase, roundIndex]);

  // The pairing board only exists while its sector is being played.
  const boardVisible = boardOpen && !!round.board && phase === 'playing';

  // Dev-only handle for scripted playtesting from the browser console.
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__game = { engine, dispatch };
  }, [engine]);

  // The mission clock is hidden during play, but still recorded for the victory screen and staff overlay.
  const running = started && state.endedAt === null;
  const now = useNow(running || !!state.pendingHint || !!state.cooldown || !!state.reboot);
  const elapsedMs = state.startedAt !== null ? (state.endedAt ?? now) - state.startedAt : 0;

  // ---- phase side effects
  useEffect(() => {
    if (phase === 'reveal' || phase === 'victory') sound.fanfare();
    if (phase === 'failed') {
      sound.impact();
      engine?.alarm();
    }
    if (phase === 'vault') {
      sound.clunk();
      const id = window.setTimeout(() => dispatch({ type: 'ADVANCE', now: Date.now() }), VAULT_HOLD_MS);
      return () => window.clearTimeout(id);
    }
  }, [phase, epoch, engine]);

  useEffect(() => {
    if (!state.cooldown) return;
    const id = window.setTimeout(
      () => dispatch({ type: 'COMPLETE_COOLDOWN' }),
      Math.max(0, state.cooldown.endsAt - Date.now()),
    );
    return () => window.clearTimeout(id);
  }, [state.cooldown]);

  useEffect(() => {
    if (!state.pendingHint) return;
    const id = window.setTimeout(
      () => dispatch({ type: 'COMPLETE_HINT' }),
      Math.max(0, state.pendingHint.endsAt - Date.now()),
    );
    return () => window.clearTimeout(id);
  }, [state.pendingHint]);

  useEffect(() => {
    if (phase !== 'failed' || !state.reboot) return;
    const id = window.setTimeout(
      () => dispatch({ type: 'RESTART_SECTOR' }),
      Math.max(0, state.reboot.endsAt - Date.now()),
    );
    return () => window.clearTimeout(id);
  }, [phase, state.reboot]);

  // ---- audio unlock + staff / legend keys
  useEffect(() => {
    const unlock = () => sound.unlock();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLegend(false);
        setBoardOpen(false);
        return;
      }
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && e.code === 'KeyC') {
        e.preventDefault();
        dispatch({ type: 'CANCEL_WAITS' });
        return;
      }
      if (isTypingTarget(e.target)) return;
      if (e.key === '?') {
        setShowLegend((v) => !v);
        return;
      }
      if (!e.shiftKey || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.code === 'KeyR') {
        e.preventDefault();
        setShowTargets(false);
        setShowNavClues(false);
        setBoardOpen(false);
        dispatch({ type: 'RESET' });
      } else if (e.code === 'KeyN') {
        e.preventDefault();
        dispatch({ type: 'SKIP', now: Date.now() });
      } else if (e.code === 'KeyH') {
        e.preventDefault();
        setShowTargets((v) => !v);
      } else if (e.code === 'KeyV') {
        e.preventDefault();
        setShowNavClues((v) => !v);
      }
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  // ---- UI callbacks
  const onBegin = useCallback((team: string) => {
    sound.unlock();
    sound.chime();
    dispatch({ type: 'BEGIN', team, now: Date.now() });
  }, []);

  const onArm = useCallback((coord: Coord | null) => dispatch({ type: 'ARM', coord }), []);

  const onInvalidCoord = useCallback((text: string) => {
    sound.denied();
    dispatch({ type: 'LOG', text: `INVALID COORDINATE "${text.trim()}". USE X,Y WITH VALUES 1-8`, tone: 'error' });
  }, []);

  const onRequestHint = useCallback(() => dispatch({ type: 'REQUEST_HINT', now: Date.now() }), []);

  const onScan = useCallback(() => {
    sound.laser();
    dispatch({ type: 'SCAN', now: Date.now() });
  }, []);

  const onIdentify = useCallback(
    (name: string) => {
      if (!isAcceptedName(round, name)) sound.buzz();
      dispatch({ type: 'IDENTIFY', name, now: Date.now() });
    },
    [round],
  );

  const onRevealDone = useCallback(() => dispatch({ type: 'REVEAL_DONE' }), []);

  const onDecrypt = useCallback(
    (key: string) => {
      if (isCorrectKey(round, key)) sound.chime();
      else sound.denied();
      dispatch({ type: 'DECRYPT', key, now: Date.now() });
    },
    [round],
  );

  const onBoardPlace = useCallback(
    (kind: 'col' | 'row', card: number, slot: number | null) => dispatch({ type: 'BOARD_PLACE', kind, card, slot }),
    [],
  );
  const onBoardValue = useCallback(
    (kind: 'col' | 'row', card: number, value: string) => dispatch({ type: 'BOARD_VALUE', kind, card, value }),
    [],
  );
  const boardPlaced = state.board
    ? [...state.board.colSlots, ...state.board.rowSlots].filter((c) => c !== null).length
    : 0;

  const label = sectorLabel(state);

  return (
    <>
      <SpaceBackground tint={round.alienColor} paused={phase === 'reveal'} />

      <div className="viewport">
        <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${stageScale})` }}>
          <h1 className="visually-hidden">The Constellation Grid</h1>
          <section className="left" aria-label="Targeting matrix">
            <TopBar
              sectorNumber={roundIndex + 1}
              sectorCount={ROUNDS.length}
              sectorName={label}
              hidden={label !== round.name}
              hitsRemaining={round.targets.length - state.hits.length}
              misses={state.wrongHits}
              maxMisses={MAX_WRONG_HITS}
            />
            <TargetingMatrix handlers={handlers} onReady={setEngine} />
            <div className="matrix-footer">
              <span>
                <Key arrow="left" />
                <Key arrow="right" /> MOVE
              </span>
              <span>
                <Key arrow="up" />
                <Key arrow="down" /> RANGE
              </span>
              <span>
                <Key>SPACE</Key> FIRE
              </span>
              <span>
                <Key>?</Key> CONTROLS
              </span>
              {showTargets && <span className="staff-flag">STAFF {formatDuration(elapsedMs)}</span>}
              {showNavClues && round.navigatorOnly && <span className="staff-flag">NAV CLUES ON SCREEN</span>}
            </div>
          </section>

          <AstrometryLog
            round={round}
            roundIndex={roundIndex}
            phase={phase}
            hints={state.hints}
            hits={state.hits}
            log={state.log}
            armed={armed}
            armedScan={state.armedScan}
            scansLeft={MAX_SCANS - state.scansUsed}
            fragments={state.fragments}
            masterKey={masterKey(state)}
            decrypted={state.decrypted}
            now={now}
            pendingHint={state.pendingHint}
            showNavClues={showNavClues}
            boardPlaced={boardPlaced}
            onOpenBoard={() => setBoardOpen(true)}
            onArm={onArm}
            onScan={onScan}
            onInvalidCoord={onInvalidCoord}
            onRequestHint={onRequestHint}
            onIdentify={onIdentify}
            onDecrypt={onDecrypt}
          />

          {boardVisible && round.board && state.board && (
            <PairingBoard
              config={round.board}
              state={state.board}
              onPlace={onBoardPlace}
              onValue={onBoardValue}
              onClose={() => setBoardOpen(false)}
            />
          )}
          {phase === 'lobby' && <Lobby onStart={onBegin} />}
          {phase === 'victory' && (
            <VictoryScreen
              team={state.team}
              masterKey={masterKey(state)}
              totalMs={elapsedMs}
              sectorRestarts={state.sectorRestarts}
            />
          )}
          {phase === 'failed' && state.reboot && <RebootScreen wait={state.reboot} now={now} />}
          {showLegend && <ControlsLegend onClose={() => setShowLegend(false)} />}
        </div>
      </div>

      {phase === 'reveal' && <ConstellationDetected key={epoch} round={round} onDone={onRevealDone} />}
    </>
  );
}

function RebootScreen({ wait, now }: { wait: TimedWait; now: number }) {
  const duration = wait.endsAt - wait.startedAt;
  const progress = Math.min(1, Math.max(0, (now - wait.startedAt) / duration));
  const seconds = Math.min(Math.ceil(duration / 1000), Math.max(0, Math.ceil((wait.endsAt - now) / 1000)));
  return (
    <div className="reboot-screen" role="alert" aria-live="assertive">
      <div className="reboot-title">SYSTEMS REBOOTING</div>
      <div className="reboot-seconds">{seconds}s</div>
      <div
        className="wait-track"
        role="progressbar"
        aria-label="Systems rebooting"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <span style={{ transform: `scaleX(${progress})` }} />
      </div>
      <p>SECTOR DATA, HINTS, AND SCANS RETAINED</p>
    </div>
  );
}
