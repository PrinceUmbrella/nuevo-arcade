import { useEffect, useRef } from 'react';
import { GameEngine, type EngineHandlers } from '../game/engine';
import { REDESIGN } from '../game/ruleset';

interface Props {
  /** Must be referentially stable — the engine is created once per handlers/onReady pair. */
  handlers: EngineHandlers;
  onReady: (engine: GameEngine | null) => void;
  /** Cells can be clicked to pencil-mark them (redesign rules). Shows a crosshair cursor. */
  markable?: boolean;
}

/** Hosts the 2D canvas game engine (aliens, cannon, stars, lines). */
export function TargetingMatrix({ handlers, onReady, markable = false }: Props) {
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
    <div className={markable ? 'matrix markable' : 'matrix'} onMouseDown={() => (document.activeElement as HTMLElement | null)?.blur()}>
      <canvas
        ref={canvasRef}
        aria-label={REDESIGN ? 'Targeting matrix, 8 by 8 grid of Nuvi robots' : 'Targeting matrix, 8 by 8 grid of aliens'}
      />
    </div>
  );
}
