import { useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Sparkles, Stars } from '@react-three/drei';
import * as THREE from 'three';

const nebulaVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const nebulaFragment = /* glsl */ `
  uniform float uTime;
  uniform vec3 uTint;
  uniform vec3 uDeep;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 6; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
    return v;
  }

  void main() {
    vec2 p = vUv * vec2(3.2, 1.8);
    float t = uTime * 0.015;
    float warp = fbm(p * 1.4 - vec2(t, t * 0.6));
    float n = fbm(p + vec2(t, -t * 0.5) + warp * 1.3);
    float n2 = fbm(p * 2.3 - vec2(t * 0.7, t) + warp);
    vec3 col = uTint * smoothstep(0.45, 0.95, n) * 0.85;
    col += uDeep * smoothstep(0.35, 0.9, n2) * 0.9;
    col += vec3(1.0) * pow(smoothstep(0.7, 1.0, n), 3.0) * 0.25;
    float vign = smoothstep(0.95, 0.15, length((vUv - 0.5) * vec2(1.2, 1.6)));
    gl_FragColor = vec4(col * vign * 0.6, 1.0);
  }
`;

function Nebula({ tint, motion }: { tint: string; motion: number }) {
  const material = useRef<THREE.ShaderMaterial>(null);
  const target = useMemo(() => new THREE.Color(), []);
  const [uniforms] = useState(() => ({
    uTime: { value: 0 },
    uTint: { value: new THREE.Color(tint) },
    uDeep: { value: new THREE.Color('#1b2a8a') },
  }));

  useFrame((_, dt) => {
    if (!material.current) return;
    const u = material.current.uniforms;
    u.uTime.value += dt * (0.2 + motion);
    target.set(tint);
    (u.uTint.value as THREE.Color).lerp(target, Math.min(1, dt * 1.5));
  });

  return (
    <mesh position={[0, 0, -40]}>
      <planeGeometry args={[180, 100]} />
      <shaderMaterial
        ref={material}
        vertexShader={nebulaVertex}
        fragmentShader={nebulaFragment}
        uniforms={uniforms}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        transparent
      />
    </mesh>
  );
}

function DriftingSky({ tint, motion }: { tint: string; motion: number }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ camera, clock }, dt) => {
    if (group.current) {
      group.current.rotation.y += dt * 0.006 * motion;
      group.current.rotation.x += dt * 0.002 * motion;
    }
    const t = clock.elapsedTime * motion;
    camera.position.x = Math.sin(t * 0.05) * 0.6;
    camera.position.y = Math.cos(t * 0.04) * 0.4;
    camera.lookAt(0, 0, -40);
  });
  return (
    <group ref={group}>
      <Stars radius={70} depth={60} count={7000} factor={4} saturation={0} fade speed={0.6 * motion} />
      <Sparkles count={70} scale={[40, 22, 20]} position={[0, 0, -15]} size={4} speed={0.25 * motion} color={tint} opacity={0.7} />
    </group>
  );
}

/** Full-screen 3D starfield + nebula rendered behind the whole UI. */
export function SpaceBackground({ tint, paused }: { tint: string; paused: boolean }) {
  const motion = useMemo(() => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0.05 : 1), []);
  return (
    <div className="space-bg" aria-hidden="true">
      <Canvas
        camera={{ position: [0, 0, 1], fov: 70, near: 0.1, far: 300 }}
        dpr={[1, 1.5]}
        gl={{ antialias: false, powerPreference: 'high-performance' }}
        frameloop={paused ? 'never' : 'always'}
      >
        <color attach="background" args={['#01020a']} />
        <Nebula tint={tint} motion={motion} />
        <DriftingSky tint={tint} motion={motion} />
      </Canvas>
    </div>
  );
}
