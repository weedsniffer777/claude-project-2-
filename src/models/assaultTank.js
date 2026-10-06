// The assault tank, after the Leopard 2A4, in a desert three-tone camo
// (sand, red-brown, dark grey-olive). Forward is +X, up is +Y; same
// interface as the other tanks, so the game can drive any of them.
//
// What makes it read as a Leopard 2:
//  - a long, low hull: a sharp wedge nose rising to a short glacis, then a
//    long flat deck to a grilled engine deck sloping down at the back
//  - side skirts the length of the hull over the top half of the running
//    gear, their bottom edge cut in scallops, a thicker armoured section at
//    the front; seven road wheels, the idler at the front, the sprocket at
//    the back
//  - the boxy, vertical-sided turret of the A4 (no wedge), set well forward,
//    a long bustle behind it; a narrow mantlet in the middle of its face;
//    the commander's PERI periscope (a round head) at the front left, the
//    gunner's sight box at the front right; smoke dischargers in two rows
//    on each side; the loader's hatch and MG at the back right
//  - the long 120 mm gun: a fume extractor near its middle, a thermal
//    sleeve in bands
//  - the rear plate: two round exhaust fan housings (the boost: they light
//    up, a short hard dash), tail lights at the corners, mud flaps
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { box, cyl, put, toon, wrapAngle, approachAngle, gradientMap } from './kit.js';

const C = {
  sand: 0xc4a06a,
  red: 0x8c5c3e,
  grey: 0x4e4a3e,
  sandDark: 0xa8875a,
  dark: 0x26262a,
  black: 0x1c1c1e,
  steel: 0x5d6368,
  rubber: 0x262625,
  trackA: 0x3a3936,
  trackB: 0x2c2b29,
  glass: 0x1d2a30,
  lamp: 0xe0d49a,
  tail: 0xd8321e,
};
const TAU = Math.PI * 2;

// ---------------------------------------------------------------- layout
const NOSE = 2.2;
const REAR = -2.15;
const DECK_Y = 1.0;
// the upper hull out over the tracks: side profile, counter-clockwise
const UPPER = [[REAR + 0.05, 0.62], [1.7, 0.62], [NOSE, 0.74], [NOSE, 0.82], [1.45, DECK_Y], [-0.95, DECK_Y], [REAR + 0.15, 0.9], [REAR, 0.86], [REAR, 0.66]];
const UPPER_HALF = 0.98;
const LOWER = [[REAR + 0.1, 0.22], [1.55, 0.22], [2.05, 0.55], [2.05, 0.63], [REAR + 0.1, 0.63]];
const LOWER_HALF = 0.58;
const GLACIS = { x0: NOSE, y0: 0.82, x1: 1.45, y1: DECK_Y };
const TRACK_Z = 0.8;
const TRACK_W = 0.36;
const LINK_T = 0.04;
const WHEEL_R = 0.24;
const WHEEL_Y = WHEEL_R + LINK_T;
const ROAD_WHEELS = [1.42, 0.94, 0.46, -0.02, -0.5, -0.98, -1.46];
const IDLER = { x: 1.88, y: 0.46, r: 0.19 }; // at the front, raised
const SPROCKET = { x: -1.88, y: 0.47, r: 0.21 }; // at the back: the drive
const SKIRT = { x0: -2.0, x1: 2.02, y0: 0.42, y1: 0.86, z: 1.0 };
// the turret: boxy, set well forward, a long bustle
const TURRET = { x: 0.05, y: DECK_Y };
const TURRET_HALF = { bottom: 0.86, top: 0.82 };
// its plan (x, z): vertical sides, the face's cheeks swept slightly back
// from the mantlet; the gunner's sight sits down in a notch cut into the
// right cheek (NOTCH: the cut, its floor at NOTCH.y)
const CHEEK = { x0: 1.1, z0: 0.24, x1: 0.86, z1: 0.86 };
const cheekX = (z) => CHEEK.x0 + ((Math.abs(z) - CHEEK.z0) / (CHEEK.z1 - CHEEK.z0)) * (CHEEK.x1 - CHEEK.x0);
const NOTCH = { x0: 0.42, z0: 0.24, z1: 0.62, y: 0.28 };
const TURRET_PLAN = [
  [-1.55, -0.7], [-1.42, -0.86], [CHEEK.x1, -0.86], [CHEEK.x0, -0.24], [CHEEK.x0, 0.24],
  [NOTCH.x0, NOTCH.z0], [NOTCH.x0, NOTCH.z1], [cheekX(NOTCH.z1), NOTCH.z1],
  [CHEEK.x1, 0.86], [-1.42, 0.86], [-1.55, 0.7],
];
const NOTCH_FLOOR = [[NOTCH.x0, NOTCH.z0], [CHEEK.x0, NOTCH.z0], [cheekX(NOTCH.z1), NOTCH.z1], [NOTCH.x0, NOTCH.z1]];
const ROOF = 0.54; // turret-local
const GUN_Y = 0.27;
const GUN_BASE_X = 1.08;
const MUZZLE_X = 2.92;
const TURRET_SPEED = 4.2;
const GUN_DEPRESSION = -0.15;
const GUN_ELEVATION = 0.3;
const GUN_PITCH_SPEED = 2;
const MG_SPEED = 9;
const LOADER = { x: -0.62, z: 0.44 }; // the loader's hatch: the roof MG over it

// ------------------------------------------------------------- camo paint
// the three colours in big hard-edged patches, drawn small and sampled
// nearest so they stay chunky at the game's pixel size
let camoTex = null;
function camoTexture() {
  if (camoTex) return camoTex;
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d');
  const hex = (n) => `#${new THREE.Color(n).getHexString()}`;
  g.fillStyle = hex(C.sand);
  g.fillRect(0, 0, 32, 32);
  let seed = 23;
  const rand = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  // patches: irregular polygons, wrapped so the pattern tiles
  const patch = (col, x, y, r) => {
    g.fillStyle = col;
    const n = 7;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * TAU + rand() * 0.6;
      const rr = r * (0.55 + rand() * 0.6);
      pts.push([Math.cos(a) * rr * 1.4, Math.sin(a) * rr]);
    }
    for (const [dx, dy] of [[0, 0], [32, 0], [-32, 0], [0, 32], [0, -32]]) {
      g.beginPath();
      pts.forEach(([px, py], i) => (i ? g.lineTo(x + dx + px, y + dy + py) : g.moveTo(x + dx + px, y + dy + py)));
      g.closePath();
      g.fill();
    }
  };
  for (let i = 0; i < 4; i++) patch(hex(C.red), rand() * 32, rand() * 32, 5 + rand() * 3);
  for (let i = 0; i < 4; i++) patch(hex(C.grey), rand() * 32, rand() * 32, 4 + rand() * 3);
  camoTex = new THREE.CanvasTexture(c);
  camoTex.colorSpace = THREE.SRGBColorSpace;
  camoTex.magFilter = camoTex.minFilter = THREE.NearestFilter;
  camoTex.wrapS = camoTex.wrapT = THREE.RepeatWrapping;
  return camoTex;
}
function camo(scale = 0.4, shift = 0) {
  const t = camoTexture().clone();
  t.needsUpdate = true;
  t.repeat.set(scale, scale);
  t.offset.set(shift * 0.37, shift * 0.61);
  return new THREE.MeshToonMaterial({ map: t, gradientMap });
}
function camoBox(w, h, d, shift, r = 0.02) {
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 1, r), camo(0.45 / Math.max(w, h, d, 0.5), shift));
  m.castShadow = m.receiveShadow = true;
  return m;
}

// A convex side profile (x, y; counter-clockwise) given depth by a half
// width (that can narrow toward the top). UVs planar per face in world
// units, so the camo keeps its size.
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

// A plan (x, z) stood up from y0 to y1 with chamfered top and bottom
// edges (bevel); planar world-unit UVs, so the camo keeps its size.
function slab(plan, y0, y1, material, bevel = 0.035) {
  const shape = new THREE.Shape(plan.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: y1 - y0 - bevel * 2, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1, curveSegments: 1 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0 + bevel, 0);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------ track loop
// round the raised front idler, along under the wheels, round the rear
// sprocket, and back along the top on the return rollers (a slight sag)
function buildTrackLoop() {
  const half = LINK_T / 2;
  const front = { x: IDLER.x, y: IDLER.y, r: IDLER.r + half };
  const back = { x: SPROCKET.x, y: SPROCKET.y, r: SPROCKET.r + half };
  const W = ROAD_WHEELS.map((x) => ({ x, y: WHEEL_Y, r: WHEEL_R + half }));
  const W1 = W[0];
  const WN = W[W.length - 1];
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
  line(onCircle(W1, -Math.PI / 2), onCircle(WN, -Math.PI / 2));
  const nWB = tangentNormal(WN, back);
  arc(WN, -Math.PI / 2, mod(-Math.PI / 2 - nWB));
  line(onCircle(WN, nWB), onCircle(back, nWB));
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
export function createAssaultTank() {
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
  const mgSlot = new THREE.Group();
  turret.add(mgSlot);
  slotGroups.mg.push(mgSlot);

  // ---------------------------------------------------------------- hull
  chassis.add(prism(UPPER, UPPER_HALF - 0.08, UPPER_HALF - 0.08, camo(0.4, 1)));
  chassis.add(prism(LOWER, LOWER_HALF, LOWER_HALF, camo(0.4, 2)));
  {
    // the glacis: the driver's hatch and his three periscopes on it,
    // headlights in their guards on the nose corners, towing eyes
    const slope = -Math.atan2(GLACIS.y1 - GLACIS.y0, GLACIS.x0 - GLACIS.x1);
    const onGlacis = (x, z) => {
      const g = new THREE.Group();
      const k = (GLACIS.x0 - x) / (GLACIS.x0 - GLACIS.x1);
      g.position.set(x, GLACIS.y0 + k * (GLACIS.y1 - GLACIS.y0), z);
      g.rotation.z = slope;
      chassis.add(g);
      return g;
    };
    const hatch = onGlacis(1.55, -0.42);
    put(hatch, box(0.36, 0.04, 0.42, C.sandDark, { r: 0.02 }), 0, 0.02, 0);
    for (const dz of [-0.13, 0, 0.13]) put(hatch, box(0.08, 0.06, 0.09, C.dark, { r: 0.01 }), 0.2, 0.04, dz);
    for (const s of [-1, 1]) {
      const g = onGlacis(2.05, s * 0.72);
      put(g, box(0.16, 0.12, 0.22, C.sandDark, { r: 0.02 }), 0, 0.06, 0); // the lamp guard
      put(g, box(0.02, 0.07, 0.12, C.lamp), 0.08, 0.06, 0);
      put(chassis, box(0.08, 0.1, 0.12, C.dark, { r: 0.02 }), NOSE + 0.02, 0.66, s * 0.38); // towing eye
    }
    // a lip along the deck edge, bolts; the grilled engine deck, the
    // engine access hatches, the tow cables across the back
    for (const s of [-1, 1]) put(chassis, box(3.6, 0.04, 0.05, C.sandDark), 0.0, DECK_Y - 0.02, s * (UPPER_HALF - 0.06));
    for (let x = -1.85; x < -1.0; x += 0.08) put(chassis, box(0.03, 0.02, 1.5, C.dark), x, 0.95 - (x + 1.0) * -0.06, 0);
    put(chassis, box(0.9, 0.03, 1.55, C.sandDark, { r: 0.01 }), -1.42, 0.93, 0).rotation.z = 0.06;
    for (const z of [-0.5, 0.5]) put(chassis, box(0.6, 0.03, 0.55, C.sandDark, { r: 0.01 }), -0.62, DECK_Y + 0.015, z);
    for (const s of [-1, 1]) put(chassis, cyl(0.025, 1.6, C.steel, { axis: 'x', seg: 6 }), -1.25, 0.98, s * 0.82); // tow cables
  }
  // the side skirts: a thicker armoured section at the front, plain plates
  // behind, their bottom edge cut in scallops between the wheels
  for (const s of [-1, 1]) {
    const z = s * SKIRT.z;
    put(chassis, camoBox(1.1, SKIRT.y1 - SKIRT.y0 + 0.04, 0.1, 7 + s, 0.02), SKIRT.x1 - 0.55, (SKIRT.y0 + SKIRT.y1) / 2, z);
    put(chassis, camoBox(SKIRT.x1 - 1.1 - SKIRT.x0, SKIRT.y1 - SKIRT.y0 - 0.12, 0.05, 8 + s, 0.015), (SKIRT.x0 + SKIRT.x1 - 1.1) / 2, (SKIRT.y0 + 0.12 + SKIRT.y1) / 2, z);
    // the scallops: tongues hanging between the wheels
    for (const x of ROAD_WHEELS.slice(2)) put(chassis, camoBox(0.24, 0.12, 0.05, 9 + x, 0.015), x - 0.24, SKIRT.y0 + 0.06, z);
    for (let x = SKIRT.x0 + 0.1; x < SKIRT.x1 - 1.2; x += 0.42) put(chassis, box(0.03, 0.03, 0.02, C.dark), x, SKIRT.y1 - 0.05, z + s * 0.03); // bolts
    put(chassis, box(0.02, SKIRT.y1 - SKIRT.y0 - 0.06, 0.02, C.dark), SKIRT.x1 - 1.1, (SKIRT.y0 + SKIRT.y1) / 2, z + s * 0.035); // the join
  }
  // the rear plate: the two round exhaust housings (the boost), tail
  // lights and their guards at the corners, mud flaps, the towing pintle
  const nozzles = [];
  const flameMats = [0.5, 0.75, 1].map((opacity) => new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }));
  const plumes = [];
  for (const s of [-1, 1]) {
    const ez = s * 0.42;
    const ey = 0.6;
    put(chassis, cyl(0.17, 0.08, C.sandDark, { axis: 'x', seg: 14 }), REAR - 0.02, ey, ez); // the housing ring
    put(chassis, cyl(0.13, 0.06, 0x0f1011, { axis: 'x', seg: 14 }), REAR - 0.05, ey, ez); // sooty throat
    for (const a of [0, Math.PI / 2]) put(chassis, box(0.02, 0.24, 0.025, C.dark), REAR - 0.07, ey, ez).rotation.x = a; // the fan cross
    // tail light in its box guard, the mud flap under
    put(chassis, box(0.08, 0.12, 0.26, C.sandDark, { r: 0.015 }), REAR - 0.03, 0.8, s * 0.82);
    put(chassis, box(0.02, 0.06, 0.14, C.tail, { glow: true }), REAR - 0.075, 0.8, s * 0.82);
    put(chassis, camoBox(0.06, 0.34, 0.4, 12 + s, 0.01), REAR + 0.02, 0.5, s * 0.82);
    // the flame: a hot core, an orange plume flaring out behind
    const flame = new THREE.Group();
    flame.position.set(REAR - 0.08, ey, ez);
    flame.visible = false;
    chassis.add(flame);
    const plume = (prof, layer) => {
      const g = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 10);
      g.rotateZ(Math.PI / 2); // +y to -x: out the back
      g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 4), 4));
      const m = new THREE.Mesh(g, flameMats[layer]);
      m.userData.fx = true;
      m.userData.len = prof[prof.length - 1][1];
      m.userData.layer = layer;
      flame.add(m);
      plumes.push(m);
    };
    plume([[0.13, 0], [0.24, 0.3], [0.34, 0.75], [0.42, 1.25], [0.46, 1.6], [0.38, 1.9], [0.18, 2.05], [0, 2.1]], 0);
    plume([[0.11, 0], [0.17, 0.25], [0.23, 0.65], [0.26, 1.0], [0.18, 1.2], [0, 1.32]], 1);
    plume([[0.09, 0], [0.1, 0.12], [0.1, 0.3], [0.07, 0.5], [0, 0.62]], 2);
    nozzles.push({ flame, at: new THREE.Vector3(REAR - 0.08, ey, ez) });
  }
  put(chassis, box(0.12, 0.12, 0.16, C.dark, { r: 0.02 }), REAR - 0.04, 0.38, 0); // pintle

  // ---------------------------------------------------------------- turret
  turret.add(slab(TURRET_PLAN, 0, ROOF, camo(0.45, 3)));
  turret.add(slab(NOTCH_FLOOR, 0, NOTCH.y, camo(0.45, 3), 0.02));
  put(turret, cyl(0.62, 0.05, C.dark, { seg: 22 }), 0, 0.0, 0); // the ring, just under it
  {
    // the face: the swept cheeks, a narrow mantlet between them; the
    // coax port; bolts along the cheeks' top edge
    for (const s of [-1, 1]) for (const z of [0.4, 0.7]) if (s < 0 || z > NOTCH.z1) put(turret, box(0.03, 0.03, 0.03, C.dark), cheekX(z) + 0.01, ROOF - 0.05, s * z);
    put(turret, camoBox(0.24, 0.42, 0.42, 17, 0.03), 1.12, GUN_Y, 0);
    put(turret, box(0.04, 0.05, 0.05, C.dark), 1.25, GUN_Y + 0.13, -0.15);
    // the bustle: stowage baskets either side of its back, a lip round it
    for (const s of [-1, 1]) {
      put(turret, box(0.7, 0.26, 0.04, C.sandDark), -1.18, 0.62, s * 0.85);
      for (let x = -1.5; x < -0.85; x += 0.12) put(turret, box(0.02, 0.26, 0.02, C.dark), x, 0.62, s * 0.86);
    }
    put(turret, box(0.04, 0.26, 1.7, C.sandDark), -1.56, 0.62, 0);
    put(turret, box(0.55, 0.22, 1.4, C.grey, { r: 0.06 }), -1.25, 0.66, 0); // a tarp bundle in it
    // the big basket across the back of the bustle: a frame of bars, a
    // jerrycan, a rolled tarp and a crate in it
    {
      const bx = -1.82;
      const bz = 0.78;
      put(turret, box(0.5, 0.03, bz * 2, C.dark), bx, 0.12, 0); // floor
      for (const y of [0.12, 0.3, 0.48]) {
        put(turret, box(0.03, 0.03, bz * 2, C.sandDark), bx - 0.25, y, 0);
        for (const s of [-1, 1]) put(turret, box(0.5, 0.03, 0.03, C.sandDark), bx, y, s * bz);
      }
      for (let z = -bz; z <= bz + 0.01; z += bz / 4) put(turret, box(0.025, 0.38, 0.025, C.dark), bx - 0.25, 0.3, z);
      for (const s of [-1, 1]) for (const x of [bx - 0.05, bx + 0.15]) put(turret, box(0.025, 0.38, 0.025, C.dark), x, 0.3, s * bz);
      for (const s of [-1, 1]) put(turret, box(0.32, 0.04, 0.05, C.dark), -1.62, 0.3, s * 0.6); // the brackets to the bustle
      put(turret, cyl(0.13, 1.0, C.grey, { axis: 'z', seg: 10 }), bx + 0.04, 0.27, -0.2); // tarp roll
      put(turret, box(0.26, 0.3, 0.16, 0x4f5a3a, { r: 0.02 }), bx, 0.3, 0.52); // jerrycan
      put(turret, box(0.28, 0.2, 0.3, 0x6b5a3e, { r: 0.015 }), bx + 0.02, 0.24, 0.2); // crate
    }
    // the smoke dischargers: two rows of four on each side, angled up and
    // forward, on the turret sides behind the cheeks
    for (const s of [-1, 1]) {
      const rack = new THREE.Group();
      rack.position.set(-0.05, 0.36, s * (TURRET_HALF.bottom + 0.06));
      rack.rotation.set(0, -s * 0.35, 0.45);
      turret.add(rack);
      put(rack, box(0.12, 0.22, 0.4, C.sandDark, { r: 0.015 }), -0.06, 0, 0);
      for (const dy of [-0.055, 0.055]) {
        for (const dz of [-0.14, -0.047, 0.047, 0.14]) {
          put(rack, cyl(0.035, 0.24, C.sand, { axis: 'x', seg: 8 }), 0.1, dy, dz);
          put(rack, cyl(0.04, 0.035, C.dark, { axis: 'x', seg: 8 }), 0.23, dy, dz);
        }
      }
    }
    // the gunner's sight (EMES): a tall armoured box down in the notch,
    // its top just over the roof; armoured doors over the window, open, a
    // sloped hood; a periscope head beside it for the gunner's back-up
    {
      const sx = (NOTCH.x0 + cheekX((NOTCH.z0 + NOTCH.z1) / 2)) / 2 - 0.02;
      const sz = (NOTCH.z0 + NOTCH.z1) / 2;
      const top = ROOF + 0.1;
      put(turret, camoBox(0.46, top - NOTCH.y, 0.3, 19, 0.025), sx, (top + NOTCH.y) / 2, sz);
      put(turret, box(0.03, 0.16, 0.22, C.dark), sx + 0.24, top - 0.12, sz); // the window frame
      put(turret, box(0.02, 0.12, 0.17, C.glass), sx + 0.25, top - 0.12, sz);
      put(turret, box(0.012, 0.03, 0.15, 0x5aa9c4, { glow: true }), sx + 0.262, top - 0.09, sz); // a glint
      for (const s of [-1, 1]) put(turret, box(0.14, 0.17, 0.025, C.sandDark, { r: 0.01 }), sx + 0.3, top - 0.12, sz + s * 0.16).rotation.y = s * 0.5; // the doors, open
      const hood = put(turret, box(0.22, 0.035, 0.36, C.sandDark, { r: 0.01 }), sx + 0.2, top + 0.02, sz);
      hood.rotation.z = -0.25;
      put(turret, box(0.4, 0.02, 0.26, C.dark), sx - 0.02, top + 0.005, sz); // top plate seam
      put(turret, box(0.08, 0.06, 0.08, C.dark, { r: 0.01 }), NOTCH.x0 - 0.1, ROOF + 0.03, sz + 0.1); // the back-up periscope
    }
    // the commander's PERI: a collar on the roof, a column, the head on it
    // (a rounded box, its window forward, a hood over it), turned slightly
    {
      const px = 0.14;
      const pz = -0.46;
      put(turret, cyl(0.2, 0.06, C.sandDark, { seg: 14 }), px, ROOF + 0.03, pz);
      put(turret, cyl(0.15, 0.14, C.sand, { seg: 12 }), px, ROOF + 0.13, pz);
      put(turret, cyl(0.17, 0.03, C.dark, { seg: 12 }), px, ROOF + 0.21, pz);
      const head = new THREE.Group();
      head.position.set(px, ROOF + 0.22, pz);
      head.rotation.y = 0.15;
      turret.add(head);
      put(head, camoBox(0.3, 0.22, 0.26, 21, 0.05), 0, 0.11, 0).castShadow = true;
      put(head, box(0.03, 0.12, 0.18, C.dark), 0.15, 0.1, 0);
      put(head, box(0.02, 0.09, 0.14, C.glass), 0.16, 0.1, 0);
      put(head, box(0.012, 0.025, 0.12, 0x5aa9c4, { glow: true }), 0.172, 0.125, 0);
      put(head, box(0.2, 0.03, 0.3, C.sandDark, { r: 0.01 }), 0.08, 0.235, 0).rotation.z = -0.15; // hood
      for (const s of [-1, 1]) put(head, box(0.18, 0.12, 0.02, C.sandDark), 0.06, 0.11, s * 0.14); // side armour
      put(head, box(0.05, 0.05, 0.05, C.dark), -0.12, 0.25, 0.06); // sensor
    }
    put(turret, cyl(0.24, 0.05, C.sandDark, { seg: 14 }), -0.45, ROOF + 0.02, -0.42); // commander's hatch
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU; // his vision blocks round it
      put(turret, box(0.06, 0.05, 0.07, C.dark, { r: 0.01 }), -0.45 + Math.cos(a) * 0.29, ROOF + 0.04, -0.42 + Math.sin(a) * 0.29).rotation.y = -a;
    }
    put(turret, cyl(0.22, 0.05, C.sandDark, { seg: 14 }), LOADER.x, ROOF + 0.02, LOADER.z); // loader's hatch
    for (const [x, z] of [[-0.72, -0.72], [-0.75, -0.1], [0.3, 0.1]]) put(turret, box(0.07, 0.06, 0.08, C.dark, { r: 0.01 }), x, ROOF + 0.03, z);
    put(turret, cyl(0.02, 0.4, C.dark, { seg: 5 }), -1.2, ROOF + 0.2, 0.55); // the wind sensor
    put(turret, box(0.1, 0.05, 0.05, C.dark), -1.2, ROOF + 0.42, 0.55);
    // the number plate on the bustle side, a little flag
    put(turret, box(0.4, 0.1, 0.01, C.dark), -0.95, 0.3, -(TURRET_HALF.bottom + 0.01));
  }
  // two whip antennas on the bustle
  const antennas = [];
  for (const [x, z] of [[-1.35, -0.6], [-1.0, 0.65]]) {
    put(turret, cyl(0.04, 0.08, C.dark, { seg: 6 }), x, ROOF + 0.04, z);
    const geo = new THREE.CylinderGeometry(0.012, 0.012, 1.6, 4);
    geo.translate(0, 0.8, 0);
    const a = new THREE.Mesh(geo, toon(C.dark));
    a.position.set(x, ROOF + 0.08, z);
    turret.add(a);
    antennas.push({ obj: a, v: 0, a: 0 });
  }

  // ------------------------------------------------------------------- gun
  // the long 120: thermal sleeve in bands, a fume extractor near the middle
  const gunPivot = new THREE.Group();
  gunPivot.position.set(GUN_BASE_X, GUN_Y, 0);
  turret.add(gunPivot);
  slotGroups.gun.push(gunPivot);
  {
    put(gunPivot, cyl(0.1, 0.4, C.sandDark, { axis: 'x', seg: 12 }), 0.2, 0, 0); // the gun's base out of the mantlet
    for (const [x0, x1] of [[0.4, 0.95], [1.12, 1.55], [1.6, 2.05], [2.1, 2.55]]) put(gunPivot, cyl(0.075, x1 - x0, C.sand, { axis: 'x', seg: 10 }), (x0 + x1) / 2, 0, 0); // sleeve sections
    for (const x of [0.96, 1.575, 2.075, 2.56]) put(gunPivot, cyl(0.08, 0.04, C.grey, { axis: 'x', seg: 10 }), x, 0, 0); // their bands
    put(gunPivot, cyl(0.11, 0.18, C.sand, { axis: 'x', seg: 12 }), 1.04, 0, 0); // fume extractor
    put(gunPivot, cyl(0.065, 0.3, C.sandDark, { axis: 'x', seg: 10 }), 2.72, 0, 0); // the muzzle end
    put(gunPivot, box(0.06, 0.05, 0.08, C.dark), 2.82, 0.08, 0); // reference sensor
  }

  // ---------------------------------------------------------------- roof MG
  const mgPivot = new THREE.Group();
  const MG_Y = ROOF + 0.32;
  mgPivot.position.set(LOADER.x + 0.1, MG_Y, LOADER.z);
  mgSlot.add(mgPivot);
  put(mgSlot, cyl(0.025, MG_Y - ROOF, C.steel, { seg: 6 }), LOADER.x + 0.1, (ROOF + MG_Y) / 2, LOADER.z);
  put(mgPivot, box(0.32, 0.08, 0.08, C.dark, { r: 0.02 }), 0, 0, 0);
  put(mgPivot, cyl(0.022, 0.5, C.dark, { axis: 'x', seg: 6 }), 0.4, 0.01, 0);
  put(mgPivot, box(0.1, 0.1, 0.06, C.grey), -0.02, -0.06, 0.07); // ammo box
  const mgFlash = put(mgPivot, new THREE.Group(), 0.68, 0.01, 0);
  put(mgFlash, box(0.1, 0.1, 0.1, 0xfff3c4, { glow: true, r: 0.02 }));
  put(mgFlash, box(0.28, 0.04, 0.04, 0xffc24a, { glow: true, r: 0.01 }), 0.1, 0, 0);
  mgFlash.visible = false;

  // ---------------------------------------------------------------- tracks
  const spinners = [];
  const trackPt = { x: 0, y: 0, heading: 0 };
  const linkCount = Math.round(LOOP.total / 0.09);
  const linkSpacing = LOOP.total / linkCount;
  const linkGeo = (() => {
    const plate = new RoundedBoxGeometry(0.078, 0.032, TRACK_W, 1, 0.01);
    const pad = new THREE.BoxGeometry(0.05, 0.02, TRACK_W * 0.4).toNonIndexed();
    const pad2 = pad.clone();
    pad.translate(0, -0.022, -TRACK_W * 0.24);
    pad2.translate(0, -0.022, TRACK_W * 0.24);
    return mergeGeometries([plate, pad, pad2]);
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
    // road wheels: twin discs, each a rubber tyre round a dished steel
    // wheel (a raised rim, a recess, a hub boss with its bolt circle), a
    // dark gap between the pair, the red cap on the outer hub
    for (const x of ROAD_WHEELS) {
      const p = new THREE.Group();
      p.position.set(x, WHEEL_Y, s * TRACK_Z);
      p.userData.radius = WHEEL_R;
      put(p, cyl(WHEEL_R * 0.8, 0.3, C.black, { axis: 'z', seg: 14 }), 0, 0, 0); // the gap
      for (const dz of [-0.1, 0.1]) {
        put(p, cyl(WHEEL_R, 0.1, C.rubber, { axis: 'z', seg: 18 }), 0, 0, dz);
        put(p, cyl(WHEEL_R * 0.84, 0.11, C.sandDark, { axis: 'z', seg: 18 }), 0, 0, dz); // rim
        put(p, cyl(WHEEL_R * 0.68, 0.114, C.sand, { axis: 'z', seg: 16 }), 0, 0, dz); // the dish
      }
      put(p, cyl(0.085, 0.3, C.sandDark, { axis: 'z', seg: 10 }), 0, 0, 0); // hub boss
      put(p, cyl(0.04, 0.33, C.tail, { axis: 'z', seg: 8 }), 0, 0, 0); // the red hub cap
      for (let k = 0; k < 8; k++) {
        const ang = (k / 8) * TAU;
        put(p, box(0.022, 0.022, 0.02, C.dark), Math.cos(ang) * 0.115, Math.sin(ang) * 0.115, s * 0.16);
        if (k % 2 === 0) put(p, box(WHEEL_R * 0.3, 0.02, 0.012, C.sandDark), Math.cos(ang) * WHEEL_R * 0.48, Math.sin(ang) * WHEEL_R * 0.48, s * 0.16).rotation.z = ang; // the dish's ribs
      }
      tracks.add(p);
      spinners.push(p);
    }
    // the toothed sprocket at the back, the idler at the front
    for (const [w, teeth] of [[SPROCKET, 11], [IDLER, 0]]) {
      const p = new THREE.Group();
      p.position.set(w.x, w.y, s * TRACK_Z);
      p.userData.radius = w.r;
      put(p, cyl(w.r, 0.22, teeth ? C.sandDark : C.sand, { axis: 'z', seg: 14 }), 0, 0, 0);
      put(p, cyl(0.06, 0.26, C.dark, { axis: 'z', seg: 8 }), 0, 0, 0);
      for (let k = 0; k < (teeth || 6); k++) {
        const ang = (k / (teeth || 6)) * TAU;
        if (teeth) put(p, box(0.06, 0.06, 0.12, C.dark), Math.cos(ang) * (w.r + 0.01), Math.sin(ang) * (w.r + 0.01), 0).rotation.z = ang;
        else put(p, box(w.r * 0.85, 0.03, 0.02, C.dark), Math.cos(ang) * w.r * 0.45, Math.sin(ang) * w.r * 0.45, s * 0.115).rotation.z = ang;
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
    spring.vPitch += 0.9 * (api.kick ?? 1); // the 120: a hard kick
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
      turret.rotation.y = approachAngle(turret.rotation.y, want, TURRET_SPEED * (ctx.turretRate || 1) * dt);
      aimError = Math.abs(wrapAngle(want - turret.rotation.y));
      const dist = Math.hypot(ctx.aimPoint.x - tmp.x, ctx.aimPoint.z - tmp.z) - GUN_BASE_X;
      const dy = ctx.aimPoint.y - (tmp.y + TURRET.y + GUN_Y);
      const wantE = ctx.levelGun ? 0 : THREE.MathUtils.clamp(Math.atan2(dy, Math.max(0.4, dist)), GUN_DEPRESSION, GUN_ELEVATION);
      const pitch = GUN_PITCH_SPEED * (ctx.turretRate || 1) * dt;
      gunElev += THREE.MathUtils.clamp(wantE - gunElev, -pitch, pitch);
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

    // the hull leans with acceleration and rocks over bumps (heavy: slower
    // swings than the light tank's)
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
        bumpTimer = 0.25 + Math.random() * 0.45;
        spring.vPitch += (Math.random() - 0.5) * 0.35;
        spring.vRoll += (Math.random() - 0.5) * 0.3;
      }
    }
    [spring.pitch, spring.vPitch] = step(spring.pitch, spring.vPitch, 80, 8, fwdAcc * 0.01, dt);
    [spring.roll, spring.vRoll] = step(spring.roll, spring.vRoll, 80, 8, -latAcc * 0.01, dt);
    rock.rotation.set(spring.roll, 0, spring.pitch);
    rock.position.y = ROCK_Y + Math.abs(Math.sin(t * 11)) * 0.008 * Math.min(1, Math.abs(speed));
    for (const a of antennas) {
      [a.a, a.v] = step(a.a, a.v, 40, 3, -fwdAcc * 0.05, dt);
      a.obj.rotation.z = THREE.MathUtils.clamp(a.a, -0.5, 0.5);
    }

    // the gun: a long recoil, slower run-out
    recoil = Math.max(0, recoil - dt * 4);
    gunPivot.position.x = GUN_BASE_X - recoil * 0.3;
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
          muzzle: mgPivot.localToWorld(new THREE.Vector3(0.68, 0.01, 0)),
          eject: mgPivot.localToWorld(new THREE.Vector3(0.05, 0.03, 0.06)),
          ejectDir: new THREE.Vector3(0, 0, 1).transformDirection(mgPivot.matrixWorld),
          target: ctx.mgPoint.clone(),
        });
      }
    }
  }

  // a second gun goes by the commander's hatch
  const commanderTop = new THREE.Vector3(-0.45, ROOF + 0.4, -0.42);

  // the exhaust housings as rockets: k 0..1 how lit
  let rocketK = 0;
  function setRocket(k, lit, t = 0) {
    rocketK = k;
    for (const [i, n] of nozzles.entries()) {
      n.flame.visible = lit && k > 0.05;
      if (!n.flame.visible) continue;
      const flick = 0.85 + Math.sin(t * 55 + i * 2.1) * 0.12 + Math.random() * 0.15;
      const len = k * flick;
      n.flame.scale.set(len, 0.8 + 0.2 * k + Math.random() * 0.08, 0.8 + 0.2 * k + Math.random() * 0.08);
    }
  }
  function rocketNozzles() {
    group.updateWorldMatrix(true, true);
    return nozzles.map((n) => chassis.localToWorld(n.at.clone()));
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

  const api = {
    kind: 'assault',
    group,
    chassis,
    turret,
    mgMount: mgSlot,
    mgGun: mgPivot,
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
  return api;
}
