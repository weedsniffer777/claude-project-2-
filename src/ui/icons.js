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

// ------------------------------------------------------- guided missile
// a missile flying right, symmetrical (pointed nose, a fin pair top and
// bottom at the tail, a mid band), a flame out the back, and a small red
// lock box round a plain round target ahead of it
const MY = 12;
function missileBody(x, y) {
  const dy = Math.abs(y - MY);
  // the nose cone: narrows to a point
  if (x >= 18 && x < 22 && dy < 1.6 - (x - 18) * 0.38) return x > 20.5 ? '#ff3b2f' : '#d8dde2';
  // the body
  if (x >= 7 && x < 18 && dy < 1.6) {
    if (x >= 12 && x < 13.2) return '#ffb347'; // the band
    return dy < 0.6 ? '#c9cfd5' : '#8a9097';
  }
  // tail fins, swept back, the same top and bottom
  if (x >= 6 && x < 11 && dy >= 1.6 && dy < 1.6 + (x - 6) * 0.7 && dy < 4.2) return '#5f6b48';
  // mid fins, small
  if (x >= 15 && x < 17 && dy >= 1.6 && dy < 2.6) return '#5f6b48';
  return null;
}
function flame(x, y) {
  const dy = Math.abs(y - MY);
  if (x >= 7) return null;
  const k = (7 - x) / 6; // 0 at the nozzle, 1 at the tip
  if (dy < 0.7 * (1 - k) + 0.1 && x > 3.5) return '#ffffff';
  if (dy < 1.4 * (1 - k * 0.7) && x > 2.2) return '#ffe066';
  if (dy < 1.7 * (1 - k * 0.5) && x > 0.5) return '#ff7a2a';
  return null;
}
function lockTarget(x, y) {
  // the target: a dark disc with a lighter ring
  const r = Math.hypot(x - 27, y - MY);
  if (r < 1.3) return '#ff3b2f';
  if (r < 2.4) return '#3a3436';
  if (r < 3.1) return '#8a8580';
  // the lock box: red corner brackets
  const bx = [23, 31];
  const by = [8, 16];
  const onEdge = (v, a, b) => Math.abs(v - a) < 0.6 || Math.abs(v - b) < 0.6;
  const inSpan = (v, a, b) => v >= a - 0.6 && v <= b + 0.6;
  const nearCorner = (v, a, b) => v - a < 2.5 || b - v < 2.5;
  if (inSpan(x, ...bx) && inSpan(y, ...by) && ((onEdge(x, ...bx) && nearCorner(y, ...by)) || (onEdge(y, ...by) && nearCorner(x, ...bx)))) return '#ff3b2f';
  return null;
}
function atgmAt(x, y) {
  const c = missileBody(x, y) || flame(x, y) || lockTarget(x, y);
  if (c) return c;
  // a black edge round the missile so it reads on the tile
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (missileBody(x + dx, y + dy)) return '#000000';
  return null;
}
const atgmCache = new Map();
export function atgmCanvas(scale = 2) {
  if (!atgmCache.has(scale)) atgmCache.set(scale, raster(32, 24, atgmAt, scale));
  return atgmCache.get(scale);
}

// --------------------------------------------------------------- shield
// a small tank seen from above, a curved see-through shield bowed out in
// front of it (a hex grid in it, bright rims), and red rounds bursting
// on its face
const SC = [9, 12];
function shieldBand(x, y) {
  const d = Math.hypot(x - SC[0], (y - SC[1]) * 1.05);
  const a = Math.atan2(y - SC[1], x - SC[0]);
  if (Math.abs(a) > 1.25 || d < 10.4 || d > 13.6) return null;
  return { d, a };
}
function shieldAt(x, y) {
  // the rounds coming in, and their bursts on the shield
  for (const [hx, hy, len] of [[21.5, 6.2, 8], [22.6, 15.6, 6]]) {
    const r = Math.hypot(x - hx, y - hy);
    if (r < 1.1) return '#ffffff';
    if (r < 2.1 && ((Math.atan2(y - hy, x - hx) * 4) | 0) % 2 === 0) return '#ffd36b';
    if (y > hy - 0.6 && y < hy + 0.6 && x > hx + 1.5 && x < hx + len) return x < hx + 3 ? '#ffb8a0' : '#ff2414';
  }
  const s = shieldBand(x, y);
  if (s) {
    if (s.d > 12.8 || s.d < 11.2 || Math.abs(s.a) > 1.12) return '#c8fbff'; // the rims
    // the hex grid: offset rows of cells, their edges lit
    const u = s.a * 9;
    const v = (s.d - 11.2) * 1.4 + (Math.floor(u) % 2) * 0.5;
    const edge = u - Math.floor(u) < 0.22 || v - Math.floor(v) < 0.25;
    return edge ? '#5fe6ff' : '#1f6f84';
  }
  // the tank: hull, tracks, turret, the gun pointing at the shield
  if (x > 3 && x < 15 && y > 6 && y < 18) {
    if (y < 7.6 || y > 16.4) return '#2b2f26'; // tracks
    if (Math.hypot(x - 8.5, y - 12) < 2.6) return '#9aa274'; // turret
    if (x > 10 && x < 15.5 && Math.abs(y - 12) < 0.6) return '#3a3d33';
    return '#6f7a52';
  }
  if (x >= 15 && x < 17.5 && Math.abs(y - 12) < 0.6) return '#3a3d33'; // the barrel's end
  return null;
}
const shieldCache = new Map();
export function shieldCanvas(scale = 2) {
  if (!shieldCache.has(scale)) shieldCache.set(scale, raster(32, 24, shieldAt, scale));
  return shieldCache.get(scale);
}
