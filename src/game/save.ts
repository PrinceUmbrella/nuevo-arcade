import { ROUNDS } from '../data/constellations';
import { coordKey } from './grid';
import { REDESIGN } from './ruleset';
import type { GameState, SectorProgress } from './state';
import type { Phase } from './types';

/**
 * Redesign only: the game is saved to this browser after every change so a refresh, a closed tab,
 * or a browser restart on the kiosk doesn't lose a crew's progress. Bump SAVE_VERSION whenever
 * GameState changes shape; older saves are then discarded instead of loaded.
 */
const SAVE_KEY = 'constellation-grid:save:v1';
const SAVE_VERSION = 1;

export interface SavedGame {
  savedAt: number;
  state: GameState;
}

const RESUMABLE_PHASES: Phase[] = [
  'playing',
  'failed',
  'drawing',
  'identify',
  'reveal',
  'finale',
  'vault',
  'complete',
  'victory',
];
/** Phases a sector can be left in (see canSwitchSector), plus complete. */
const SNAPSHOT_PHASES: Phase[] = ['playing', 'identify', 'finale', 'complete'];

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
const isSlotArray = (v: unknown, length: number, cards: number) =>
  Array.isArray(v) && v.length === length && v.every((x) => x === null || (isInt(x) && x >= 0 && x < cards));

/** One sector's progress fits that sector's round data (stars, board shape and so on). */
function isValidProgress(roundIndex: number, p: SectorProgress): boolean {
  const round = ROUNDS[roundIndex];
  const targets = new Set(round.targets.map(([x, y]) => coordKey(x, y)));
  if (!p || typeof p !== 'object') return false;
  if (!isStringArray(p.hits) || !p.hits.every((h) => targets.has(h))) return false;
  if (!isStringArray(p.scanned) || !isStringArray(p.marks)) return false;
  if (!isInt(p.wrongHits) || !isInt(p.scansUsed)) return false;
  if (typeof p.sectorMissed !== 'boolean' || typeof p.decrypted !== 'boolean') return false;
  if (!Array.isArray(p.hints) || !p.hints.every((h) => h && typeof h.text === 'string' && typeof h.auto === 'boolean')) {
    return false;
  }
  if (round.board) {
    const b = p.board;
    if (!b) return false;
    const { slots, columnCards, rowCards } = round.board;
    if (!isSlotArray(b.colSlots, slots, columnCards.length) || !isSlotArray(b.rowSlots, slots, rowCards.length)) return false;
    if (!isStringArray(b.colValues) || b.colValues.length !== columnCards.length) return false;
    if (!isStringArray(b.rowValues) || b.rowValues.length !== rowCards.length) return false;
  } else if (p.board !== null) {
    return false;
  }
  return true;
}

/** True when a saved state still fits the current round data, so restoring it can't break the game. */
function isValidState(s: GameState): boolean {
  if (!isInt(s.roundIndex) || s.roundIndex < 0 || s.roundIndex >= ROUNDS.length) return false;
  if (!RESUMABLE_PHASES.includes(s.phase)) return false;
  if (typeof s.team !== 'string' || !isInt(s.epoch) || !isInt(s.nextLogId)) return false;
  if (!isValidProgress(s.roundIndex, s)) return false;
  if (!isStringArray(s.fragments) || s.fragments.length > ROUNDS.length) return false;
  if (!isInt(s.sectorRestarts) || !isInt(s.penaltyMs)) return false;
  // Added after the first saves shipped, so an older save may not have these yet.
  if (s.finalSolved !== undefined && typeof s.finalSolved !== 'boolean') return false;
  if (s.boardHelpSeen !== undefined && typeof s.boardHelpSeen !== 'boolean') return false;
  if (s.sectors !== undefined) {
    if (!Array.isArray(s.sectors) || s.sectors.length !== ROUNDS.length) return false;
    const ok = s.sectors.every(
      (p, i) => p === null || (SNAPSHOT_PHASES.includes(p.phase) && isValidProgress(i, p)),
    );
    if (!ok) return false;
  }
  if (!Array.isArray(s.log) || !s.log.every((l) => l && isInt(l.id) && typeof l.text === 'string')) return false;
  if (s.startedAt !== null && typeof s.startedAt !== 'number') return false;
  if (s.endedAt !== null && typeof s.endedAt !== 'number') return false;
  return true;
}

/** The saved game, or null when there is none or it no longer fits (in which case it is removed). */
export function loadSave(): SavedGame | null {
  if (!REDESIGN) return null;
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(SAVE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { version?: unknown; savedAt?: unknown; state?: GameState };
    if (parsed.version === SAVE_VERSION && typeof parsed.savedAt === 'number' && parsed.state && isValidState(parsed.state)) {
      return { savedAt: parsed.savedAt, state: parsed.state };
    }
  } catch {
    // Not valid JSON: fall through and discard it.
  }
  clearSave();
  return null;
}

export function writeSave(state: GameState) {
  if (!REDESIGN) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: SAVE_VERSION, savedAt: Date.now(), state }));
  } catch {
    // Storage full or blocked: the game keeps running, it just can't resume after a refresh.
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}
