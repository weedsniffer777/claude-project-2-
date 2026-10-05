// The missile tank: an AFT-10 style launcher on a long, low infantry-carrier
// hull. Forward is +X, up is +Y; same interface as the other tanks, so the
// game can drive any of them.
//
// After the reference photos:
//  - the hull: long and low, a long shallow glacis at the front running up
//    from a short nose plate to a flat deck; the driver's hatch front left,
//    the commander's cupola front right with its hooded sight; an exhaust
//    louvre on the right of the glacis; tow hooks, headlights in guards
//  - skirts down the sides over the top of the track, in panels, the front
//    one angled; the running gear under them: six road wheels (one fewer
//    than the real thing, for the compact look), the sprocket at the front,
//    the idler at the back, return rollers on top
//  - the launcher on the rear deck: a low turntable, a cradle on two side
//    arms, and the canister pack on it: two rows of four square canisters,
//    their ends ribbed; it raises to fire, the missiles leaving one canister
//    after another
//  - Chinese-style digital camo (pixel blocks of greens, tan and brown), no
//    markings
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { box, cyl, put, toon, wrapAngle, approachAngle, gradientMap } from './kit.js';

const C = {
  green: 0x5f7040,
  greenDark: 0x45532e,
  tan: 0xa89466,
  dark: 0x23261f,
  steel: 0x5d6368,
  rubber: 0x262625,
  trackA: 0x3a3936,
  trackB: 0x2c2b29,
  glass: 0x1d1f22,
  lamp: 0xe0d49a,
  wheelHub: 0x8a6a44, // the bronze-ish hub caps in the photos
};
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- layout
const NOSE = 2.05;
const REAR = -1.95;
const DECK_Y = 1.0;
// upper hull, full width over the tracks; side profile, counter-clockwise
const UPPER = [[REAR, 0.5], [1.95, 0.5], [NOSE, 0.58], [NOSE, 0.68], [0.75, DECK_Y], [REAR + 0.03, DECK_Y], [REAR, 0.96]];
const UPPER_HALF = 0.8;
const LOWER = [[REAR + 0.05, 0.2], [1.6, 0.2], [1.95, 0.42], [1.95, 0.51], [REAR + 0.05, 0.51]];
const LOWER_HALF = 0.48;
const GLACIS = { x0: NOSE, y0: 0.68, x1: 0.75, y1: DECK_Y };
const TRACK_Z = 0.66;
const TRACK_W = 0.34;
const LINK_T = 0.035;
const WHEEL_R = 0.22;
const WHEEL_Y = WHEEL_R + LINK_T;
const ROAD_WHEELS = [1.25, 0.72, 0.19, -0.34, -0.87, -1.4];
const SPROCKET = { x: 1.74, y: 0.44, r: 0.18 };
const IDLER = { x: -1.78, y: 0.42, r: 0.16 };
const ROLLERS = [1.0, -0.1, -1.15];
// the launcher: a turntable on the rear deck, the pack on a cradle
const TURRET = { x: -0.95, y: DECK_Y };
const PIVOT = { x: 0.15, y: 0.42 }; // the cradle's trunnion (turret-local)
const POD = { len: 1.35, cw: 0.3, gap: 0.04, rows: 2, cols: 4 };
const TURRET_SPEED = 5;
const POD_REST = 0.12; // the pack's angle at rest, nose up a little
const POD_MAX = 0.5;
const POD_SPEED = 1.6;

// ------------------------------------------------------- digital camo
// Pixel blocks of four colours in clumps, drawn small and sampled
// nearest, so it reads as the chunky digital pattern.
let camoTex = null;
function camoTexture() {
  if (camoTex) return camoTex;
  // three colours: a light green ground, dark green and tan blocks, in
  // big chunky clumps
  const N = 24;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  const cols = ['#76874d', '#46552f', '#a68c5c'];
  g.fillStyle = cols[0];
  g.fillRect(0, 0, N, N);
  let seed = 11;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const P = 3; // the pixel block size
  const clump = (col, n, steps) => {
    g.fillStyle = col;
    for (let k = 0; k < n; k++) {
      let x = ((rand() * N) / P) | 0;
      let y = ((rand() * N) / P) | 0;
      for (let i = 0; i < steps; i++) {
        for (const [dx, dy] of [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N]]) g.fillRect(x * P + dx, y * P + dy, P, P);
        x = (x + ((rand() * 3) | 0) - 1 + N / P) % (N / P);
        y = (y + ((rand() * 3) | 0) - 1 + N / P) % (N / P);
      }
    }
  };
  clump(cols[1], 7, 11); // plenty of dark green
  clump(cols[2], 4, 7);
  camoTex = new THREE.CanvasTexture(c);
  camoTex.colorSpace = THREE.SRGBColorSpace;
  camoTex.magFilter = camoTex.minFilter = THREE.NearestFilter;
  camoTex.wrapS = camoTex.wrapT = THREE.RepeatWrapping;
  return camoTex;
}
function camo(scale = 0.3, shift = 0) {
  const t = camoTexture().clone();
  t.needsUpdate = true;
  t.repeat.set(scale, scale);
  t.offset.set(shift * 0.37, shift * 0.61);
  return new THREE.MeshToonMaterial({ map: t, gradientMap });
}
// a box painted in the camo at the same scale as the hull (world-unit UVs
// on every face, so nothing's stretched)
const camoMat = camo(0.3, 0);
function camoBox(w, h, d) {
  const m = prism([[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]], d / 2, d / 2, camoMat);
  return m;
}
// a convex side profile given depth, planar UVs per face in world units
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
    tri(P(points[0], 1), P(points[i], 1), P(points[i + 1], 1));
    tri(P(points[0], -1), P(points[i + 1], -1), P(points[i], -1));
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
// over the sprocket, along the return rollers, round the idler, under the
// road wheels
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
  line({ x: back.x, y: back.y + back.r }, { x: front.x, y: front.y + front.r }, 0.03);
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
export function createMissileTank() {
  const group = new THREE.Group();
  const ROCK_Y = 0.55;
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

  // ---------------------------------------------------------------- hull
  chassis.add(prism(UPPER, UPPER_HALF, UPPER_HALF, camo(0.3, 1)));
  chassis.add(prism(LOWER, LOWER_HALF, LOWER_HALF, camo(0.3, 2)));
  // the glacis: things on its slope
  const slope = -Math.atan2(GLACIS.y1 - GLACIS.y0, GLACIS.x0 - GLACIS.x1);
  const onSlope = (x, z) => {
    const g = new THREE.Group();
    const k = (GLACIS.x0 - x) / (GLACIS.x0 - GLACIS.x1);
    g.position.set(x, GLACIS.y0 + k * (GLACIS.y1 - GLACIS.y0), z);
    g.rotation.z = slope;
    chassis.add(g);
    return g;
  };
  // the exhaust louvre (right) and the driver's hatch with its periscopes (left)
  {
    const lv = onSlope(1.45, 0.42);
    put(lv, box(0.62, 0.02, 0.5, C.dark), 0, 0.01, 0);
    for (let k = 0; k < 8; k++) put(lv, box(0.03, 0.03, 0.48, C.greenDark), -0.27 + k * 0.077, 0.025, 0);
    // the driver's hatch: a square plate with a hinge, set flush on the
    // slope, and a block of three periscopes ahead of it
    const dh = onSlope(1.0, -0.42);
    put(dh, box(0.36, 0.04, 0.34, C.greenDark, { r: 0.012 }), 0, 0.025, 0);
    put(dh, box(0.3, 0.02, 0.28, C.green, { r: 0.01 }), 0, 0.05, 0);
    put(dh, box(0.04, 0.05, 0.3, C.dark, { r: 0.01 }), -0.17, 0.05, 0); // the hinge
    put(dh, box(0.1, 0.06, 0.32, C.greenDark, { r: 0.012 }), 0.26, 0.035, 0);
    for (const dz of [-0.1, 0, 0.1]) put(dh, box(0.02, 0.035, 0.07, C.glass), 0.315, 0.04, dz);
    // a raised strake across the glacis, as on the real one
    const st = onSlope(1.7, 0);
    put(st, box(0.06, 0.04, UPPER_HALF * 2 - 0.1, C.greenDark, { r: 0.01 }), 0, 0.02, 0);
  }
  // the nose: headlights in guards, tow hooks, a dark plate
  for (const s of [-1, 1]) {
    put(chassis, box(0.12, 0.1, 0.16, C.greenDark, { r: 0.02 }), NOSE - 0.04, 0.74, s * 0.6);
    put(chassis, box(0.02, 0.07, 0.12, C.lamp), NOSE + 0.025, 0.74, s * 0.6);
    put(chassis, box(0.04, 0.12, 0.04, C.dark), NOSE + 0.04, 0.78, s * 0.52); // guard bar
    put(chassis, box(0.08, 0.1, 0.06, C.dark, { r: 0.02 }), NOSE + 0.03, 0.52, s * 0.36); // tow hook
  }
  // the skirts down each side over the track: panels with bolts along the
  // top, the front one angled down toward the sprocket
  for (const s of [-1, 1]) {
    const z = s * (UPPER_HALF + 0.035);
    // panels whose bottom edges dip to a shallow point in the middle of
    // each, so the skirt's lower edge runs in slight chevrons
    for (const [x0, x1] of [[-1.9, -1.05], [-1.03, -0.18], [-0.16, 0.69], [0.71, 1.56]]) {
      const w = x1 - x0;
      put(chassis, camoBox(w, 0.24, 0.05, 20 + x0 * 3 + s), (x0 + x1) / 2, 0.7, z);
      for (const h of [-1, 1]) {
        const lip = put(chassis, camoBox(w / 2 + 0.02, 0.12, 0.05, 25 + x0 * 3 + h), (x0 + x1) / 2 + (h * w) / 4, 0.55, z);
        lip.rotation.z = h * 0.14;
      }
      put(chassis, box(0.03, 0.34, 0.06, C.greenDark), x1 + 0.01, 0.66, z); // the seam
    }
    // a stowage box and a lamp on the rear side
    put(chassis, camoBox(0.5, 0.2, 0.12, 40 + s), -1.4, 0.92, s * (UPPER_HALF + 0.05));
    put(chassis, box(0.06, 0.06, 0.06, C.lamp), REAR - 0.02, 0.86, s * 0.68);
  }
  // the commander's cupola and sight, front right of the deck; antennas
  const cup = new THREE.Group();
  cup.position.set(0.45, DECK_Y, 0.38);
  chassis.add(cup);
  // a low collar, the hatch ring, the lid swung open behind, four
  // periscopes round the front of the ring
  put(cup, cyl(0.25, 0.1, C.greenDark, { seg: 16 }), 0, 0.05, 0);
  put(cup, cyl(0.21, 0.05, C.green, { seg: 16 }), 0, 0.125, 0);
  put(cup, cyl(0.15, 0.02, 0x15160f, { seg: 14 }), 0, 0.15, 0); // the open hatch
  const lid = put(cup, cyl(0.17, 0.035, C.green, { seg: 14 }), -0.24, 0.26, 0);
  lid.rotation.z = 1.25;
  for (const a of [-0.9, -0.3, 0.3, 0.9]) {
    const pz = put(cup, box(0.07, 0.06, 0.06, C.greenDark, { r: 0.01 }), Math.cos(a) * 0.22, 0.13, Math.sin(a) * 0.22);
    pz.rotation.y = -a;
    put(cup, box(0.01, 0.03, 0.045, C.glass), Math.cos(a) * 0.258, 0.13, Math.sin(a) * 0.258).rotation.y = -a;
  }
  // the hooded sight box ahead of it, like the photos' angular head
  const sh = put(chassis, camoBox(0.34, 0.28, 0.3, 50), 0.82, DECK_Y + 0.14, 0.42);
  sh.rotation.z = -0.15;
  put(chassis, box(0.02, 0.1, 0.22, C.glass), 1.0, DECK_Y + 0.17, 0.42);
  put(chassis, box(0.12, 0.03, 0.34, C.greenDark, { r: 0.01 }), 0.94, DECK_Y + 0.29, 0.42);
  const antennas = [];
  for (const [x, z] of [[-1.7, -0.6], [-1.7, 0.6]]) {
    put(chassis, cyl(0.04, 0.08, C.dark, { seg: 6 }), x, DECK_Y + 0.04, z);
    const geo = new THREE.CylinderGeometry(0.012, 0.012, 1.7, 4);
    geo.translate(0, 0.85, 0);
    const a = new THREE.Mesh(geo, toon(C.dark));
    a.position.set(x, DECK_Y + 0.08, z);
    chassis.add(a);
    antennas.push({ obj: a, v: 0, a: 0 });
  }
  // the rear: the troop door, tail lights, a grille
  put(chassis, box(0.04, 0.42, 0.62, C.greenDark, { r: 0.02 }), REAR - 0.02, 0.72, 0);
  put(chassis, box(0.04, 0.04, 0.12, C.dark), REAR - 0.05, 0.72, 0.22);
  // the Retreat: two exhaust outlets up at the front corners of the hull,
  // angled a little forward; they fire forward and rocket it backwards
  const flameMats = [0.5, 0.75, 1].map((opacity) => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  const plumes = [];
  const nozzles = [];
  for (const s of [-1, 1]) {
    const at = new THREE.Vector3(1.62, 0.9, s * (UPPER_HALF + 0.06));
    const ex = new THREE.Group();
    ex.position.copy(at);
    ex.rotation.y = s * 0.25; // splayed a little outward, pointing forward
    chassis.add(ex);
    put(ex, box(0.34, 0.2, 0.18, C.greenDark, { r: 0.03 }), -0.1, 0, 0); // its housing
    put(ex, cyl(0.08, 0.16, C.dark, { axis: 'x', seg: 10 }), 0.12, 0, 0);
    put(ex, cyl(0.065, 0.02, 0x0f1011, { axis: 'x', seg: 10 }), 0.2, 0, 0);
    const flame = new THREE.Group();
    flame.position.set(0.22, 0, 0);
    flame.rotation.y = Math.PI; // (the plumes run out along -x: turned to face forward)
    flame.visible = false;
    ex.add(flame);
    at.copy(ex.localToWorld(new THREE.Vector3(0.22, 0, 0)));
    const plume = (prof, layer) => {
      const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 10);
      g.rotateZ(Math.PI / 2);
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 4), 4));
      const m = new THREE.Mesh(g, flameMats[layer]);
      m.userData.fx = true;
      m.userData.len = prof[prof.length - 1][1];
      m.userData.layer = layer;
      flame.add(m);
      plumes.push(m);
    };
    plume([[0.09, 0], [0.19, 0.3], [0.3, 0.8], [0.4, 1.35], [0.46, 1.7], [0.38, 1.95], [0.2, 2.1], [0, 2.15]], 0);
    plume([[0.08, 0], [0.13, 0.25], [0.2, 0.7], [0.24, 1.05], [0.17, 1.25], [0, 1.35]], 1);
    plume([[0.065, 0], [0.08, 0.12], [0.085, 0.3], [0.06, 0.52], [0, 0.65]], 2);
    nozzles.push({ flame, at });
  }

  // ------------------------------------------------------------- launcher
  // the turntable, a low housing, two side arms up to the cradle
  put(turret, cyl(0.62, 0.06, C.dark, { seg: 22 }), 0, 0.03, 0);
  turret.add(prism([[-0.6, 0], [0.55, 0], [0.62, 0.12], [0.5, 0.26], [-0.6, 0.26]], 0.58, 0.5, camo(0.5, 3)));
  for (const s of [-1, 1]) {
    const arm = put(turret, camoBox(0.32, 0.36, 0.08, 60 + s), PIVOT.x - 0.05, 0.36, s * 0.66);
    arm.rotation.z = 0.1;
    put(turret, cyl(0.08, 0.1, C.dark, { axis: 'z', seg: 10 }), PIVOT.x, PIVOT.y, s * 0.72);
  }
  put(turret, box(0.18, 0.18, 0.18, C.greenDark, { r: 0.02 }), -0.45, 0.35, 0.3); // the guidance box
  put(turret, cyl(0.03, 0.2, C.dark, { seg: 6 }), -0.45, 0.52, 0.3);
  // the cradle and the canister pack: pivots at its middle; +x the way it fires
  const gunPivot = new THREE.Group();
  gunPivot.position.set(PIVOT.x, PIVOT.y, 0);
  turret.add(gunPivot);
  slotGroups.gun.push(gunPivot);
  const mouths = [];
  const caps = []; // the canisters' covers: blown off by the missile, back on after a reload
  {
    // two packs of four (2 x 2) side by side on the cradle, a gap between
    const { len, cw, gap } = POD;
    const SPLIT = 0.16;
    const y0 = 0.12 + cw / 2;
    const packW = 2 * cw + gap;
    put(gunPivot, box(len * 0.9, 0.08, 2 * packW + SPLIT + 0.08, C.greenDark, { r: 0.02 }), 0, 0.06, 0); // the cradle
    for (const side of [-1, 1]) {
      const zc = side * (packW / 2 + SPLIT / 2);
      for (let r = 0; r < 2; r++) {
        for (let c = 0; c < 2; c++) {
          const y = y0 + r * (cw + gap);
          const z = zc - packW / 2 + cw / 2 + c * (cw + gap);
          put(gunPivot, camoBox(len, cw, cw, 70 + r * 4 + c + side * 9, 0.015), 0, y, z);
          for (const ex of [-1, 1]) put(gunPivot, box(0.05, cw + 0.02, cw + 0.02, C.greenDark, { r: 0.01 }), ex * (len / 2 - 0.02), y, z);
          // the open end: thin walls round a dark bore (seen once its cover's gone)
          put(gunPivot, box(0.02, cw - 0.05, cw - 0.05, 0x111210), len / 2 + 0.006, y, z);
          // its cover: a thin olive cap with a raised cross and a boss
          const cap = new THREE.Group();
          cap.position.set(len / 2 + 0.03, y, z);
          put(cap, box(0.03, cw - 0.01, cw - 0.01, C.green, { r: 0.008 }), 0, 0, 0);
          put(cap, box(0.015, cw - 0.06, 0.03, C.greenDark), 0.02, 0, 0);
          put(cap, box(0.015, 0.03, cw - 0.06, C.greenDark), 0.02, 0, 0);
          put(cap, cyl(0.035, 0.02, C.tan, { axis: 'x', seg: 8 }), 0.03, 0, 0);
          gunPivot.add(cap);
          caps.push({ g: cap, home: cap.position.clone(), on: true, t: 0, vel: new THREE.Vector3(), spin: new THREE.Vector3() });
          const m = new THREE.Object3D();
          m.position.set(len / 2 + 0.05, y, z);
          gunPivot.add(m);
          mouths.push(m);
        }
      }
      // each pack's straps: rings wrapped round all four canisters at a
      // quarter and three quarters of their length
      const ph = 2 * cw + gap;
      const pyc = y0 + (cw + gap) / 2;
      for (const rx of [-len / 4, len / 4]) {
        for (const sy of [-1, 1]) put(gunPivot, box(0.07, 0.035, packW + 0.07, 0x6d7076, { r: 0.008 }), rx, pyc + sy * (ph / 2 + 0.0175), zc);
        for (const s2 of [-1, 1]) put(gunPivot, box(0.07, ph + 0.07, 0.035, 0x6d7076, { r: 0.008 }), rx, pyc, zc + s2 * (packW / 2 + 0.0175));
      }
    }
  }
  // order: top row first, alternating sides, so it ripples across
  const order = [2, 6, 3, 7, 0, 4, 1, 5]; // top rows first, alternating packs
  let next = 0;

  // ---------------------------------------------------------------- roof MG
  const mgSlot = new THREE.Group();
  chassis.add(mgSlot);
  slotGroups.mg.push(mgSlot);
  const mgPivot = new THREE.Group();
  const MG = { x: 0.45, y: DECK_Y + 0.42, z: 0.38 };
  mgPivot.position.set(MG.x, MG.y, MG.z);
  mgSlot.add(mgPivot);
  put(mgSlot, cyl(0.025, 0.26, C.steel, { seg: 6 }), MG.x, MG.y - 0.15, MG.z);
  put(mgPivot, box(0.3, 0.08, 0.08, C.dark, { r: 0.02 }), 0, 0, 0);
  put(mgPivot, cyl(0.022, 0.5, C.dark, { axis: 'x', seg: 6 }), 0.38, 0.01, 0);
  const mgFlash = put(mgPivot, new THREE.Group(), 0.66, 0.01, 0);
  put(mgFlash, box(0.1, 0.1, 0.1, 0xfff3c4, { glow: true, r: 0.02 }));
  put(mgFlash, box(0.28, 0.04, 0.04, 0xffc24a, { glow: true, r: 0.01 }), 0.1, 0, 0);
  mgFlash.visible = false;

  // ---------------------------------------------------------------- tracks
  const spinners = [];
  const trackPt = { x: 0, y: 0, heading: 0 };
  const linkCount = Math.round(LOOP.total / 0.09);
  const linkSpacing = LOOP.total / linkCount;
  const linkGeo = (() => {
    const plate = new RoundedBoxGeometry(0.078, 0.03, TRACK_W, 1, 0.01);
    const grouser = new THREE.BoxGeometry(0.024, 0.02, TRACK_W * 0.9).toNonIndexed();
    grouser.translate(0, 0.022, 0);
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
    // road wheels: rubber, a green dished disc, a bronze hub cap (as in
    // the photos, a couple of them all bronze)
    ROAD_WHEELS.forEach((x, i) => {
      const p = new THREE.Group();
      p.position.set(x, WHEEL_Y, s * TRACK_Z);
      p.userData.radius = WHEEL_R;
      put(p, cyl(WHEEL_R, 0.24, C.rubber, { axis: 'z', seg: 18 }), 0, 0, 0);
      put(p, cyl(WHEEL_R * 0.82, 0.26, i === 2 || i === 3 ? C.wheelHub : C.green, { axis: 'z', seg: 18 }), 0, 0, 0);
      put(p, cyl(0.07, 0.29, C.wheelHub, { axis: 'z', seg: 10 }), 0, 0, 0);
      for (let k = 0; k < 6; k++) {
        const ang = (k / 6) * TAU;
        put(p, box(0.024, 0.024, 0.02, C.dark), Math.cos(ang) * 0.05, Math.sin(ang) * 0.05, s * 0.15);
      }
      tracks.add(p);
      spinners.push(p);
    });
    for (const [w, teeth] of [[SPROCKET, 11], [IDLER, 0]]) {
      const p = new THREE.Group();
      p.position.set(w.x, w.y, s * TRACK_Z);
      p.userData.radius = w.r;
      put(p, cyl(w.r, 0.18, teeth ? C.dark : C.green, { axis: 'z', seg: 14 }), 0, 0, 0);
      put(p, cyl(0.06, 0.22, C.dark, { axis: 'z', seg: 8 }), 0, 0, 0);
      for (let k = 0; k < (teeth || 5); k++) {
        const ang = (k / (teeth || 5)) * TAU;
        if (teeth) put(p, box(0.05, 0.05, 0.1, C.dark), Math.cos(ang) * (w.r + 0.01), Math.sin(ang) * (w.r + 0.01), 0).rotation.z = ang;
        else put(p, box(w.r * 0.9, 0.025, 0.02, C.dark), Math.cos(ang) * w.r * 0.45, Math.sin(ang) * w.r * 0.45, s * 0.095).rotation.z = ang;
      }
      tracks.add(p);
      spinners.push(p);
    }
    // return rollers along the top run
    for (const x of ROLLERS) {
      const p = new THREE.Group();
      const k = (x - IDLER.x) / (SPROCKET.x - IDLER.x);
      p.position.set(x, IDLER.y + IDLER.r + (SPROCKET.y + SPROCKET.r - IDLER.y - IDLER.r) * k - 0.05, s * TRACK_Z);
      p.userData.radius = 0.06;
      put(p, cyl(0.06, 0.14, C.dark, { axis: 'z', seg: 10 }), 0, 0, 0);
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
  let podElev = POD_REST;
  let raise = 0; // seconds the pack stays up after firing
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

  // a missile out of the next canister: where from, which way
  function fire() {
    recoil = 1;
    raise = 1.2;
    spring.vPitch -= 0.25;
    group.updateWorldMatrix(true, true);
    const i = order[next++ % order.length];
    const m = mouths[i];
    // the cover blows off ahead of the missile, tumbling away
    const cp = caps[i];
    if (cp?.on && group.parent) {
      cp.on = false;
      cp.t = 0;
      const fwd = new THREE.Vector3(1, 0, 0).transformDirection(gunPivot.matrixWorld);
      group.parent.attach(cp.g);
      cp.vel.copy(fwd).multiplyScalar(5 + Math.random() * 2).add(new THREE.Vector3((Math.random() - 0.5) * 2, 3 + Math.random() * 2, (Math.random() - 0.5) * 2));
      cp.spin.set((Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18, (Math.random() - 0.5) * 18);
    }
    return {
      position: m.getWorldPosition(new THREE.Vector3()),
      direction: new THREE.Vector3(1, 0, 0).transformDirection(gunPivot.matrixWorld),
      breech: gunPivot.localToWorld(new THREE.Vector3(0, 0, 0)),
      quadrant: 0,
    };
  }
  function muzzle() {
    gunPivot.updateWorldMatrix(true, false);
    const m = mouths[order[next % order.length]];
    return {
      position: m.getWorldPosition(new THREE.Vector3()),
      direction: new THREE.Vector3(1, 0, 0).transformDirection(gunPivot.matrixWorld),
      breech: gunPivot.localToWorld(new THREE.Vector3(0, 0, 0)),
    };
  }

  function update(dt, t, ctx = {}) {
    group.getWorldPosition(tmp);
    const yaw = group.rotation.y;
    if (ctx.aimPoint) {
      const want = wrapAngle(Math.atan2(-(ctx.aimPoint.z - tmp.z), ctx.aimPoint.x - tmp.x) - yaw);
      turret.rotation.y = approachAngle(turret.rotation.y, want, TURRET_SPEED * (ctx.turretRate || 1) * dt);
      aimError = Math.abs(wrapAngle(want - turret.rotation.y));
    }
    // the pack: up to fire (and a moment after), settling back down
    raise = Math.max(0, raise - dt);
    const wantE = raise > 0 || ctx.trigger ? POD_MAX : POD_REST;
    podElev += THREE.MathUtils.clamp(wantE - podElev, -POD_SPEED * dt, POD_SPEED * dt);
    recoil = Math.max(0, recoil - dt * 6);
    // blown-off covers tumble away and fade; after a reload's time a new one's on
    for (const cp of caps) {
      if (cp.on) continue;
      cp.t += dt;
      if (cp.t < 1.4) {
        cp.vel.y -= 14 * dt;
        cp.g.position.addScaledVector(cp.vel, dt);
        cp.g.rotation.x += cp.spin.x * dt;
        cp.g.rotation.y += cp.spin.y * dt;
        cp.g.rotation.z += cp.spin.z * dt;
        if (cp.g.position.y < 0.05) {
          cp.g.position.y = 0.05;
          cp.vel.multiplyScalar(0.3);
          cp.vel.y = Math.abs(cp.vel.y) * 0.3;
          cp.spin.multiplyScalar(0.5);
        }
      } else if (cp.g.parent !== gunPivot) {
        gunPivot.add(cp.g);
        cp.g.visible = false;
        cp.g.position.copy(cp.home);
        cp.g.rotation.set(0, 0, 0);
      }
      if (cp.t > 3.2) {
        cp.on = true;
        cp.g.visible = true;
      }
    }
    gunPivot.rotation.z = podElev;
    gunPivot.position.x = PIVOT.x - recoil * 0.05;

    if (ctx.mgPoint) {
      const want = wrapAngle(Math.atan2(-(ctx.mgPoint.z - tmp.z), ctx.mgPoint.x - tmp.x) - yaw);
      mgPivot.rotation.y = approachAngle(mgPivot.rotation.y, want, 10 * dt);
      mgPivot.getWorldPosition(mgWorld);
      const dist = Math.hypot(ctx.mgPoint.x - mgWorld.x, ctx.mgPoint.z - mgWorld.z);
      const wantP = THREE.MathUtils.clamp(Math.atan2(ctx.mgPoint.y - mgWorld.y, Math.max(0.3, dist)), -0.3, 1.0);
      mgElev += THREE.MathUtils.clamp(wantP - mgElev, -4 * dt, 4 * dt);
      mgPivot.rotation.z = mgElev;
    }

    const speed = ctx.speed || 0;
    for (const w of spinners) w.rotation.z -= (speed * dt) / w.userData.radius;
    if (speed) {
      trackOffset += speed * dt;
      updateTracks();
    }
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
        bumpTimer = 0.2 + Math.random() * 0.4;
        spring.vPitch += (Math.random() - 0.5) * 0.45;
        spring.vRoll += (Math.random() - 0.5) * 0.4;
      }
    }
    [spring.pitch, spring.vPitch] = step(spring.pitch, spring.vPitch, 100, 9, fwdAcc * 0.012, dt);
    [spring.roll, spring.vRoll] = step(spring.roll, spring.vRoll, 100, 9, -latAcc * 0.012, dt);
    rock.rotation.set(spring.roll, 0, spring.pitch);
    rock.position.y = ROCK_Y + Math.abs(Math.sin(t * 13)) * 0.01 * Math.min(1, Math.abs(speed));
    for (const a of antennas) {
      [a.a, a.v] = step(a.a, a.v, 40, 3, -fwdAcc * 0.05, dt);
      a.obj.rotation.z = THREE.MathUtils.clamp(a.a, -0.5, 0.5);
    }

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

  const commanderTop = new THREE.Vector3(0.1, DECK_Y + 0.3, -0.35);

  let rocketK = 0;
  function setRocket(k, lit, t = 0) {
    rocketK = k;
    for (const [i, n] of nozzles.entries()) {
      n.flame.visible = lit && k > 0.05;
      if (!n.flame.visible) continue;
      const flick = 0.85 + Math.sin(t * 55 + i * 2.1) * 0.12 + Math.random() * 0.15;
      n.flame.scale.set(k * flick, 0.8 + 0.2 * k + Math.random() * 0.08, 0.8 + 0.2 * k + Math.random() * 0.08);
    }
  }
  function rocketNozzles() {
    group.updateWorldMatrix(true, true);
    return nozzles.map((n) => n.flame.getWorldPosition(new THREE.Vector3()));
  }
  const RAMPS = {
    normal: [[0, 0xfffaf0], [0.12, 0xe8f2ff], [0.24, 0xbcd8ff], [0.4, 0xffd27a], [0.65, 0xff8a2a], [1, 0xd8461a]],
    afterburner: [[0, 0xffffff], [0.15, 0xdcecff], [0.38, 0x9fcfff], [0.55, 0xff9ad0], [0.75, 0xff7a5a], [1, 0xc8406a]],
  };
  const tmpC = new THREE.Color();
  const tmpD = new THREE.Color();
  function rampAt(stops, k) {
    let i = 1;
    while (i < stops.length - 1 && stops[i][0] < k) i++;
    const [k0, c0] = stops[i - 1];
    const [k1, c1] = stops[i];
    return tmpC.setHex(c0).lerp(tmpD.setHex(c1), THREE.MathUtils.clamp((k - k0) / (k1 - k0 || 1), 0, 1));
  }
  function setFlameStyle(style) {
    const stops = RAMPS[style] || RAMPS.normal;
    for (const m of plumes) {
      const pos = m.geometry.attributes.position;
      const col = m.geometry.attributes.color;
      const len = m.userData.len;
      for (let i = 0; i < pos.count; i++) {
        const k = THREE.MathUtils.clamp(-pos.getX(i) / len, 0, 1);
        const c = rampAt(stops, k * [1, 0.7, 0.35][m.userData.layer]);
        const fade = k < 0.55 ? 1 : 1 - ((k - 0.55) / 0.45) ** 1.4;
        col.setXYZW(i, c.r, c.g, c.b, Math.max(0, fade));
      }
      col.needsUpdate = true;
    }
  }
  setFlameStyle('normal');

  return {
    kind: 'missile',
    missile: true,
    group,
    chassis,
    turret,
    mgMount: mgSlot,
    mgGun: mgPivot, // (the roof MG itself: a part can fit things to it)
    gunPivot,
    slotGroups,
    setSlotVisible(name, visible) {
      for (const g of slotGroups[name] || []) g.visible = visible;
    },
    fire,
    muzzle,
    update,
    events,
    aimError: () => aimError,
    setRocket,
    rocketNozzles,
    setFlameStyle,
    commanderTop,
    get rocketK() {
      return rocketK;
    },
    kick: 1,
  };
}
