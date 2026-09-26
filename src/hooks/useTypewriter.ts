import { useEffect, useState } from 'react';

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Reveals `text` one character at a time; restarts whenever `text` changes. */
export function useTypewriter(text: string, msPerChar = 18) {
  const [progress, setProgress] = useState({ text, count: 0 });
  const instant = prefersReducedMotion();
  const count = instant ? text.length : progress.text === text ? progress.count : 0;

  useEffect(() => {
    if (instant) return;
    const id = window.setInterval(() => {
      setProgress((p) => {
        const current = p.text === text ? p.count : 0;
        if (current >= text.length) {
          window.clearInterval(id);
          return p.text === text ? p : { text, count: current };
        }
        return { text, count: current + 1 };
      });
    }, msPerChar);
    return () => window.clearInterval(id);
  }, [text, msPerChar, instant]);

  return { shown: text.slice(0, count), done: count >= text.length };
}
