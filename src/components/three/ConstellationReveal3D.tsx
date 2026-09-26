import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Line, Stars } from '@react-three/drei';
import { Bloom, EffectComposer } from '@react-three/postprocessing';
import * as THREE from 'three';
import type { Line2, LineSegments2 } from 'three-stdlib';
import type { Round } from '../../game/types';

const SPACING = 1.35;
const STAR_IN_START = 0.1;
const STAR_IN_STEP = 0.09;
const LINES_START = 0.8;
const LINES_DURATION = 1.4;
const SETTLE_START = 0.25;
const SETTLE_END = 2.8;

const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutBack = (t: number) => {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
};
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const STAR_COLOR = new THREE.Color(2.6, 2.8, 3.2);
const LINE_COLOR = new THREE.Color(0.3, 2.2, 2.8);

function RevealScene({ round }: { round: Round }) {
  const group = useRef<THREE.Group>(null);
  const starRefs = useRef<(THREE.Mesh | null)[]>([]);
  const lineRefs = useRef<(Line2 | LineSegments2 | null)[]>([]);
  const start = useRef<number | null>(null);

  const { base, depth } = useMemo(() => {
    const pts = round.targets.map(([x, y]) => new THREE.Vector3(x * SPACING, y * SPACING, 0));
    const centroid = pts.reduce((acc, p) => acc.add(p), new THREE.Vector3()).divideScalar(pts.length);
    pts.forEach((p) => p.sub(centroid));
    // Deterministic pseudo-random depth per star so the shape looks 3D before it settles.
    const d = pts.map((_, i) => Math.sin(i * 12.9898 + round.targets.length * 78.233) * 3.2);
    return { base: pts, depth: d };
  }, [round]);

  const current = useMemo(() => base.map((p) => p.clone()), [base]);

  useFrame(({ clock, camera }) => {
    if (start.current === null) start.current = clock.elapsedTime;
    const t = clock.elapsedTime - start.current;

    camera.position.z = THREE.MathUtils.lerp(30, 15, easeOutCubic(clamp01(t / 2.0)));
    camera.lookAt(0, 0, 0);

    const settle = easeInOut(clamp01((t - SETTLE_START) / (SETTLE_END - SETTLE_START)));
    if (group.current) {
      group.current.rotation.y = (1 - settle) * 1.1 + Math.sin(t * 0.6) * 0.04 * settle;
      group.current.rotation.x = (1 - settle) * -0.5;
      group.current.rotation.z = (1 - settle) * 0.25;
    }

    base.forEach((p, i) => {
      current[i].set(p.x, p.y, depth[i] * (1 - settle));
      const mesh = starRefs.current[i];
      if (!mesh) return;
      mesh.position.copy(current[i]);
      const appear = clamp01((t - (STAR_IN_START + i * STAR_IN_STEP)) / 0.5);
      const pulse = 1 + Math.sin(t * 4 + i) * 0.08;
      mesh.scale.setScalar(Math.max(0.0001, easeOutBack(appear)) * pulse);
    });

    const n = round.lines.length;
    round.lines.forEach(([a, b], k) => {
      const line = lineRefs.current[k];
      if (!line) return;
      const segP = clamp01(((t - LINES_START) / LINES_DURATION) * n - k);
      line.visible = segP > 0;
      if (!line.visible) return;
      const from = current[a];
      const to = current[b];
      line.geometry.setPositions([
        from.x,
        from.y,
        from.z,
        from.x + (to.x - from.x) * segP,
        from.y + (to.y - from.y) * segP,
        from.z + (to.z - from.z) * segP,
      ]);
    });
  });

  return (
    <group ref={group}>
      {base.map((_, i) => (
        <mesh key={`s${i}`} ref={(m) => void (starRefs.current[i] = m)} scale={0.0001}>
          <sphereGeometry args={[0.28, 24, 24]} />
          <meshBasicMaterial color={STAR_COLOR} toneMapped={false} />
        </mesh>
      ))}
      {round.lines.map((_, k) => (
        <Line
          key={`l${k}`}
          ref={(l) => void (lineRefs.current[k] = l)}
          points={[
            [0, 0, 0],
            [0, 0, 0.001],
          ]}
          color={LINE_COLOR}
          lineWidth={4}
          toneMapped={false}
          visible={false}
        />
      ))}
    </group>
  );
}

/** Full-screen 3D fly-in of the completed constellation. */
export function ConstellationReveal3D({ round }: { round: Round }) {
  return (
    <Canvas camera={{ position: [0, 0, 30], fov: 45 }} dpr={[1, 2]} gl={{ antialias: true }}>
      <color attach="background" args={['#00010a']} />
      <Stars radius={60} depth={40} count={4000} factor={3} saturation={0} fade speed={1.2} />
      <RevealScene round={round} />
      <EffectComposer>
        <Bloom intensity={1.4} luminanceThreshold={0.2} luminanceSmoothing={0.3} mipmapBlur />
      </EffectComposer>
    </Canvas>
  );
}
