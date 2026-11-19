"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";

import { onBallReaction, play, type BallReaction } from "@/lib/feedback";

import { HEX_COUNT, HEX_FILL_ORDER, HEX_RADIUS, PANELS, PENT_RADIUS } from "./geometry";

export type BallTheme = "light" | "dark";

export type Football3DProps = {
  /** How many of the 20 hexagon panels are stitched in (the level progress). */
  filled: number;
  theme: BallTheme;
  /** Let people drag to spin and tap to kick. */
  interactive?: boolean;
  /** Lower-energy motion for small HUD balls. */
  compact?: boolean;
  reducedMotion?: boolean;
};

const PALETTE: Record<BallTheme, { base: string; pent: string; fill: string; rim: string; seam: string }> = {
  light: { base: "#f8f4ea", pent: "#1b1913", fill: "#e3a51f", rim: "#fff1cf", seam: "#2b261c" },
  dark: { base: "#eef1e6", pent: "#0d1912", fill: "#f5c542", rim: "#bfe3ff", seam: "#121c15" },
};

const vertexShader = /* glsl */ `
  varying vec3 vObj;
  varying vec3 vNormal;
  varying vec3 vView;
  void main() {
    vObj = normalize(position);
    vNormal = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vView = normalize(-mv.xyz);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uCenters[32];
  uniform float uFill[32];
  uniform float uFlash[32];
  uniform vec3 uBase;
  uniform vec3 uPent;
  uniform vec3 uFillColor;
  uniform vec3 uRim;
  uniform vec3 uSeam;
  uniform float uPentR;
  uniform float uHexR;
  varying vec3 vObj;
  varying vec3 vNormal;
  varying vec3 vView;

  void main() {
    float best = 1e9;
    float second = 1e9;
    int idx = 0;
    for (int i = 0; i < 32; i++) {
      float ang = acos(clamp(dot(vObj, uCenters[i]), -1.0, 1.0));
      float d = ang / (i < 12 ? uPentR : uHexR);
      if (d < best) { second = best; best = d; idx = i; }
      else if (d < second) { second = d; }
    }
    float gap = second - best;

    vec3 panel = uPent;
    float fill = 0.0;
    float flash = 0.0;
    for (int i = 0; i < 32; i++) {
      if (i == idx) { fill = uFill[i]; flash = uFlash[i]; }
    }
    if (idx >= 12) panel = mix(uBase, uFillColor, fill);
    panel = mix(panel, vec3(1.0), flash * 0.7);

    // Stitched seams, and a soft "pillow" so each panel bulges slightly.
    float seam = 1.0 - smoothstep(0.018, 0.05, gap);
    float pillow = mix(0.82, 1.0, smoothstep(0.0, 0.32, gap));
    vec3 color = mix(panel * pillow, uSeam, seam * 0.85);

    vec3 N = normalize(vNormal);
    vec3 L = normalize(vec3(-0.45, 0.75, 0.55));
    vec3 H = normalize(L + vView);
    float diff = max(dot(N, L), 0.0);
    float spec = pow(max(dot(N, H), 0.0), 60.0) * (1.0 - seam) * 0.45;
    float rim = pow(1.0 - max(dot(N, vView), 0.0), 2.6);

    vec3 lit = color * (0.42 + 0.7 * diff) + spec + uRim * rim * 0.55;
    gl_FragColor = vec4(lit, 1.0);
    #include <colorspace_fragment>
  }
`;

const shadowFragment = /* glsl */ `
  uniform float uOpacity;
  varying vec2 vUv;
  void main() {
    float d = length(vUv - 0.5) * 2.0;
    float a = smoothstep(1.0, 0.0, d);
    gl_FragColor = vec4(0.0, 0.0, 0.0, a * a * uOpacity);
  }
`;

const shadowVertex = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

/** Fill eases toward its target and the "just stitched" flash fades, once per frame. */
function easePanels(material: THREE.ShaderMaterial | null, target: number[], dt: number) {
  if (!material) return;
  const fills = material.uniforms.uFill.value as number[];
  const flashes = material.uniforms.uFlash.value as number[];
  for (let i = 0; i < fills.length; i++) {
    fills[i] += (target[i] - fills[i]) * Math.min(1, dt * 5);
    flashes[i] *= Math.exp(-dt * 3.5);
  }
}

const BASE_Y = -0.3;
const GRAVITY = -16;
const Y_AXIS = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const Z_AXIS = new THREE.Vector3(0, 0, 1);

type Motion = {
  spin: THREE.Vector2; // angular velocity around Y (x) and X (y), rad/s
  y: number;
  vy: number;
  wobble: number; // seconds since the last wobble started, or -1
  squash: number;
  dragging: boolean;
  dragDelta: THREE.Vector2;
};

function Ball({ filled, theme, compact, reducedMotion, interactive }: Football3DProps) {
  const mesh = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const material = useRef<THREE.ShaderMaterial>(null);
  const motion = useRef<Motion>({
    spin: new THREE.Vector2(0.35, 0.08),
    y: 0,
    vy: 0,
    wobble: -1,
    squash: 0,
    dragging: false,
    dragDelta: new THREE.Vector2(),
  });
  const { gl } = useThree();

  const uniforms = useMemo(() => {
    const p = PALETTE[theme];
    return {
      uCenters: { value: PANELS.map((v) => new THREE.Vector3(...v)) },
      uFill: { value: new Array(32).fill(0) as number[] },
      uFlash: { value: new Array(32).fill(0) as number[] },
      uBase: { value: new THREE.Color(p.base) },
      uPent: { value: new THREE.Color(p.pent) },
      uFillColor: { value: new THREE.Color(p.fill) },
      uRim: { value: new THREE.Color(p.rim) },
      uSeam: { value: new THREE.Color(p.seam) },
      uPentR: { value: PENT_RADIUS },
      uHexR: { value: HEX_RADIUS },
    };
    // Colours update in the effect below; the uniform objects live for the whole mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Uniforms are mutated through the material, outside React's render.
  useEffect(() => {
    const u = material.current?.uniforms;
    if (!u) return;
    const p = PALETTE[theme];
    u.uBase.value.set(p.base);
    u.uPent.value.set(p.pent);
    u.uFillColor.value.set(p.fill);
    u.uRim.value.set(p.rim);
    u.uSeam.value.set(p.seam);
  }, [theme]);

  // Target fill per panel, plus a white flash on panels that were just stitched in.
  const target = useRef<number[]>(new Array(32).fill(0));
  const lastFilled = useRef<number | null>(null);
  useEffect(() => {
    const count = Math.max(0, Math.min(HEX_COUNT, Math.round(filled)));
    const next = new Array(32).fill(0);
    HEX_FILL_ORDER.slice(0, count).forEach((hex) => (next[12 + hex] = 1));
    const flash = material.current?.uniforms.uFlash.value as number[] | undefined;
    if (flash && lastFilled.current !== null && count > lastFilled.current) {
      HEX_FILL_ORDER.slice(lastFilled.current, count).forEach((hex) => (flash[12 + hex] = 1));
    }
    lastFilled.current = count;
    target.current = next;
  }, [filled]);

  const react = (r: BallReaction) => {
    const m = motion.current;
    const power = compact ? 0.6 : 1;
    if (reducedMotion) {
      m.spin.x += r === "wobble" ? 0 : 1.5;
      return;
    }
    if (r === "kick") {
      m.vy = 5.2 * power;
      m.spin.set(m.spin.x + 9 * power, m.spin.y + 2.5 * power);
    } else if (r === "cheer") {
      m.vy = 6.4 * power;
      m.spin.set(m.spin.x + 14 * power, m.spin.y - 4 * power);
    } else if (r === "nudge") {
      m.vy = Math.max(m.vy, 1.6 * power);
      m.spin.x += 2.5 * power;
    } else if (r === "wobble") {
      m.wobble = 0;
    }
  };
  const reactRef = useRef(react);
  useEffect(() => {
    reactRef.current = react;
  });
  useEffect(() => onBallReaction((r) => reactRef.current(r)), []);

  // Drag to spin, tap to kick. Pointer events go on the canvas element itself.
  useEffect(() => {
    if (!interactive) return;
    const el = gl.domElement;
    let start: { x: number; y: number; t: number } | null = null;
    let last: { x: number; y: number } | null = null;
    const down = (e: PointerEvent) => {
      start = { x: e.clientX, y: e.clientY, t: performance.now() };
      last = { x: e.clientX, y: e.clientY };
      motion.current.dragging = true;
      el.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (!last) return;
      motion.current.dragDelta.x += e.clientX - last.x;
      motion.current.dragDelta.y += e.clientY - last.y;
      last = { x: e.clientX, y: e.clientY };
    };
    const up = (e: PointerEvent) => {
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) < 6) play("kick");
      start = null;
      last = null;
      motion.current.dragging = false;
    };
    el.addEventListener("pointerdown", down);
    el.addEventListener("pointermove", move);
    el.addEventListener("pointerup", up);
    el.addEventListener("pointercancel", up);
    return () => {
      el.removeEventListener("pointerdown", down);
      el.removeEventListener("pointermove", move);
      el.removeEventListener("pointerup", up);
      el.removeEventListener("pointercancel", up);
    };
  }, [gl, interactive]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 1 / 30);
    const m = motion.current;
    const ball = mesh.current;
    if (!ball) return;

    // Fill and flash ease toward their targets.
    easePanels(material.current, target.current, dt);

    // Spin: drag sets velocity directly, otherwise it decays back to a lazy idle roll.
    if (m.dragging) {
      const vx = (m.dragDelta.x * 0.012) / dt;
      const vy = (m.dragDelta.y * 0.012) / dt;
      m.spin.set(vx, vy);
      m.dragDelta.set(0, 0);
    } else {
      const idle = reducedMotion ? 0 : compact ? 0.5 : 0.35;
      m.spin.x += (idle - m.spin.x) * Math.min(1, dt * 1.6);
      m.spin.y += ((reducedMotion ? 0 : 0.06) - m.spin.y) * Math.min(1, dt * 1.6);
    }
    ball.rotateOnWorldAxis(Y_AXIS, m.spin.x * dt);
    ball.rotateOnWorldAxis(X_AXIS, m.spin.y * dt);

    // Bounce with a little squash on landing.
    if (m.y > 0 || m.vy !== 0) {
      m.vy += GRAVITY * dt;
      m.y += m.vy * dt;
      if (m.y <= 0) {
        m.y = 0;
        m.squash = Math.min(0.22, Math.abs(m.vy) * 0.035);
        m.vy = Math.abs(m.vy) > 1.2 ? -m.vy * 0.42 : 0;
      }
    }
    m.squash *= Math.exp(-dt * 14);

    let wobbleX = 0;
    if (m.wobble >= 0) {
      m.wobble += dt;
      wobbleX = Math.sin(m.wobble * 34) * 0.16 * Math.exp(-m.wobble * 5);
      ball.rotateOnWorldAxis(Z_AXIS, Math.sin(m.wobble * 34) * 0.02 * Math.exp(-m.wobble * 5));
      if (m.wobble > 1.2) m.wobble = -1;
    }

    ball.position.set(wobbleX, BASE_Y + m.y, 0);
    ball.scale.set(1 + m.squash * 0.5, 1 - m.squash, 1 + m.squash * 0.5);

    if (shadow.current) {
      const s = 1 / (1 + m.y * 0.45);
      shadow.current.scale.set(1.9 * s, 0.5 * s, 1);
      shadow.current.position.x = wobbleX;
      (shadow.current.material as THREE.ShaderMaterial).uniforms.uOpacity.value =
        (theme === "dark" ? 0.55 : 0.32) * s;
    }
  });

  return (
    <>
      <mesh ref={mesh} position={[0, BASE_Y, 0]}>
        <sphereGeometry args={[1, 128, 96]} />
        <shaderMaterial
          ref={material}
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>
      <mesh ref={shadow} position={[0, BASE_Y - 1.08, -0.4]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          transparent
          depthWrite={false}
          uniforms={{ uOpacity: { value: 0.3 } }}
          vertexShader={shadowVertex}
          fragmentShader={shadowFragment}
        />
      </mesh>
    </>
  );
}

export default function Football3D(props: Football3DProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 0, 5.4], fov: 34 }}
      gl={{ antialias: true, alpha: true, powerPreference: "low-power" }}
      style={{ touchAction: props.interactive ? "pan-y" : "auto" }}
      aria-hidden
    >
      <Ball {...props} />
    </Canvas>
  );
}
