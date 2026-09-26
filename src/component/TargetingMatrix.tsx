import { useEffect, useRef } from 'react';
import { GameEngine, type EngineHandlers } from '../game/engine';

interface Props {
  /** Must be referentially stable — the engine is created once per handlers/onReady pair. */
  handlers: EngineHandlers;
  onReady: (engine: GameEngine | null) => void;
}

/** Hosts the 2D canvas game engine (aliens, cannon, stars, lines). */
export function TargetingMatrix({ handlers, onReady }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const engine = new GameEngine(canvasRef.current!, handlers);
    onReady(engine);
    return () => {
      engine.destroy();
      onReady(null);
    };
  }, [handlers, onReady]);

  return (
    <div className="matrix" onMouseDown={() => (document.activeElement as HTMLElement | null)?.blur()}>
      <canvas ref={canvasRef} aria-label="Targeting matrix, 8 by 8 grid of aliens" />
    </div>
  );
}
