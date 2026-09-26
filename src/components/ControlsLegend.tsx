import { Key } from './Key';

export function ControlsLegend({ onClose }: { onClose: () => void }) {
  return (
    <div className="legend-backdrop" onClick={onClose}>
      <div className="legend" role="dialog" aria-labelledby="legend-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="legend-title">CONTROLS</h2>
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
          free hint. Consecutive misses lock the cannon for 2, 5, then 10 seconds. Requested hints take 15, 25, then 40
          seconds to decrypt. Lose all 6 shields and systems reboot for 10 seconds, but you keep your hints and scans.
        </p>
        <button type="button" onClick={onClose}>
          CLOSE (ESC)
        </button>
      </div>
    </div>
  );
}
