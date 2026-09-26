import { useEffect, useState } from 'react';
import { ROUNDS } from '../data/constellations';
import { roundClues, roundMissionText } from '../game/state';
import { readPublishedSector, SECTOR_SYNC_KEY } from '../game/leaderboard';

/**
 * ?view=navigator: shows the clues for navigator-only sectors on a phone or tablet.
 * On the same machine it follows the live sector; on another device it simply shows the clues.
 */
export function NavigatorView() {
  const [sector, setSector] = useState<number | null>(readPublishedSector);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === SECTOR_SYNC_KEY) setSector(readPublishedSector());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const navRounds = ROUNDS.map((r, i) => ({ r, i })).filter(({ r }) => r.navigatorOnly);
  const firstNav = navRounds[0]?.i ?? 0;
  const locked = sector !== null && sector < firstNav;

  return (
    <main className="navigator">
      <header>
        <h1>NAVIGATOR CONSOLE</h1>
        <p>For the Navigator only. Read the beacons aloud; the Gunner cannot see them.</p>
      </header>
      {locked ? (
        <p className="navigator-standby">STAND BY. Your beacons unlock at Sector {firstNav + 1}.</p>
      ) : (
        navRounds.map(({ r, i }) => (
          <section key={r.name}>
            <h2>SECTOR {i + 1}: {r.hiddenName ? 'CLASSIFIED' : r.name}</h2>
            <p className="navigator-mission">{roundMissionText(r)}</p>
            {roundClues(r).map((c) => {
              const List = c.ordered ? 'ol' : 'ul';
              return (
                <div key={c.heading}>
                  <h3>{c.heading}</h3>
                  <List>
                    {c.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </List>
                </div>
              );
            })}
          </section>
        ))
      )}
    </main>
  );
}
