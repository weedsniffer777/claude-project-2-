// The light tank, a copy of the Scimitar (CVR(T)). Forward is +X, up is +Y;
// same interface as the battle tank, so the game can drive either.
//
// Proportions measured off the reference photos (side view for lengths and
// heights, the three-quarter render for the front and the turret's bins):
//  - a LOW hull: the deck about a quarter of the hull's length off the
//    ground; flat side armour as a band over the track; a short, shallow
//    slope at the front down to a vertical nose plate with two headlights in
//    octagonal housings on top, set inboard; a rounded transmission cover
//    under the nose; big flat mudguards over the front of the tracks
//  - running gear shorter than the hull: five road wheels, the toothed
//    sprocket raised at the front, the idler at the back with the hull
//    overhanging it; the track's top run straight from idler to sprocket,
//    clear of the wheels
//  - a long turret set well back (it covers the rear half of the hull): a
//    faceted front with a rounded mantlet housing (the gun off to the right),
//    a high slatted box on its right side, a big bin on its left, bags hung
//    off the back, smoke dischargers on the front corners, the commander's
//    hooded sight and the gunner's sight on the roof
//  - the gun: a thick jacket, then a thin barrel; the muzzle stops short of
//    the nose
//  - a mesh-covered exhaust along the top of the left side; a slatted bin on
//    the rear plate
//  - three-tone camo (green, brown, black) in big blotches
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { box, cyl, put, toon, wrapAngle, approachAngle, gradientMap } from './kit.js';

const C = {
  green: 0x5b6a3c,
  greenDark: 0x4a5731,
  brown: 0x6e5639,
  black: 0x2b2b25,
  dark: 0x232426,
  steel: 0x5d6368,
  rubber: 0x262625,
  trackA: 0x3a3936,
  trackB: 0x2c2b29,
  glass: 0x4a4a78,
  glint: 0x8a86c0,
  lamp: 0xe0d49a,
  slats: 0x9a9a8c,
  canvas: 0x5a5238,
  mesh: 0x7a6e50,
};
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- layout
// (world units: nose at x 1.7, rear plate at -1.6)
const NOSE = 1.7;
const REAR = -1.6;
const DECK_Y = 0.8;
// upper hull, full width out over the tracks; side profile, counter-clockwise
const UPPER = [[REAR, 0.5], [1.66, 0.5], [NOSE, 0.56], [NOSE, 0.69], [1.14, DECK_Y], [REAR + 0.02, DECK_Y], [REAR, 0.77]];
const UPPER_HALF = 0.76;
// lower hull between the tracks: the belly and the lower nose
const LOWER = [[REAR + 0.02, 0.18], [1.4, 0.18], [1.64, 0.4], [1.64, 0.51], [REAR + 0.02, 0.51]];
const LOWER_HALF = 0.44;
const FRONT_SLOPE = { x0: NOSE, y0: 0.69, x1: 1.14, y1: DECK_Y };
const TRACK_Z = 0.6;
const TRACK_W = 0.3;
const LINK_T = 0.035;
const WHEEL_R = 0.2;
const WHEEL_Y = WHEEL_R + LINK_T;
const ROAD_WHEELS = [0.98, 0.59, 0.2, -0.23, -0.66];
const SPROCKET = { x: 1.41, y: 0.36, r: 0.16 }; // drive, raised at the front
const IDLER = { x: -1.03, y: 0.34, r: 0.14 };
// turret: long, set well back; side profile with a faceted front
const TURRET = { x: -0.55, y: DECK_Y };
const TURRET_PROFILE = [[-0.74, 0], [0.62, 0], [0.76, 0.18], [0.6, 0.48], [-0.74, 0.48]];
const TURRET_HALF = { bottom: 0.48, top: 0.42 };
const ROOF = 0.48; // turret-local
const GUN_Y = 0.27;
const GUN_Z = 0.14; // off to the right
const GUN_BASE_X = 0.9;
const MUZZLE_X = 1.22;
const TURRET_SPEED = 8; // a small turret swings fast
const GUN_DEPRESSION = -0.3;
const GUN_ELEVATION = 0.35;
const GUN_PITCH_SPEED = 3;
const MG_SPEED = 10;
const COMMANDER = { x: -0.2, z: -0.2 };

// ------------------------------------------------------------- camo paint
// Big blotches of the three colours, drawn small and sampled nearest, so
// they stay chunky at the game's pixel size.
let camoTex = null;
function camoTexture() {
  if (camoTex) return camoTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const hex = (n) => `#${new THREE.Color(n).getHexString()}`;
  g.fillStyle = hex(C.green);
  g.fillRect(0, 0, 32, 32);
  let seed = 7;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const blob = (col, x, y, rx, ry) => {
    g.fillStyle = col;
    const a = rand() * 3;
    for (const [dx, dy] of [[0, 0], [32, 0], [-32, 0], [0, 32], [0, -32]]) {
      g.beginPath();
      g.ellipse(x + dx, y + dy, rx, ry, a, 0, TAU);
      g.fill();
    }
  };
  for (let i = 0; i < 5; i++) blob(hex(C.brown), rand() * 32, rand() * 32, 5 + rand() * 4, 3 + rand() * 3);
  for (let i = 0; i < 4; i++) blob(hex(C.black), rand() * 32, rand() * 32, 3 + rand() * 3, 2 + rand() * 2);
  camoTex = new THREE.CanvasTexture(c);
  camoTex.colorSpace = THREE.SRGBColorSpace;
  camoTex.magFilter = camoTex.minFilter = THREE.NearestFilter;
  camoTex.wrapS = camoTex.wrapT = THREE.RepeatWrapping;
  return camoTex;
}
// a camo material; scale is pattern repeats per world unit, shift moves it
// so neighbouring panels don't match
function camo(scale = 0.5, shift = 0) {
  const t = camoTexture().clone();
  t.needsUpdate = true;
  t.repeat.set(scale, scale);
  t.offset.set(shift * 0.37, shift * 0.61);
  return new THREE.MeshToonMaterial({ map: t, gradientMap });
}
function camoBox(w, h, d, shift, r = 0.02) {
  const g = new RoundedBoxGeometry(w, h, d, 1, r);
  const m = new THREE.Mesh(g, camo(0.5 / Math.max(w, h, d, 0.5), shift));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// A convex side profile (x, y; counter-clockwise) given depth by a half
// width that can narrow toward the top (sloped sides, like a turret's).
// UVs are planar per face in world units, so the camo keeps its size.
function prism(points, hwBottom, hwTop, material) {
  const ys = points.map((p) => p[1]);
  const y0 = Math.min(...ys);
  const y1 = Math.max(...ys);
  const hw = (y) => hwBottom + (hwTop - hwBottom) * ((y - y0) / (y1 - y0 || 1));
  const pos = [];
  const uv = [];
  const P = ([x, y], s) => [x, y, s * hw(y)];
  const tri = (a, b, c) => {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    const nx = Math.abs(uy * vz - uz * vy);
    const ny = Math.abs(uz * vx - ux * vz);
    const nz = Math.abs(ux * vy - uy * vx);
    for (const p of [a, b, c]) {
      pos.push(...p);
      uv.push(...(nz >= nx && nz >= ny ? [p[0], p[1]] : ny >= nx ? [p[0], p[2]] : [p[2], p[1]]));
    }
  };
  const n = points.length;
  for (let i = 1; i < n - 1; i++) {
    tri(P(points[0], 1), P(points[i], 1), P(points[i + 1], 1)); // +z side
    tri(P(points[0], -1), P(points[i + 1], -1), P(points[i], -1)); // -z side
  }
  for (let i = 0; i < n; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    tri(P(a, 1), P(a, -1), P(b, -1));
    tri(P(a, 1), P(b, -1), P(b, 1));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------ track loop
function buildTrackLoop() {
  const half = LINK_T / 2;
  const front = { x: SPROCKET.x, y: SPROCKET.y, r: SPROCKET.r + half };
  const back = { x: IDLER.x, y: IDLER.y, r: IDLER.r + half };
  const W = ROAD_WHEELS.map((x) => ({ x, y: WHEEL_Y, r: WHEEL_R + half }));
  const W1 = W[0];
  const W5 = W[W.length - 1];
  const pts = [];
  const mod = (v) => ((v % TAU) + TAU) % TAU;
  const line = (a, b, sag = 0) => {
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const n = Math.max(2, Math.ceil(len / 0.02));
    for (let i = 0; i < n; i++) {
      const u = i / n;
      pts.push({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u - sag * Math.sin(Math.PI * u) });
    }
  };
  const arc = (c, from, sweep) => {
    const n = Math.max(1, Math.ceil((sweep * c.r) / 0.02));
    for (let i = 0; i < n; i++) {
      const a = from - (sweep * i) / n;
      pts.push({ x: c.x + c.r * Math.cos(a), y: c.y + c.r * Math.sin(a) });
    }
  };
  const tangentNormal = (a, b) => Math.atan2(b.y - a.y, b.x - a.x) + Math.acos((a.r - b.r) / Math.hypot(b.x - a.x, b.y - a.y));
  const onCircle = (c, ang) => ({ x: c.x + c.r * Math.cos(ang), y: c.y + c.r * Math.sin(ang) });
  // top run: straight from the rear idler to the raised front sprocket,
  // clear of the wheels
  line({ x: back.x, y: back.y + back.r }, { x: front.x, y: front.y + front.r }, 0.02);
  const nFW = tangentNormal(front, W1);
  arc(front, Math.PI / 2, mod(Math.PI / 2 - nFW));
  line(onCircle(front, nFW), onCircle(W1, nFW));
  arc(W1, nFW, mod(nFW + Math.PI / 2));
  line(onCircle(W1, -Math.PI / 2), onCircle(W5, -Math.PI / 2));
  const nWB = tangentNormal(W5, back);
  arc(W5, -Math.PI / 2, mod(-Math.PI / 2 - nWB));
  line(onCircle(W5, nWB), onCircle(back, nWB));
  arc(back, nWB, mod(nWB - Math.PI / 2));
  pts.push({ ...pts[0] });
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y));
  return { pts, cum, total: cum[cum.length - 1] };
}
const LOOP = buildTrackLoop();
function trackAt(sIn, out) {
  const { pts, cum, total } = LOOP;
  const s = ((sIn % total) + total) % total;
  let lo = 0;
  let hi = cum.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (cum[mid] <= s) lo = mid;
    else hi = mid;
  }
  const a = pts[lo];
  const b = pts[hi];
  const u = (s - cum[lo]) / (cum[hi] - cum[lo] || 1);
  out.x = a.x + (b.x - a.x) * u;
  out.y = a.y + (b.y - a.y) * u;
  out.heading = Math.atan2(b.y - a.y, b.x - a.x);
}

// ================================================================== model
export function createLightTank() {
  const group = new THREE.Group();
  const ROCK_Y = 0.5;
  const rock = new THREE.Group();
  rock.position.y = ROCK_Y;
  group.add(rock);
  const chassis = new THREE.Group();
  chassis.position.y = -ROCK_Y;
  rock.add(chassis);
  const turret = new THREE.Group();
  turret.position.set(TURRET.x, TURRET.y, 0);
  chassis.add(turret);
  const tracks = new THREE.Group();
  group.add(tracks);
  const slotGroups = { tracks: [tracks], armor: [], engine: [], gun: [], mg: [], sights: [], module: [] };
  const mgSlot = new THREE.Group();
  turret.add(mgSlot);
  slotGroups.mg.push(mgSlot);

  // ---------------------------------------------------------------- hull
  chassis.add(prism(UPPER, UPPER_HALF, UPPER_HALF, camo(0.5, 1)));
  chassis.add(prism(LOWER, LOWER_HALF, LOWER_HALF, camo(0.5, 2)));
  // the rounded transmission cover under the nose
  put(chassis, cyl(0.15, 0.84, C.green, { axis: 'z', seg: 12 }), 1.56, 0.34, 0);
  put(chassis, box(0.02, 0.08, 0.3, C.black, { r: 0.01 }), NOSE + 0.005, 0.6, 0); // blank number plate
  for (const s of [-1, 1]) {
    const z = s * UPPER_HALF;
    // the ledge running the length of the side, bolts along the top edge
    put(chassis, box(3.2, 0.03, 0.04, C.greenDark), 0.05, 0.62, z + s * 0.015);
    for (let x = -1.45; x < 1.4; x += 0.24) put(chassis, box(0.03, 0.03, 0.015, C.black), x, 0.76, z + s * 0.008);
    // the big flat mudguard over the front of the track, a flap at the back
    put(chassis, camoBox(0.05, 0.34, TRACK_W + 0.08, 15 + s), NOSE + 0.03, 0.42, s * TRACK_Z);
    put(chassis, box(0.28, 0.025, TRACK_W + 0.08, C.greenDark, { r: 0.01 }), NOSE - 0.1, 0.6, s * TRACK_Z);
    put(chassis, box(0.04, 0.18, TRACK_W, C.rubber, { r: 0.01 }), REAR - 0.02, 0.42, s * TRACK_Z);
    // the headlight in its octagonal housing on the nose top, set inboard
    const lamp = put(chassis, cyl(0.09, 0.12, C.green, { axis: 'x', seg: 8 }), NOSE - 0.02, 0.76, s * 0.27);
    lamp.rotation.x = Math.PI / 8;
    put(chassis, cyl(0.065, 0.02, C.lamp, { axis: 'x', seg: 12 }), NOSE + 0.045, 0.76, s * 0.27);
    put(chassis, box(0.04, 0.04, 0.05, C.lamp), NOSE - 0.02, 0.74, s * 0.64); // small corner light
    // towing shackle on the nose plate; a mirror on its stalk
    put(chassis, box(0.06, 0.1, 0.05, C.dark, { r: 0.02 }), NOSE + 0.02, 0.56, s * 0.42);
    put(chassis, box(0.03, 0.22, 0.03, C.dark), NOSE - 0.12, 0.88, s * 0.68);
    put(chassis, box(0.02, 0.14, 0.1, C.dark, { r: 0.01 }), NOSE - 0.1, 1.02, s * 0.7);
  }
  // the short slope at the front: the driver's hatch (left), the engine
  // grille (right), canvas rolls across the deck behind
  {
    const slope = -Math.atan2(FRONT_SLOPE.y1 - FRONT_SLOPE.y0, FRONT_SLOPE.x0 - FRONT_SLOPE.x1);
    const onSlope = (x, z) => {
      const g = new THREE.Group();
      const k = (FRONT_SLOPE.x0 - x) / (FRONT_SLOPE.x0 - FRONT_SLOPE.x1);
      g.position.set(x, FRONT_SLOPE.y0 + k * (FRONT_SLOPE.y1 - FRONT_SLOPE.y0), z);
      g.rotation.z = slope;
      chassis.add(g);
      return g;
    };
    const grille = onSlope(1.42, 0.3);
    put(grille, box(0.44, 0.02, 0.4, C.dark), 0, 0.01, 0);
    for (let k = 0; k < 6; k++) put(grille, box(0.025, 0.025, 0.38, C.greenDark), -0.18 + k * 0.072, 0.025, 0);
  }
  put(chassis, cyl(0.16, 0.05, C.green, { seg: 14 }), 0.95, DECK_Y + 0.02, -0.38); // driver's hatch
  put(chassis, box(0.1, 0.07, 0.16, C.dark, { r: 0.015 }), 1.13, DECK_Y + 0.035, -0.38); // his periscope
  put(chassis, box(0.02, 0.04, 0.12, C.glass), 1.185, DECK_Y + 0.04, -0.38);
  for (const z of [-0.36, 0.0, 0.36]) put(chassis, cyl(0.06, 0.32, C.canvas, { axis: 'z', seg: 8 }), 0.62, DECK_Y + 0.06, z);
  put(chassis, box(0.5, 0.18, 0.4, C.canvas, { r: 0.08 }), 0.6, DECK_Y + 0.09, 0.42); // a bundled net
  // the long exhaust along the top of the left side in its mesh guard, a
  // bin under it
  const exZ = -(UPPER_HALF + 0.08);
  put(chassis, cyl(0.1, 1.3, C.mesh, { axis: 'x', seg: 10 }), -0.75, DECK_Y - 0.02, exZ);
  for (let k = 0; k < 12; k++) put(chassis, cyl(0.105, 0.02, C.dark, { axis: 'x', seg: 10 }), -1.35 + k * 0.11, DECK_Y - 0.02, exZ);
  put(chassis, cyl(0.06, 0.18, C.dark, { axis: 'x', seg: 8 }), -0.02, DECK_Y - 0.02, exZ);
  put(chassis, camoBox(1.0, 0.18, 0.12, 5), -0.85, 0.62, -(UPPER_HALF + 0.06));
  // the right side: a long stowage bin along the middle of the hull
  put(chassis, camoBox(1.5, 0.18, 0.1, 6), -0.2, 0.66, UPPER_HALF + 0.05);
  put(chassis, box(1.52, 0.025, 0.12, C.greenDark, { r: 0.01 }), -0.2, 0.76, UPPER_HALF + 0.05);
  // the slatted bin on the rear plate, tail lights either side
  put(chassis, box(0.22, 0.3, 0.9, C.greenDark, { r: 0.02 }), REAR - 0.11, 0.68, 0);
  for (let k = 0; k < 5; k++) put(chassis, box(0.02, 0.025, 0.86, C.slats), REAR - 0.225, 0.56 + k * 0.055, 0);
  for (const z of [-0.6, 0.6]) put(chassis, box(0.03, 0.06, 0.1, C.dark), REAR - 0.015, 0.72, z);

  // ---------------------------------------------------------------- turret
  turret.add(prism(TURRET_PROFILE, TURRET_HALF.bottom, TURRET_HALF.top, camo(0.6, 3)));
  put(turret, cyl(0.5, 0.04, C.dark, { seg: 22 }), 0, 0.01, 0); // turret ring
  {
    // right side: the big slatted box, high up on the front half
    put(turret, box(0.56, 0.3, 0.14, C.greenDark, { r: 0.015 }), 0.25, 0.33, 0.52);
    for (let k = 0; k < 5; k++) put(turret, box(0.52, 0.025, 0.02, C.slats), 0.25, 0.22 + k * 0.055, 0.6);
    // and behind it a round port and a chevron painted on
    put(turret, cyl(0.07, 0.03, C.greenDark, { axis: 'z', seg: 10 }), -0.28, 0.28, 0.47);
    for (const r of [0.6, -0.6]) put(turret, box(0.16, 0.025, 0.01, C.slats), -0.48, 0.28 + (r > 0 ? 0.04 : -0.04), 0.476).rotation.z = r;
    // left side: a big flat-sided bin the length of the turret
    put(turret, camoBox(1.1, 0.44, 0.18, 12), -0.12, 0.24, -0.57);
    put(turret, box(1.12, 0.03, 0.2, C.greenDark, { r: 0.01 }), -0.12, 0.47, -0.57);
    for (const x of [-0.5, 0.0, 0.3]) put(turret, box(0.03, 0.44, 0.01, C.black), x, 0.24, -0.665); // straps
    // bags hung off the back, overhanging, a bustle box under them
    put(turret, camoBox(0.24, 0.28, 0.86, 9), -0.86, 0.16, 0);
    put(turret, box(0.34, 0.3, 0.9, C.canvas, { r: 0.1 }), -0.9, 0.42, -0.05);
    put(turret, box(0.26, 0.22, 0.4, C.greenDark, { r: 0.08 }), -0.86, 0.6, 0.22);
    put(turret, cyl(0.08, 0.8, C.brown, { axis: 'z', seg: 8 }), -0.78, 0.6, -0.18);
    // the mantlet housing at the front, rounded, round the gun
    put(turret, box(0.2, 0.3, 0.34, C.greenDark, { r: 0.04 }), 0.74, GUN_Y, GUN_Z);
    put(turret, cyl(0.15, 0.26, C.green, { axis: 'x', seg: 12 }), 0.86, GUN_Y, GUN_Z);
    // smoke dischargers: four capped tubes on each front corner, up and out
    for (const s of [-1, 1]) {
      const rack = new THREE.Group();
      rack.position.set(0.5, 0.42, s * 0.46);
      rack.rotation.set(0, -s * 0.3, 0.5);
      turret.add(rack);
      put(rack, box(0.08, 0.14, 0.18, C.greenDark, { r: 0.01 }), -0.05, 0, 0);
      for (const [dy, dz] of [[-0.04, -0.045], [-0.04, 0.045], [0.04, -0.045], [0.04, 0.045]]) {
        put(rack, cyl(0.03, 0.2, C.green, { axis: 'x', seg: 8 }), 0.07, dy, dz);
        put(rack, cyl(0.036, 0.04, C.dark, { axis: 'x', seg: 8 }), 0.18, dy, dz);
      }
    }
    // roof: the commander's hooded sight (left), the gunner's sight (right),
    // two hatches behind, periscopes round the edge
    const sight = (x, z, w, h, d) => {
      const sg = new THREE.Group();
      sg.position.set(x, ROOF, z);
      turret.add(sg);
      put(sg, cyl(d * 0.55, 0.05, C.greenDark, { seg: 12 }), 0, 0.025, 0);
      put(sg, camoBox(w, h, d, 14 + z * 10), 0, 0.05 + h / 2, 0);
      put(sg, box(w + 0.08, 0.05, d + 0.04, C.dark, { r: 0.015 }), 0.05, 0.05 + h + 0.02, 0).rotation.z = -0.15; // the hood
      put(sg, box(0.05, h * 0.6, d * 0.86, C.dark, { r: 0.01 }), w / 2 + 0.02, 0.05 + h * 0.5, 0); // window frame
      put(sg, box(0.02, h * 0.42, d * 0.64, C.glass, { r: 0.004 }), w / 2 + 0.045, 0.05 + h * 0.5, 0);
      put(sg, box(0.012, h * 0.1, d * 0.4, C.glint), w / 2 + 0.056, 0.05 + h * 0.6, -d * 0.05);
      for (const sz of [-1, 1]) put(sg, box(0.14, 0.02, 0.02, C.dark), 0, 0.05 + h * 0.55, sz * (d / 2 + 0.02)); // grab handles
    };
    sight(0.24, -0.2, 0.26, 0.24, 0.26);
    sight(0.3, 0.2, 0.22, 0.18, 0.22);
    put(turret, cyl(0.15, 0.04, C.green, { seg: 14 }), COMMANDER.x, ROOF + 0.02, COMMANDER.z);
    put(turret, cyl(0.14, 0.04, C.green, { seg: 14 }), -0.24, ROOF + 0.02, 0.2);
    for (const [x, z] of [[-0.02, -0.38], [-0.45, -0.34], [-0.45, 0.34], [0.5, 0.0]]) put(turret, box(0.07, 0.07, 0.08, C.dark, { r: 0.01 }), x, ROOF + 0.035, z);
  }
  // two whip antennas at the back corners
  const antennas = [];
  for (const [x, z] of [[-0.62, -0.38], [-0.24, 0.4]]) {
    put(turret, cyl(0.04, 0.08, C.dark, { seg: 6 }), x, ROOF + 0.04, z);
    const geo = new THREE.CylinderGeometry(0.012, 0.012, 1.5, 4);
    geo.translate(0, 0.75, 0);
    const a = new THREE.Mesh(geo, toon(C.dark));
    a.position.set(x, ROOF + 0.08, z);
    turret.add(a);
    antennas.push({ obj: a, v: 0, a: 0 });
  }

  // ------------------------------------------------------------------- gun
  // a thick jacket out of the mantlet, then the thin barrel
  const gunPivot = new THREE.Group();
  gunPivot.position.set(GUN_BASE_X, GUN_Y, GUN_Z);
  turret.add(gunPivot);
  slotGroups.gun.push(gunPivot);
  {
    put(gunPivot, cyl(0.07, 0.36, C.green, { axis: 'x', seg: 10 }), 0.28, 0, 0); // jacket
    put(gunPivot, cyl(0.075, 0.04, C.greenDark, { axis: 'x', seg: 10 }), 0.47, 0, 0); // its end ring
    put(gunPivot, cyl(0.032, 0.72, C.dark, { axis: 'x', seg: 8 }), 0.84, 0, 0); // barrel
    put(gunPivot, cyl(0.045, 0.1, C.dark, { axis: 'x', seg: 8 }), 1.18, 0, 0); // muzzle
    put(turret, cyl(0.02, 0.24, C.dark, { axis: 'x', seg: 6 }), GUN_BASE_X + 0.02, GUN_Y - 0.08, GUN_Z - 0.18); // coax MG
  }

  // ---------------------------------------------------------------- roof MG
  const mgPivot = new THREE.Group();
  mgPivot.position.set(COMMANDER.x + 0.12, ROOF + 0.26, COMMANDER.z);
  mgSlot.add(mgPivot);
  put(mgSlot, cyl(0.025, 0.16, C.steel, { seg: 6 }), COMMANDER.x + 0.12, ROOF + 0.16, COMMANDER.z);
  put(mgPivot, box(0.3, 0.08, 0.08, C.dark, { r: 0.02 }), 0, 0, 0);
  put(mgPivot, cyl(0.022, 0.5, C.dark, { axis: 'x', seg: 6 }), 0.38, 0.01, 0);
  const mgFlash = put(mgPivot, new THREE.Group(), 0.66, 0.01, 0);
  put(mgFlash, box(0.1, 0.1, 0.1, 0xfff3c4, { glow: true, r: 0.02 }));
  put(mgFlash, box(0.28, 0.04, 0.04, 0xffc24a, { glow: true, r: 0.01 }), 0.1, 0, 0);
  mgFlash.visible = false;

  // ---------------------------------------------------------------- tracks
  const spinners = [];
  const trackPt = { x: 0, y: 0, heading: 0 };
  const linkCount = Math.round(LOOP.total / 0.08);
  const linkSpacing = LOOP.total / linkCount;
  const linkGeo = (() => {
    const plate = new RoundedBoxGeometry(0.068, 0.028, TRACK_W, 1, 0.01);
    const grouser = new THREE.BoxGeometry(0.022, 0.018, TRACK_W * 0.9).toNonIndexed();
    grouser.translate(0, 0.02, 0);
    return mergeGeometries([plate, grouser]);
  })();
  const trackSets = [];
  let trackOffset = 0;
  const dummy = new THREE.Object3D();
  for (const s of [-1, 1]) {
    const links = new THREE.InstancedMesh(linkGeo, toon(0xffffff), linkCount);
    links.castShadow = links.receiveShadow = true;
    links.frustumCulled = false;
    const a = new THREE.Color(C.trackA);
    const b = new THREE.Color(C.trackB);
    for (let i = 0; i < linkCount; i++) links.setColorAt(i, i % 2 ? a : b);
    tracks.add(links);
    trackSets.push({ links, zc: s * TRACK_Z });
    // road wheels: rubber tyre, a solid dished disc, a hub with six bolts
    for (const x of ROAD_WHEELS) {
      const p = new THREE.Group();
      p.position.set(x, WHEEL_Y, s * TRACK_Z);
      p.userData.radius = WHEEL_R;
      put(p, cyl(WHEEL_R, 0.2, C.rubber, { axis: 'z', seg: 18 }), 0, 0, 0);
      put(p, cyl(WHEEL_R * 0.8, 0.22, C.green, { axis: 'z', seg: 18 }), 0, 0, 0);
      put(p, cyl(0.06, 0.25, C.greenDark, { axis: 'z', seg: 10 }), 0, 0, 0);
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * TAU;
        put(p, box(0.022, 0.022, 0.02, C.black), Math.cos(ang) * 0.042, Math.sin(ang) * 0.042, s * 0.128);
      }
      tracks.add(p);
      spinners.push(p);
    }
    // the toothed drive sprocket at the front, the spoked idler at the back
    for (const [w, teeth] of [[SPROCKET, 10], [IDLER, 0]]) {
      const p = new THREE.Group();
      p.position.set(w.x, w.y, s * TRACK_Z);
      p.userData.radius = w.r;
      put(p, cyl(w.r, 0.16, teeth ? C.dark : C.green, { axis: 'z', seg: 14 }), 0, 0, 0);
      put(p, cyl(0.05, 0.2, C.dark, { axis: 'z', seg: 8 }), 0, 0, 0);
      for (let k = 0; k < (teeth || 5); k++) {
        const ang = (k / (teeth || 5)) * TAU;
        if (teeth) put(p, box(0.05, 0.05, 0.1, C.dark), Math.cos(ang) * (w.r + 0.01), Math.sin(ang) * (w.r + 0.01), 0).rotation.z = ang;
        else put(p, box(w.r * 0.9, 0.025, 0.02, C.dark), Math.cos(ang) * w.r * 0.45, Math.sin(ang) * w.r * 0.45, s * 0.085).rotation.z = ang; // spokes
      }
      tracks.add(p);
      spinners.push(p);
    }
  }
  function updateTracks() {
    for (const { links, zc } of trackSets) {
      for (let i = 0; i < linkCount; i++) {
        trackAt(i * linkSpacing + trackOffset, trackPt);
        dummy.position.set(trackPt.x, trackPt.y, zc);
        dummy.rotation.set(0, 0, trackPt.heading);
        dummy.updateMatrix();
        links.setMatrixAt(i, dummy.matrix);
      }
      links.instanceMatrix.needsUpdate = true;
    }
  }
  updateTracks();

  // ------------------------------------------------------------- behaviour
  const tmp = new THREE.Vector3();
  const prevPos = new THREE.Vector3();
  const prevVel = new THREE.Vector3();
  const vel = new THREE.Vector3();
  let hasPrev = false;
  let recoil = 0;
  let gunElev = 0;
  let mgElev = 0;
  let mgTimer = 0;
  let bumpTimer = 0.4;
  let aimError = 0;
  const mgWorld = new THREE.Vector3();
  const events = [];
  const spring = { pitch: 0, vPitch: 0, roll: 0, vRoll: 0 };
  const step = (x, v, k, d, f, dt) => {
    v += (-k * x - d * v + f) * dt;
    return [x + v * dt, v];
  };

  function fire() {
    recoil = 1;
    spring.vPitch += 0.35; // a small gun: a small kick
    group.updateWorldMatrix(true, true);
    return {
      position: gunPivot.localToWorld(new THREE.Vector3(MUZZLE_X, 0, 0)),
      direction: new THREE.Vector3(1, 0, 0).transformDirection(gunPivot.matrixWorld),
      breech: gunPivot.localToWorld(new THREE.Vector3(0, 0, 0)),
      quadrant: 0,
    };
  }
  function muzzle() {
    gunPivot.updateWorldMatrix(true, false);
    return {
      position: gunPivot.localToWorld(new THREE.Vector3(MUZZLE_X, 0, 0)),
      direction: new THREE.Vector3(1, 0, 0).transformDirection(gunPivot.matrixWorld),
      breech: gunPivot.localToWorld(new THREE.Vector3(0, 0, 0)),
    };
  }

  function update(dt, t, ctx = {}) {
    group.getWorldPosition(tmp);
    const yaw = group.rotation.y;
    if (ctx.aimPoint) {
      const want = wrapAngle(Math.atan2(-(ctx.aimPoint.z - tmp.z), ctx.aimPoint.x - tmp.x) - yaw);
      turret.rotation.y = approachAngle(turret.rotation.y, want, TURRET_SPEED * dt);
      aimError = Math.abs(wrapAngle(want - turret.rotation.y));
      const dist = Math.hypot(ctx.aimPoint.x - tmp.x, ctx.aimPoint.z - tmp.z) - GUN_BASE_X;
      const dy = ctx.aimPoint.y - (tmp.y + TURRET.y + GUN_Y);
      const wantE = THREE.MathUtils.clamp(Math.atan2(dy, Math.max(0.4, dist)), GUN_DEPRESSION, GUN_ELEVATION);
      gunElev += THREE.MathUtils.clamp(wantE - gunElev, -GUN_PITCH_SPEED * dt, GUN_PITCH_SPEED * dt);
    }
    if (ctx.mgPoint) {
      const want = wrapAngle(Math.atan2(-(ctx.mgPoint.z - tmp.z), ctx.mgPoint.x - tmp.x) - yaw - turret.rotation.y);
      mgPivot.rotation.y = approachAngle(mgPivot.rotation.y, want, MG_SPEED * dt);
      mgPivot.getWorldPosition(mgWorld);
      const dist = Math.hypot(ctx.mgPoint.x - mgWorld.x, ctx.mgPoint.z - mgWorld.z);
      const wantP = THREE.MathUtils.clamp(Math.atan2(ctx.mgPoint.y - mgWorld.y, Math.max(0.3, dist)), -0.3, 1.0);
      mgElev += THREE.MathUtils.clamp(wantP - mgElev, -4 * dt, 4 * dt);
      mgPivot.rotation.z = mgElev;
    }

    // running gear
    const speed = ctx.speed || 0;
    for (const w of spinners) w.rotation.z -= (speed * dt) / w.userData.radius;
    if (speed) {
      trackOffset += speed * dt;
      updateTracks();
    }

    // the hull leans with acceleration and rocks over bumps (lighter, livelier)
    let fwdAcc = 0;
    let latAcc = 0;
    if (dt > 0 && hasPrev) {
      vel.copy(tmp).sub(prevPos).divideScalar(dt);
      const acc = vel.clone().sub(prevVel).divideScalar(dt);
      if (acc.length() > 30) acc.setLength(30);
      fwdAcc = acc.x * Math.cos(yaw) - acc.z * Math.sin(yaw);
      latAcc = acc.x * Math.sin(yaw) + acc.z * Math.cos(yaw);
      prevVel.copy(vel);
    }
    prevPos.copy(tmp);
    hasPrev = true;
    if (Math.abs(speed) > 0.05) {
      bumpTimer -= dt;
      if (bumpTimer <= 0) {
        bumpTimer = 0.18 + Math.random() * 0.4;
        spring.vPitch += (Math.random() - 0.5) * 0.6;
        spring.vRoll += (Math.random() - 0.5) * 0.5;
      }
    }
    [spring.pitch, spring.vPitch] = step(spring.pitch, spring.vPitch, 110, 9, fwdAcc * 0.014, dt);
    [spring.roll, spring.vRoll] = step(spring.roll, spring.vRoll, 110, 9, -latAcc * 0.014, dt);
    rock.rotation.set(spring.roll, 0, spring.pitch);
    rock.position.y = ROCK_Y + Math.abs(Math.sin(t * 14)) * 0.01 * Math.min(1, Math.abs(speed));
    // antennas whip about
    for (const a of antennas) {
      [a.a, a.v] = step(a.a, a.v, 40, 3, -fwdAcc * 0.05, dt);
      a.obj.rotation.z = THREE.MathUtils.clamp(a.a, -0.5, 0.5);
    }

    // the gun: a short sharp recoil, quick run-out
    recoil = Math.max(0, recoil - dt * 8);
    gunPivot.position.x = GUN_BASE_X - recoil * 0.12;
    gunPivot.rotation.z = gunElev;

    // roof MG: bursts while it has a target
    events.length = 0;
    mgFlash.visible = false;
    if (ctx.mgPoint) {
      mgTimer -= dt;
      if (Math.sin(t * 2.4) > -0.3 && mgTimer <= 0) {
        mgTimer = 0.07;
        mgFlash.visible = true;
        mgFlash.rotation.x = Math.random() * Math.PI;
        group.updateWorldMatrix(true, true);
        events.push({
          type: 'mg',
          muzzle: mgPivot.localToWorld(new THREE.Vector3(0.66, 0.01, 0)),
          eject: mgPivot.localToWorld(new THREE.Vector3(0.05, 0.03, 0.06)),
          ejectDir: new THREE.Vector3(0, 0, 1).transformDirection(mgPivot.matrixWorld),
          target: ctx.mgPoint.clone(),
        });
      }
    }
  }

  const commanderTop = new THREE.Vector3(COMMANDER.x, ROOF + 0.3, COMMANDER.z);
  return {
    kind: 'light',
    group,
    chassis,
    turret,
    mgMount: mgSlot,
    slotGroups,
    setSlotVisible(name, visible) {
      for (const g of slotGroups[name] || []) g.visible = visible;
    },
    fire,
    muzzle,
    update,
    events,
    aimError: () => aimError,
    // no rocket drums on this one: its Breakthrough is driven by the game
    setRocket() {},
    rocketNozzles: () => [],
    setFlameStyle() {},
    commanderTop,
    rocketK: 0,
  };
}
