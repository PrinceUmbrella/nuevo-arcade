/*
 * ============================================================================
 *  THE CONSTELLATION GRID - ROUND DATA
 * ============================================================================
 *  Everything about the three sectors is driven from the ROUNDS array below.
 *  To reuse the game next year, edit this file only:
 *
 *  - name / hiddenName  Sector title. With hiddenName: true the UI shows
 *                       "UNKNOWN SECTOR" and players must type the name.
 *  - alienColor         Any CSS color. Also tints the 3D nebula background.
 *  - targets            [X, Y] cells. X = column 1-8 LEFT to RIGHT,
 *                       Y = row 1-8 BOTTOM to TOP (Y = 1 is nearest the cannon).
 *                       With requireOrder: true this is also the firing order
 *                       (classic rules only; the redesign accepts any order).
 *                       Cells are always stored column first like this, but
 *                       players type and read them ROW FIRST (row,col) in the
 *                       redesign. Write any coordinate inside clue or hint
 *                       text as (row,col); ?rules=classic shows (X,Y) text
 *                       from classicClues / classicHints.
 *  - keyFragment        ONE LETTER PER TARGET, in targets order. Each alien
 *                       hides a letter, shown once it is hit or SCANned; the
 *                       stars spell the fragment. Cells touching a target
 *                       never show a fragment letter.
 *  - lines              [i, j] index pairs into `targets`, drawn in order.
 *  - clues              Sections of clue text shown in the log. Nothing checks
 *                       them against `targets`, so re-solve your own puzzle
 *                       after editing and make sure it has ONE answer.
 *  - classicClues       Optional. Original clue text for ?rules=classic.
 *  - decoys             Optional red-herring cells with their own letter.
 *                       Hitting one costs a shield like any miss.
 *  - requireOrder       Optional, classic rules only. Out-of-sequence hits
 *                       cost a shield. The redesign ignores it.
 *  - classicMissionText Optional. Original mission text for ?rules=classic.
 *  - guideLine          Optional. After the first star, players can drag a
 *                       guide line from a star on the grid (visual only).
 *  - board              Optional drag-and-drop pairing board: column and row
 *                       clue cards, dropped into `slots` W positions. Teams
 *                       write their own number on each card; the mini-map
 *                       plots those numbers, never the true answers.
 *  - navigatorOnly      Optional. Clues show only on ?view=navigator (a phone
 *                       or tablet). Staff can show them on screen with Shift+V.
 *  - finale             Optional. After naming the constellation, a mothership
 *                       crosses the top lane; it only counts over `column`.
 *  - cipher             Optional. Clue sections are shown Vigenere-encrypted
 *                       with `key` until players type the key. (Unused now.)
 *  - sway               Optional. Grid sway as a fraction of DRIFT_AMPLITUDE
 *                       (0 = still, 1 = full, the default).
 *  - flak               Optional. false stops aliens firing at the cannon.
 *                       Defaults to true. sway and flak are ignored with
 *                       ?rules=classic, which always uses full sway and flak.
 *  - hints              Revealed in order: free on request, or automatically
 *                       every 3 misses. There is no clock. Every hint must add
 *                       something the mission text, clues and board don't
 *                       already say, and hints 1-2 must never state a
 *                       coordinate or a card's value. They point at HOW to
 *                       think, not WHAT the answer is. The ladder used here:
 *                         1. trivia help: a memory hook for each fact, never
 *                            the number itself,
 *                         2. the reasoning step teams get stuck on, with no
 *                            numbers,
 *                         3. one star, never the whole constellation.
 *                       The LAST hint stays locked until the team makes a
 *                       wrong deduction in that sector (nextHintLocked in
 *                       state.ts). 6 misses in a sector
 *                       restarts it (MAX_WRONG_HITS in state.ts). Only a wrong
 *                       deduction counts as a miss; a shot fired without LOCK
 *                       is deflected and costs nothing but a short cooldown.
 *  - classicHints       Optional. The original hint text, shown only with
 *                       ?rules=classic (which also brings back the timer, the
 *                       +1:00 hint penalty and the leaderboard).
 *                       Delete these once the classic rules are retired.
 *  - acceptedNames      Answers accepted for hidden rounds. Case, spaces and
 *                       punctuation are ignored.
 *
 *  ANSWER KEY (staff), written as players type them: (row,col).
 *  With ?rules=classic players type (col,row), so swap each pair.
 *  Sector 1  Mintaka (5,3) M, Alnilam (4,4) A, Alnitak (3,5) P.
 *  Sector 2  Columns 1,2,4,6,7,8: notes 1-2 put the outer stars in 1 and 7,
 *            so 8 is interference. Rows 3-7 follow the height pattern.
 *            Segin (6,1) S, Ruchbah (4,2) T, Gamma Cas (5,4) A,
 *            Schedar (3,6) R, Caph (7,7) S. Decoy (7,8) X.
 *  Sector 3  Beacon trivia (redesign): rainbow colors 7, Earth's moons 1,
 *            seasons 4, atmosphere layers 5, pre-telescope planets 5,
 *            Perseverance wheels 6. None of it repeats Sectors 1-2.
 *            Firing order: Dubhe (7,1) P, Merak (5,1) O, Phecda (4,3) L,
 *            Megrez (6,3) A, Alioth (6,5) R, Mizar (5,6) I, Alkaid (4,8) S.
 *            The handle attaches at Megrez, as in the real sky. Decoy (7,8) Q.
 *            Finale: POLARIS mothership, hit while over column 1.
 *  Master key: MAP-STARS-POLARIS
 *  Final question (redesign): POLARIS is in URSA MINOR, the Little Dipper.
 * ============================================================================
 */
import type { Round } from '../game/types';

export const MASTER_KEY_SEPARATOR = '-';

/** Shown on the victory screen under the master key. */
export const VICTORY_LINE = 'The Pointers point north, to POLARIS. Master key assembled.';

/**
 * Redesign only: after the master key, the crew looks up one fact about it. Their answer is what
 * they take to the final terminal. Pick a fact that is stable and quick to search, and that the
 * game never states on screen. Matching ignores case, spaces and punctuation.
 */
export const FINAL_QUESTION = {
  prompt: 'The master key ends at POLARIS. Look it up: which constellation is POLARIS part of?',
  answer: 'URSA MINOR (THE LITTLE DIPPER)',
  accepted: ['URSA MINOR', 'LITTLE DIPPER', 'THE LITTLE DIPPER', 'LITTLE BEAR', 'THE LITTLE BEAR'],
  /** Answers that are close but wrong get this nudge instead of a plain "no". */
  nearMiss: {
    answers: ['URSA MAJOR', 'BIG DIPPER', 'THE BIG DIPPER', 'GREAT BEAR', 'THE GREAT BEAR', 'THE PLOUGH', 'PLOUGH'],
    reply: "That's the pattern you just mapped. POLARIS belongs to its smaller neighbor.",
  },
};

export const ROUNDS: Round[] = [
  {
    name: "ORION'S BELT",
    hiddenName: false,
    alienColor: '#39ff14',
    missionText:
      "Sector 1 firewall active. ORION'S BELT: three stars in a perfectly straight, evenly spaced line, running from upper-left to lower-right. Only part of the telemetry survived. Reconstruct the rest.",
    targets: [
      [3, 5],
      [4, 4],
      [5, 3],
    ],
    keyFragment: 'MAP',
    guideLine: true,
    // The tutorial sector holds still so teams can learn to aim before sway and flak arrive.
    sway: 0,
    flak: false,
    lines: [
      [0, 1],
      [1, 2],
    ],
    clues: [
      {
        heading: 'SURVIVING TELEMETRY',
        items: [
          "Signal A: The westernmost star (Mintaka). Row = number of IAU-recognized dwarf planets. Column = Earth's position from the Sun.",
          'Signal B: The easternmost star (Alnitak) sits in the column of the largest planet. Its row was lost.',
          'Signal C: The middle star (Alnilam) sits in the row matching the number of Galilean moons. Its column was lost.',
        ],
      },
    ],
    classicClues: [
      {
        heading: 'SURVIVING TELEMETRY',
        items: [
          "Signal A: The westernmost star (Mintaka). Column = Earth's position from the Sun. Row = number of IAU-recognized dwarf planets.",
          'Signal B: The easternmost star (Alnitak) sits in the column of the largest planet. Its row was lost.',
          'Signal C: The middle star (Alnilam) sits in the row matching the number of Galilean moons. Its column was lost.',
        ],
      },
    ],
    hints: [
      'Trivia help: count out from the Sun to find Earth. Pluto was moved into the IAU dwarf-planet group in 2006. The largest planet is the one with the Great Red Spot, and Galileo was the first to see its big moons.',
      '"Evenly spaced" means the middle star sits exactly halfway between the other two, in its row and in its column. Use that to fill in each lost number.',
      'Mintaka is (5,3). Follow the line from there.',
    ],
    classicHints: ['Straight line, even steps.', 'Mintaka is (3,5). Walk the line.', 'Alnilam is (4,4).'],
    acceptedNames: [],
  },
  {
    name: 'CASSIOPEIA',
    hiddenName: false,
    alienColor: '#b44cff',
    missionText:
      'Sector 2 firewall active. CASSIOPEIA is a "W" of five stars. Two unsorted streams arrived. One column reading is interference.',
    targets: [
      [1, 6],
      [2, 4],
      [4, 5],
      [6, 3],
      [7, 7],
    ],
    keyFragment: 'STARS',
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 4],
    ],
    decoys: [{ cell: [8, 7], letter: 'X' }],
    // Cards are deliberately shuffled: pairing them in print order gives wrong cells.
    board: {
      slots: 5,
      columnCards: [
        'Number of Apollo missions that landed humans on the Moon',
        "Neptune's position from the Sun",
        "Mercury's position from the Sun",
        "Uranus's position from the Sun",
        'Atomic number of helium',
        'Number of giant planets (gas + ice) in our solar system',
      ],
      rowCards: [
        'Number of Lagrange points in a two-body system',
        "Saturn's position from the Sun",
        'Number of astronauts on the Apollo 11 crew',
        "Number of sisters in the Pleiades' nickname",
        'Number of rocky (terrestrial) planets',
      ],
    },
    clues: [
      {
        heading: 'ORBITAL NOTES',
        ordered: true,
        items: [
          "The W's leftmost star sits in column 1.",
          "The rightmost star's column = the leftmost star's column + 6.",
          'Read left to right, the star heights go: second-highest, second-lowest, middle, lowest, highest.',
        ],
      },
    ],
    hints: [
      'Trivia help: the Apollo landings ran from Apollo 11 to 17, but one mission in that range turned back. "Giant planets" counts the gas giants and the ice giants together. Rocky planets are the ones inside the asteroid belt.',
      'Rank the five row numbers from lowest to highest. Note 3 is written in ranks, not row numbers, so swap each rank for the row number that holds it.',
      'Schedar is (3,6).',
    ],
    classicHints: [
      "One column number doesn't belong. Check note 2.",
      'Sort each stream, then use the height pattern.',
      'Schedar is (6,3).',
    ],
    acceptedNames: [],
  },
  {
    name: 'URSA MAJOR',
    hiddenName: true,
    alienColor: '#ffcc33',
    missionText:
      'Sector 3 firewall active. Identity CLASSIFIED. Seven beacons, and you can lock them in any order. Once the pattern forms, identify it.',
    classicMissionText:
      'FINAL FIREWALL. Sector identity CLASSIFIED. Seven beacons, listed in FIRING SEQUENCE. Out-of-sequence shots will be rejected. Once the pattern forms, identify it.',
    targets: [
      [1, 7],
      [1, 5],
      [3, 4],
      [3, 6],
      [5, 6],
      [6, 5],
      [8, 4],
    ],
    keyFragment: 'POLARIS',
    requireOrder: true,
    navigatorOnly: true,
    finale: { label: 'POLARIS', column: 1, pointers: [1, 0] },
    lines: [
      [0, 1],
      [1, 2],
      [2, 3],
      [3, 0],
      [3, 4],
      [4, 5],
      [5, 6],
    ],
    decoys: [{ cell: [8, 7], letter: 'Q' }],
    clues: [
      {
        heading: 'BEACONS',
        ordered: true,
        items: [
          'Row = number of colors in a rainbow. Column = number of moons Earth has.',
          'Directly below Beacon 1, two rows down. (Together they are called "the Pointers." Remember that.)',
          'In the row matching the number of seasons in a year, two columns right of Beacon 2.',
          'Directly above Beacon 3, two rows up. Beacons 1 through 4 close into a four-sided shape.',
          "In the same row as Beacon 4, in the column matching the number of major layers in Earth's atmosphere.",
          "A famous double star. Row = number of planets (besides Earth) people knew about before telescopes. Column = number of wheels on NASA's Perseverance rover.",
          "Two signals claim to be the final beacon: (4,8) and (7,8). The true one continues the tail's downward curve.",
        ],
      },
    ],
    classicClues: [
      {
        heading: 'BEACONS, IN FIRING SEQUENCE',
        ordered: true,
        items: [
          "Column = Mercury's position from the Sun. Row = number of planets not named Earth.",
          'Directly below Beacon 1, two rows down. (Together they are called "the Pointers." Remember that.)',
          'In the row matching the number of rocky planets, two columns right of Beacon 2.',
          "Directly above Beacon 3, in the row of Saturn's position. Beacons 1 through 4 close into a four-sided shape.",
          "In the same row as Beacon 4, in the column of Jupiter's position.",
          "A famous double star. Column = number of Uranus's five major moons, plus one. Row = number of IAU dwarf planets.",
          "Two signals claim to be the final beacon: (8,4) and (8,7). The true one continues the tail's downward curve.",
        ],
      },
    ],
    hints: [
      "Trivia help: the rainbow's colors spell out a name, ROY G. BIV. Earth's atmosphere runs from the troposphere up to the exosphere. Before telescopes, people only knew the planets bright enough to see by eye.",
      'For the final beacon, check whether the tail was rising or falling from Beacon 5 to Beacon 6. The true signal keeps going the same way. Finished, the shape looks like a kitchen ladle.',
      'Beacon 3 is (4,3).',
    ],
    classicHints: [
      'Beacons 1 to 4 make a box; the rest trail off like a handle.',
      "Fire in beacon order. Letters should spell a star's name.",
      'Beacon 3 is (3,4).',
    ],
    acceptedNames: ['URSA MAJOR', 'BIG DIPPER', 'THE BIG DIPPER', 'THE PLOUGH', 'GREAT BEAR'],
  },
];
