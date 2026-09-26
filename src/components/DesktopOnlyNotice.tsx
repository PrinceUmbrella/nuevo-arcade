import { MIN_VIEWPORT_H, MIN_VIEWPORT_W } from '../hooks/useViewportTooSmall';

/** Shown instead of the game on phones and small windows. The Navigator view is unaffected. */
export function DesktopOnlyNotice() {
  return (
    <div className="desktop-only" role="alert">
      <div className="desktop-only-box">
        <h1>DESKTOP ONLY</h1>
        <p>
          The Constellation Grid needs a screen at least {MIN_VIEWPORT_W}×{MIN_VIEWPORT_H}. Open it on the kiosk
          computer, or make this window larger.
        </p>
        <p className="desktop-only-nav">
          Navigator? Your clues are at{' '}
          <a href="/?view=navigator" target="_blank" rel="noopener noreferrer">
            {window.location.host}/?view=navigator
          </a>
          , which works on phones.
        </p>
      </div>
    </div>
  );
}
