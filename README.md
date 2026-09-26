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

Designed for a 1920×1080 screen; the layout scales to fit other window sizes.

### Screens

| URL | What it's for |
| --- | --- |
| `/` | The game (kiosk screen) |
| `/?view=navigator` | Sector 3 beacon clues for the Navigator's phone or tablet (needs `npm run dev:lan`, then open the Network address it prints) |

The navigator view follows the live sector when it runs on the same computer (it says STAND BY until Sector 3). On another device it just shows the clues, so hand it over at Sector 3, or print them.

## How it plays

A crew enters its team name in the lobby and starts the mission. Three sectors (Orion's Belt, Cassiopeia, and a classified third). Players decode clues into (X, Y) cells and shoot only those aliens. X counts left to right, Y counts bottom to top (Y = 1 is the bottom row). The grid sways left and right, so shots need timing; the labels sway with it.

Every alien hides a letter, shown only when it is hit or SCANned. The correct stars spell each sector's key fragment. The master key is **MAP-STARS-POLARIS**.

1. **Orion's Belt (tutorial).** One star is given by facts; the other two each lose a coordinate. After the first hit, players can drag a guide line from a star to find the rest of the belt.
2. **Cassiopeia.** A pairing board: drag randomized column and row clue cards into five W positions and write each card's number. The mini-map plots dots as the team works, then draws the connecting lines once all five pairs are filled. One column card is interference, and a decoy cell waits where it lands.
3. **Unknown sector (Big Dipper).** Clues are on the Navigator device only; the Gunner fires in sequence as the Navigator reads. The stars spell POLARIS, the team names the constellation, then the POLARIS mothership crosses the top. It only counts when shot over column 1, where the Pointer stars aim.

The full answer key is in the comment at the top of `src/data/constellations.ts`.

- A wrong, decoy, or out-of-sequence hit costs one shield. Consecutive misses lock firing for 2, 5, then 10 seconds. A correct hit resets the streak.
- SCAN (3 per sector) says whether the armed cell is in the constellation and reveals its letter.
- Requested hints decrypt for 15, 25, then 40 seconds. The game remains playable during the wait. Every 3 misses unlocks a free hint immediately.
- Losing all 6 shields starts a 10-second systems reboot before restarting the current sector. Hints, scans and the pairing board are kept.
- The mission timer stays hidden during play and appears on the victory screen.

### Player controls

| Key | Action |
| --- | --- |
| Left / Right or A / D | Move cannon |
| Up / Down or W / S | Set range (the row a shot detonates on) |
| Space | Fire |
| ARM TARGET box + Enter | Highlight a cell and set range |
| SCAN | Check the armed cell and reveal its letter (3 per sector) |
| ? | Controls legend |
| Esc | Close the legend or the pairing board |

### Staff controls (keep these quiet)

| Key | Action |
| --- | --- |
| Shift+R | Full reset back to the lobby |
| Shift+N | Skip to the next sector (awards its key fragment) |
| Shift+H | Toggle the target overlay (numbered in firing order; decoys marked D) |
| Shift+V | Show the Navigator clues on the main screen (no second device) |
| Shift+C | Cancel the active weapon cooldown and finish any active hint decrypt |

## Customizing

All puzzle content lives in `src/data/constellations.ts` (targets, letters, lines, clues, board cards, decoys, hints, accepted names, finale). Tuning constants: `MAX_WRONG_HITS`, `MAX_SCANS`, `MISS_COOLDOWN_MS`, `HINT_DECRYPT_MS`, and `REBOOT_MS` in `src/game/state.ts`; `DRIFT_AMPLITUDE` and `DRIFT_PERIOD_S` in `src/game/grid.ts`.
