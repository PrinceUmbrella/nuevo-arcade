import { useRef } from 'react';
import { REDESIGN } from '../game/ruleset';
import { MAX_MARKS, MAX_SCANS, MAX_WRONG_HITS } from '../game/state';
import { useDialogFocus } from '../hooks/useDialogFocus';
import { Key } from './Key';

export function ControlsLegend({ onClose }: { onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(closeRef, REDESIGN);
  return (
    <div className="legend-backdrop" onClick={onClose}>
      <div
        className={REDESIGN ? 'legend compact' : 'legend'}
        role="dialog"
        aria-modal={REDESIGN || undefined}
        aria-labelledby="legend-title"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="legend-title">CONTROLS</h2>
        {REDESIGN ? <RedesignControls /> : <ClassicControls />}
        <button type="button" ref={closeRef} onClick={onClose}>
          CLOSE (ESC)
        </button>
      </div>
    </div>
  );
}

function RedesignControls() {
  return (
    <>
      <dl>
        <dt>ARM TARGET</dt>
        <dd>Type X,Y and press Enter. The cannon only fires at this cell</dd>
        <dt>
          <Key arrow="left" />
          <Key arrow="right" /> or <Key>A</Key>
          <Key>D</Key>
        </dt>
        <dd>Move the cannon under the target&apos;s column</dd>
        <dt>
          <Key arrow="up" />
          <Key arrow="down" /> or <Key>W</Key>
          <Key>S</Key>
        </dt>
        <dd>Set the row (Y) the shot detonates on</dd>
        <dt>
          <Key>SPACE</Key>
        </dt>
        <dd>Fire on LOCK. Without LOCK the shot is deflected: no shield lost, short cooldown</dd>
        <dt>SCAN</dt>
        <dd>Is the armed cell in the constellation? Also shows its hidden letter. {MAX_SCANS} per sector</dd>
        <dt>MARK</dt>
        <dd>Click a cell or type M X,Y to pencil-mark it (up to {MAX_MARKS}). M CLEAR removes all</dd>
        <dt>
          <Key>?</Key>
        </dt>
        <dd>Show or hide this legend</dd>
      </dl>
      <p>
        X counts left to right. Y counts bottom to top. <b>Y = 1 is the bottom row.</b>
      </p>
      <p>
        Every Nuvi hides a letter, and the right stars spell a word. Hitting a cell that isn&apos;t in the
        constellation costs one shield, and every 3 misses unlocks the next hint. Hints are free and there&apos;s no
        clock, but the last hint in each sector gives a star away, so it unlocks only after a wrong answer. Lose all{' '}
        {MAX_WRONG_HITS} shields and the sector restarts, but you keep your hints, scans, and marks.
      </p>
    </>
  );
}

function ClassicControls() {
  return (
    <>
      <dl>
        <dt>
          <Key arrow="left" />
          <Key arrow="right" /> or <Key>A</Key>
          <Key>D</Key>
        </dt>
        <dd>Move the cannon</dd>
        <dt>
          <Key arrow="up" />
          <Key arrow="down" /> or <Key>W</Key>
          <Key>S</Key>
        </dt>
        <dd>Set range: the row (Y) your shot detonates on</dd>
        <dt>
          <Key>SPACE</Key>
        </dt>
        <dd>Fire. The grid sways, so time your shot</dd>
        <dt>ARM TARGET</dt>
        <dd>Type X,Y and press Enter to light up a cell and set your range</dd>
        <dt>SCAN</dt>
        <dd>Is the armed cell in the constellation? Also shows its hidden letter. 3 per sector</dd>
        <dt>
          <Key>?</Key>
        </dt>
        <dd>Show or hide this legend</dd>
      </dl>
      <p>
        X counts left to right. Y counts bottom to top. <b>Y = 1 is the bottom row.</b>
      </p>
      <p>
        Every alien hides a letter. The right stars spell a word. A wrong hit costs one shield; every 3 misses unlocks a
        free hint. Requested hints add 1:00. Lose all 6 shields and the sector restarts, but you keep your hints and scans.
      </p>
    </>
  );
}
