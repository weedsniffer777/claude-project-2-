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
function tokenAt(x, y) {
  const face = ell(x, y, 16, 14.5, 12.5, 11.5);
  const edge = ell(x, y, 16, 17.5, 12.5, 11.5);
  const inFace = face <= 1;
  const inEdge = edge <= 1 || (Math.abs(x - 16) <= 12.5 && y >= 14.5 && y <= 17.5);
  // the up arrow (and its shadow, one pixel down and right)
  const arrow = (ax, ay) => {
    if (ay >= 6 && ay <= 13.5) {
      const half = ((ay - 6) / 7.5) * 6.2;
      if (Math.abs(ax - 16) <= half) return true;
    }
    return ay > 13.5 && ay <= 21.5 && Math.abs(ax - 16) <= 2.6;
  };
  if (inFace) {
    if (face <= 0.62) {
      if (arrow(x, y)) return x - y > 2.5 ? '#f3e2ff' : '#ffffff';
      if (arrow(x - 1, y - 1)) return '#6a2fa8';
      if (x + y < 21 && face > 0.3) return '#e0b4ff'; // the shine, top left
      return '#c77dff';
    }
    if (face <= 0.8) return x + y < 26 ? '#d9a3ff' : '#9a52e0'; // the raised rim
    return '#7a38c0';
  }
  if (inEdge) return y > 20 || x > 22 ? '#4a1d78' : '#5f2894'; // the coin's thickness
  // a dark outline round it all
  if (ell(x, y, 16, 14.5, 13.5, 12.5) <= 1 || ell(x, y, 16, 17.5, 13.5, 12.5) <= 1) return '#1a0a2a';
  // a glint
  if ((Math.round(x - 0.5) === 5 && Math.abs(y - 4.5) < 2) || (Math.round(y - 0.5) === 4 && Math.abs(x - 5.5) < 2)) return '#ffffff';
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
const BLASTS = [
  { x: 11, y: 17, r: 5.2, ring: [7.5, 3] },
  { x: 24, y: 14, r: 4.2, ring: [6, 2.4] },
];
const TRAILS = [
  { a: [1, 0], b: [10, 12.5] },
  { a: [15, 0], b: [23, 10.5] },
  { a: [27, 0], b: [30.5, 5.5], head: true }, // one still coming in
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
  // the incoming shell's head
  const h = TRAILS[2];
  if (Math.hypot(x - h.b[0], y - h.b[1]) <= 1.3) return '#ffffff';
  // smoke trails, fading out up the sky
  for (const t of TRAILS) {
    const s = seg(x, y, ...t.a, ...t.b);
    if (s.d <= 0.55 + s.k * 0.6) return s.k > 0.75 ? '#fff0c8' : s.k > 0.4 ? '#c9c2b4' : '#7d776d';
  }
  // the red impact rings on the ground
  for (const b of BLASTS) {
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
