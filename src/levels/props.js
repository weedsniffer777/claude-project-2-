// City props for the ruined levels: burnt-out cars, vans and buses, and the
// ordinary things a street had (benches, bins, dumpsters, crates, fences,
// bollards, cabinets, bent and fallen poles). Each takes a LevelBuilder.
import * as THREE from 'three';
import { box, cyl, put, toon, gradientMap } from '../models/kit.js';
import { canvas, tex, blob } from './builder.js';

const SNOW = 0xd3d6db;

// --------------------------------------------------------------- textures
const burntCache = new Map();
// Mottled burnt paint: char and ash with rust bloom, and a little of the
// original paint surviving low down.
function burntMaterial(paint, rand) {
  const key = paint ?? 'none';
  if (burntCache.has(key)) return burntCache.get(key);
  const [c, g] = canvas(48, 48);
  g.fillStyle = '#34302d';
  g.fillRect(0, 0, 48, 48);
  // mostly charcoal and ash, rust coming through in small patches
  const blobs = [
    ['#2a2624', 10, 4],
    ['#4a4440', 10, 3],
    ['#5e4434', 9, 2],
    ['#6d4a32', 6, 1.6],
    ['#3d3632', 8, 3],
  ];
  if (paint) blobs.push([`#${new THREE.Color(paint).lerp(new THREE.Color(0x3a3532), 0.45).getHexString()}`, 4, 2.5]);
  for (const [col, n, size] of blobs) {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) blob(g, rand() * 48, rand() * 48, 1 + rand() * size, 1 + rand() * size * 0.8, rand);
  }
  for (let i = 0; i < 220; i++) {
    g.fillStyle = rand() < 0.5 ? '#00000030' : '#ffffff10';
    g.fillRect((rand() * 48) | 0, (rand() * 48) | 0, 1, 1);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.7, 0.7);
  const m = new THREE.MeshToonMaterial({ map: t, gradientMap });
  burntCache.set(key, m);
  return m;
}

function extrude(points, depth, material) {
  const shape = new THREE.Shape(points.map(([x, y]) => new THREE.Vector2(x, y)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1, curveSegments: 4 });
  geo.translate(0, 0, -depth / 2);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}

function arch(cx, cy, r, steps = 6) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const a = Math.PI - (i / steps) * Math.PI;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

// Side profiles, front of the vehicle toward +x. Bottom runs left to right
// over the wheel arches, then the roofline back.
const PROFILES = {
  sedan: {
    len: 2.72,
    width: 1.1,
    wheels: [-0.85, 0.82],
    body: [
      [-1.36, 0.28],
      ...arch(-0.85, 0.27, 0.31),
      ...arch(0.82, 0.27, 0.31),
      [1.36, 0.27],
      [1.37, 0.55],
      [1.24, 0.66],
      [0.58, 0.72],
      [0.22, 1.04],
      [-0.6, 1.03],
      [-0.92, 0.68],
      [-1.28, 0.65],
      [-1.37, 0.56],
    ],
    glass: [
      [-0.86, 0.66],
      [0.52, 0.66],
      [0.52, 0.73],
      [0.2, 1.0],
      [-0.58, 0.99],
      [-0.84, 0.7],
    ],
    pillars: [-0.17],
  },
  hatch: {
    len: 2.5,
    width: 1.08,
    wheels: [-0.78, 0.76],
    body: [
      [-1.24, 0.28],
      ...arch(-0.78, 0.27, 0.3),
      ...arch(0.76, 0.27, 0.3),
      [1.25, 0.27],
      [1.26, 0.55],
      [1.14, 0.66],
      [0.52, 0.72],
      [0.18, 1.05],
      [-1.0, 1.05],
      [-1.2, 0.98],
      [-1.26, 0.56],
    ],
    glass: [
      [-1.18, 0.66],
      [0.46, 0.66],
      [0.46, 0.73],
      [0.16, 1.01],
      [-1.0, 1.01],
      [-1.16, 0.95],
    ],
    pillars: [-0.3],
  },
  van: {
    len: 2.6,
    width: 1.18,
    wheels: [-0.78, 0.86],
    body: [
      [-1.3, 0.3],
      ...arch(-0.78, 0.29, 0.31),
      ...arch(0.86, 0.29, 0.31),
      [1.3, 0.3],
      [1.32, 0.62],
      [1.26, 1.05],
      [1.12, 1.52],
      [0.95, 1.62],
      [-1.2, 1.62],
      [-1.3, 1.5],
    ],
    glass: [
      [-1.2, 1.12],
      [1.18, 1.12],
      [1.06, 1.48],
      [-1.2, 1.48],
    ],
    pillars: [0.55, -0.15],
  },
};

// A wrecked car or van. Burnt-out ones sit on their rims with the glass gone;
// some have a door hanging open or the bonnet sprung.
export function car(B, x, z, yaw, { kind = 'sedan', paint = null, burnt = true, flipped = false, snow = true, solidBlock = true } = {}) {
  const rand = B.rand;
  const P = PROFILES[kind];
  const g = new THREE.Group();
  const body = new THREE.Group();
  g.add(body);
  const shell = burnt ? burntMaterial(paint, rand) : toon(paint ?? 0x8a8172);
  body.add(extrude(P.body, P.width, shell));
  // glass (or the black hole where it was), slightly proud of the body sides
  const glass = extrude(P.glass, P.width + 0.04, toon(burnt ? 0x151312 : 0x252a33));
  body.add(glass);
  for (const px of P.pillars) for (const s of [-1, 1]) put(body, box(0.09, 0.4, 0.04, burnt ? 0x2b2522 : paint ?? 0x8a8172, { r: 0.01 }), px, kind === 'van' ? 1.3 : 0.86, s * (P.width / 2 + 0.03));
  // bumpers, lights
  for (const s of [-1, 1]) {
    put(body, box(0.08, 0.12, P.width + 0.02, burnt ? 0x2a2624 : 0x5d5f62, { r: 0.03 }), s * (P.len / 2 + 0.02), 0.36, 0);
    for (const sz of [-1, 1]) put(body, box(0.03, 0.08, 0.2, burnt ? 0x1c1a19 : s > 0 ? 0xb9b6a8 : 0x6a4a34, { r: 0.01 }), s * (P.len / 2 + 0.035), 0.52, sz * (P.width / 2 - 0.16));
  }
  // wheels: bare rims when burnt, slumped low
  for (const wx of P.wheels) {
    for (const s of [-1, 1]) {
      if (burnt) {
        put(body, cyl(0.19, 0.12, 0x4a3a30, { axis: 'z', seg: 10 }), wx, 0.19, s * (P.width / 2 - 0.05));
        put(body, cyl(0.09, 0.13, 0x231e1b, { axis: 'z', seg: 8 }), wx, 0.19, s * (P.width / 2 - 0.04));
      } else {
        put(body, cyl(0.27, 0.2, 0x1d1e20, { axis: 'z', seg: 12 }), wx, 0.25, s * (P.width / 2 - 0.08));
        put(body, cyl(0.12, 0.21, 0x6c6e70, { axis: 'z', seg: 8 }), wx, 0.25, s * (P.width / 2 - 0.08));
      }
    }
  }
  if (burnt) body.position.y = -0.08;
  // a door hanging open, a sprung bonnet
  if (kind !== 'van' && rand() < 0.45) {
    const s = rand() < 0.5 ? -1 : 1;
    const hinge = new THREE.Group();
    hinge.position.set(0.5, 0, s * (P.width / 2 + 0.02));
    hinge.rotation.y = s * (0.7 + rand() * 0.5);
    put(hinge, box(0.7, 0.4, 0.05, burnt ? 0x3a2f29 : paint ?? 0x8a8172, { r: 0.02 }), -0.36, 0.5, 0);
    body.add(hinge);
  }
  if (kind !== 'van' && rand() < 0.35) {
    const hood = put(body, box(0.65, 0.04, P.width - 0.06, burnt ? 0x3a2f29 : paint ?? 0x8a8172, { r: 0.01 }), 0.92, 0.84, 0);
    hood.rotation.z = 0.55;
  }
  if (snow && !flipped) {
    const roofX = kind === 'van' ? 0 : kind === 'hatch' ? -0.4 : -0.18;
    put(body, box(kind === 'van' ? 2.0 : 0.72, 0.06, P.width - 0.12, SNOW, { r: 0.02 }), roofX, kind === 'van' ? 1.66 : 1.08, 0);
    if (kind !== 'van') put(body, box(0.5, 0.05, P.width - 0.2, SNOW, { r: 0.02 }), 0.95, 0.72, 0).rotation.z = -0.08;
  }
  if (flipped) {
    body.rotation.x = Math.PI;
    body.position.y = kind === 'van' ? 1.66 : 1.08;
  }
  body.rotation.z = (rand() - 0.5) * 0.05;
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  B.add(g);
  B.hitBox(x, 0.55, z, P.len, kind === 'van' ? 1.6 : 1.1, P.width, yaw);
  if (burnt) scorch(B, x, z, P.len * 0.75);
  if (solidBlock) B.block(x, z, P.len / 2, P.width / 2 + 0.05, yaw);
  return g;
}

// Long burnt-out trolleybus.
export function bus(B, x, z, yaw) {
  const rand = B.rand;
  const g = new THREE.Group();
  const body = new THREE.Group(); // sits low and leans: the tyres burnt off
  g.add(body);
  const shell = burntMaterial(0x6f8a7c, rand);
  const L = 6.4;
  const W = 2.0;
  const DARK = 0x151312;
  const FRAME = 0x2b2522;
  const RUST = 0x6b3a22;
  const outline = [
    [-L / 2, 0.42],
    ...arch(-1.9, 0.4, 0.45),
    ...arch(2.0, 0.4, 0.45),
    [L / 2, 0.42],
    [L / 2 + 0.05, 1.0],
    [L / 2 - 0.05, 2.25],
    [L / 2 - 0.3, 2.42],
    [-L / 2 + 0.2, 2.42],
    [-L / 2, 2.25],
  ];
  body.add(extrude(outline, W, shell));
  // the window band: black where the glass was, the interior's seat backs
  // and a few hanging grab rails just visible inside
  body.add(extrude([[-L / 2 + 0.25, 1.35], [L / 2 - 0.1, 1.35], [L / 2 - 0.12, 2.15], [-L / 2 + 0.25, 2.15]], W + 0.04, toon(DARK)));
  for (let i = 0; i < 7; i++) for (const s of [-1, 1]) put(body, box(0.1, 0.8, 0.04, FRAME, { r: 0.01 }), -2.75 + i * 0.9, 1.75, s * (W / 2 + 0.03));
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) put(body, box(0.4, 0.5, 0.06, 0x3a2f28, { r: 0.02 }), -2.4 + i * 0.9, 1.45, s * 0.55); // seat backs
  for (const s of [-1, 1]) put(body, box(L - 0.6, 0.06, 0.08, FRAME, { r: 0.01 }), -0.1, 1.33, s * (W / 2 + 0.03)); // the sill
  // a few panes still in, cracked and sooty
  for (let i = 0; i < 3; i++) put(body, box(0.7, 0.6, 0.02, 0x4a5258, { r: 0.01 }), -2.3 + ((rand() * 6) | 0) * 0.9, 1.78, (rand() < 0.5 ? -1 : 1) * (W / 2 + 0.035));
  // front: a big windscreen split in two, a dead destination board over it,
  // bumper, headlights, the doors (one folded open)
  put(body, box(0.05, 0.75, W - 0.25, DARK, { r: 0.01 }), L / 2 + 0.02, 1.8, 0);
  put(body, box(0.07, 0.8, 0.06, FRAME, { r: 0.01 }), L / 2 + 0.03, 1.8, 0);
  put(body, box(0.06, 0.24, W - 0.5, 0x0e0d0c, { r: 0.01 }), L / 2 - 0.02, 2.28, 0);
  put(body, box(0.18, 0.2, W + 0.06, 0x2f2a26, { r: 0.04 }), L / 2 + 0.05, 0.55, 0);
  for (const s of [-1, 1]) put(body, box(0.05, 0.12, 0.22, 0x8a8172, { r: 0.02 }), L / 2 + 0.04, 0.85, s * 0.7);
  for (const dx of [1.6, -0.6]) {
    put(body, box(1.0, 1.75, 0.03, DARK, { r: 0.01 }), dx, 1.2, W / 2 + 0.03);
    put(body, box(0.06, 1.75, 0.05, FRAME), dx, 1.2, W / 2 + 0.04);
  }
  const door = put(body, box(0.5, 1.6, 0.05, FRAME, { r: 0.01 }), 1.95, 1.2, W / 2 + 0.28);
  door.rotation.y = -0.9;
  // rear: an engine grille, a ladder up the back
  put(body, box(0.05, 0.7, W - 0.5, 0x1d1b1a, { r: 0.01 }), -L / 2 - 0.02, 0.95, 0);
  for (let k = 0; k < 6; k++) put(body, box(0.06, 0.03, W - 0.6, 0x3a332e), -L / 2 - 0.04, 0.68 + k * 0.1, 0);
  // the roof: sagging in the middle, a hole burnt through, the trolley
  // base, rust running down from it
  put(body, box(5.0, 0.24, 1.3, FRAME, { r: 0.04 }), -0.4, 2.55, 0);
  const sag = put(body, box(2.2, 0.08, W - 0.3, 0x2a2420, { r: 0.02 }), 0.6, 2.36, 0);
  sag.rotation.z = 0.05;
  put(body, box(1.4, 0.1, 0.9, DARK, { r: 0.05 }), 0.8, 2.44, 0.2); // the hole
  for (let i = 0; i < 8; i++) {
    const s = rand() < 0.5 ? -1 : 1;
    put(body, box(0.08 + rand() * 0.1, 0.4 + rand() * 0.8, 0.02, RUST, { r: 0 }), -2.8 + rand() * 5.6, 1.0 + rand() * 0.4, s * (W / 2 + 0.04));
  }
  // wheels: bare rims sitting low, a shred of tyre left on one
  for (const wx of [-1.9, 2.0]) {
    for (const s of [-1, 1]) {
      put(body, cyl(0.3, 0.16, 0x3a332e, { axis: 'z', seg: 10 }), wx, 0.3, s * 0.92);
      put(body, cyl(0.12, 0.18, 0x2b2522, { axis: 'z', seg: 8 }), wx, 0.3, s * 0.92);
    }
  }
  put(body, cyl(0.42, 0.12, 0x1a1918, { axis: 'z', seg: 12 }), 2.0, 0.36, 0.95);
  body.position.y = -0.12;
  body.rotation.x = (rand() - 0.5) * 0.08;
  // trolley poles: one still raised, one dangling to the road
  const p1 = put(g, cyl(0.04, 5.2, 0x2f2f30, { seg: 6 }), -1.0, 4.05, -0.25);
  p1.rotation.z = 1.05;
  const p2 = put(g, cyl(0.04, 5.2, 0x2f2f30, { seg: 6 }), -2.4, 1.7, 0.4);
  p2.rotation.z = -1.25;
  p2.rotation.x = 0.4;
  // glass and bits of trim round it on the ground
  for (let i = 0; i < 10; i++) B.piece(0.1 + rand() * 0.25, 0.03, 0.1 + rand() * 0.2, i % 3 ? 0x3a3f44 : 0x2b2522, x + (rand() - 0.5) * L * 1.1, 0.02, z + (rand() - 0.5) * 3.4, 0, rand() * 3, 0);
  g.position.set(x, 0, z);
  g.rotation.set(0, yaw, 0.02);
  B.add(g);
  B.hitBox(x, 1.3, z, L, 2.5, W, yaw);
  scorch(B, x, z, 4.5);
  B.block(x, z, L / 2, 1.05, yaw);
  return g;
}

// Paint that went through a fire: the livery still there in places, char
// and soot over the rest, rust blooming through, streaks running down.
const tramPaintCache = new Map();
function tramPaint(color, burn, rand) {
  const key = `${color}|${burn}`;
  if (tramPaintCache.has(key)) return tramPaintCache.get(key);
  const [c, g] = canvas(64, 64);
  g.fillStyle = `#${new THREE.Color(color).getHexString()}`;
  g.fillRect(0, 0, 64, 64);
  const faded = `#${new THREE.Color(color).lerp(new THREE.Color(0x8a8578), 0.35).getHexString()}`;
  g.fillStyle = faded;
  for (let i = 0; i < 10; i++) blob(g, rand() * 64, rand() * 64, 3 + rand() * 6, 2 + rand() * 5, rand);
  for (const [col, n, size] of [['#6d4a32', 6 + burn * 8, 2.5], ['#3d3632', 8 * burn, 6], ['#2a2624', 10 * burn, 7], ['#4a4440', 6 * burn, 4]]) {
    g.fillStyle = col;
    for (let i = 0; i < n; i++) blob(g, rand() * 64, rand() * 64, 1 + rand() * size, 1 + rand() * size * 0.8, rand);
  }
  // soot streaks running down
  for (let i = 0; i < 14 * burn + 3; i++) {
    g.fillStyle = rand() < 0.6 ? '#1c1a1966' : '#5e443455';
    g.fillRect((rand() * 64) | 0, (rand() * 40) | 0, 1 + ((rand() * 2) | 0), 6 + rand() * 18);
  }
  for (let i = 0; i < 260; i++) {
    g.fillStyle = rand() < 0.5 ? '#00000026' : '#ffffff12';
    g.fillRect((rand() * 64) | 0, (rand() * 64) | 0, 1, 1);
  }
  const t = tex(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(0.35, 0.35);
  const m = new THREE.MeshToonMaterial({ map: t, gradientMap });
  tramPaintCache.set(key, m);
  return m;
}

// A plan-view outline (x along the car, z across) raised from y0 by h.
function planSlab(points, y0, h, material) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 3 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, y0, 0);
  const m = new THREE.Mesh(geo, material);
  m.castShadow = m.receiveShadow = true;
  return m;
}
// the car's outline in plan, rounded off toward both ends
function tramPlan(L, W, inset = 0) {
  const a = L / 2 - inset;
  const b = W / 2 - inset;
  return [[-a + 0.35, -b], [a - 0.35, -b], [a - 0.08, -b * 0.72], [a + 0.04, -b * 0.3], [a + 0.04, b * 0.3], [a - 0.08, b * 0.72], [a - 0.35, b], [-a + 0.35, b], [-a + 0.08, b * 0.72], [-a - 0.04, b * 0.3], [-a - 0.04, -b * 0.3], [-a + 0.08, -b * 0.72]];
}

// A burnt-out tram, the old two-axle kind: ochre below the window line,
// cream above, a clerestory roof. Derailed, windows blown out, a hole burnt
// through the roof. With trailer: a second, shorter car coupled behind.
// tilt leans it over (radians), nose pitches it down (into rubble).
export function tram(B, x, z, yaw, { trailer = false, tilt = 0.04, nose = 0, burn = 0.6, snow = true } = {}) {
  const rand = B.rand;
  const g = new THREE.Group();
  const LOWER = tramPaint(0x9a7a3a, burn, rand);
  const UPPER = tramPaint(0xc9bfa0, burn * 0.8, rand);
  const DARK = toon(0x141211);
  const FRAME = 0x2a2826;
  const W = 2.1;

  function car(L, cx, { cab = true, roofHole = false } = {}) {
    const c = new THREE.Group();
    c.position.x = cx;
    // underframe, two axles with spoked wheels, leaf springs, axle boxes
    put(c, box(L - 0.7, 0.24, W - 0.4, FRAME, { r: 0.03 }), 0, 0.6, 0);
    for (const ax of [-L * 0.24, L * 0.24]) {
      for (const s of [-1, 1]) {
        put(c, cyl(0.34, 0.1, 0x2b2726, { axis: 'z', seg: 10 }), ax, 0.36, s * 0.72);
        put(c, cyl(0.12, 0.12, 0x3a3634, { axis: 'z', seg: 6 }), ax, 0.36, s * 0.8);
        put(c, box(0.9, 0.08, 0.12, 0x3a3634, { r: 0.02 }), ax, 0.56, s * 0.86);
        put(c, box(0.2, 0.2, 0.16, 0x2f2c2a, { r: 0.02 }), ax, 0.4, s * 0.9);
      }
    }
    // lower body: the panels, a dark rubbing strip, a belt rail under the windows
    c.add(planSlab(tramPlan(L, W), 0.72, 0.9, LOWER));
    for (const s of [-1, 1]) put(c, box(L - 0.9, 0.07, 0.04, 0x3a3634, { r: 0.01 }), 0, 0.98, s * (W / 2 + 0.01));
    c.add(planSlab(tramPlan(L + 0.06, W + 0.06), 1.6, 0.07, toon(0x4a4440)));
    // the window band: a dark inside behind cream posts, a few panes left
    c.add(planSlab(tramPlan(L, W, 0.06), 1.67, 0.75, DARK));
    const n = Math.round((L - 1.6) / 0.62);
    const step = (L - 1.6) / n;
    for (const s of [-1, 1]) {
      for (let i = 0; i <= n; i++) put(c, box(0.1, 0.75, 0.06, 0xb5ab90, { r: 0.01 }), -L / 2 + 0.8 + i * step, 2.04, s * (W / 2 - 0.02));
      for (let i = 0; i < n; i++) {
        if (rand() < 0.75) continue;
        const pane = put(c, box(step - 0.16, 0.3 + rand() * 0.35, 0.02, 0x8fa4a8, { r: 0.005 }), -L / 2 + 0.8 + (i + 0.5) * step, 1.86 + rand() * 0.15, s * (W / 2 - 0.03));
        pane.rotation.z = (rand() - 0.5) * 0.3;
      }
      // end platforms: the door openings and their step
      for (const ex of cab ? [L / 2 - 0.6] : [L / 2 - 0.6, -L / 2 + 0.6]) {
        put(c, box(0.7, 1.4, 0.05, 0x0f0e0d, { r: 0.01 }), ex, 1.4, s * (W / 2 + 0.005));
        put(c, box(0.7, 0.06, 0.25, 0x3a3634, { r: 0.01 }), ex, 0.66, s * (W / 2 + 0.08));
      }
    }
    // the end posts round the cab windows
    const plan = tramPlan(L, W, 0.02);
    for (const i of [2, 3, 4, 5, 8, 9, 10, 11]) put(c, box(0.08, 0.75, 0.08, 0xb5ab90, { r: 0.01 }), plan[i][0], 2.04, plan[i][1]);
    // letterboard, then the curved roof (burnt through on one car)
    c.add(planSlab(tramPlan(L, W), 2.42, 0.18, UPPER));
    const arc = [];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI - (i / 8) * Math.PI;
      arc.push([Math.cos(a) * (W / 2), 2.6 + Math.sin(a) * 0.22]);
    }
    arc.push([W / 2, 2.6]);
    const roofPiece = (x0, x1) => {
      const m = extrude(arc, x1 - x0 - 0.06, toon(0x5d5a55));
      m.rotation.y = Math.PI / 2;
      m.position.x = (x0 + x1) / 2;
      return c.add(m);
    };
    const r0 = -L / 2 + 0.3;
    const r1 = L / 2 - 0.3;
    if (roofHole) {
      const h0 = -0.3 + (rand() - 0.5) * 0.6;
      roofPiece(r0, h0);
      roofPiece(h0 + 1.5, r1);
      // the ribs left standing over the hole, one sagging in
      for (let i = 0; i < 3; i++) {
        const rib = put(c, box(0.06, 0.06, W - 0.1, 0x2f2c2a, { r: 0.01 }), h0 + 0.35 + i * 0.4, 2.72 - (i === 1 ? 0.25 : 0), 0);
        rib.rotation.x = i === 1 ? 0.25 : 0;
      }
      put(c, box(1.4, 0.1, 0.4, 0x2a2624, { r: 0.02 }), h0 + 0.75, 2.2, -0.3).rotation.set(0.2, 0, 0.3); // a roof sheet fallen in
    } else roofPiece(r0, r1);
    // clerestory along the middle with its vents
    put(c, box(L * 0.6, 0.16, 0.8, 0x4f4c48, { r: 0.03 }), roofHole ? L * 0.14 : 0, 2.88, 0);
    for (let i = 0; i < 4; i++) put(c, box(0.24, 0.1, 0.84, 0x3a3634, { r: 0.02 }), -L * 0.24 + i * L * 0.16 + (roofHole ? L * 0.14 : 0), 2.95, 0);
    if (cab) {
      // the driver's end: a headlamp (dead), the lifeguard tray, the
      // number box on the roof, the coupler
      put(c, cyl(0.12, 0.08, 0x8f8b84, { axis: 'x', seg: 8 }), L / 2 + 0.06, 1.05, 0);
      put(c, box(0.3, 0.12, 1.5, 0x2a2826, { r: 0.02 }), L / 2 + 0.05, 0.42, 0);
      for (const dz of [-0.5, 0, 0.5]) put(c, box(0.3, 0.04, 0.06, 0x3a3634, { r: 0.01 }), L / 2 + 0.05, 0.32, dz);
      put(c, box(0.24, 0.3, 1.0, 0x1d1b1a, { r: 0.03 }), L / 2 - 0.45, 2.98, 0);
      put(c, box(0.02, 0.18, 0.8, 0x6d6a62, { r: 0.005 }), L / 2 - 0.32, 2.98, 0); // its panel, blank
    }
    put(c, box(0.4, 0.12, 0.14, FRAME, { r: 0.02 }), -L / 2 - 0.05, 0.62, 0);
    if (snow) for (let i = 0; i < 3; i++) put(c, box(0.6 + rand() * 0.9, 0.06, 0.5 + rand() * 0.4, SNOW, { r: 0.02 }), (rand() - 0.5) * (L - 2), 2.86, (rand() - 0.5) * 0.9);
    return g.add(c);
  }

  const L = 6.4;
  const main = car(L, 0, { cab: true, roofHole: true });
  // the bow collector: knocked back, its frame bent
  const bow = new THREE.Group();
  bow.position.set(-0.6, 2.98, 0);
  bow.rotation.z = 2.5 + rand() * 0.3;
  put(bow, box(1.7, 0.05, 0.05, 0x2f2f30, { r: 0.01 }), 0.85, 0, -0.35);
  put(bow, box(1.7, 0.05, 0.05, 0x2f2f30, { r: 0.01 }), 0.85, 0, 0.35).rotation.y = 0.15;
  put(bow, box(0.06, 0.06, 1.2, 0x2f2f30, { r: 0.01 }), 1.7, 0, 0).rotation.x = 0.3;
  main.add(bow);
  let len = L;
  if (trailer) {
    const T = 5.4;
    const tr = car(T, -(L / 2 + T / 2 + 0.25), { cab: false, roofHole: false });
    tr.rotation.y = 0.12 + rand() * 0.08; // jack-knifed off the rails
    tr.position.z = 0.35;
    put(g, box(0.5, 0.1, 0.12, FRAME, { r: 0.02 }), -L / 2 - 0.15, 0.62, 0.1);
    len += T + 0.25;
  }
  g.position.set(x, -0.08, z);
  g.rotation.set(tilt, yaw, nose, 'YXZ');
  B.add(g);
  const cx = trailer ? -(len - L) / 2 : 0;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const hx = x + c * cx;
  const hz = z - s * cx;
  B.hitBox(hx, 1.4, hz, len, 2.9, W, yaw);
  scorch(B, hx, hz, len * 0.55);
  B.block(hx, hz, len / 2, W / 2 + 0.05, yaw);
  return g;
}

// Soot on the ground under something that burned.
const scorchMat = new THREE.MeshBasicMaterial({ color: 0x0c0b0b, transparent: true, opacity: 0.45, depthWrite: false });
export function scorch(B, x, z, r) {
  const m = new THREE.Mesh(new THREE.CircleGeometry(r, 9), scorchMat);
  m.rotation.set(-Math.PI / 2, 0, B.rand() * 3);
  m.scale.set(1, 0.6, 1);
  m.position.set(x, 0.025, z);
  m.userData.soot = true; // stays when the wreck above it is crushed
  B.add(m);
}

// ----------------------------------------------------------- street props
export function bench(B, x, y, z, yaw, { tipped = false } = {}) {
  const g = new THREE.Group();
  for (const s of [-0.65, 0.65]) put(g, box(0.14, 0.42, 0.5, 0x8d8b86, { r: 0.02 }), s, 0.21, 0);
  for (let i = 0; i < 3; i++) if (B.rand() > 0.15) put(g, box(1.7, 0.05, 0.13, 0x6b5640, { r: 0.01 }), 0, 0.45, -0.16 + i * 0.16);
  for (let i = 0; i < 2; i++) if (B.rand() > 0.2) put(g, box(1.7, 0.12, 0.04, 0x6b5640, { r: 0.01 }), 0, 0.68 + i * 0.17, 0.26).rotation.x = -0.15;
  put(g, box(1.2, 0.04, 0.3, SNOW, { r: 0.01 }), (B.rand() - 0.5) * 0.3, 0.49, 0);
  if (tipped) {
    g.rotation.x = 1.45;
    g.position.y = 0.25;
  }
  const holder = new THREE.Group();
  holder.add(g);
  holder.position.set(x, y, z);
  holder.rotation.y = yaw;
  return B.add(holder);
}

export function bin(B, x, y, z, { tipped = false } = {}) {
  const r = B.rand;
  const m = put(B.root, cyl(0.24, 0.7, 0x56604f, { seg: 10, radiusEnd: 0.2 }), x, y + 0.35, z);
  if (tipped) {
    m.rotation.set(Math.PI / 2, 0, r() * 3);
    m.position.y = y + 0.22;
  }
  for (let i = 0; i < 2 + r() * 3; i++) B.lump(x + (r() - 0.5) * 1.4, y + 0.12, z + (r() - 0.5) * 1.2, 0.2 + r() * 0.12, 0.15, 0.2, r() < 0.5 ? 0x1d1f24 : 0x2c3442, r() * 3);
  return m;
}

export function dumpster(B, x, y, z, yaw, color = 0x4e6355) {
  const g = new THREE.Group();
  put(g, box(1.8, 1.0, 1.05, color, { r: 0.05 }), 0, 0.6, 0);
  const lid = put(g, box(1.84, 0.06, 1.1, 0x34383a, { r: 0.02 }), 0, 1.14, 0.12);
  lid.rotation.x = B.rand() < 0.5 ? -0.5 : 0;
  for (const sx of [-0.7, 0.7]) for (const sz of [-0.4, 0.4]) put(g, cyl(0.07, 0.08, 0x1d1e20, { axis: 'z', seg: 6 }), sx, 0.08, sz);
  put(g, box(1.7, 0.05, 0.95, SNOW, { r: 0.01 }), 0, 1.2, 0.05);
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  B.add(g);
  B.hitBox(x, y + 0.6, z, 1.8, 1.2, 1.05, yaw);
  B.block(x, z, 0.92, 0.55, yaw);
  return g;
}

// Stacked wooden crates and cardboard, some burst.
export function crates(B, x, y, z) {
  const r = B.rand;
  for (let i = 0; i < 4 + r() * 4; i++) {
    const s = 0.4 + r() * 0.3;
    const wood = r() < 0.55;
    const cx = x + (r() - 0.5) * 1.6;
    const cz = z + (r() - 0.5) * 1.2;
    const stacked = i > 2 && r() < 0.5;
    B.piece(s, wood ? s : s * (0.5 + r() * 0.5), s, wood ? 0x7a5f3e : 0x9b8463, cx, y + (stacked ? s * 1.4 : s / 2), cz, (r() - 0.5) * 0.3, r() * 3, (r() - 0.5) * 0.3);
    if (wood) B.piece(s + 0.02, 0.06, s + 0.02, 0x5c472e, cx, y + (stacked ? s * 1.4 : s / 2), cz, 0, 0, 0);
  }
  // a pallet leaning against the pile
  for (let i = 0; i < 3; i++) B.piece(1.1, 0.05, 0.14, 0x6e5a42, x + 0.6, y + 0.35 + i * 0.2, z + 0.7, 1.2, 0.2, 0);
}

export function tires(B, x, y, z, n = 4) {
  const r = B.rand;
  const geo = new THREE.TorusGeometry(0.24, 0.1, 6, 10);
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(geo, toon(0x1f2022));
    const stacked = i < n / 2;
    m.position.set(x + (stacked ? 0 : (r() - 0.5) * 1.6), y + (stacked ? 0.1 + i * 0.2 : 0.1), z + (stacked ? 0 : (r() - 0.5) * 1.4));
    m.rotation.set(Math.PI / 2 + (stacked ? 0 : (r() - 0.5) * 0.4), 0, r() * 3);
    m.castShadow = true;
    B.add(m);
  }
}

export function bollards(B, x0, x1, y, z) {
  for (let x = x0; x <= x1; x += 1.2) {
    const m = put(B.root, cyl(0.1, 0.75, 0x6a6c6f, { seg: 8 }), x, y + 0.37, z);
    if (B.rand() < 0.35) {
      m.rotation.z = (B.rand() - 0.5) * 1.6; // run over
      m.position.y = y + 0.25;
    }
  }
}

export function planter(B, x, y, z) {
  B.solid(put(B.root, box(1.2, 0.55, 1.2, 0x8f8c86, { r: 0.04 }), x, y + 0.28, z));
  put(B.root, box(1.0, 0.06, 1.0, SNOW, { r: 0.02 }), x, y + 0.57, z);
  for (let i = 0; i < 5; i++) {
    const s = cyl(0.025, 0.7 + B.rand() * 0.6, 0x3d3632, { seg: 4 });
    s.position.set(x + (B.rand() - 0.5) * 0.6, y + 0.9, z + (B.rand() - 0.5) * 0.6);
    s.rotation.set((B.rand() - 0.5) * 0.9, 0, (B.rand() - 0.5) * 0.9);
    B.add(s);
  }
  B.block(x, z, 0.6, 0.6);
}

let fenceTex = null;
function fenceMaterial() {
  if (!fenceTex) {
    const [c, g] = canvas(32, 32);
    g.strokeStyle = '#5f6366';
    g.lineWidth = 1;
    for (let i = -32; i < 64; i += 6) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 32, 32);
      g.moveTo(i + 32, 0);
      g.lineTo(i, 32);
      g.stroke();
    }
    fenceTex = tex(c);
    fenceTex.wrapS = fenceTex.wrapT = THREE.RepeatWrapping;
  }
  return new THREE.MeshToonMaterial({ map: fenceTex, alphaTest: 0.5, transparent: false, side: THREE.DoubleSide, gradientMap });
}

// Chain-link fence run along x, some panels sagging or flattened.
export function fence(B, x0, x1, y, z) {
  const mat = fenceMaterial();
  for (let x = x0; x < x1; x += 2.4) {
    put(B.root, cyl(0.04, 1.9, 0x55595c, { seg: 6 }), x, y + 0.95, z);
    const roll = B.rand();
    if (roll < 0.15) continue;
    const geo = new THREE.PlaneGeometry(2.4, 1.7);
    geo.attributes.uv.array.forEach((v, i, a) => (a[i] = v * (i % 2 ? 1.7 : 2.4) * 1.4));
    const p = new THREE.Mesh(geo, mat);
    p.position.set(x + 1.2, y + 0.95, z);
    if (roll < 0.35) {
      p.rotation.x = 0.5 + B.rand() * 0.6; // leaning out
      p.position.y -= 0.3;
    }
    p.castShadow = true;
    B.add(p);
  }
}

export function cabinet(B, x, y, z, yaw) {
  const g = new THREE.Group();
  put(g, box(0.7, 1.3, 0.45, 0x6f7774, { r: 0.03 }), 0, 0.65, 0);
  const door = put(g, box(0.66, 1.2, 0.04, 0x66706c, { r: 0.01 }), 0.33, 0.65, 0.25);
  door.rotation.y = -1.1;
  door.position.x = 0.55;
  door.position.z = 0.45;
  put(g, box(0.6, 1.1, 0.02, 0x1d1e20, { r: 0.01 }), 0, 0.65, 0.23);
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  B.add(g);
  B.block(x, z, 0.4, 0.3, yaw);
}

// A lamp pole that came down across the street.
export function fallenPole(B, x, z, yaw, len = 6.2) {
  const g = new THREE.Group();
  const pole = put(g, cyl(0.1, len, 0x8b8984, { seg: 8, radiusEnd: 0.14 }), len / 2, 0.14, 0);
  pole.rotation.z = Math.PI / 2;
  put(g, box(0.3, 0.14, 0.6, 0x3c3e42, { r: 0.05 }), len + 0.2, 0.12, 0.3);
  put(g, box(0.6, 0.3, 0.6, 0x7b7a76, { r: 0.04 }), 0, 0.15, 0); // torn-out footing
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  B.add(g);
  for (let i = 0; i < 4; i++) B.piece(0.25, 0.15, 0.2, 0x5e5d5a, x + (B.rand() - 0.5), 0.07, z + (B.rand() - 0.5), 0, B.rand() * 3, 0.3);
}

// A pole bent over at a kink.
export function bentPole(B, x, y, z, h, yaw, bend = 0.9, color = 0x6a6c6f) {
  const g = new THREE.Group();
  const k = h * (0.35 + B.rand() * 0.3);
  put(g, cyl(0.07, k, color, { seg: 6 }), 0, k / 2, 0);
  const top = new THREE.Group();
  top.position.y = k;
  top.rotation.z = bend;
  put(top, cyl(0.07, h - k, color, { seg: 6 }), 0, (h - k) / 2, 0);
  g.add(top);
  g.position.set(x, y, z);
  g.rotation.y = yaw;
  B.add(g);
  return top;
}

// Broken billboard frame: torn panels, one leg buckled.
export function billboard(B, x, z, yaw, makeSign) {
  const g = new THREE.Group();
  put(g, box(0.18, 3.4, 0.18, 0x45484c, { r: 0.02 }), -1.4, 1.7, 0);
  const leg = put(g, box(0.18, 3.4, 0.18, 0x45484c, { r: 0.02 }), 1.4, 1.5, 0);
  leg.rotation.z = 0.12;
  const board = new THREE.Group();
  board.position.set(0, 3.6, 0);
  board.rotation.z = -0.14;
  put(board, box(4.2, 2.0, 0.12, 0x3a3d40, { r: 0.03 }), 0, 0, 0);
  for (let i = 0; i < 3; i++) {
    if (B.rand() < 0.25) continue;
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 1.8), makeSign(1.3, 1.8));
    p.position.set(-1.35 + i * 1.35, 0, -0.07);
    p.rotation.y = Math.PI;
    if (B.rand() < 0.3) p.rotation.z = 0.25;
    board.add(p);
  }
  g.add(board);
  g.position.set(x, 0, z);
  g.rotation.y = yaw;
  B.add(g);
  g.traverse((m) => {
    if (m.isMesh) m.castShadow = true;
  });
  B.block(x, z, 2.1, 0.3, yaw);
}

// Facade clutter: AC units, a satellite dish, drainpipes.
export function facadeClutter(B, x0, x1, zf, H) {
  const r = B.rand;
  const n = Math.round((x1 - x0) / 4);
  for (let i = 0; i < n; i++) {
    const x = x0 + 0.6 + r() * (x1 - x0 - 1.2);
    const y = 2.2 + r() * (H - 3);
    B.piece(0.55, 0.38, 0.32, 0x9a9a96, x, y, zf + 0.16, 0, 0, 0);
    B.piece(0.08, 0.3, 0.05, 0x2a2b2d, x - 0.1, y, zf + 0.33, 0, 0, 0);
  }
  for (let i = 0; i < 2; i++) {
    const x = x0 + 1 + r() * (x1 - x0 - 2);
    const d = cyl(0.26, 0.06, 0xb9b8b2, { axis: 'z', seg: 10 });
    d.position.set(x, 3 + r() * (H - 4), zf + 0.25);
    d.rotation.y = 0.5;
    B.add(d);
  }
  for (const x of [x0 + 0.25, x1 - 0.25]) {
    const p = cyl(0.07, H - 0.2, 0x6b6c6e, { seg: 6 });
    p.position.set(x, (H - 0.2) / 2, zf + 0.1);
    if (r() < 0.3) {
      p.rotation.z = 0.08; // torn loose at the top
      p.position.x += 0.3;
    }
    B.add(p);
  }
}
