import type { Round } from './types';
import { GRID_SIZE, coordKey } from './grid';

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function hashString(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The faint letter shown on every alien. Targets carry their fragment letter, decoys their own
 * letter, and every other cell gets a deterministic filler letter. Cells touching a target never
 * use one of the fragment's letters, so a star placed one cell off spells nonsense.
 */
export function buildLetterGrid(round: Round): Map<string, string> {
  const letters = new Map<string, string>();
  round.targets.forEach(([x, y], i) => letters.set(coordKey(x, y), round.keyFragment[i]));
  round.decoys?.forEach(({ cell: [x, y], letter }) => letters.set(coordKey(x, y), letter));

  const fragmentLetters = new Set(round.keyFragment.replace(/[^A-Z]/g, ''));
  const nearTarget = (x: number, y: number) =>
    round.targets.some(([tx, ty]) => Math.abs(tx - x) <= 1 && Math.abs(ty - y) <= 1);
  const rand = mulberry32(hashString(round.name + round.keyFragment));

  for (let y = 1; y <= GRID_SIZE; y++) {
    for (let x = 1; x <= GRID_SIZE; x++) {
      const key = coordKey(x, y);
      if (letters.has(key)) continue;
      const pool = nearTarget(x, y) ? [...ALPHABET].filter((c) => !fragmentLetters.has(c)) : [...ALPHABET];
      letters.set(key, pool[Math.floor(rand() * pool.length)]);
    }
  }
  return letters;
}
