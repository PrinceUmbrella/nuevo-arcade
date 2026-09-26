import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ROUNDS } from '../data/constellations';
import { vigenere } from '../game/cipher';
import { parseCoord } from '../game/grid';
import { REDESIGN } from '../game/ruleset';
import { MAX_MARKS, roundHints } from '../game/state';
import type { Coord, HintEntry, LogEntry, Phase, Round, ScanResult } from '../game/types';
import { useTypewriter } from '../hooks/useTypewriter';

interface Props {
  /** Unreachable by keyboard while a dialog sits on top (redesign rules). */
  inert?: boolean;
  round: Round;
  roundIndex: number;
  phase: Phase;
  hints: HintEntry[];
  hits: string[];
  log: LogEntry[];
  armed: Coord | null;
  armedScan: ScanResult;
  scansLeft: number;
  /** Pencil marks on the grid right now. */
  marks: number;
  /** Redesign: the next hint is the final one and waits for a wrong answer in this sector. */
  hintLocked: boolean;
  fragments: string[];
  masterKey: string;
  decrypted: boolean;
  onArm: (coord: Coord | null) => void;
  onMark: (coord: Coord) => void;
  onClearMarks: () => void;
  onScan: () => void;
  onOpenBoard: () => void;
  boardPlaced: number;
  showNavClues: boolean;
  onInvalidCoord: (text: string) => void;
  onRequestHint: () => void;
  onIdentify: (name: string) => void;
  onDecrypt: (key: string) => void;
}

const VISIBLE_MESSAGES = 2;

export function AstrometryLog(props: Props) {
  const { round, roundIndex, phase, hints, log, fragments, masterKey, decrypted } = props;
  const mission = useTypewriter(round.missionText);
  const hintsLeft = roundHints(round).length - hints.length;
  const canHint = hintsLeft > 0 && !props.hintLocked && (phase === 'playing' || phase === 'identify');
  const identified = ['reveal', 'finale', 'vault', 'victory'].includes(phase);
  const sectorTitle = round.hiddenName && !identified ? 'CLASSIFIED' : round.name;
  const hintsRef = useRef<HTMLDivElement>(null);
  const encrypted = !!round.cipher && !decrypted;
  const canScan = phase === 'playing' && !!props.armed && props.armedScan === null && props.scansLeft > 0;
  const scanLabel = props.scansLeft === 0 ? 'NONE LEFT' : props.armed ? `${props.scansLeft} LEFT` : 'ARM FIRST';
  // Letters found so far, in target order, e.g. "S _ A _ _".
  const progress = round.targets
    .map(([x, y], i) => (props.hits.includes(`${x},${y}`) ? round.keyFragment[i] : '_'))
    .join(' ');
  const sections = useMemo(
    () =>
      round.clues.map((s, i) => {
        const key = round.cipher?.key ?? '';
        const scramble = (t: string) => (encrypted ? vigenere(t, key) : t);
        return { key: String(i), ordered: s.ordered, heading: scramble(s.heading), items: s.items.map(scramble) };
      }),
    [round, encrypted],
  );

  useEffect(() => {
    hintsRef.current?.scrollTo({ top: hintsRef.current.scrollHeight });
  }, [hints.length]);

  return (
    <aside className="log-panel" aria-label="Captain's astrometry log" inert={props.inert}>
      <header className="log-header">
        <h2>CAPTAIN&apos;S ASTROMETRY LOG</h2>
        <span className={`log-sector ${round.hiddenName && !identified ? 'classified' : ''}`}>
          SECTOR {roundIndex + 1}: {sectorTitle}
        </span>
      </header>

      <div className="log-feed" key={roundIndex}>
        <p className="mission">
          {mission.shown}
          {!mission.done && <span className="cursor">█</span>}
        </p>
        {round.cipher && !decrypted && (
          <div className="cipher-box">
            <div className="cipher-title">INCOMING TRANSMISSION: ENCRYPTED</div>
            <p className="cipher-prompt">{round.cipher.prompt}</p>
            <DecryptInput onDecrypt={props.onDecrypt} />
          </div>
        )}
        {encrypted ? (
          <p className="ciphertext" aria-label="Encrypted transmission">
            {sections.map((s) => [s.heading, ...s.items].join(' ')).join(' ')}
          </p>
        ) : round.navigatorOnly && !props.showNavClues ? (
          <div className="navigator-notice">
            <div className="navigator-notice-title">BEACON CLUES ARE ON THE NAVIGATOR DEVICE</div>
            <p>
              Your Navigator reads the beacons aloud. The Gunner stays at this screen and fires in sequence.
            </p>
            <p className="navigator-url">
              Navigator link: <b>{window.location.host}/?view=navigator</b>
            </p>
          </div>
        ) : (
          sections.map((section) => {
            const List = section.ordered ? 'ol' : 'ul';
            return (
              <section key={section.key} className="clue-section">
                <h3 className="clue-heading">{section.heading}</h3>
                <List className={section.ordered ? 'clues ordered' : 'clues'}>
                  {section.items.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </List>
              </section>
            );
          })
        )}
        {REDESIGN && roundIndex === 0 && <HowThisWorks letters={round.keyFragment.length} />}
        {round.board && (
          <div className="board-launch">
            <p>The column and row streams are on the pairing board.</p>
            <button
              type="button"
              className="board-btn"
              disabled={phase !== 'playing'}
              onMouseDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.currentTarget.blur();
                props.onOpenBoard();
              }}
            >
              OPEN PAIRING BOARD
              <small>{props.boardPlaced} OF {round.board.slots * 2} SLOTS FILLED</small>
            </button>
          </div>
        )}
      </div>

      {hints.length > 0 && (
        <div className="hints" ref={hintsRef}>
          {hints.map((h, i) => (
            <div key={i} className="hint">
              <span className={h.auto ? 'hint-tag auto' : 'hint-tag'}>{h.auto ? 'AUTO HINT' : 'HINT'}</span> {h.text}
            </div>
          ))}
          {props.hintLocked && phase === 'playing' && (
            <div className="hint locked">
              <span className="hint-tag locked">LOCKED</span> The last hint gives a star away. It unlocks after your
              first wrong answer in this sector.
            </div>
          )}
        </div>
      )}

      <div className="comms" aria-live="polite">
        {log.slice(-VISIBLE_MESSAGES).map((l, i, arr) => (
          <div key={l.id} className={`comm ${l.tone}`}>
            &gt; {l.text}
            {i === arr.length - 1 && <span className="cursor"> █</span>}
          </div>
        ))}
      </div>

      <div className="controls">
        {phase === 'identify' ? (
          <IdentifyInput onIdentify={props.onIdentify} />
        ) : (
          <ArmTargetInput
            armed={props.armed}
            disabled={phase !== 'playing'}
            marks={props.marks}
            onArm={props.onArm}
            onMark={props.onMark}
            onClearMarks={props.onClearMarks}
            onInvalid={props.onInvalidCoord}
          />
        )}
        {phase !== 'identify' && (
          <button
            type="button"
            className="scan-btn"
            disabled={!canScan}
            title="Checks whether the armed cell is part of the constellation. Free, but limited."
            onMouseDown={(e) => e.preventDefault()}
            onClick={(e) => {
              e.currentTarget.blur();
              props.onScan();
            }}
          >
            SCAN
            <small>{scanLabel}</small>
          </button>
        )}
        <button
          type="button"
          className="hint-btn"
          disabled={!canHint}
          title={props.hintLocked ? 'The last hint unlocks after a wrong answer in this sector.' : undefined}
          onMouseDown={(e) => e.preventDefault()}
          onClick={(e) => {
            e.currentTarget.blur();
            props.onRequestHint();
          }}
        >
          REQUEST HINT
          <small>
            {hintsLeft === 0
              ? 'NONE LEFT'
              : props.hintLocked
                ? `${hintsLeft} LEFT · LOCKED`
                : `${hintsLeft} LEFT${REDESIGN ? '' : ' · +1:00'}`}
          </small>
        </button>
      </div>

      <Vault
        fragments={fragments}
        openingIndex={phase === 'vault' ? roundIndex : -1}
        masterKey={masterKey}
        roundIndex={roundIndex}
        progress={progress}
      />
    </aside>
  );
}

/** Sector 1 only (redesign): the whole loop in three steps, like a museum placard. */
function HowThisWorks({ letters }: { letters: number }) {
  return (
    <section className="clue-section how-to" aria-label="How this works">
      <h3 className="clue-heading">HOW THIS WORKS</h3>
      <ol className="clues ordered">
        <li>Solve a star&apos;s X,Y and type it into ARM TARGET below.</li>
        <li>
          Line up LOCK: left/right picks the column, up/down picks the row. Then press SPACE. A shot without LOCK is
          deflected and costs no shield.
        </li>
        <li>
          Every star hides a letter, and these {letters} spell a word. SCAN checks a cell and shows its letter. Click
          cells to pencil-mark your ideas.
        </li>
      </ol>
    </section>
  );
}

/** Accepts "M 3,5" / "MARK 3,5" (toggle a pencil mark) and "M CLEAR". Null when it isn't a mark command. */
function parseMarkCommand(input: string): { clear: true } | { coord: Coord } | 'invalid' | null {
  const m = input.trim().match(/^m(?:ark)?\s*(.*)$/i);
  if (!m) return null;
  const rest = (m[1] ?? '').trim();
  if (/^clear$/i.test(rest)) return { clear: true };
  const coord = parseCoord(rest);
  return coord ? { coord } : 'invalid';
}

function ArmTargetInput({
  armed,
  disabled,
  marks,
  onArm,
  onMark,
  onClearMarks,
  onInvalid,
}: {
  armed: Coord | null;
  disabled: boolean;
  marks: number;
  onArm: (c: Coord | null) => void;
  onMark: (c: Coord) => void;
  onClearMarks: () => void;
  onInvalid: (text: string) => void;
}) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const mark = REDESIGN ? parseMarkCommand(value) : null;
    if (mark === 'invalid') {
      onInvalid(value);
      return;
    }
    if (mark) {
      if ('clear' in mark) onClearMarks();
      else onMark(mark.coord);
    } else if (!value.trim()) {
      onArm(null);
    } else {
      const c = parseCoord(value);
      if (!c) {
        onInvalid(value);
        return;
      }
      onArm(c);
    }
    setValue('');
    inputRef.current?.blur();
  };

  const idle = REDESIGN ? 'TYPE X,Y THEN ENTER' : 'TYPE 3,5 THEN ENTER';
  return (
    <form className="term-input" onSubmit={submit}>
      <label htmlFor="arm">&gt; ARM TARGET (X,Y)</label>
      <input
        id="arm"
        ref={inputRef}
        value={value}
        disabled={disabled}
        autoComplete="off"
        spellCheck={false}
        placeholder={armed ? `ARMED ${armed[0]},${armed[1]}` : idle}
        aria-describedby={REDESIGN ? 'arm-help' : undefined}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && inputRef.current?.blur()}
      />
      {REDESIGN && (
        <small id="arm-help" className="term-help">
          MARKS {marks}/{MAX_MARKS}: CLICK A CELL OR TYPE M X,Y
        </small>
      )}
    </form>
  );
}

function DecryptInput({ onDecrypt }: { onDecrypt: (key: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <form
      className="term-input decrypt"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onDecrypt(value);
        setValue('');
      }}
    >
      <label htmlFor="decrypt">&gt; DECRYPTION KEY</label>
      <input
        id="decrypt"
        value={value}
        autoComplete="off"
        spellCheck={false}
        placeholder="TYPE THE KEY THEN ENTER"
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === 'Escape' && e.currentTarget.blur()}
      />
    </form>
  );
}

function IdentifyInput({ onIdentify }: { onIdentify: (name: string) => void }) {
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form
      className="term-input identify"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onIdentify(value);
        setValue('');
      }}
    >
      <label htmlFor="identify">&gt; IDENTIFY CONSTELLATION</label>
      <input
        id="identify"
        ref={inputRef}
        value={value}
        autoComplete="off"
        spellCheck={false}
        placeholder="TYPE ITS NAME THEN ENTER"
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  );
}

function Vault({
  fragments,
  openingIndex,
  masterKey,
  roundIndex,
  progress,
}: {
  fragments: string[];
  openingIndex: number;
  masterKey: string;
  roundIndex: number;
  progress: string;
}) {
  return (
    <section className="vault" aria-label="Vault">
      <div className="vault-head">
        <h3 className="vault-title">VAULT</h3>
        <div className="master-key">
          <span className="master-key-label">MASTER KEY</span>
          <span className={masterKey ? 'master-key-value' : 'master-key-value empty'}>{masterKey || 'NO FRAGMENTS YET'}</span>
        </div>
      </div>
      <div className="vault-slots">
        {ROUNDS.map((r, i) => {
          const open = fragments[i] !== undefined;
          const current = i === roundIndex && !open;
          return (
            <div key={r.keyFragment + i} className={`vault-slot ${open ? 'open' : ''} ${openingIndex === i ? 'opening' : ''}`}>
              <div className={current ? 'vault-door current' : 'vault-door'} aria-label={current ? `Letters found: ${progress}` : undefined}>
                {current ? progress : `SECTOR ${i + 1}`}
              </div>
              <span className="vault-fragment">{open ? fragments[i] : ''}</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
