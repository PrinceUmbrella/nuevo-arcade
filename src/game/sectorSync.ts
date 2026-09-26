const SECTOR_SYNC_KEY = 'constellation-grid:sector';

/** Lets a navigator window on the same machine know which sector is live. */
export function publishSector(roundIndex: number) {
  try {
    localStorage.setItem(SECTOR_SYNC_KEY, String(roundIndex));
  } catch {
    // Navigator sync is optional when browser storage is unavailable.
  }
}

export function readPublishedSector(): number | null {
  try {
    const value = localStorage.getItem(SECTOR_SYNC_KEY);
    return value === null ? null : Number(value);
  } catch {
    return null;
  }
}

export { SECTOR_SYNC_KEY };
