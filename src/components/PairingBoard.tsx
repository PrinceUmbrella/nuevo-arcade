import { useRef, useState, type DragEvent } from 'react';
import { formatCoord } from '../game/grid';
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
  useDialogFocus(closeRef, REDESIGN);

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
        <header className="pairing-head">
          <h2 id="pairing-title">PAIRING BOARD</h2>
          <p>
            Write each card&apos;s number, then drag cards into W positions (or click a card, then a slot). Click a
            filled slot to take its card back.
          </p>
          <button type="button" className="pairing-close" ref={closeRef} onClick={onClose}>
            BACK TO GRID (ESC)
          </button>
        </header>

        <div className="pairing-body">
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
      </div>
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
