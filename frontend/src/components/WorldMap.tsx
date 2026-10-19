"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";

const WIDTH = 960;
const HEIGHT = 500;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

type CountryShape = { id: string; name: string; d: string };

type View = { x: number; y: number; w: number; h: number };
const FULL_VIEW: View = { x: 0, y: 0, w: WIDTH, h: HEIGHT };

function buildShapes(): CountryShape[] {
  const topology = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;
  const collection = feature(topology, topology.objects.countries);
  const countries = collection.features.filter(
    (f): f is Feature<Geometry, { name: string }> & { id: string } =>
      typeof f.id === "string" && f.id !== "010", // drop Antarctica
  );
  const projection = geoNaturalEarth1().fitSize([WIDTH, HEIGHT], {
    type: "FeatureCollection",
    features: countries,
  });
  const path = geoPath(projection);
  return countries.map((f) => ({ id: f.id, name: f.properties.name, d: path(f) ?? "" }));
}

export type MapHighlight = {
  selected?: string | null;
  correct?: string | null;
  wrong?: string | null;
};

export function countryName(mapId: string): string | undefined {
  return shapes().find((s) => s.id === mapId)?.name;
}

let cachedShapes: CountryShape[] | null = null;
function shapes(): CountryShape[] {
  cachedShapes ??= buildShapes();
  return cachedShapes;
}

/**
 * A clickable SVG world map. Countries are identified by ISO 3166-1 numeric ids,
 * which is how the API names the answer to every map question.
 */
export function WorldMap({
  highlight,
  disabled,
  onSelect,
}: {
  highlight: MapHighlight;
  disabled?: boolean;
  onSelect?: (mapId: string) => void;
}) {
  const countries = shapes();
  const [view, setView] = useState<View>(FULL_VIEW);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);

  const zoom = (factor: number, cx = view.x + view.w / 2, cy = view.y + view.h / 2) => {
    setView((v) => {
      const w = Math.min(WIDTH / MIN_ZOOM, Math.max(WIDTH / MAX_ZOOM, v.w / factor));
      const h = (w / WIDTH) * HEIGHT;
      const x = cx - ((cx - v.x) / v.w) * w;
      const y = cy - ((cy - v.y) / v.h) * h;
      return clamp({ x, y, w, h });
    });
  };

  const toSvgScale = () => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? view.w / rect.width : 1;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY, view, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const start = drag.current;
    if (!start) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (!start.moved && Math.hypot(dx, dy) < 6) return;
    start.moved = true;
    const scale = toSvgScale();
    setView(clamp({ ...start.view, x: start.view.x - dx * scale, y: start.view.y - dy * scale }));
  };
  const onPointerUp = () => {
    // Keep `moved` readable by the click handler that fires right after.
    setTimeout(() => (drag.current = null), 0);
  };

  const highlightFill = (id: string) => {
    if (id === highlight.correct) return "var(--pitch)";
    if (id === highlight.wrong) return "var(--danger)";
    if (id === highlight.selected) return "var(--gold)";
    return undefined;
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-[var(--sea)]">
      <svg
        ref={svgRef}
        viewBox={`${view.x} ${view.y} ${view.w} ${view.h}`}
        className="block h-auto w-full touch-none select-none"
        role="img"
        aria-label="World map"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {countries.map((c) => (
          <path
            key={c.id}
            d={c.d}
            fill="var(--land)"
            stroke="var(--background)"
            strokeWidth={0.5 * (view.w / WIDTH)}
            className={
              disabled ? "" : "cursor-pointer transition-colors hover:fill-[var(--land-hover)]"
            }
            // Inline style beats the hover class, so highlights stay visible.
            style={highlightFill(c.id) ? { fill: highlightFill(c.id) } : undefined}
            onClick={() => {
              if (disabled || drag.current?.moved) return;
              onSelect?.(c.id);
            }}
          />
        ))}
      </svg>
      <div className="absolute right-2 bottom-2 flex flex-col gap-1">
        {[
          { label: "+", title: "Zoom in", action: () => zoom(1.6) },
          { label: "−", title: "Zoom out", action: () => zoom(1 / 1.6) },
          { label: "⟲", title: "Reset view", action: () => setView(FULL_VIEW) },
        ].map((b) => (
          <button
            key={b.title}
            type="button"
            title={b.title}
            aria-label={b.title}
            onClick={b.action}
            className="h-8 w-8 rounded-lg border border-border bg-surface text-lg leading-none font-semibold shadow-sm hover:bg-surface-muted"
          >
            {b.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function clamp(v: View): View {
  return {
    ...v,
    x: Math.min(Math.max(v.x, 0), WIDTH - v.w),
    y: Math.min(Math.max(v.y, 0), HEIGHT - v.h),
  };
}
