export interface LeaderboardEntry {
  team: string;
  /** Final time including hint penalties. */
  ms: number;
  penaltyMs: number;
  restarts: number;
  at: string;
}

const STORAGE_KEY = 'constellation-grid:leaderboard';
export const LEADERBOARD_EVENT = 'constellation-grid:leaderboard-changed';

export function loadLeaderboard(): LeaderboardEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (e): e is LeaderboardEntry =>
          !!e && typeof e.team === 'string' && typeof e.ms === 'number' && Number.isFinite(e.ms),
      )
      .sort((a, b) => a.ms - b.ms);
  } catch {
    return [];
  }
}

function save(entries: LeaderboardEntry[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Storage full or blocked (private mode): the run still finishes, it just isn't recorded.
  }
  window.dispatchEvent(new Event(LEADERBOARD_EVENT));
}

/** Adds an entry and returns its 1-based rank. */
export function addLeaderboardEntry(entry: LeaderboardEntry): number {
  const entries = [...loadLeaderboard(), entry].sort((a, b) => a.ms - b.ms);
  save(entries);
  return entries.indexOf(entry) + 1;
}

export function clearLeaderboard() {
  save([]);
}

/** Calls `onChange` when the leaderboard changes in this tab or another tab/window. */
export function subscribeLeaderboard(onChange: () => void) {
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) onChange();
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(LEADERBOARD_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(LEADERBOARD_EVENT, onChange);
  };
}

const SYNC_KEY = 'constellation-grid:sector';

/** Lets a navigator window on the same machine know which sector is live. */
export function publishSector(roundIndex: number) {
  try {
    localStorage.setItem(SYNC_KEY, String(roundIndex));
  } catch {
    // Non-essential.
  }
}

export function readPublishedSector(): number | null {
  try {
    const v = localStorage.getItem(SYNC_KEY);
    return v === null ? null : Number(v);
  } catch {
    return null;
  }
}

export const SECTOR_SYNC_KEY = SYNC_KEY;
