/**
 * The 32 panels of a classic football (a truncated icosahedron), as directions on a sphere.
 *
 * Pentagon centres are the 12 vertices of an icosahedron; hexagon centres are the 20
 * vertices of a dodecahedron. The shader colours each point of a sphere by its nearest
 * panel centre, measuring distance in units of that panel's own angular radius, which puts
 * the seams exactly where a stitched ball has them.
 */

const PHI = (1 + Math.sqrt(5)) / 2;

export type Vec3 = [number, number, number];

function normalize([x, y, z]: Vec3): Vec3 {
  const l = Math.hypot(x, y, z);
  return [x / l, y / l, z / l];
}

function cyclic(a: number, b: number, c: number): Vec3[] {
  return [
    [a, b, c],
    [b, c, a],
    [c, a, b],
  ];
}

function signs(a: number, b: number): [number, number][] {
  return [
    [a, b],
    [a, -b],
    [-a, b],
    [-a, -b],
  ];
}

export const PENTAGONS: Vec3[] = signs(1, PHI)
  .flatMap(([b, c]) => cyclic(0, b, c))
  .map(normalize);

export const HEXAGONS: Vec3[] = [
  ...[1, -1].flatMap((x) => [1, -1].flatMap((y) => [1, -1].map((z) => [x, y, z] as Vec3))),
  ...signs(1 / PHI, PHI).flatMap(([b, c]) => cyclic(0, b, c)),
].map(normalize);

/** Pentagons first, then hexagons: the order the shader's uniform arrays use. */
export const PANELS: Vec3[] = [...PENTAGONS, ...HEXAGONS];

/** Angular "radius" of each panel type on a real ball, in radians (16.5 and 20.9 degrees). */
export const PENT_RADIUS = Math.atan(1 / (2 * Math.tan(Math.PI / 5)) / 2.3273);
export const HEX_RADIUS = Math.atan(1 / (2 * Math.tan(Math.PI / 6)) / 2.2672);

/**
 * The order hexagons light up as a level fills: top of the ball first, spiralling down,
 * so progress reads like the ball being stitched panel by panel.
 */
export const HEX_FILL_ORDER: number[] = HEXAGONS.map((v, i) => ({
  i,
  y: Math.round(v[1] * 1000) / 1000,
  a: Math.atan2(v[2], v[0]),
}))
  .sort((p, q) => q.y - p.y || p.a - q.a)
  .map((p) => p.i);

export const HEX_COUNT = HEXAGONS.length;
