import { useEffect, useState } from 'react';

/** Smallest window the kiosk layout stays readable in (half of the 1920×1080 stage, roughly). */
export const MIN_VIEWPORT_W = 1024;
export const MIN_VIEWPORT_H = 600;

const check = () => window.innerWidth < MIN_VIEWPORT_W || window.innerHeight < MIN_VIEWPORT_H;

/** True while the window is too small for the desktop-only game screen. */
export function useViewportTooSmall() {
  const [tooSmall, setTooSmall] = useState(check);
  useEffect(() => {
    const onResize = () => setTooSmall(check());
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return tooSmall;
}
