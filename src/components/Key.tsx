import type { ReactNode } from 'react';

type Dir = 'left' | 'right' | 'up' | 'down';
const ROTATION: Record<Dir, number> = { up: 0, right: 90, down: 180, left: 270 };

/** A keyboard key cap. Arrow keys use an authored SVG instead of Unicode arrows. */
export function Key({ children, arrow }: { children?: ReactNode; arrow?: Dir }) {
  return (
    <kbd className="key">
      {arrow ? (
        <svg viewBox="0 0 16 16" width="0.9em" height="0.9em" aria-label={`${arrow} arrow`} role="img">
          <path d="M8 2 L14 9 H10 V14 H6 V9 H2 Z" fill="currentColor" transform={`rotate(${ROTATION[arrow]} 8 8)`} />
        </svg>
      ) : (
        children
      )}
    </kbd>
  );
}
