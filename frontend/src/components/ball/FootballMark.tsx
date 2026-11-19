/**
 * The flat football used as the logo, the loading state and the fallback when WebGL is
 * unavailable. Drawn from the same panel layout as the 3D ball: a centre pentagon, five
 * neighbours cut by the rim, and stitched seams between them.
 */
function pentagon(cx: number, cy: number, r: number, rot: number) {
  return Array.from({ length: 5 }, (_, i) => {
    const a = rot + (i * 2 * Math.PI) / 5;
    return `${(cx + r * Math.sin(a)).toFixed(2)},${(cy - r * Math.cos(a)).toFixed(2)}`;
  }).join(" ");
}

const OUTER = Array.from({ length: 5 }, (_, i) => {
  const a = Math.PI / 5 + (i * 2 * Math.PI) / 5;
  return { x: 50 + 44 * Math.sin(a), y: 50 - 44 * Math.cos(a), rot: a + Math.PI };
});

const SEAMS = Array.from({ length: 5 }, (_, i) => {
  const a = (i * 2 * Math.PI) / 5;
  return {
    x1: 50 + 15 * Math.sin(a),
    y1: 50 - 15 * Math.cos(a),
    x2: 50 + 30 * Math.sin(a),
    y2: 50 - 30 * Math.cos(a),
  };
});

export function FootballMark({
  className,
  title,
  filledColor,
}: {
  className?: string;
  title?: string;
  filledColor?: string;
}) {
  const id = "fm-clip";
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <defs>
        <clipPath id={id}>
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>
      <circle cx="50" cy="50" r="46" fill={filledColor ?? "var(--surface)"} />
      <g clipPath={`url(#${id})`} fill="var(--foreground)">
        <polygon points={pentagon(50, 50, 16, 0)} />
        {OUTER.map((p, i) => (
          <polygon key={i} points={pentagon(p.x, p.y, 16, p.rot)} />
        ))}
      </g>
      <g stroke="var(--foreground)" strokeWidth="2.2" strokeLinecap="round">
        {SEAMS.map((s, i) => (
          <line key={i} {...s} />
        ))}
      </g>
      <circle cx="50" cy="50" r="46" fill="none" stroke="var(--foreground)" strokeWidth="4" />
    </svg>
  );
}
