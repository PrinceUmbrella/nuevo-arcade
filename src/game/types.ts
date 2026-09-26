/** Grid coordinate: [X column 1–8 left→right, Y row 1–8 bottom→top]. */
export type Coord = readonly [number, number];

/** A block of clues shown in the log. `ordered` renders numbered items (order carries meaning). */
export interface ClueSection {
  heading: string;
  items: string[];
  ordered?: boolean;
}

/** When present, the round's clue sections are shown encrypted until the key is entered. */
export interface Cipher {
  /** Vigenère keyword (letters only). */
  key: string;
  /** Plain-text prompt shown above the ciphertext. */
  prompt: string;
}

export interface Decoy {
  cell: Coord;
  letter: string;
}

/** Sector 2 pairing board: clue cards players drag into slots and annotate with numbers. */
export interface PairingBoard {
  columnCards: string[];
  rowCards: string[];
  /** Number of W positions (slots), left to right. */
  slots: number;
}

/** Arcade finale: a mothership crosses the top lane and must be hit over `column`. */
export interface Finale {
  label: string;
  column: number;
  /** Target indices [from, to] of the stars that point the way (drawn as an arrow). */
  pointers: [number, number];
}

export interface Round {
  name: string;
  hiddenName: boolean;
  alienColor: string;
  missionText: string;
  /** Original mission text, used only with ?rules=classic. Falls back to `missionText`. */
  classicMissionText?: string;
  /** Beacon cells. With `requireOrder`, this is also the firing sequence. */
  targets: Coord[];
  /** Pairs of indices into `targets`, drawn in order when the round is won. */
  lines: [number, number][];
  clues: ClueSection[];
  /** Original clue text (column first), used only with ?rules=classic. Falls back to `clues`. */
  classicClues?: ClueSection[];
  cipher?: Cipher;
  /** Red-herring cells that show a specific letter. Hitting one is a miss. */
  decoys?: Decoy[];
  /** Classic rules only: beacons must be hit in `targets` order; an out-of-sequence hit is a miss. */
  requireOrder?: boolean;
  /** After the first star, players can drag a guide line from a star (visual only). */
  guideLine?: boolean;
  /** Replace clue lists with a drag-and-drop pairing board. */
  board?: PairingBoard;
  /** Clue sections are shown only on the ?view=navigator device (staff can override). */
  navigatorOnly?: boolean;
  finale?: Finale;
  /** Grid sway as a fraction of DRIFT_AMPLITUDE (0 = still). Defaults to 1. Ignored with ?rules=classic. */
  sway?: number;
  /** Whether aliens drop flak on the cannon. Defaults to true. Ignored with ?rules=classic. */
  flak?: boolean;
  hints: string[];
  /** Original hint text, used only with ?rules=classic. Falls back to `hints`. */
  classicHints?: string[];
  /** Only used when `hiddenName` is true. Matching is case/punctuation-insensitive. */
  acceptedNames: string[];
  /** One letter per target, in `targets` order. The stars spell it; the vault awards it. */
  keyFragment: string;
}

/** `complete` (redesign): a finished sector the crew has come back to look at. */
export type Phase =
  | 'lobby'
  | 'playing'
  | 'failed'
  | 'drawing'
  | 'identify'
  | 'reveal'
  | 'finale'
  | 'vault'
  | 'complete'
  | 'victory';

export type LogTone = 'info' | 'success' | 'error' | 'warn';

export interface LogEntry {
  id: number;
  text: string;
  tone: LogTone;
}

export interface HintEntry {
  text: string;
  /** True when unlocked automatically by misses rather than requested. */
  auto: boolean;
}

/** Result of a free scan on the armed cell: in the constellation plane, not in it, or not scanned. */
export type ScanResult = 'in' | 'out' | null;

export type MissReason = 'miss' | 'order';

/** Why a shot never reached a cell (redesign rules only). */
export type ShotRejection =
  | { kind: 'no-target' }
  | { kind: 'deflected'; aim: Coord | null; target: Coord }
  | { kind: 'respawning'; target: Coord };
