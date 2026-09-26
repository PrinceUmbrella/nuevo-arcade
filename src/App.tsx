import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ROUNDS } from './data/constellations';
import { sound } from './game/audio';
import type { EngineHandlers, GameEngine } from './game/engine';
import {
  addLeaderboardEntry,
  clearLeaderboard,
  loadLeaderboard,
  publishSector,
  subscribeLeaderboard,
  type LeaderboardEntry,
} from './game/leaderboard';
import {
  createInitialState,
  currentRound,
  gameReducer,
  isAcceptedName,
  isCorrectKey,
  masterKey,
  MAX_SCANS,
  MAX_WRONG_HITS,
  nextHintLocked,
  sectorLabel,
} from './game/state';
import { REDESIGN } from './game/ruleset';
import type { Coord, Phase } from './game/types';
import { useNow } from './hooks/useNow';
import { useStageScale } from './hooks/useStageScale';
import { useViewportTooSmall } from './hooks/useViewportTooSmall';
import { AstrometryLog } from './components/AstrometryLog';
import { DesktopOnlyNotice } from './components/DesktopOnlyNotice';
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
const FAILED_HOLD_MS = 3000;

const BANNERS: Partial<Record<Phase, string>> = {
  identify: 'NAME THIS CONSTELLATION IN THE LOG',
  failed: 'SHIELDS DOWN. SECTOR RESTARTING',
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
  const [entries, setEntries] = useState<LeaderboardEntry[]>(loadLeaderboard);
  const [result, setResult] = useState<{ rank: number; entry: LeaderboardEntry } | null>(null);
  const recordedRun = useRef<number | null>(null);
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
        dispatch({ type: 'WRONG_HIT', x, y, reason });
      },
      onShotRejected: (rejection) => {
        if (rejection.kind !== 'no-target') sound.denied();
        dispatch({ type: 'SHOT_REJECTED', rejection });
      },
      onCellClick: (x, y) => dispatch({ type: 'TOGGLE_MARK', x, y }),
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
    engine?.setMarks(state.marks);
  }, [engine, state.marks, epoch]);

  useEffect(() => {
    engine?.setShowTargets(showTargets);
  }, [engine, showTargets]);

  useEffect(() => {
    engine?.setFlakEnabled(started);
  }, [engine, started]);

  useEffect(() => {
    publishSector(phase === 'lobby' ? -1 : roundIndex);
  }, [phase, roundIndex]);

  useEffect(() => subscribeLeaderboard(() => setEntries(loadLeaderboard())), []);

  // The pairing board only exists while its sector is being played.
  const boardVisible = boardOpen && !!round.board && phase === 'playing';

  // Dev-only handle for scripted playtesting from the browser console.
  useEffect(() => {
    if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__game = { engine, dispatch };
  }, [engine]);

  // ---- timer (classic only; requested-hint penalties are added on top of real time)
  const running = !REDESIGN && started && state.endedAt === null;
  const now = useNow(running);
  const elapsedMs = state.startedAt !== null ? (state.endedAt ?? now) - state.startedAt + state.penaltyMs : 0;

  // ---- record the finished run once (classic only: the redesign has no leaderboard)
  useEffect(() => {
    if (REDESIGN || phase !== 'victory' || state.startedAt === null || recordedRun.current === state.startedAt) return;
    recordedRun.current = state.startedAt;
    const entry: LeaderboardEntry = {
      team: state.team,
      ms: (state.endedAt ?? Date.now()) - state.startedAt + state.penaltyMs,
      penaltyMs: state.penaltyMs,
      restarts: state.sectorRestarts,
      at: new Date().toISOString(),
    };
    setResult({ rank: addLeaderboardEntry(entry), entry });
  }, [phase, state.startedAt, state.endedAt, state.penaltyMs, state.team, state.sectorRestarts]);

  // ---- phase side effects
  useEffect(() => {
    if (phase === 'reveal' || phase === 'victory') sound.fanfare();
    if (phase === 'failed') {
      sound.impact();
      engine?.alarm();
      const id = window.setTimeout(() => dispatch({ type: 'RESTART_SECTOR' }), FAILED_HOLD_MS);
      return () => window.clearTimeout(id);
    }
    if (phase === 'vault') {
      sound.clunk();
      const id = window.setTimeout(() => dispatch({ type: 'ADVANCE', now: Date.now() }), VAULT_HOLD_MS);
      return () => window.clearTimeout(id);
    }
  }, [phase, epoch, engine]);

  // ---- audio unlock + staff / legend keys
  useEffect(() => {
    const unlock = () => sound.unlock();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowLegend(false);
        setBoardOpen(false);
        return;
      }
      if (isTypingTarget(e.target)) {
        // Redesign: "?" also opens the controls from an empty text field, where teams spend much of the game.
        if (REDESIGN && e.key === '?' && e.target instanceof HTMLInputElement && e.target.value === '') {
          e.preventDefault();
          setShowLegend(true);
        }
        return;
      }
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
        setResult(null);
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
      } else if (e.code === 'KeyL' && !REDESIGN) {
        e.preventDefault();
        clearLeaderboard();
        dispatch({ type: 'LOG', text: 'STAFF: LEADERBOARD CLEARED', tone: 'warn' });
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
  const onMark = useCallback((coord: Coord) => dispatch({ type: 'TOGGLE_MARK', x: coord[0], y: coord[1] }), []);
  const onClearMarks = useCallback(() => dispatch({ type: 'CLEAR_MARKS' }), []);

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
  const tooSmall = useViewportTooSmall();
  // Redesign: while a dialog is up, the game behind it can't be reached with Tab.
  const behindDialog = REDESIGN && (phase === 'lobby' || phase === 'victory' || boardVisible);
  const underLegend = REDESIGN && showLegend;

  return (
    <>
      <SpaceBackground tint={round.alienColor} paused={phase === 'reveal'} />

      <div className="viewport" inert={REDESIGN && tooSmall}>
        <div className="stage" style={{ transform: `translate(-50%, -50%) scale(${stageScale})` }}>
          <h1 className="visually-hidden">The Constellation Grid</h1>
          <div className="stage-layer" inert={underLegend}>
            <section className="left" aria-label="Targeting matrix" inert={behindDialog}>
              <TopBar
                sectorNumber={roundIndex + 1}
                sectorCount={ROUNDS.length}
                sectorName={label}
                hidden={label !== round.name}
                elapsedMs={elapsedMs}
                penaltyMs={state.penaltyMs}
                started={started}
                hitsRemaining={round.targets.length - state.hits.length}
                misses={state.wrongHits}
                maxMisses={MAX_WRONG_HITS}
              />
              <TargetingMatrix handlers={handlers} onReady={setEngine} markable={REDESIGN && phase === 'playing'} />
              <div className="matrix-footer">
                <span>
                  <Key arrow="left" />
                  <Key arrow="right" /> MOVE
                </span>
                <span>
                  <Key arrow="up" />
                  <Key arrow="down" /> {REDESIGN ? 'ROW' : 'RANGE'}
                </span>
                <span>
                  <Key>SPACE</Key> FIRE
                </span>
                {REDESIGN ? (
                  <button
                    type="button"
                    className="footer-btn"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      e.currentTarget.blur();
                      setShowLegend(true);
                    }}
                  >
                    <Key>?</Key> CONTROLS
                  </button>
                ) : (
                  <span>
                    <Key>?</Key> CONTROLS
                  </span>
                )}
                {!REDESIGN && <span className="staff-flag">CLASSIC RULES</span>}
                {showTargets && <span className="staff-flag">STAFF OVERLAY</span>}
                {showNavClues && round.navigatorOnly && <span className="staff-flag">NAV CLUES ON SCREEN</span>}
              </div>
            </section>

            <AstrometryLog
              inert={behindDialog}
              round={round}
              roundIndex={roundIndex}
              phase={phase}
              hints={state.hints}
              hits={state.hits}
              log={state.log}
              armed={armed}
              armedScan={state.armedScan}
              scansLeft={MAX_SCANS - state.scansUsed}
              marks={state.marks.length}
              hintLocked={nextHintLocked(state)}
              fragments={state.fragments}
              masterKey={masterKey(state)}
              decrypted={state.decrypted}
              showNavClues={showNavClues}
              boardPlaced={boardPlaced}
              onOpenBoard={() => setBoardOpen(true)}
              onArm={onArm}
              onMark={onMark}
              onClearMarks={onClearMarks}
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
            {phase === 'lobby' && <Lobby entries={entries} onStart={onBegin} />}
            {phase === 'victory' && (
              <VictoryScreen
                team={state.team}
                masterKey={masterKey(state)}
                totalMs={result?.entry.ms ?? elapsedMs}
                penaltyMs={state.penaltyMs}
                sectorRestarts={state.sectorRestarts}
                rank={result?.rank ?? null}
                entries={entries}
                mine={result?.entry ?? null}
              />
            )}
          </div>
          {showLegend && <ControlsLegend onClose={() => setShowLegend(false)} />}
        </div>
      </div>

      {phase === 'reveal' && <ConstellationDetected key={epoch} round={round} onDone={onRevealDone} />}
      {REDESIGN && tooSmall && <DesktopOnlyNotice />}
    </>
  );
}
