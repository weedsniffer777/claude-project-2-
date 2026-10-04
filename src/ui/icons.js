// Pixel icons drawn from shapes: each pixel of a small grid asks a list of
// layers (top first) for its colour, so edges stay crisp at any scale.
//  - the upgrade token: a thick violet coin seen a little from above, its
//    rim and edge shaded, an embossed white up arrow on its face
//  - the artillery strike: shells streaking in on smoke trails, red impact
//    rings on the ground, explosions blooming out of them

function raster(W, H, colorAt, scale) {
  const c = document.createElement('canvas');
  c.width = W * scale;
  c.height = H * scale;
  const g = c.getContext('2d');
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const col = colorAt(x + 0.5, y + 0.5);
      if (!col) continue;
      g.fillStyle = col;
      g.fillRect(x * scale, y * scale, scale, scale);
    }
  return c;
}
const ell = (x, y, cx, cy, rx, ry) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
// distance from a point to a segment, and how far along it (0..1)
function seg(x, y, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const k = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy)));
  return { d: Math.hypot(x - ax - dx * k, y - ay - dy * k), k };
}

// ---------------------------------------------------------------- token
// a flat violet hexagon (a simple shape, like the scraps' diamond), a
// lighter facet up its top left, and a white up arrow badge off its top
// right corner
const hex = (x, y, cx, cy, r) => {
  const dx = Math.abs(x - cx);
  const dy = Math.abs(y - cy);
  return dx <= r * 0.866 && dy <= r - dx * 0.577 ? 1 : 0; // pointy-top hexagon
};
function tokenAt(x, y) {
  const C = [13, 17];
  // the arrow badge, outlined
  const ax = x - 23.5;
  const ay = y - 8;
  const arrow = (u, v) => (v >= -6 && v <= -0.5 && Math.abs(u) <= (v + 6) * 0.95) || (v > -0.5 && v <= 5 && Math.abs(u) <= 1.6);
  if (arrow(ax, ay)) return '#ffffff';
  if (arrow(ax - 1, ay - 1) || arrow(ax + 1, ay) || arrow(ax - 1, ay) || arrow(ax, ay + 1) || arrow(ax, ay - 1)) return '#1a0a2a';
  if (hex(x, y, C[0], C[1], 12)) {
    if (!hex(x, y, C[0], C[1], 10)) return '#1a0a2a';
    if (!hex(x, y, C[0], C[1], 8.2)) return y < C[1] && x < C[0] + 3 ? '#e2b8ff' : '#8a45d0';
    return x + y < C[0] + C[1] ? '#d29aff' : '#b468f2';
  }
  return null;
}
const tokenCache = new Map();
export function tokenCanvas(scale = 2) {
  if (!tokenCache.has(scale)) tokenCache.set(scale, raster(32, 32, tokenAt, scale));
  return tokenCache.get(scale);
}
let tokenUrl = null;
export const tokenIconURL = () => (tokenUrl ??= tokenCanvas(2).toDataURL());

// ------------------------------------------------------------ artillery
// a group of three, all on the same slant: two landed either side, the
// third still coming down between them
const BLASTS = [
  { x: 8.5, y: 17, r: 4.8, ring: [6.5, 2.7] },
  { x: 23.5, y: 17, r: 4.8, ring: [6.5, 2.7] },
];
const TRAILS = [
  { a: [1, 1], b: [7.4, 12.4] },
  { a: [16, 1], b: [22.4, 12.4] },
  { a: [9.5, 1], b: [15.5, 9.5], head: true },
];
function artilleryAt(x, y) {
  // explosions: spiky blooms, white-hot cores
  for (const b of BLASTS) {
    const dx = x - b.x;
    const dy = (y - (b.y - 2)) * 1.15;
    const d = Math.hypot(dx, dy);
    const a = Math.atan2(dy, dx);
    const r = b.r * (0.8 + 0.25 * Math.cos(a * 7 + b.x));
    if (d <= r * 0.35) return '#ffffff';
    if (d <= r * 0.62) return '#ffe27a';
    if (d <= r * 0.85) return '#ffb347';
    if (d <= r) return '#e8602a';
  }
  // the incoming shell's head, and its ring on the ground waiting
  const h = TRAILS[2];
  if (Math.hypot(x - h.b[0], y - h.b[1]) <= 1.3) return '#ffffff';
  // smoke trails, fading out up the sky
  for (const t of TRAILS) {
    const s = seg(x, y, ...t.a, ...t.b);
    if (s.d <= 0.55 + s.k * 0.6) return s.k > 0.75 ? '#fff0c8' : s.k > 0.4 ? '#c9c2b4' : '#7d776d';
  }
  // the red impact rings on the ground (one for the shell still coming)
  for (const b of [...BLASTS, { x: 16, y: 19.5, ring: [3.6, 1.6] }]) {
    const e = ell(x, y, b.x, b.y + 2, b.ring[0], b.ring[1]);
    if (e <= 1 && e >= 0.55) return '#ff3b2f';
    if (e < 0.55) return '#5a1a16';
  }
  return null;
}
const artyCache = new Map();
export function artilleryCanvas(scale = 2) {
  if (!artyCache.has(scale)) artyCache.set(scale, raster(32, 24, artilleryAt, scale));
  return artyCache.get(scale);
}
