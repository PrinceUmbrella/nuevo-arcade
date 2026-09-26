/** Logical canvas geometry. The engine scales this to fit its container. */
export const W = 1050;
export const H = 910;
export const GRID_SIZE = 8;
export const CELL = 88;
/** The grid sways left and right by up to this many pixels (one cell). */
export const DRIFT_AMPLITUDE = CELL;
export const DRIFT_PERIOD_S = 9;
export const GRID_LEFT = 150;
export const GRID_TOP = 60;
export const GRID_RIGHT = GRID_LEFT + CELL * GRID_SIZE;
export const GRID_BOTTOM = GRID_TOP + CELL * GRID_SIZE;
export const CANNON_Y = 862;

export const cellCenterX = (x: number) => GRID_LEFT + (x - 0.5) * CELL;
/** Y = 1 is the bottom row, nearest the cannon. */
export const cellCenterY = (y: number) => GRID_BOTTOM - (y - 0.5) * CELL;

export const coordKey = (x: number, y: number) => `${x},${y}`;

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Accepts "3,5", "3 5", "(3, 5)", "3;5". Returns null if invalid. */
export function parseCoord(input: string): [number, number] | null {
  const m = input.trim().match(/^\(?\s*([1-8])\s*[,;\s]\s*([1-8])\s*\)?$/);
  return m ? [Number(m[1]), Number(m[2])] : null;
}
