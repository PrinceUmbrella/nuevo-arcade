import { useLayoutEffect, useRef, type RefObject } from 'react';

/**
 * Moves focus into a dialog when it opens and hands it back when it closes. Focus only returns
 * to text fields: returning it to a button would let the next SPACE (fire) click that button.
 */
export function useDialogFocus(target: RefObject<HTMLElement | null>, enabled: boolean) {
  const previous = useRef<Element | null>(null);
  // Layout effect: the content behind the dialog turns inert in this same commit, and the browser
  // moves focus off it before the next paint, so the opener has to be read now.
  useLayoutEffect(() => {
    if (!enabled) return;
    // Kept across StrictMode's mount/unmount/mount so the real opener isn't replaced by our own button.
    if (previous.current === null) previous.current = document.activeElement;
    const dialogNode = target.current;
    dialogNode?.focus();
    return () => {
      const opener = previous.current;
      // Deferred until the background is no longer inert. StrictMode's rehearsal unmount keeps the
      // dialog in the DOM, so a still-connected node means the dialog is actually still open.
      queueMicrotask(() => {
        if (dialogNode?.isConnected) return;
        if (opener instanceof HTMLInputElement && opener.isConnected && !opener.disabled) opener.focus();
        else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
      });
    };
  }, [target, enabled]);
}
