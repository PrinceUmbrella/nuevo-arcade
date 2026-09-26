# First-time player UI report

Method: dual-agent (A: ca1e4c38-d261-4eb5-9c0b-ba16de0b66c4 · B: 41d65b02-ac52-42cf-9354-45f0bdb8ed47)

Tested on September 26, 2026 against the local development build. The playthrough started with no knowledge of the rules, answers, controls, or source code. It covered the lobby, mission start, controls help, target entry, scanning, firing, hints, keyboard use, and a 390 by 844 mobile viewport.

## Bottom line

The game explains the puzzle premise well, but it does not teach the shooting mechanic well enough. A new player can solve a coordinate correctly, confirm it with SCAN, and still lose shields without understanding why. That is the main point where the game stops feeling challenging and starts feeling unreliable.

The first sector currently teaches too many things at once: coordinate orientation, astronomy clues, constellation patterns, target arming, vertical range, cannon movement, grid sway, shot timing, scans, shields, hints, and a running clock. The UI needs a short, safe firing tutorial before those systems all become consequential.

## Observed first-time journey

| Step | What happened | Likely player interpretation |
|---|---|---|
| Lobby | The mission premise and three-sector goal were clear. Starting with a blank crew name appeared to start the timer while leaving the lobby visible. | The Start button or form may be broken. |
| Controls | The footer showed arrows, `SPACE`, and `?`. The Controls dialog was useful but dense, and the timer kept running while it was read. | Learning the rules already hurts the score. |
| Coordinate solving | The first clue produced a plausible `(3,5)` answer. | The puzzle itself feels fair and satisfying. |
| Arming and scanning | Arming `(3,5)` highlighted the cell and SCAN confirmed membership and revealed `M`. | The target is now fully aimed and ready to fire. |
| Firing | Firing caused `TELEMETRY DESYNC` and removed a shield. Moving twice and trying again still missed. | The game rejected a correct answer for an unexplained reason. |
| Hint | Requesting a hint added one minute, but the hint repeated the visible "straight line, even steps" clue. | The player paid for information they already had. |
| Mobile | The whole 1920 by 1080 stage shrank into a 390 by 219 area. Text fell to roughly 3 to 15 pixels and controls became untappable. | The game is not playable on a phone. |

## Where players may get stuck

### P0: A correct target does not lead to a predictable shot

`ARM TARGET` highlights the cell and sets the row, but it does not move the cannon to the target column. Nothing makes that distinction clear enough. The wording strongly suggests the weapon is ready.

The first shot should be a guided, consequence-free tutorial:

1. Freeze the grid sway.
2. Highlight the armed column, current cannon column, and selected row.
3. Draw or animate the expected projectile path.
4. Tell the player, "Target armed. Move the cannon to column 3, then fire."
5. Do not remove a shield for mistakes during this tutorial.
6. After the hit, enable sway and explain timing in one short message.

An alignment indicator would also help after the tutorial. For example: `COLUMN ALIGNED`, `RANGE LOCKED`, and `FIRE WINDOW OPEN`.

### P1: The opening sector has too much concurrent learning

The player must learn the puzzle and the arcade controls under leaderboard pressure. Keep the first clue-solving task, but reveal mechanics in stages:

1. Solve and enter one coordinate.
2. Teach movement and range with a frozen grid.
3. Fire one safe shot.
4. Introduce sway.
5. Introduce SCAN, shields, hints, and penalties only when each becomes relevant.

Put `Y = 1 IS THE BOTTOM ROW` beside the grid until the first successful hit. Do not make the player remember it from a modal.

### P1: Miss feedback names the failure but not the correction

`TELEMETRY DESYNC` fits the fiction, but it does not help a new player recover. Keep the themed heading and add plain guidance below it:

> TELEMETRY DESYNC  
> Target row was set, but the cannon was not under column 3. Move horizontally before firing.

After a correct SCAN followed by a miss, the game has enough context to provide this message automatically.

### P1: Help competes with the clock

The timer should pause while the Controls dialog or first-run instructions are open. The first opening could happen automatically after the crew starts, with a clear `BEGIN SECTOR` action that starts or resumes the clock.

The Controls dialog also needs proper modal focus. When it opened, focus stayed on the page body, and Tab moved to `START MISSION` behind the dialog. Move focus into the dialog, trap it there, restore focus on close, and keep Escape support.

### P2: Hints are not contextual enough

The tested hint repeated information already visible in the sector description. Before applying the one-minute penalty, preview the topic:

> Hint available: constellation spacing  
> Costs +01:00

Hints should react to the player's state. A correct scan followed by a miss needs control guidance, not another constellation clue. Consider separating free control help from penalized puzzle hints.

### P2: The `?` shortcut can appear broken

The advertised `?` shortcut does nothing while a text field has focus. The coordinate field receives focus during play, so this is a common state. Add a visible Controls button, or allow `?` to open help when the input is empty and no text selection is active.

### P2: Mobile scaling preserves layout but destroys usability

The app scales a desktop stage rather than adapting it. If phones are not intended for the main game, say so before mission start and provide a minimum viewport message. If phones should work, the game needs a separate compact layout with touch movement, range, fire, scan, and hint controls.

## Design health score

Scores run from 0, unusable, to 4, excellent.

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 3 | Most status updates are clear, but cannon alignment and firing readiness are not. |
| 2 | Match between system and real world | 2 | "Range," "armed," and "telemetry desync" hide ordinary aiming concepts. |
| 3 | User control and freedom | 2 | No visible pause, restart, undo, or abandon action during a mission. |
| 4 | Consistency and standards | 2 | "Arm target" sounds like complete weapon preparation, but only sets part of the aim. |
| 5 | Error prevention | 1 | The game allows an uninformed shot to consume a shield without a strong warning. |
| 6 | Recognition rather than recall | 1 | Coordinate direction, range, sway timing, and cannon position rely too much on memory. |
| 7 | Flexibility and efficiency | 2 | Keyboard movement works, but solved coordinates still require opaque timing. |
| 8 | Aesthetic and minimalist design | 2 | Strong visual identity, but the opening minute introduces too many systems. |
| 9 | Error recovery | 1 | Miss feedback does not explain how to correct the next shot. |
| 10 | Help and documentation | 2 | Help exists, but it is hidden behind `?`, dense, and read under a running timer. |
| **Total** |  | **18/40** | **The presentation is strong; first-shot comprehension is weak.** |

## What already works

- The CRT command-console look feels made for this game. The labels, typography, colors, and mission framing form a coherent identity.
- SCAN gives excellent feedback. It confirms constellation membership, reveals a letter, and updates the remaining allowance.
- Shields, target counts, penalties, the vault, and log messages update immediately and are easy to see on desktop.
- Disabled controls such as `SCAN ARM FIRST` explain prerequisites better than most of the firing flow.
- The desktop layout is stable and has no horizontal overflow at 1200 pixels.

## Persona risks

**Jordan, a first-time player.** Jordan will likely read `ARM TARGET` literally, fire after a correct scan, and assume the game is broken when a shield disappears. The recovery message does not teach the missing horizontal alignment step.

**Alex, an impatient player.** Alex will understand the coordinate puzzle quickly, then resent mandatory timing that can invalidate the solved answer. Repetitive penalized hints will feel punitive.

**Sam, a keyboard or screen-reader user.** Keyboard shortcuts exist, but the 8 by 8 grid is exposed as one generic region. Individual cells, cannon column, selected row, sway position, armed state, and hit results need usable semantics or live announcements.

## Accessibility and interaction findings

- The Controls dialog does not move or trap focus.
- The `?` help shortcut is ignored while typing fields have focus.
- The canvas is named, but its meaningful game state is not exposed as interactive or live semantic information.
- Focus outlines on the crew field and Start button are visible.
- Dense mission and telemetry text uses a line-height near 1.10. Increase it for easier reading.
- The 390 by 844 viewport produces text and targets far below practical reading and touch sizes.

## Automated UI scan

The source scan of `src/App.tsx` found no deterministic issues. The live browser scan reported 28 style findings across 23 elements:

| Rule | Count | Assessment |
|---|---:|---|
| Dark glow | 16 | Mostly intentional arcade styling. |
| AI color palette | 5 | Likely a false positive for the established terminal palette. |
| Tight leading | 4 | Credible. Mission and telemetry copy are too compressed. |
| Blinking cursor | 1 | Intentional terminal behavior. Respect reduced-motion settings. |
| Cramped padding | 1 | Likely false positive. The Hint button measured 44 pixels high. |
| Repeating stripes gradient | 1 | Intentional scanline treatment. |

The browser console had no runtime errors. It did show one unrelated Three.js deprecation warning for `THREE.Clock`.

## Recommended UI additions

| Priority | Addition | Purpose |
|---|---|---|
| P0 | Guided first shot with no shield loss | Teaches movement, range, alignment, and firing through action. |
| P0 | Cannon-to-target alignment indicator | Makes shot readiness visible instead of inferred. |
| P1 | Plain-language recovery text under themed errors | Tells players exactly how to correct a miss. |
| P1 | Pause timer during help and first-run teaching | Removes the penalty for learning. |
| P1 | Persistent coordinate orientation beside the grid | Prevents avoidable X and Y confusion. |
| P1 | Proper dialog focus management | Keeps keyboard users inside the active Controls dialog. |
| P2 | Context-aware hint routing | Separates control confusion from puzzle difficulty. |
| P2 | Visible Controls button | Prevents the `?` shortcut from being the only discovery path. |
| P2 | Desktop-only notice or a real mobile control layout | Avoids presenting an unusable scaled interface. |
| P2 | Screen-reader status region | Announces cannon column, range, armed cell, shields, and shot results. |

## Acceptance tests

1. Starting with an empty crew name shows an inline error and does not start the timer.
2. The first armed target triggers a guided shot that cannot consume a shield.
3. Arming `(3,5)` states what changed and tells the player that cannon column alignment is still required.
4. The UI exposes current cannon column, target column, selected row, and fire readiness without relying on animation alone.
5. A correct scan followed by a missed shot explains the exact alignment error.
6. Opening Controls pauses the timer, moves focus into the dialog, traps focus, and restores focus when closed.
7. A visible Controls button remains available when the coordinate input has focus.
8. Puzzle hints never repeat the currently visible clue as their only information.
9. Screen readers receive changes to cannon position, range, armed cell, shields, scans, and shot results.
10. At a 390 by 844 viewport, the game either supplies readable touch controls or blocks play with a clear desktop requirement.

## Questions for the team

- Is the main challenge constellation deduction or shot timing? The current interaction lets shot timing erase the player's success at solving the puzzle.
- Should a verified SCAN result allow direct firing, or should it at least remove the timing penalty for that cell?
- Is the main game intentionally desktop-only? The separate Navigator view suggests phones matter, but the main route currently looks available and then becomes unusable.
