# The Constellation Grid

A Space Invaders-style coordinate puzzle for a space-themed escape room. Built with Vite, React, TypeScript, and three.js (React Three Fiber).

## Run

```bash
npm install
npm run dev       # development server on this machine
npm run dev:lan   # same, but reachable from phones/tablets on the local network
npm run build     # production build in dist/
npm run preview   # serve the production build locally
```

Designed for a 1920×1080 screen; the layout scales to fit other window sizes. The game screen is desktop only: windows smaller than 1024×600 get a notice instead (the Navigator view still works on phones).

### Screens

| URL | What it's for |
| --- | --- |
| `/` | The game (kiosk screen) |
| `/?view=leaderboard&rules=classic` | Classic rules only: second screen of fastest crews, updates live when opened on the same computer |
| `/?view=navigator` | Sector 3 beacon clues for the Navigator's phone or tablet (needs `npm run dev:lan`, then open the Network address it prints) |
| `/?rules=classic` | The original rules and copy, for before/after comparison with the redesign (the default) |

The navigator view follows the live sector when it runs on the same computer (it says STAND BY until Sector 3). On another device it just shows the clues, so hand it over at Sector 3, or print them.

## How it plays

A crew enters its team name in the lobby and starts the mission. There is no clock and no leaderboard: crews take as long as they need. Three sectors (Orion's Belt, Cassiopeia, and a classified third). Players decode clues into (X, Y) cells, arm each answer, and shoot only those aliens. X counts left to right, Y counts bottom to top (Y = 1 is the bottom row).

The puzzle is the deduction; the shot is the payoff. The cannon only fires at the armed cell. Players line up LOCK by moving the cannon under the target's column and setting the row by hand, and a line above the grid says what to do next. A shot fired without LOCK is deflected: no shield lost, nothing revealed, a 1.5-second cooldown. Orion's Belt holds still with no enemy fire so crews can learn this. In Cassiopeia and the third sector the grid sways left and right (the labels sway with it) and aliens drop flak that knocks weapons offline for 2 seconds.

Every alien hides a letter, shown only when it is hit or SCANned. The correct stars spell each sector's key fragment. The master key is **MAP-STARS-POLARIS**.

1. **Orion's Belt (tutorial).** One star is given by facts; the other two each lose a coordinate. After the first hit, players can drag a guide line from a star to find the rest of the belt.
2. **Cassiopeia.** A pairing board: drag column and row clue cards into five W positions and write each card's number. A mini-map plots the team's numbers live. One column card is interference, and a decoy cell waits where it lands.
3. **Unknown sector (Big Dipper).** Clues are on the Navigator device only; the Gunner fires in sequence as the Navigator reads. The stars spell POLARIS, the team names the constellation, then the POLARIS mothership crosses the top. It only counts when shot over column 1, where the Pointer stars aim.

The full answer key is in the comment at the top of `src/data/constellations.ts`.

- A locked shot at a wrong, decoy, or out-of-sequence cell costs one shield; the alien respawns after 3 seconds.
- SCAN (3 per sector) says whether the armed cell is in the constellation and reveals its letter.
- Pencil marks: click a cell, or type `M X,Y` in ARM TARGET, to drop a numbered mark (up to 8). `M CLEAR` removes them. Marks are a scratchpad only and never count as shots.
- Hints are free: 3 per sector, revealed in order on request. Every 3 misses also unlocks the next one automatically. The third hint in each sector gives a star away, so it stays locked until the crew makes at least one wrong deduction in that sector (a deflected shot doesn't count). A sector restart keeps it unlocked.
- Losing all 6 shields restarts the current sector; hints, scans, marks and the pairing board are kept.

### Player controls

| Key | Action |
| --- | --- |
| ARM TARGET box + Enter | Arm a cell. The cannon only fires at the armed cell |
| Left / Right or A / D | Move cannon (sets the column) |
| Up / Down or W / S | Set the row a shot detonates on |
| Space | Fire (lands only on LOCK; otherwise deflected) |
| SCAN | Check the armed cell and reveal its letter (3 per sector) |
| Click a cell, or `M X,Y` | Toggle a pencil mark. `M CLEAR` removes all |
| ? or the CONTROLS button | Controls legend (`?` also works from an empty ARM TARGET box) |
| Esc | Close the legend or the pairing board |

### Staff controls (keep these quiet)

| Key | Action |
| --- | --- |
| Shift+R | Full reset back to the lobby |
| Shift+N | Skip to the next sector (awards its key fragment) |
| Shift+H | Toggle the target overlay (numbered in firing order; decoys marked D) |
| Shift+V | Show the Navigator clues on the main screen (no second device) |
| Shift+L | Clear the leaderboard (classic rules only) |

## Customizing

All puzzle content lives in `src/data/constellations.ts` (targets, letters, lines, clues, board cards, decoys, hints, accepted names, finale, and per-sector `sway` and `flak`). Tuning constants: `MAX_WRONG_HITS`, `MAX_SCANS` and `MAX_MARKS` in `src/game/state.ts`; `DEFLECT_COOLDOWN_S` in `src/game/engine.ts`; `DRIFT_AMPLITUDE` and `DRIFT_PERIOD_S` in `src/game/grid.ts`.

### Classic rules

`?rules=classic` runs the game as it was before the redesign: shots hit whatever cell is under them when they arrive, every miss costs a shield, arming also sets the range, the grid sways and flak falls in every sector, the mission timer and leaderboard return, hints cost 1:00 (`HINT_PENALTY_MS`), and the original hint text (`classicHints` in the round data) and messages come back. A `CLASSIC RULES` flag shows in the grid footer. Only classic runs are recorded on the leaderboard. `src/game/ruleset.ts` holds the switch; retiring classic means deleting the `REDESIGN` checks and the `classicHints` fields.
