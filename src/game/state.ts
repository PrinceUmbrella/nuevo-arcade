import { MASTER_KEY_SEPARATOR, ROUNDS } from '../data/constellations';
import { normalizeKey } from './cipher';
import { coordKey } from './grid';
import { buildLetterGrid } from './letters';
import type { Coord, HintEntry, LogEntry, LogTone, MissReason, Phase, Round, ScanResult } from './types';

export const WRONG_HITS_PER_FREE_HINT = 3;
/** Misses allowed per sector. Reaching it wipes the sector's stars and restarts it. */
export const MAX_WRONG_HITS = 6;
/** Free "is this cell in the constellation?" checks per sector. Each also reveals the cell's letter. */
export const MAX_SCANS = 3;
export const REBOOT_MS = 10 * 1000;
export const MISS_COOLDOWN_MS = [2_000, 5_000, 10_000] as const;
export const HINT_DECRYPT_MS = [15_000, 25_000, 40_000] as const;
export const TEAM_NAME_MAX = 18;
const MAX_LOG = 40;

export interface TimedWait {
  startedAt: number;
  endsAt: number;
}

export interface PendingHint extends TimedWait {
  hintIndex: number;
}

/** Pairing board: which card sits in each slot, and the number the team wrote on each card. */
export interface BoardState {
  colSlots: (number | null)[];
  rowSlots: (number | null)[];
  colValues: string[];
  rowValues: string[];
  colOrder: number[];
  rowOrder: number[];
}

export interface GameState {
  team: string;
  roundIndex: number;
  /** Incremented every time a round (re)loads so the canvas engine can respawn. */
  epoch: number;
  phase: Phase;
  hits: string[];
  wrongHits: number;
  missStreak: number;
  hints: HintEntry[];
  cooldown: TimedWait | null;
  pendingHint: PendingHint | null;
  reboot: TimedWait | null;
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
  log: LogEntry[];
  nextLogId: number;
}

export type GameAction =
  | { type: 'BEGIN'; team: string; now: number }
  | { type: 'ARM'; coord: Coord | null }
  | { type: 'SCAN'; now: number }
  | { type: 'LOG'; text: string; tone: LogTone }
  | { type: 'CORRECT_HIT'; x: number; y: number }
  | { type: 'WRONG_HIT'; x: number; y: number; reason: MissReason; now: number }
  | { type: 'FLAK_HIT' }
  | { type: 'REQUEST_HINT'; now: number }
  | { type: 'COMPLETE_HINT' }
  | { type: 'COMPLETE_COOLDOWN' }
  | { type: 'CANCEL_WAITS' }
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
  | { type: 'RESET' };

export const currentRound = (s: GameState): Round => ROUNDS[s.roundIndex];
export const isLastRound = (s: GameState) => s.roundIndex === ROUNDS.length - 1;
export const masterKey = (s: GameState) => s.fragments.join(MASTER_KEY_SEPARATOR);
export const fullMasterKey = () => ROUNDS.map((r) => r.keyFragment).join(MASTER_KEY_SEPARATOR);

export const sectorLabel = (s: GameState) => {
  const r = currentRound(s);
  const identified = ['reveal', 'finale', 'vault', 'victory'].includes(s.phase);
  return r.hiddenName && !identified ? 'UNKNOWN SECTOR' : r.name;
};

const normalizeName = (v: string) =>
  v
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

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

function shuffledIndices(length: number): number[] {
  const order = Array.from({ length }, (_, index) => index);
  for (let index = order.length - 1; index > 0; index--) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [order[index], order[swapIndex]] = [order[swapIndex], order[index]];
  }
  if (order.length > 1 && order.every((value, index) => value === index)) {
    [order[0], order[1]] = [order[1], order[0]];
  }
  return order;
}

function emptyBoard(round: Round): BoardState | null {
  if (!round.board) return null;
  return {
    colSlots: Array(round.board.slots).fill(null),
    rowSlots: Array(round.board.slots).fill(null),
    colValues: round.board.columnCards.map(() => ''),
    rowValues: round.board.rowCards.map(() => ''),
    colOrder: shuffledIndices(round.board.columnCards.length),
    rowOrder: shuffledIndices(round.board.rowCards.length),
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
    missStreak: 0,
    hints: [],
    cooldown: null,
    pendingHint: null,
    reboot: null,
    decrypted: !r.cipher,
    scansUsed: 0,
    scanned: [],
    board: emptyBoard(r),
    armed: null,
    armedScan: null,
  };
  const order = r.requireOrder ? ' IN SEQUENCE' : '';
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
    missStreak: 0,
    hints: [],
    cooldown: null,
    pendingHint: null,
    reboot: null,
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
  if (s.fragments.length > s.roundIndex) return s;
  const fragments = [...s.fragments];
  fragments[s.roundIndex] = currentRound(s).keyFragment;
  return { ...s, fragments };
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
      return startRound(log({ ...s, team, startedAt: a.now }, `CREW ${team} ON STATION. MISSION STARTED`, 'success'), 0);
    }

    case 'ARM':
      if (a.coord === null) return s.armed === null ? s : { ...s, armed: null, armedScan: null };
      return log({ ...s, armed: a.coord, armedScan: null }, `TARGET ARMED (${a.coord[0]},${a.coord[1]})`, 'info');

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
        `SCAN (${x},${y}): ${inPlane ? 'IN' : 'NOT IN'} THE CONSTELLATION. LETTER ${letterAt(round, key)}. ${left} ${left === 1 ? 'SCAN' : 'SCANS'} LEFT`,
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
      if (round.requireOrder) {
        const [ex, ey] = round.targets[s.hits.length];
        if (coordKey(ex, ey) !== key) return s;
      }
      const hits = [...s.hits, key];
      const beacon = round.requireOrder ? `BEACON ${hits.length}` : `TARGET (${a.x},${a.y})`;
      let next = log(
        { ...s, hits, missStreak: 0, cooldown: null },
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
      const wrongHits = s.wrongHits + 1;
      const missStreak = s.missStreak + 1;
      const cooldownMs = MISS_COOLDOWN_MS[Math.min(missStreak, MISS_COOLDOWN_MS.length) - 1];
      const what = a.reason === 'order' ? 'OUT OF SEQUENCE. SHOT REJECTED' : 'TELEMETRY DESYNC - RECALIBRATING';
      let next = log(
        {
          ...s,
          wrongHits,
          missStreak,
          cooldown: wrongHits < MAX_WRONG_HITS ? { startedAt: a.now, endsAt: a.now + cooldownMs } : null,
        },
        `${what} (MISS ${wrongHits} OF ${MAX_WRONG_HITS})`,
        'error',
      );
      if (wrongHits % WRONG_HITS_PER_FREE_HINT === 0 && s.hints.length < round.hints.length) {
        next = {
          ...next,
          hints: [...s.hints, { text: round.hints[s.hints.length], auto: true }],
          pendingHint: null,
        };
        next = log(next, `${WRONG_HITS_PER_FREE_HINT} MISSES DETECTED. FREE HINT UNLOCKED`, 'warn');
      }
      if (wrongHits >= MAX_WRONG_HITS) {
        return log(
          {
            ...next,
            phase: 'failed',
            armed: null,
            armedScan: null,
            cooldown: null,
            reboot: { startedAt: a.now, endsAt: a.now + REBOOT_MS },
          },
          'SHIELDS DEPLETED. SYSTEMS REBOOTING',
          'error',
        );
      }
      return next;
    }

    case 'RESTART_SECTOR': {
      if (s.phase !== 'failed') return s;
      // Only the shots reset. Hints, scans (and their letters), the board and a solved cipher stay.
      return {
        ...startRound(s, s.roundIndex),
        hints: s.hints,
        decrypted: s.decrypted,
        scansUsed: s.scansUsed,
        scanned: s.scanned,
        board: s.board,
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
      const round = currentRound(s);
      if (s.pendingHint || s.hints.length >= round.hints.length) return s;
      const hintIndex = s.hints.length;
      const waitMs = HINT_DECRYPT_MS[Math.min(hintIndex, HINT_DECRYPT_MS.length - 1)];
      return log(
        {
          ...s,
          pendingHint: { hintIndex, startedAt: a.now, endsAt: a.now + waitMs },
        },
        `DECRYPTING HINT ${hintIndex + 1}. TRANSMISSION ETA ${waitMs / 1000}s`,
        'warn',
      );
    }

    case 'COMPLETE_HINT': {
      if (!s.pendingHint) return s;
      const round = currentRound(s);
      const hintIndex = s.pendingHint.hintIndex;
      if (hintIndex !== s.hints.length || hintIndex >= round.hints.length) {
        return { ...s, pendingHint: null };
      }
      const next: GameState = {
        ...s,
        pendingHint: null,
        hints: [...s.hints, { text: round.hints[hintIndex], auto: false }],
      };
      return log(next, 'TRANSMISSION DECRYPTED. HINT AVAILABLE', 'warn');
    }

    case 'COMPLETE_COOLDOWN':
      return s.cooldown ? { ...s, cooldown: null } : s;

    case 'CANCEL_WAITS': {
      if (!s.cooldown && !s.pendingHint) return s;
      let next = s.cooldown ? { ...s, cooldown: null } : s;
      if (next.pendingHint) {
        const hintIndex = next.pendingHint.hintIndex;
        const round = currentRound(next);
        next = {
          ...next,
          pendingHint: null,
          hints:
            hintIndex === next.hints.length && hintIndex < round.hints.length
              ? [...next.hints, { text: round.hints[hintIndex], auto: false }]
              : next.hints,
        };
      }
      return log(next, 'STAFF: ACTIVE WAITS CLEARED', 'warn');
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
      if (isLastRound(s)) return { ...s, phase: 'victory', endedAt: s.endedAt ?? a.now };
      return startRound(s, s.roundIndex + 1);
    }

    case 'SKIP': {
      if (s.phase === 'victory' || s.phase === 'lobby') return s;
      const next = log(withFragment(s), `STAFF OVERRIDE. SECTOR ${s.roundIndex + 1} BYPASSED`, 'warn');
      if (isLastRound(s)) {
        return { ...next, phase: 'victory', startedAt: next.startedAt ?? a.now, endedAt: next.endedAt ?? a.now };
      }
      return startRound(next, s.roundIndex + 1);
    }

    case 'RESET':
      return createInitialState(s.epoch + 1);

    default:
      return s;
  }
}
