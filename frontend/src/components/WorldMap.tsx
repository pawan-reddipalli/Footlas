"use client";

import { geoNaturalEarth1, geoPath } from "d3-geo";
import type { Feature, Geometry } from "geojson";
import { motion } from "motion/react";
import { useEffect, useRef, useState } from "react";
import { feature } from "topojson-client";
import type { GeometryCollection, Topology } from "topojson-specification";
import world from "world-atlas/countries-110m.json";

const WIDTH = 960;
const HEIGHT = 500;
const MIN_ZOOM = 1;
const MAX_ZOOM = 8;

type CountryShape = { id: string; name: string; d: string; c: [number, number] };

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
  return countries.map((f) => ({
    id: f.id,
    name: f.properties.name,
    d: path(f) ?? "",
    c: centroidOf(path, f),
  }));
}

/** Centre of the country's largest piece, so the ball lands on France and not French Guiana. */
function centroidOf(
  path: ReturnType<typeof geoPath>,
  f: Feature<Geometry, { name: string }>,
): [number, number] {
  if (f.geometry.type !== "MultiPolygon") return path.centroid(f);
  let best: { area: number; c: [number, number] } | null = null;
  for (const coordinates of f.geometry.coordinates) {
    const part: Feature<Geometry> = { type: "Feature", properties: {}, geometry: { type: "Polygon", coordinates } };
    const area = path.area(part);
    if (!best || area > best.area) best = { area, c: path.centroid(part) };
  }
  return best?.c ?? path.centroid(f);
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
 *
 * A football rolls to whichever country you tap. After a wrong answer, a chalk line
 * draws from your pick to the right country and the ball follows it there.
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
  const [instant, setInstant] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ x: number; y: number; view: View; moved: boolean } | null>(null);

  const zoom = (factor: number, cx?: number, cy?: number) => {
    setInstant(false);
    setView((v) => {
      const px = cx ?? v.x + v.w / 2;
      const py = cy ?? v.y + v.h / 2;
      const w = Math.min(WIDTH / MIN_ZOOM, Math.max(WIDTH / MAX_ZOOM, v.w / factor));
      const h = (w / WIDTH) * HEIGHT;
      const x = px - ((px - v.x) / v.w) * w;
      const y = py - ((py - v.y) / v.h) * h;
      return clamp({ x, y, w, h });
    });
  };

  // Trackpad pinch (and ctrl + wheel) zooms around the pointer without scrolling the page.
  const zoomRef = useRef(zoom);
  useEffect(() => {
    zoomRef.current = zoom;
  });
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const vb = el.viewBox.baseVal;
      const cx = vb.x + ((e.clientX - rect.left) / rect.width) * vb.width;
      const cy = vb.y + ((e.clientY - rect.top) / rect.height) * vb.height;
      zoomRef.current(Math.exp(-e.deltaY * 0.01), cx, cy);
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, []);

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
    setInstant(true);
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
    if (id === highlight.selected) return "var(--map-pick)";
    return undefined;
  };

  const find = (id: string | null | undefined) => (id ? countries.find((c) => c.id === id) : undefined);
  const wrong = find(highlight.wrong);
  const correct = find(highlight.correct);
  const ballAt = correct ?? find(highlight.selected);
  const k = view.w / WIDTH; // keeps markers the same size on screen at any zoom
  const ballR = 9 * k;

  // Ball roll: rotation tracks horizontal position, so moving right rolls clockwise.
  const roll = ballAt ? (ballAt.c[0] * 360) / (2 * Math.PI * 9) : 0;

  return (
    <div className="sticker relative overflow-hidden rounded-2xl" style={{ background: "var(--sea)" }}>
      <motion.svg
        ref={svgRef}
        initial={false}
        animate={{ viewBox: `${view.x} ${view.y} ${view.w} ${view.h}` }}
        transition={instant ? { duration: 0 } : { type: "spring", stiffness: 220, damping: 30 }}
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
            stroke="var(--sea)"
            strokeWidth={0.7 * k}
            className={
              disabled ? "transition-[fill] duration-500" : "cursor-pointer transition-[fill] duration-200 hover:fill-[var(--land-hover)]"
            }
            // Inline style beats the hover class, so highlights stay visible.
            style={highlightFill(c.id) ? { fill: highlightFill(c.id) } : undefined}
            onClick={() => {
              if (disabled || drag.current?.moved) return;
              onSelect?.(c.id);
            }}
          >
            <title>{c.name}</title>
          </path>
        ))}

        {wrong && correct && (
          <motion.path
            d={chalkArc(wrong.c, correct.c)}
            fill="none"
            stroke="var(--foreground)"
            strokeWidth={2.2 * k}
            strokeDasharray={`${6 * k} ${5 * k}`}
            strokeLinecap="round"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.8 }}
            transition={{ duration: 0.9, ease: "easeInOut", delay: 0.15 }}
            pointerEvents="none"
          />
        )}

        {correct && (
          <motion.circle
            cx={correct.c[0]}
            cy={correct.c[1]}
            fill="none"
            stroke="var(--pitch)"
            strokeWidth={2 * k}
            initial={{ r: ballR, opacity: 0.9 }}
            animate={{ r: ballR * 4, opacity: 0 }}
            transition={{ duration: 1.2, repeat: 2, ease: "easeOut", delay: 0.9 }}
            pointerEvents="none"
          />
        )}

        {ballAt && (
          <motion.g
            initial={false}
            animate={{ x: ballAt.c[0], y: ballAt.c[1] }}
            transition={{ type: "spring", stiffness: 120, damping: 16, delay: wrong ? 0.2 : 0 }}
            pointerEvents="none"
          >
            <ellipse cx={1.5 * k} cy={ballR * 0.9} rx={ballR * 0.9} ry={ballR * 0.3} fill="rgb(0 0 0 / 0.25)" />
            <motion.g
              animate={{ rotate: roll }}
              transition={{ type: "spring", stiffness: 120, damping: 16 }}
            >
              <g transform={`translate(${-ballR} ${-ballR}) scale(${(ballR * 2) / 100})`}>
                <BallGlyph />
              </g>
            </motion.g>
          </motion.g>
        )}
      </motion.svg>
      <div className="absolute right-2 bottom-2 flex flex-col gap-1">
        {[
          { label: "+", title: "Zoom in", action: () => zoom(1.6) },
          { label: "−", title: "Zoom out", action: () => zoom(1 / 1.6) },
          {
            label: "⟲",
            title: "Reset view",
            action: () => {
              setInstant(false);
              setView(FULL_VIEW);
            },
          },
        ].map((b) => (
          <motion.button
            key={b.title}
            type="button"
            title={b.title}
            aria-label={b.title}
            onClick={b.action}
            whileTap={{ scale: 0.85 }}
            className="h-9 w-9 rounded-full border border-border bg-surface text-lg leading-none font-bold shadow-sm hover:border-pitch"
          >
            {b.label}
          </motion.button>
        ))}
      </div>
    </div>
  );
}

/** A gentle curve between two points, like a pass drawn on a tactics board. */
function chalkArc(a: [number, number], b: [number, number]) {
  const mx = (a[0] + b[0]) / 2;
  const my = (a[1] + b[1]) / 2;
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lift = Math.min(80, Math.hypot(dx, dy) * 0.25);
  const len = Math.hypot(dx, dy) || 1;
  return `M${a[0]},${a[1]} Q${mx - (dy / len) * lift},${my + (dx / len) * lift - lift * 0.3} ${b[0]},${b[1]}`;
}

/** A tiny football drawn in a 100 by 100 box, for use inside other SVGs. */
function BallGlyph() {
  const pent = (cx: number, cy: number, r: number, rot: number) =>
    Array.from({ length: 5 }, (_, i) => {
      const a = rot + (i * 2 * Math.PI) / 5;
      return `${cx + r * Math.sin(a)},${cy - r * Math.cos(a)}`;
    }).join(" ");
  return (
    <>
      <clipPath id="ball-glyph-clip">
        <circle cx="50" cy="50" r="47" />
      </clipPath>
      <circle cx="50" cy="50" r="47" fill="#f7f7f4" />
      <polygon points={pent(50, 50, 17, 0)} fill="#1b1913" />
      <g clipPath="url(#ball-glyph-clip)">
      {Array.from({ length: 5 }, (_, i) => {
        const a = Math.PI / 5 + (i * 2 * Math.PI) / 5;
        return (
          <polygon
            key={i}
            points={pent(50 + 44 * Math.sin(a), 50 - 44 * Math.cos(a), 14, a + Math.PI)}
            fill="#1b1913"
          />
        );
      })}
      </g>
      <circle cx="50" cy="50" r="47" fill="none" stroke="#1b1913" strokeWidth="5" />
    </>
  );
}

function clamp(v: View): View {
  return {
    ...v,
    x: Math.min(Math.max(v.x, 0), WIDTH - v.w),
    y: Math.min(Math.max(v.y, 0), HEIGHT - v.h),
  };
}
