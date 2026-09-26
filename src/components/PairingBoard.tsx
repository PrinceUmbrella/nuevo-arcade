import { useEffect, useRef, useState, type DragEvent } from 'react';
import { COORD_LABEL, formatCoord } from '../game/grid';
import { REDESIGN } from '../game/ruleset';
import type { BoardState } from '../game/state';
import type { PairingBoard as BoardConfig } from '../game/types';
import { useDialogFocus } from '../hooks/useDialogFocus';

type Kind = 'col' | 'row';

interface Props {
  config: BoardConfig;
  state: BoardState;
  onPlace: (kind: Kind, card: number, slot: number | null) => void;
  onValue: (kind: Kind, card: number, value: string) => void;
  onClose: () => void;
}

const MAP_CELL = 40;
const MAP_SIZE = MAP_CELL * 8;
const label = (kind: Kind, card: number) => `${kind === 'col' ? 'C' : 'R'}${card + 1}`;
const DRAG_TYPE = 'application/x-constellation-card';

/** Sector 2: drag clue cards into W positions; the mini-map plots the numbers the team wrote. */
export function PairingBoard({ config, state, onPlace, onValue, onClose }: Props) {
  const [selected, setSelected] = useState<{ kind: Kind; card: number } | null>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  useDialogFocus(closeRef, REDESIGN);

  const closeHelp = () => {
    setHelpOpen(false);
    requestAnimationFrame(() => helpButtonRef.current?.focus());
  };

  const slotOf = (kind: Kind, card: number) => (kind === 'col' ? state.colSlots : state.rowSlots).indexOf(card);
  const valueOf = (kind: Kind, card: number | null) =>
    card === null ? '' : (kind === 'col' ? state.colValues : state.rowValues)[card];

  const place = (kind: Kind, card: number, slot: number | null) => {
    onPlace(kind, card, slot);
    setSelected(null);
  };

  const onDrop = (kind: Kind, slot: number) => (e: DragEvent) => {
    e.preventDefault();
    try {
      const data = JSON.parse(e.dataTransfer.getData(DRAG_TYPE)) as { kind: Kind; card: number };
      if (data.kind === kind) place(kind, data.card, slot);
    } catch {
      // Not one of our cards.
    }
  };

  const points = Array.from({ length: config.slots }, (_, i) => {
    const x = Number(valueOf('col', state.colSlots[i]));
    const y = Number(valueOf('row', state.rowSlots[i]));
    return x >= 1 && x <= 8 && y >= 1 && y <= 8 ? { i, x, y } : null;
  });
  const toMap = (x: number, y: number) => [(x - 0.5) * MAP_CELL, MAP_SIZE - (y - 0.5) * MAP_CELL] as const;
  const segments = points.flatMap((p, i) => {
    const q = points[i + 1];
    return p && q ? [[toMap(p.x, p.y), toMap(q.x, q.y)] as const] : [];
  });

  // Redesign: W positions run left to right, so the column numbers must climb. Flags a mirrored or
  // shuffled W without saying which card is the interference.
  const colNumbers = state.colSlots.map((c) => Number(valueOf('col', c)));
  const colsNumbered = colNumbers.every((v) => v >= 1 && v <= 8);
  const colsOutOfOrder = REDESIGN && colsNumbered && colNumbers.some((v, i) => i > 0 && v <= colNumbers[i - 1]);

  const plotted = points.filter(Boolean).length;

  const unusedCols = config.columnCards.map((_, c) => c).filter((c) => slotOf('col', c) === -1);
  const allColsPlaced = state.colSlots.every((c) => c !== null);

  const renderCard = (kind: Kind, text: string, card: number) => {
    const slot = slotOf(kind, card);
    const isSelected = selected?.kind === kind && selected.card === card;
    return (
      <li
        key={card}
        className={`clue-card ${kind} ${slot >= 0 ? 'placed' : ''} ${isSelected ? 'selected' : ''}`}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ kind, card }));
          e.dataTransfer.effectAllowed = 'move';
        }}
        onClick={() => setSelected(isSelected ? null : { kind, card })}
      >
        <span className="card-label">{label(kind, card)}</span>
        <span className="card-text">{text}</span>
        <span className="card-value" onClick={(e) => e.stopPropagation()}>
          =
          <input
            aria-label={`Value of ${label(kind, card)}`}
            inputMode="numeric"
            maxLength={1}
            value={valueOf(kind, card)}
            onChange={(e) => onValue(kind, card, e.target.value)}
            onDragStart={(e) => e.preventDefault()}
          />
        </span>
        {slot >= 0 && <span className="card-slot">IN POSITION {slot + 1}</span>}
      </li>
    );
  };

  const renderZone = (kind: Kind, slot: number) => {
    const card = kind === 'col' ? state.colSlots[slot] : state.rowSlots[slot];
    const armed = selected?.kind === kind;
    return (
      <button
        type="button"
        className={`drop-zone ${kind} ${card !== null ? 'filled' : ''} ${armed ? 'ready' : ''}`}
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDrop(kind, slot)}
        onClick={() => {
          if (selected?.kind === kind) place(kind, selected.card, slot);
          else if (card !== null) place(kind, card, null);
        }}
        aria-label={`Position ${slot + 1} ${kind === 'col' ? 'column' : 'row'}${card !== null ? `: ${label(kind, card)}` : ''}`}
      >
        {card === null ? (
          <span className="zone-empty">{kind === 'col' ? 'COLUMN' : 'ROW'}</span>
        ) : (
          <>
            <span className="zone-card">{label(kind, card)}</span>
            <span className="zone-value">{valueOf(kind, card) || '?'}</span>
          </>
        )}
      </button>
    );
  };

  return (
    <div className="pairing-backdrop" role="dialog" aria-labelledby="pairing-title">
      <div className="pairing">
        <header className={REDESIGN ? 'pairing-head with-help' : 'pairing-head'} inert={helpOpen}>
          <h2 id="pairing-title">PAIRING BOARD</h2>
          {REDESIGN ? (
            <ol className="board-steps">
              <li>Write each card&apos;s number</li>
              <li>Put a column card and a row card in each position</li>
              <li>Type the {COORD_LABEL} it shows into ARM TARGET</li>
            </ol>
          ) : (
            <p>
              Write each card&apos;s number, then drag cards into W positions (or click a card, then a slot). Click a
              filled slot to take its card back.
            </p>
          )}
          {REDESIGN && (
            <button type="button" className="pairing-help-btn" ref={helpButtonRef} onClick={() => setHelpOpen(true)}>
              ? HOW IT WORKS
            </button>
          )}
          <button type="button" className="pairing-close" ref={closeRef} onClick={onClose}>
            BACK TO GRID (ESC)
          </button>
        </header>

        <div className="pairing-body" inert={helpOpen}>
          <section className="card-pool" aria-label="Column stream">
            <h3>COLUMN STREAM</h3>
            <ul>{config.columnCards.map((t, i) => renderCard('col', t, i))}</ul>
          </section>
          <section className="card-pool" aria-label="Row stream">
            <h3>ROW STREAM</h3>
            <ul>{config.rowCards.map((t, i) => renderCard('row', t, i))}</ul>
          </section>

          <section className="pairing-side">
            <h3>W POSITIONS, LEFT TO RIGHT</h3>
            <ol className="slots">
              {Array.from({ length: config.slots }, (_, i) => (
                <li key={i} className={REDESIGN ? 'slot with-coord' : 'slot'}>
                  <span className="slot-num">{i + 1}</span>
                  {renderZone('col', i)}
                  {renderZone('row', i)}
                  {REDESIGN && <SlotCoord point={points[i]} />}
                </li>
              ))}
            </ol>

            <h3>
              PREVIEW{REDESIGN && <small className="preview-axes">ROW ↑ · COL →</small>}
            </h3>
            {REDESIGN && (
              <p className={plotted === config.slots ? 'preview-status ready' : 'preview-status'}>
                {plotted === config.slots
                  ? `All ${config.slots} positions plotted. Compare the shape with the orbital notes.`
                  : `Dots: ${plotted} of ${config.slots}. A position gets a dot once it has a column card and a row card, and both have numbers.`}
              </p>
            )}
            <svg
              className="mini-map"
              viewBox={REDESIGN ? `-30 -2 ${MAP_SIZE + 32} ${MAP_SIZE + 32}` : `-2 -2 ${MAP_SIZE + 4} ${MAP_SIZE + 4}`}
              role="img"
              aria-label="Preview of your pairs"
            >
              {REDESIGN &&
                Array.from({ length: 8 }, (_, i) => (
                  <g key={`axis${i}`} className="mini-axis">
                    <text x={-14} y={MAP_SIZE - (i + 0.5) * MAP_CELL + 5}>
                      {i + 1}
                    </text>
                    <text x={(i + 0.5) * MAP_CELL} y={MAP_SIZE + 22}>
                      {i + 1}
                    </text>
                  </g>
                ))}
              {Array.from({ length: 9 }, (_, i) => (
                <g key={i}>
                  <line x1={i * MAP_CELL} y1={0} x2={i * MAP_CELL} y2={MAP_SIZE} />
                  <line x1={0} y1={i * MAP_CELL} x2={MAP_SIZE} y2={i * MAP_CELL} />
                </g>
              ))}
              {segments.map(([[x1, y1], [x2, y2]], i) => (
                <line key={`s${i}`} className={colsOutOfOrder ? 'mini-seg bad' : 'mini-seg'} x1={x1} y1={y1} x2={x2} y2={y2} />
              ))}
              {points.map((p) => {
                if (!p) return null;
                const [cx, cy] = toMap(p.x, p.y);
                return (
                  <g key={`p${p.i}`}>
                    <circle className="mini-star" cx={cx} cy={cy} r={9} />
                    <text className="mini-label" x={cx} y={cy + 4}>
                      {p.i + 1}
                    </text>
                  </g>
                );
              })}
            </svg>
            <p className={colsOutOfOrder ? 'pairing-foot warn' : 'pairing-foot'} aria-live="polite">
              {colsOutOfOrder
                ? 'Columns should go up from position 1 (left) to position 5 (right).'
                : allColsPlaced
                  ? `Left over: ${unusedCols.map((c) => label('col', c)).join(', ')}. Is that the interference?`
                  : 'The preview plots the numbers you wrote. It cannot tell you if they are right.'}
            </p>
          </section>
        </div>
        {helpOpen && <BoardHelp onClose={closeHelp} />}
      </div>
    </div>
  );
}

/**
 * Made-up cards for the help window's demo. Nothing here comes from the real puzzle. Streams are
 * listed out of order on purpose, so the demo shows cards being picked, not just taken top-down.
 */
const DEMO_COLS = [
  { text: 'Sides on a triangle', value: 3 },
  { text: 'Fingers on one hand', value: 5 },
  { text: 'Horns on a unicorn', value: 1 },
];
const DEMO_ROWS = [
  { text: 'Wheels on a tricycle', value: 3 },
  { text: 'Legs on a dog', value: 4 },
  { text: 'Noses on a face', value: 1 },
];
/** Which column card and row card (by stream index) go into positions 1, 2 and 3. */
const DEMO_PAIRS: [number, number][] = [
  [2, 1],
  [0, 2],
  [1, 0],
];
const DEMO_CELL = 28;
const DEMO_SIZE = 5;
/** Per position: pick column card, drop it, pick row card, drop it, plot the dot. */
const DEMO_SUBSTEPS = 5;
const DEMO_TICKS = DEMO_PAIRS.length * DEMO_SUBSTEPS;
/** The last tick holds the finished picture before the loop restarts. */
const DEMO_HOLD = DEMO_TICKS;
const demoTickMs = (tick: number) => (tick === DEMO_HOLD ? 3400 : tick % DEMO_SUBSTEPS === 4 ? 1700 : 1000);

/**
 * Redesign: the board's rules, shown on request. Uses made-up cards (tricycle wheels, bird legs)
 * so it teaches the mechanics without touching this puzzle's answers.
 */
function BoardHelp({ onClose }: { onClose: () => void }) {
  const okRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    okRef.current?.focus();
    // Capture Esc before the app-wide handler, which would close the whole board.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div className="board-help" role="dialog" aria-modal="true" aria-labelledby="board-help-title">
      <h2 id="board-help-title">HOW THE PAIRING BOARD WORKS</h2>
      <div className="board-help-body">
        <ol className="board-help-steps">
          <li>Answer each card and type its number (1 to 8) in the box on the card.</li>
          <li>
            Give every W position one column card and one row card. Drag a card onto a position, or click the card and
            then the position. Click a filled position to take its card back.
          </li>
          <li>
            A position only gets a dot on the preview, and a {COORD_LABEL} to type, once it has both cards and both
            have numbers.
          </li>
          <li>Positions 1 to 5 run left to right across the W. The preview joins the dots in that order.</li>
          <li>There is one more column card than there are positions. The spare card stays in the stream.</li>
          <li>
            The preview only draws what you wrote. It can&apos;t tell you if an answer is right; firing at the star (or
            SCAN) is how you check.
          </li>
        </ol>

        <BoardDemo />
      </div>
      <button type="button" className="pairing-close" ref={okRef} onClick={onClose}>
        GOT IT (ESC)
      </button>
    </div>
  );
}

/** Redesign: the coordinate a W position becomes, in the same order the ARM TARGET box expects. */
function SlotCoord({ point }: { point: { x: number; y: number } | null }) {
  const coord = point ? formatCoord(point.x, point.y) : null;
  return (
    <span className={coord ? 'slot-coord ready' : 'slot-coord'} aria-label={coord ? `Type ${coord}` : 'Not ready yet'}>
      → {coord ?? '–'}
    </span>
  );
}

/**
 * Redesign help window: an animated walkthrough with made-up cards. Each position picks a column
 * card, writes its number, drops it in, does the same with a row card, then plots a dot and draws
 * the line from the last one. Loops, can be paused, and holds still under reduced motion.
 */
function BoardDemo() {
  const [reducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [tick, setTick] = useState(reducedMotion ? DEMO_HOLD : 0);
  const [paused, setPaused] = useState(reducedMotion);

  useEffect(() => {
    if (paused) return;
    const id = window.setTimeout(() => setTick((t) => (t >= DEMO_HOLD ? 0 : t + 1)), demoTickMs(tick));
    return () => window.clearTimeout(id);
  }, [tick, paused]);

  const position = Math.min(Math.floor(tick / DEMO_SUBSTEPS), DEMO_PAIRS.length - 1);
  const sub = tick >= DEMO_HOLD ? DEMO_SUBSTEPS : tick % DEMO_SUBSTEPS;
  /** True once sub-step `s` of position `p` has started. */
  const reached = (p: number, s: number) => tick >= p * DEMO_SUBSTEPS + s;
  const active = (p: number, s: number) => tick === p * DEMO_SUBSTEPS + s;

  const colPos = (card: number) => DEMO_PAIRS.findIndex(([c]) => c === card);
  const rowPos = (card: number) => DEMO_PAIRS.findIndex(([, r]) => r === card);
  const point = (p: number) => ({ x: DEMO_COLS[DEMO_PAIRS[p][0]].value, y: DEMO_ROWS[DEMO_PAIRS[p][1]].value });
  const toMap = (x: number, y: number) => [(x - 0.5) * DEMO_CELL, (DEMO_SIZE - y + 0.5) * DEMO_CELL] as const;

  const [colCard, rowCard] = DEMO_PAIRS[position];
  const here = point(position);
  const caption =
    tick >= DEMO_HOLD
      ? 'The lines join the dots in position order, so you can check the shape against your clues.'
      : [
          `Write the column card's number: ${DEMO_COLS[colCard].text} = ${DEMO_COLS[colCard].value}.`,
          `Drop it into position ${position + 1}.`,
          `Write the row card's number: ${DEMO_ROWS[rowCard].text} = ${DEMO_ROWS[rowCard].value}.`,
          `Drop it into position ${position + 1} too.`,
          `Both cards are in, so dot ${position + 1} lands at row ${here.y}, column ${here.x}. Type ${formatCoord(here.x, here.y)}.`,
        ][sub];

  const renderCard = (kind: 'col' | 'row', card: number) => {
    const data = kind === 'col' ? DEMO_COLS[card] : DEMO_ROWS[card];
    const p = kind === 'col' ? colPos(card) : rowPos(card);
    const pick = kind === 'col' ? 0 : 2;
    const written = p >= 0 && reached(p, pick);
    const placed = p >= 0 && reached(p, pick + 1);
    const selected = p >= 0 && active(p, pick);
    return (
      <li key={card} className={`demo-card ${kind}${selected ? ' selected' : ''}${placed ? ' placed' : ''}`}>
        <span className="demo-label">{kind === 'col' ? 'C' : 'R'}{card + 1}</span>
        <span className="demo-text">{data.text}</span>
        <span className={written ? 'demo-value written' : 'demo-value'}>= {written ? data.value : ''}</span>
      </li>
    );
  };

  return (
    <figure
      className="board-help-example"
      role="img"
      aria-label="Animated example with made-up cards: pick a column card and a row card, write their numbers, drop them into a position, and a dot appears on the preview."
    >
      <figcaption>EXAMPLE (MADE-UP CARDS, NOT FROM THIS PUZZLE)</figcaption>
      <div className="demo" aria-hidden="true">
        <div className="demo-streams">
          <ul>{DEMO_COLS.map((_, i) => renderCard('col', i))}</ul>
          <ul>{DEMO_ROWS.map((_, i) => renderCard('row', i))}</ul>
        </div>

        <div className="demo-lower">
          <ol className="demo-slots">
            {DEMO_PAIRS.map(([c, r], p) => {
              const colIn = reached(p, 1);
              const rowIn = reached(p, 3);
              const plotted = reached(p, 4);
              const pt = point(p);
              return (
                <li key={p} className={p === position && tick < DEMO_HOLD ? 'demo-slot current' : 'demo-slot'}>
                  <span className="demo-slot-num">{p + 1}</span>
                  <span className={colIn ? 'demo-zone col filled' : 'demo-zone col'}>
                    {colIn ? `C${c + 1} ${DEMO_COLS[c].value}` : 'COL'}
                  </span>
                  <span className={rowIn ? 'demo-zone row filled' : 'demo-zone row'}>
                    {rowIn ? `R${r + 1} ${DEMO_ROWS[r].value}` : 'ROW'}
                  </span>
                  <span className={plotted ? 'demo-coord ready' : 'demo-coord'}>
                    → {plotted ? formatCoord(pt.x, pt.y) : '–'}
                  </span>
                </li>
              );
            })}
          </ol>

          <svg className="demo-map" viewBox={`-24 -4 ${DEMO_CELL * DEMO_SIZE + 28} ${DEMO_CELL * DEMO_SIZE + 28}`}>
            {Array.from({ length: DEMO_SIZE + 1 }, (_, i) => (
              <g key={i} className="demo-grid">
                <line x1={i * DEMO_CELL} y1={0} x2={i * DEMO_CELL} y2={DEMO_SIZE * DEMO_CELL} />
                <line x1={0} y1={i * DEMO_CELL} x2={DEMO_SIZE * DEMO_CELL} y2={i * DEMO_CELL} />
              </g>
            ))}
            {Array.from({ length: DEMO_SIZE }, (_, i) => (
              <g key={`a${i}`} className="mini-axis">
                <text x={-12} y={(DEMO_SIZE - i - 0.5) * DEMO_CELL + 5}>
                  {i + 1}
                </text>
                <text x={(i + 0.5) * DEMO_CELL} y={DEMO_SIZE * DEMO_CELL + 19}>
                  {i + 1}
                </text>
              </g>
            ))}
            {DEMO_PAIRS.map((_, p) => {
              if (p === 0 || !reached(p, 4)) return null;
              const [x1, y1] = toMap(point(p - 1).x, point(p - 1).y);
              const [x2, y2] = toMap(point(p).x, point(p).y);
              const length = Math.hypot(x2 - x1, y2 - y1);
              return (
                <line
                  key={`seg${p}`}
                  className="demo-seg"
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  style={{ strokeDasharray: length, strokeDashoffset: reducedMotion ? 0 : length }}
                />
              );
            })}
            {DEMO_PAIRS.map((_, p) => {
              if (!reached(p, 4)) return null;
              const [cx, cy] = toMap(point(p).x, point(p).y);
              return (
                <g key={`dot${p}`} className="demo-dot">
                  <circle className="mini-star" cx={cx} cy={cy} r={9} />
                  <text className="mini-label" x={cx} y={cy + 4}>
                    {p + 1}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
      <p className="demo-caption" aria-hidden="true">
        {caption}
      </p>
      <div className="demo-controls">
        <span className="demo-note">Your clues decide which cards pair up. The demo just picks some.</span>
        <button
          type="button"
          className="demo-toggle"
          onClick={() => {
            if (tick >= DEMO_HOLD && paused) setTick(0);
            setPaused((v) => !v);
          }}
        >
          {paused ? '▶ PLAY' : '❚❚ PAUSE'}
        </button>
      </div>
    </figure>
  );
}
