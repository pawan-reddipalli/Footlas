"use client";

import { useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";
import dynamic from "next/dynamic";
import { Component, useSyncExternalStore, type ReactNode } from "react";

import type { Football3DProps } from "./Football3D";
import { FootballMark } from "./FootballMark";

const Football3D = dynamic(() => import("./Football3D"), {
  ssr: false,
  loading: () => <Placeholder />,
});

function Placeholder() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <FootballMark className="h-3/5 w-3/5 animate-pulse opacity-60" />
    </div>
  );
}

class WebGLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? <Placeholder /> : this.props.children;
  }
}

let webglSupport: boolean | null = null;
function hasWebGL(): boolean {
  if (webglSupport === null) {
    try {
      // three.js needs WebGL2. Release the probe context straight away.
      const gl = document.createElement("canvas").getContext("webgl2");
      webglSupport = !!gl;
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}

const noop = () => () => {};

/**
 * The Footlas football. It renders in 3D with WebGL, spins when dragged, kicks when
 * tapped and reacts to every answer. Its hexagon panels fill as the player levels up.
 */
export function Football({
  filled,
  interactive = false,
  compact = false,
  className,
}: Omit<Football3DProps, "theme" | "reducedMotion"> & { className?: string }) {
  const { resolvedTheme } = useTheme();
  const reducedMotion = useReducedMotion() ?? false;
  const canRender = useSyncExternalStore(noop, hasWebGL, () => false);

  return (
    <div className={className} data-testid="football">
      {canRender ? (
        <WebGLBoundary>
          <Football3D
            filled={filled}
            interactive={interactive}
            compact={compact}
            reducedMotion={reducedMotion}
            theme={resolvedTheme === "dark" ? "dark" : "light"}
          />
        </WebGLBoundary>
      ) : (
        <Placeholder />
      )}
    </div>
  );
}
