import { MASTER_KEY_SEPARATOR, ROUNDS } from '../data/constellations';
import { normalizeKey } from './cipher';
import { COORD_LABEL, coordKey, formatCoord } from './grid';
import { buildLetterGrid } from './letters';
import { FREE_AIM, REDESIGN } from './ruleset';
import type { ClueSection, Coord, HintEntry, LogEntry, LogTone, MissReason, Phase, Round, ScanResult, ShotRejection } from './types';

export const WRONG_HITS_PER_FREE_HINT = 3;
/** Misses allowed per sector. Reaching it wipes the sector's stars and restarts it. */
export const MAX_WRONG_HITS = 6;
/** Free "is this cell in the constellation?" checks per sector. Each also reveals the cell's letter. */
export const MAX_SCANS = 3;
/** Classic rules only: time added for each hint the team requests. The redesign has no clock, so hints are free. */
export const HINT_PENALTY_MS = REDESIGN ? 0 : 60 * 1000;
/** Pencil marks allowed on the grid at once (redesign rules only). */
export const MAX_MARKS = 8;
export const TEAM_NAME_MAX = 18;
const MAX_LOG = 40;

/** Hint text for the active rule set. */
export const roundHints = (round: Round) => (REDESIGN ? round.hints : (round.classicHints ?? round.hints));

/** Clue text for the active rule set (the redesign writes coordinates row first). */
export const roundClues = (round: Round): ClueSection[] => (REDESIGN ? round.clues : (round.classicClues ?? round.clues));

const at = (c: Coord) => `(${formatCoord(c[0], c[1])})`;

/**
 * Redesign: the last hint in a sector gives a star away, so it stays locked until the team has
 * made at least one wrong deduction there. Hints are free, so this keeps a team from clicking
 * straight through to the answer.
 */
export const nextHintLocked = (s: GameState) => {
  const total = roundHints(currentRound(s)).length;
  return REDESIGN && total > 1 && s.hints.length === total - 1 && !s.sectorMissed;
};

/** Pairing board: which card sits in each slot, and the number the team wrote on each card. */
export interface BoardState {
  colSlots: (number | null)[];
  rowSlots: (number | null)[];
  colValues: string[];
  rowValues: string[];
}

/** One sector's progress, kept while the crew works on a different sector (redesign). */
export interface SectorProgress {
  phase: Phase;
  hits: string[];
  wrongHits: number;
  hints: HintEntry[];
  decrypted: boolean;
  scansUsed: number;
  scanned: string[];
  board: BoardState | null;
  marks: string[];
  sectorMissed: boolean;
}

export interface GameState {
  team: string;
  roundIndex: number;
  /** Incremented every time a round (re)loads so the canvas engine can respawn. */
  epoch: number;
  phase: Phase;
  hits: string[];
  wrongHits: number;
  hints: HintEntry[];
  penaltyMs: number;
  /** False while the current round's clues are still encrypted. */
  decrypted: boolean;
  scansUsed: number;
  /** Cells whose letters were revealed by SCAN this sector. */
  scanned: string[];
  board: BoardState | null;
  sectorRestarts: number;
  fragments: string[];
  startedAt: number | null;
  endedAt: number | null;
  armed: Coord | null;
  armedScan: ScanResult;
  /** Pencil-marked cells in placement order. Kept through a sector restart. */
  marks: string[];
  /** A wrong deduction has happened in this sector (survives a restart). Unlocks the final hint. */
  sectorMissed: boolean;
  /** Redesign: the crew answered the look-up question on the victory screen. */
  finalSolved: boolean;
  /**
   * Redesign: progress in each sector, so crews can jump between sectors without losing work.
   * The active sector lives in the top-level fields; this slot is refreshed whenever they leave it.
   */
  sectors: (SectorProgress | null)[];
  log: LogEntry[];
  nextLogId: number;
}

export type GameAction =
  | { type: 'BEGIN'; team: string; now: number }
  | { type: 'ARM'; coord: Coord | null }
  | { type: 'SCAN'; now: number }
  | { type: 'LOG'; text: string; tone: LogTone }
  | { type: 'CORRECT_HIT'; x: number; y: number }
  | { type: 'WRONG_HIT'; x: number; y: number; reason: MissReason }
  | { type: 'SHOT_REJECTED'; rejection: ShotRejection }
  | { type: 'TOGGLE_MARK'; x: number; y: number }
  | { type: 'CLEAR_MARKS' }
  | { type: 'FLAK_HIT' }
  | { type: 'REQUEST_HINT'; now: number }
  | { type: 'DECRYPT'; key: string; now: number }
  | { type: 'BOARD_PLACE'; kind: 'col' | 'row'; card: number; slot: number | null }
  | { type: 'BOARD_VALUE'; kind: 'col' | 'row'; card: number; value: string }
  | { type: 'GUIDE_DRAWN' }
  | { type: 'RESTART_SECTOR' }
  | { type: 'LINES_DRAWN'; now: number }
  | { type: 'IDENTIFY'; name: string; now: number }
  | { type: 'REVEAL_DONE' }
  | { type: 'FINALE_HIT'; now: number }
  | { type: 'FINALE_MISS'; kind: 'off-column' | 'passed' }
  | { type: 'ADVANCE'; now: number }
  | { type: 'SKIP'; now: number }
  | { type: 'RESTORE'; state: GameState }
  | { type: 'FINAL_SOLVED' }
  | { type: 'GOTO_SECTOR'; index: number }
  | { type: 'RESET' };

export const currentRound = (s: GameState): Round => ROUNDS[s.roundIndex];
export const isLastRound = (s: GameState) => s.roundIndex === ROUNDS.length - 1;
export const fullMasterKey = () => ROUNDS.map((r) => r.keyFragment).join(MASTER_KEY_SEPARATOR);

/** Classic rules only: beacons must be shot in `targets` order. The redesign accepts any order. */
export const inSequence = (round: Round) => !REDESIGN && !!round.requireOrder;
export const roundMissionText = (round: Round) =>
  REDESIGN ? round.missionText : (round.classicMissionText ?? round.missionText);

export const hasFragment = (s: GameState, index: number) => !!s.fragments[index];
export const allFragments = (s: GameState) => ROUNDS.every((_, i) => hasFragment(s, i));

/** Classic joins fragments in play order. The redesign can finish sectors out of order, so gaps show as ?s. */
export const masterKey = (s: GameState) => {
  if (!REDESIGN) return s.fragments.join(MASTER_KEY_SEPARATOR);
  if (!s.fragments.some(Boolean)) return '';
  return ROUNDS.map((r, i) => s.fragments[i] || '?'.repeat(r.keyFragment.length)).join(MASTER_KEY_SEPARATOR);
};

/** Phases after which a hidden sector's real name may be shown. */
const IDENTIFIED_PHASES: Phase[] = ['reveal', 'finale', 'vault', 'complete', 'victory'];

export const sectorLabel = (s: GameState) => {
  const r = currentRound(s);
  const identified = IDENTIFIED_PHASES.includes(s.phase);
  return r.hiddenName && !identified ? 'UNKNOWN SECTOR' : r.name;
};

/** Redesign: phases a crew can leave mid-sector. Short animations and the shield reboot can't be interrupted. */
const SWITCHABLE_PHASES: Phase[] = ['playing', 'identify', 'finale', 'complete'];
export const canSwitchSector = (s: GameState) => REDESIGN && SWITCHABLE_PHASES.includes(s.phase);

export type SectorStatus = 'current' | 'complete' | 'started' | 'new';

/** Redesign: what the sector buttons show for sector `index`. */
export function sectorTab(s: GameState, index: number): { name: string; status: SectorStatus; done: boolean } {
  const round = ROUNDS[index];
  const saved = s.sectors[index];
  const done = hasFragment(s, index);
  if (index === s.roundIndex) return { name: sectorLabel(s), status: 'current', done };
  const identified = done || (!!saved && IDENTIFIED_PHASES.includes(saved.phase));
  return {
    name: round.hiddenName && !identified ? 'UNKNOWN SECTOR' : round.name,
    status: done ? 'complete' : saved ? 'started' : 'new',
    done,
  };
}

const normalizeName = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

/** True when `input` matches one of `answers`, ignoring case, spaces and punctuation. */
export const matchesAnswer = (answers: string[], input: string) => {
  const n = normalizeName(input);
  return n.length > 0 && answers.some((a) => normalizeName(a) === n);
};

export const isAcceptedName = (round: Round, input: string) => {
  const n = normalizeName(input);
  return n.length > 0 && round.acceptedNames.some((a) => normalizeName(a) === n);
};

export const isCorrectKey = (round: Round, input: string) =>
  !!round.cipher && normalizeKey(input).length > 0 && normalizeKey(input) === normalizeKey(round.cipher.key);

const letterGrids = new Map<Round, Map<string, string>>();
const letterAt = (round: Round, key: string) => {
  if (!letterGrids.has(round)) letterGrids.set(round, buildLetterGrid(round));
  return letterGrids.get(round)!.get(key) ?? '?';
};

function emptyBoard(round: Round): BoardState | null {
  if (!round.board) return null;
  return {
    colSlots: Array(round.board.slots).fill(null),
    rowSlots: Array(round.board.slots).fill(null),
    colValues: round.board.columnCards.map(() => ''),
    rowValues: round.board.rowCards.map(() => ''),
  };
}

function log(s: GameState, text: string, tone: LogTone = 'info'): GameState {
  const entry = { id: s.nextLogId, text, tone };
  return { ...s, log: [...s.log, entry].slice(-MAX_LOG), nextLogId: s.nextLogId + 1 };
}

function startRound(s: GameState, index: number): GameState {
  const r = ROUNDS[index];
  const next: GameState = {
    ...s,
    roundIndex: index,
    epoch: s.epoch + 1,
    phase: 'playing',
    hits: [],
    wrongHits: 0,
    hints: [],
    decrypted: !r.cipher,
    scansUsed: 0,
    scanned: [],
    board: emptyBoard(r),
    armed: null,
    armedScan: null,
    marks: [],
    sectorMissed: false,
  };
  const order = inSequence(r) ? ' IN SEQUENCE' : '';
  return log(next, `SECTOR ${index + 1} LINK ESTABLISHED. ${r.targets.length} BEACONS TO LOCK${order}`, 'info');
}

export function createInitialState(epoch = 0): GameState {
  const base: GameState = {
    team: '',
    roundIndex: 0,
    epoch,
    phase: 'lobby',
    hits: [],
    wrongHits: 0,
    hints: [],
    penaltyMs: 0,
    decrypted: true,
    scansUsed: 0,
    scanned: [],
    board: emptyBoard(ROUNDS[0]),
    sectorRestarts: 0,
    fragments: [],
    startedAt: null,
    endedAt: null,
    armed: null,
    armedScan: null,
    marks: [],
    sectorMissed: false,
    finalSolved: false,
    sectors: ROUNDS.map(() => null),
    log: [],
    nextLogId: 1,
  };
  return log(base, 'ORBITAL COMMAND UPLINK ONLINE. AWAITING CREW', 'success');
}

function toReveal(s: GameState, now: number): GameState {
  const finishes = isLastRound(s) && !currentRound(s).finale;
  return { ...s, phase: 'reveal', endedAt: finishes ? now : s.endedAt };
}

function withFragment(s: GameState): GameState {
  if (hasFragment(s, s.roundIndex)) return s;
  // Redesign sectors can finish in any order, so keep one slot per sector ('' until earned).
  const fragments = REDESIGN ? ROUNDS.map((_, i) => s.fragments[i] || '') : [...s.fragments];
  fragments[s.roundIndex] = currentRound(s).keyFragment;
  return { ...s, fragments };
}

function snapshot(s: GameState, phase: Phase = s.phase): SectorProgress {
  const { hits, wrongHits, hints, decrypted, scansUsed, scanned, board, marks, sectorMissed } = s;
  return { phase, hits, wrongHits, hints, decrypted, scansUsed, scanned, board, marks, sectorMissed };
}

/** Redesign: store the current sector's progress (as `leavingPhase`) and open sector `index` where the crew left it. */
function enterSector(s: GameState, index: number, leavingPhase: Phase = s.phase): GameState {
  const sectors = [...s.sectors];
  sectors[s.roundIndex] = snapshot(s, leavingPhase);
  const saved = sectors[index];
  if (!saved) return startRound({ ...s, sectors }, index);
  const round = ROUNDS[index];
  const next: GameState = { ...s, ...saved, sectors, roundIndex: index, epoch: s.epoch + 1, armed: null, armedScan: null };
  if (saved.phase === 'complete') return log(next, `SECTOR ${index + 1} COMPLETE. KEY FRAGMENT ${round.keyFragment}`, 'success');
  if (saved.phase === 'identify') return log(next, `SECTOR ${index + 1} LINK RESTORED. NAME THE CONSTELLATION IN THE LOG`, 'warn');
  if (saved.phase === 'finale' && round.finale) {
    return log(next, `SECTOR ${index + 1} LINK RESTORED. SHOOT ${round.finale.label} OVER COLUMN ${round.finale.column}`, 'warn');
  }
  const left = round.targets.length - saved.hits.length;
  return log(next, `SECTOR ${index + 1} LINK RESTORED. ${left} OF ${round.targets.length} BEACONS LEFT`, 'info');
}

/** Redesign: the next sector without a key fragment, starting after the current one. */
function nextUnfinished(s: GameState): number | null {
  for (let step = 1; step <= ROUNDS.length; step++) {
    const i = (s.roundIndex + step) % ROUNDS.length;
    if (!hasFragment(s, i)) return i;
  }
  return null;
}

function openVault(s: GameState): GameState {
  const next = withFragment({ ...s, phase: 'vault' });
  return log(next, `VAULT ${s.roundIndex + 1} OPEN. KEY FRAGMENT: ${currentRound(s).keyFragment}`, 'success');
}

function placeCard(board: BoardState, kind: 'col' | 'row', card: number, slot: number | null): BoardState {
  const slots = [...(kind === 'col' ? board.colSlots : board.rowSlots)].map((c) => (c === card ? null : c));
  if (slot !== null) slots[slot] = card;
  return kind === 'col' ? { ...board, colSlots: slots } : { ...board, rowSlots: slots };
}

export function gameReducer(s: GameState, a: GameAction): GameState {
  switch (a.type) {
    case 'BEGIN': {
      if (s.phase !== 'lobby') return s;
      const team = a.team.trim().toUpperCase().slice(0, TEAM_NAME_MAX) || 'UNNAMED CREW';
      const started = REDESIGN ? 'MISSION STARTED' : 'MISSION CLOCK STARTED';
      return startRound(log({ ...s, team, startedAt: a.now }, `CREW ${team} ON STATION. ${started}`, 'success'), 0);
    }

    case 'ARM':
      if (a.coord === null) {
        if (s.armed === null) return s;
        const cleared = { ...s, armed: null, armedScan: null };
        return REDESIGN ? log(cleared, 'TARGET CLEARED', 'info') : cleared;
      }
      if (REDESIGN && s.hits.includes(coordKey(a.coord[0], a.coord[1]))) {
        return log(s, `${at(a.coord)} IS ALREADY A STAR. ARM ANOTHER CELL`, 'warn');
      }
      return log({ ...s, armed: a.coord, armedScan: null }, `TARGET ARMED ${at(a.coord)}`, 'info');

    case 'SCAN': {
      if (s.phase !== 'playing' || !s.armed || s.armedScan !== null || s.scansUsed >= MAX_SCANS) return s;
      const [x, y] = s.armed;
      const round = currentRound(s);
      const key = coordKey(x, y);
      const inPlane = round.targets.some(([tx, ty]) => tx === x && ty === y);
      const scansUsed = s.scansUsed + 1;
      const left = MAX_SCANS - scansUsed;
      const next: GameState = {
        ...s,
        scansUsed,
        scanned: s.scanned.includes(key) ? s.scanned : [...s.scanned, key],
        armedScan: inPlane ? 'in' : 'out',
      };
      return log(
        next,
        `SCAN ${at([x, y])}: ${inPlane ? 'IN' : 'NOT IN'} THE CONSTELLATION. LETTER ${letterAt(round, key)}. ${left} ${left === 1 ? 'SCAN' : 'SCANS'} LEFT`,
        inPlane ? 'success' : 'warn',
      );
    }

    case 'LOG':
      return log(s, a.text, a.tone);

    case 'CORRECT_HIT': {
      if (s.phase !== 'playing') return s;
      const round = currentRound(s);
      const key = coordKey(a.x, a.y);
      const isTarget = round.targets.some(([x, y]) => coordKey(x, y) === key);
      if (!isTarget || s.hits.includes(key)) return s;
      if (inSequence(round)) {
        const [ex, ey] = round.targets[s.hits.length];
        if (coordKey(ex, ey) !== key) return s;
      }
      const hits = [...s.hits, key];
      const beacon = inSequence(round) ? `BEACON ${hits.length}` : `TARGET ${at([a.x, a.y])}`;
      // Under the redesign a shot can only land on the armed cell, so it is spent once it becomes a star.
      const spent = REDESIGN && s.armed !== null && coordKey(s.armed[0], s.armed[1]) === key;
      let next = log(
        spent ? { ...s, hits, armed: null, armedScan: null } : { ...s, hits },
        `${beacon} NEUTRALIZED. LETTER ${letterAt(round, key)} LOCKED`,
        'success',
      );
      if (round.guideLine && hits.length === 1) {
        next = log(next, 'GUIDE LINE ONLINE. DRAG FROM A STAR ON THE GRID', 'info');
      }
      const complete = round.targets.every(([x, y]) => hits.includes(coordKey(x, y)));
      if (complete) {
        next = log({ ...next, phase: 'drawing', armed: null, armedScan: null }, 'ALL BEACONS LOCKED. PLOTTING CONSTELLATION...', 'success');
      }
      return next;
    }

    case 'WRONG_HIT': {
      if (s.phase !== 'playing') return s;
      const round = currentRound(s);
      const hints = roundHints(round);
      const wrongHits = s.wrongHits + 1;
      const what = REDESIGN
        ? `${at([a.x, a.y])} ${a.reason === 'order' ? 'OUT OF SEQUENCE' : 'NOT IN CONSTELLATION'}. SHIELD LOST`
        : a.reason === 'order'
          ? 'OUT OF SEQUENCE. SHOT REJECTED'
          : 'TELEMETRY DESYNC - RECALIBRATING';
      // Redesign: the armed answer has been checked and was wrong, so it is disarmed to avoid a second penalty.
      const checked = REDESIGN ? { armed: null, armedScan: null } : {};
      let next = log({ ...s, ...checked, wrongHits, sectorMissed: true }, `${what} (MISS ${wrongHits} OF ${MAX_WRONG_HITS})`, 'error');
      if (wrongHits >= MAX_WRONG_HITS) {
        return log({ ...next, phase: 'failed', armed: null, armedScan: null }, 'SHIELDS DEPLETED. SECTOR PROGRESS LOST, RESTARTING SECTOR', 'error');
      }
      if (nextHintLocked(s) && !nextHintLocked(next)) next = log(next, 'FINAL HINT UNLOCKED', 'warn');
      if (wrongHits % WRONG_HITS_PER_FREE_HINT === 0 && s.hints.length < hints.length) {
        next = {
          ...next,
          hints: [...s.hints, { text: hints[s.hints.length], auto: true }],
        };
        next = log(next, `${WRONG_HITS_PER_FREE_HINT} MISSES DETECTED. ${REDESIGN ? 'NEXT' : 'FREE'} HINT UNLOCKED`, 'warn');
      }
      return next;
    }

    case 'SHOT_REJECTED': {
      if (s.phase !== 'playing') return s;
      const r = a.rejection;
      if (r.kind === 'no-target') {
        const text = FREE_AIM
          ? `AIM AT A GRID CELL, OR TYPE ${COORD_LABEL} IN ARM TARGET`
          : `NO TARGET ARMED. TYPE ${COORD_LABEL} IN ARM TARGET`;
        return s.log[s.log.length - 1]?.text === text ? s : log(s, text, 'warn');
      }
      if (r.kind === 'respawning') return log(s, `${at(r.target)} IS RESPAWNING. WAIT, THEN FIRE AGAIN`, 'warn');
      const where = r.aim ? `CANNON ON ${at(r.aim)}, TARGET ${at(r.target)}` : 'CANNON OFF THE GRID';
      return log(s, `DEFLECTED: ${where}. NO SHIELD LOST`, 'warn');
    }

    case 'TOGGLE_MARK': {
      if (s.phase !== 'playing') return s;
      const key = coordKey(a.x, a.y);
      if (s.marks.includes(key)) return { ...s, marks: s.marks.filter((m) => m !== key) };
      if (s.hits.includes(key)) return s;
      if (s.marks.length >= MAX_MARKS) return log(s, `MARK LIMIT IS ${MAX_MARKS}. CLICK A MARK TO REMOVE IT`, 'warn');
      return { ...s, marks: [...s.marks, key] };
    }

    case 'CLEAR_MARKS':
      return s.marks.length ? { ...s, marks: [] } : s;

    case 'RESTART_SECTOR': {
      if (s.phase !== 'failed') return s;
      // Only the shots reset. Hints, scans (and their letters), marks, the board and a solved cipher stay.
      return {
        ...startRound(s, s.roundIndex),
        hints: s.hints,
        decrypted: s.decrypted,
        scansUsed: s.scansUsed,
        scanned: s.scanned,
        board: s.board,
        marks: s.marks,
        sectorMissed: s.sectorMissed,
        sectorRestarts: s.sectorRestarts + 1,
      };
    }

    case 'DECRYPT': {
      const cipher = currentRound(s).cipher;
      if (!cipher || s.decrypted) return s;
      if (isCorrectKey(currentRound(s), a.key)) {
        return log({ ...s, decrypted: true }, 'KEY ACCEPTED. TRANSMISSION DECRYPTED', 'success');
      }
      return log(s, `KEY "${a.key.trim().toUpperCase()}" REJECTED. TRANSMISSION STILL LOCKED`, 'error');
    }

    case 'BOARD_PLACE':
      return s.board ? { ...s, board: placeCard(s.board, a.kind, a.card, a.slot) } : s;

    case 'BOARD_VALUE': {
      if (!s.board) return s;
      const value = a.value.replace(/[^0-9]/g, '').slice(0, 1);
      const key = a.kind === 'col' ? 'colValues' : 'rowValues';
      const values = [...s.board[key]];
      values[a.card] = value;
      return { ...s, board: { ...s.board, [key]: values } };
    }

    case 'GUIDE_DRAWN':
      return log(s, 'GUIDE LINE PLACED. STARS ON THIS LINE ARE EVENLY SPACED', 'info');

    case 'FLAK_HIT':
      return log(s, 'HULL IMPACT. WEAPONS OFFLINE 2s', 'error');

    case 'REQUEST_HINT': {
      if (s.phase !== 'playing' && s.phase !== 'identify') return s;
      const hints = roundHints(currentRound(s));
      if (s.hints.length >= hints.length || nextHintLocked(s)) return s;
      const next: GameState = {
        ...s,
        penaltyMs: s.penaltyMs + HINT_PENALTY_MS,
        hints: [...s.hints, { text: hints[s.hints.length], auto: false }],
      };
      return log(next, REDESIGN ? `HINT ${next.hints.length} DECRYPTED` : 'HINT DECRYPTED. +1:00 ADDED TO MISSION TIME', 'warn');
    }

    case 'LINES_DRAWN': {
      if (s.phase !== 'drawing') return s;
      if (currentRound(s).hiddenName) {
        return log({ ...s, phase: 'identify' }, 'SECTOR IDENTITY UNKNOWN. NAME THE CONSTELLATION TO OPEN THE VAULT', 'warn');
      }
      return toReveal(s, a.now);
    }

    case 'IDENTIFY': {
      if (s.phase !== 'identify') return s;
      const round = currentRound(s);
      if (!isAcceptedName(round, a.name)) {
        return log(s, `IDENTIFICATION REJECTED: "${a.name.trim().toUpperCase()}"`, 'error');
      }
      return toReveal(log(s, `IDENTITY CONFIRMED: ${round.name}`, 'success'), a.now);
    }

    case 'REVEAL_DONE': {
      if (s.phase !== 'reveal') return s;
      const finale = currentRound(s).finale;
      if (finale) {
        return log(
          { ...s, phase: 'finale' },
          `THE POINTERS POINT NORTH. SHOOT ${finale.label} AS IT CROSSES COLUMN ${finale.column}`,
          'warn',
        );
      }
      return openVault(s);
    }

    case 'FINALE_HIT': {
      if (s.phase !== 'finale') return s;
      const label = currentRound(s).finale?.label ?? 'TARGET';
      const next = log({ ...s, endedAt: isLastRound(s) ? a.now : s.endedAt }, `${label} ACQUIRED. NORTH STAR LOCKED`, 'success');
      return openVault(next);
    }

    case 'FINALE_MISS': {
      if (s.phase !== 'finale') return s;
      const f = currentRound(s).finale;
      const text =
        a.kind === 'off-column'
          ? `SHOT DEFLECTED. ${f?.label} WAS NOT OVER COLUMN ${f?.column}. NEXT PASS IN 5s`
          : `${f?.label} PASSED. NEXT PASS IN 5s`;
      return log(s, text, 'warn');
    }

    case 'ADVANCE': {
      if (s.phase !== 'vault') return s;
      if (REDESIGN) {
        // Sectors can be finished in any order: win once every fragment is in, otherwise move on.
        const next = nextUnfinished(s);
        if (next === null) {
          const sectors = [...s.sectors];
          sectors[s.roundIndex] = snapshot(s, 'complete');
          return { ...s, sectors, phase: 'victory', endedAt: s.endedAt ?? a.now };
        }
        return enterSector(s, next, 'complete');
      }
      if (isLastRound(s)) return { ...s, phase: 'victory', endedAt: s.endedAt ?? a.now };
      return startRound(s, s.roundIndex + 1);
    }

    case 'GOTO_SECTOR':
      if (!canSwitchSector(s) || a.index === s.roundIndex || a.index < 0 || a.index >= ROUNDS.length) return s;
      return enterSector(s, a.index);

    case 'SKIP': {
      if (s.phase === 'victory' || s.phase === 'lobby') return s;
      if (REDESIGN) {
        const hits = currentRound(s).targets.map(([x, y]) => coordKey(x, y));
        const done = log(withFragment({ ...s, hits }), `STAFF OVERRIDE. SECTOR ${s.roundIndex + 1} BYPASSED`, 'warn');
        const next = nextUnfinished(done);
        if (next === null) {
          const sectors = [...done.sectors];
          sectors[done.roundIndex] = snapshot(done, 'complete');
          return { ...done, sectors, phase: 'victory', startedAt: done.startedAt ?? a.now, endedAt: done.endedAt ?? a.now };
        }
        return enterSector(done, next, 'complete');
      }
      const next = log(withFragment(s), `STAFF OVERRIDE. SECTOR ${s.roundIndex + 1} BYPASSED`, 'warn');
      if (isLastRound(s)) {
        return { ...next, phase: 'victory', startedAt: next.startedAt ?? a.now, endedAt: next.endedAt ?? a.now };
      }
      return startRound(next, s.roundIndex + 1);
    }

    case 'RESTORE': {
      // Redesign: resume a saved game after a refresh. A new epoch makes the canvas reload the
      // sector; the armed target is dropped so the team re-arms deliberately.
      if (s.phase !== 'lobby') return s;
      const restored: GameState = {
        ...a.state,
        epoch: s.epoch + 1,
        armed: null,
        armedScan: null,
        finalSolved: a.state.finalSolved ?? false,
        sectors: a.state.sectors ?? ROUNDS.map(() => null),
      };
      return log(restored, 'MISSION RESUMED', 'success');
    }

    case 'FINAL_SOLVED':
      return s.phase === 'victory' && !s.finalSolved ? log({ ...s, finalSolved: true }, 'FINAL ANSWER CONFIRMED', 'success') : s;

    case 'RESET':
      return createInitialState(s.epoch + 1);

    default:
      return s;
  }
}
