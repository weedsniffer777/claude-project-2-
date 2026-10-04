// Level 3: onto the highway, at midday. The same district, out at its edge:
// the panel blocks thin out into warehouses and works yards, then the road
// climbs a long ramp onto the elevated highway out toward the airport.
//
// Layout (world +X runs bottom-left to top-right on screen):
//  1 The outskirts: the last blocks of the city, then warehouses, a works
//    chimney, oil tanks, fences. Dogs and walkers; the first attack drones.
//    A checkpoint across the road at its end.
//  2 The ramp: the road rises on a long ramp onto the highway deck, fields
//    and a power line below, the airport off in the haze. Drones come in
//    over the sides, machines up the ramp. A checkpoint on the deck itself.
//  3 The highway: wrecks and barriers across the carriageways, a fortified
//    roadblock at the end. Clear its defenders, break through, and on.
import * as THREE from 'three';
import { addNoon } from '../render/setup.js';
import { box, cyl, put, toon, gradientMap, setLowPoly } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import * as P from './props.js';
import { buildShack } from './depot.js';
import { buildDepotRoom } from './depotRoom.js';
import { rails } from './rails.js';
import { FH, glyphSign, sidewalkTexture, facadeTextures, endTexture, facadeMat, mapMat } from './cityTextures.js';

const GPX = 8; // ground texels per world unit
const MAP = { x0: -60, x1: 340, z0: -70, z1: 60 };
const START_X = -20;
const CURB = { n: -7.5, s: 6.5 };
const WALK = { n: -10, s: 9 };
const SW = 0.16;
const SHACK_A = { x0: 100, x1: 107.6 };
const RAMP = { x0: 126, x1: 168 }; // the ramp, rising onto the deck
const DECK = 4.5; // the highway deck's height
const DECK_Z = 8.6; // its half-width
const SHACK_B = { x0: 226, x1: 233.6 }; // the checkpoint on the deck
const BLOCK_X = 300; // the roadblock
const END_X = 316;

const PANELS = ['#9a978f', '#a5a095', '#91959a', '#aca393', '#8b8e92'];
const ACCENTS = ['#5f8784', '#a3874e', '#5c6f8c', '#8f8550', '#6f7f6a'];
const CONCRETE = [0x8d8b86, 0x7d7c78, 0x9a978f, 0x6f6e6b, 0x85898c];
const BURNT_PAINT = [0x5d6b80, 0x8a8172, 0x6f7f6a, 0x9b9277, null, 0x7a6a5a];
const CONTAINERS = [0x7a4a36, 0x4f6b6a, 0x6b6f72, 0x8a6a3a, 0x3f5470];

const onRampOrDeck = (x, z) => x >= RAMP.x0 && Math.abs(z + 0.5) < DECK_Z;
// the ground's height: the street's sidewalks, the ramp climbing, the deck
function heightAt(x, z) {
  if (x >= RAMP.x1 && Math.abs(z + 0.5) < DECK_Z) return DECK;
  if (x >= RAMP.x0 && x < RAMP.x1 && Math.abs(z + 0.5) < DECK_Z) return (DECK * (x - RAMP.x0)) / (RAMP.x1 - RAMP.x0);
  if (x < RAMP.x0) return z <= CURB.n || z >= CURB.s ? SW : 0;
  return 0;
}

// The ground: the street's asphalt in from the city, then fields either
// side of the road out past the works (thin snow, brown grass, ruts of
// mud), the road running on under the ramp.
function groundTexture(rand) {
  const W = (MAP.x1 - MAP.x0) * GPX;
  const H = (MAP.z1 - MAP.z0) * GPX;
  const [c, g] = canvas(W, H);
  const X = (x) => (x - MAP.x0) * GPX;
  const Z = (z) => (z - MAP.z0) * GPX;
  const rect = (x0, z0, x1, z1, color) => {
    g.fillStyle = color;
    g.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
  };
  // fields: brown grass under a thin, patchy snow
  rect(MAP.x0, MAP.z0, MAP.x1, MAP.z1, '#8a7f63');
  speckle(g, W, H, ['#7d7358', '#958a6c', '#6f6650', '#a39878'], W * H * 0.02, rand);
  for (let i = 0; i < 900; i++) {
    g.fillStyle = rand() < 0.6 ? '#dfe3e6' : '#c9ced3';
    blob(g, rand() * W, rand() * H, (1 + rand() * 4) * GPX, (0.6 + rand() * 2) * GPX, rand, 9);
  }
  // the city end: hard standing and yards, mostly snow
  rect(MAP.x0, MAP.z0, RAMP.x0 - 10, MAP.z1, '#c3c6cb');
  speckle(g, X(RAMP.x0 - 10), H, ['#b3b6bb', '#cfd2d6', '#a9abaf'], X(RAMP.x0 - 10) * H * 0.03, rand);
  // the road, all the way along
  rect(MAP.x0, CURB.n, MAP.x1, CURB.s, '#5e5f64');
  speckle(g, W, Z(CURB.s) - Z(CURB.n), ['#68696e', '#54555a', '#6e6e72'], W * (Z(CURB.s) - Z(CURB.n)) * 0.05, rand, Z(CURB.n));
  for (let i = 0; i < (MAP.x1 - MAP.x0) * 3; i++) {
    const x = MAP.x0 + rand() * (MAP.x1 - MAP.x0);
    const z = CURB.n + 0.3 + rand() * (CURB.s - CURB.n - 0.6);
    const edge = Math.min(z - CURB.n, CURB.s - z) < 1.3;
    g.fillStyle = edge ? '#a9a8a6' : rand() < 0.5 ? '#88867f' : '#78766f';
    blob(g, X(x), Z(z), (0.5 + rand() * 1.3) * GPX, (0.35 + rand() * 0.6) * GPX, rand, 9);
  }
  g.fillStyle = '#aaa79e';
  for (let x = MAP.x0; x < MAP.x1; x += 1) if (rand() > 0.45) g.fillRect(X(x), Z(-0.6), GPX, 2);
  // mud tracks off across the fields to the works
  g.fillStyle = '#5f5544';
  for (let k = 0; k < 6; k++) {
    let x = RAMP.x0 - 30 + rand() * 120;
    let z = rand() < 0.5 ? -12 : 11;
    const dz = z < 0 ? -1 : 1;
    for (let i = 0; i < 60; i++) {
      g.fillRect(X(x), Z(z), 4, 3);
      x += 0.5 + rand() * 0.5;
      z += dz * (0.3 + rand() * 0.4);
    }
  }
  return tex(c);
}

// Highway signs: a green board, white lettering, a white edge.
function roadSign(lines, w, h) {
  const k = 24;
  const [c, g] = canvas(w * k, h * k);
  g.fillStyle = '#1f6b43';
  g.fillRect(0, 0, w * k, h * k);
  g.strokeStyle = '#f1f1ea';
  g.lineWidth = 3;
  g.strokeRect(4, 4, w * k - 8, h * k - 8);
  g.fillStyle = '#f1f1ea';
  g.textBaseline = 'middle';
  const lh = (h * k - 16) / lines.length;
  lines.forEach(([text, right], i) => {
    g.font = `bold ${Math.round(lh * 0.6)}px sans-serif`;
    g.textAlign = 'left';
    g.fillText(text, 14, 8 + lh * (i + 0.5));
    if (right) {
      g.textAlign = 'right';
      g.fillText(right, w * k - 14, 8 + lh * (i + 0.5));
    }
  });
  const t = tex(c);
  t.magFilter = THREE.NearestFilter;
  return t;
}

export const highway = {
  id: 'highway',
  name: 'Level 3 · Highway',
  build(scene) {
    setLowPoly(true);
    try {
      return buildHighway(scene);
    } finally {
      setLowPoly(false);
    }
  },
};

function buildHighway(scene) {
  const B = new LevelBuilder(scene, 3307);
  const rand = B.rand;
  // everything up on the deck is built on a second root raised to its height
  const D = new LevelBuilder(scene, 3311);
  D.root.position.y = DECK;
  const light = addNoon(scene, { shadowSize: 22, shadowMap: 2048 });
  const sign = (w, h, o = {}) => mapMat(glyphSign(w, h, { rand, ...o }));

  // ------------------------------------------------------------ ground
  const groundMat = mapMat(groundTexture(rand));
  {
    const geo = new THREE.PlaneGeometry(MAP.x1 - MAP.x0, MAP.z1 - MAP.z0);
    const m = new THREE.Mesh(geo, groundMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((MAP.x0 + MAP.x1) / 2, 0, (MAP.z0 + MAP.z1) / 2);
    m.receiveShadow = true;
    B.add(m);
    B.solid(m);
  }
  const walkTex = sidewalkTexture(rand);
  const curbMat = toon(0x9a9893);
  function slab(x0, x1, z0, z1) {
    const t = walkTex.clone();
    t.needsUpdate = true;
    t.repeat.set((x1 - x0) / 3.2, (z1 - z0) / 3.2);
    const top = new THREE.MeshToonMaterial({ map: t, gradientMap });
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, SW, z1 - z0), [curbMat, curbMat, top, curbMat, curbMat, curbMat]);
    m.position.set((x0 + x1) / 2, SW / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    B.add(m);
    B.solid(m);
  }
  slab(MAP.x0, RAMP.x0 - 2, -18, CURB.n);
  slab(MAP.x0, RAMP.x0 - 2, CURB.s, 18);
  // snow plowed up along the curbs
  for (const [z, dir] of [[CURB.n - 0.35, -1], [CURB.s + 0.35, 1]]) {
    for (let x = START_X - 10; x < RAMP.x0 - 4; x += 0.6) {
      if (rand() < 0.15) x += 2;
      B.lump(x, SW, z + dir * rand() * 0.25, 0.5 + rand() * 0.4, 0.18 + rand() * 0.15, 0.35 + rand() * 0.2, rand() < 0.3 ? 0xa9aaac : 0xc7cacf, rand() * 3);
    }
  }
  // tram rails down the street and on to the ramp's foot
  {
    const R = rails(B, rand, { y: heightAt });
    for (const z of [-2.25, 1.55]) R.track(R.straight(START_X + 1, z, RAMP.x0 - 6, z));
  }

  // ---------------------------------------------------- buildings (city)
  const ribs = (() => {
    const [c, g] = canvas(16, 16);
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 16, 16);
    g.fillStyle = '#c9c9c9';
    for (let x = 0; x < 16; x += 4) g.fillRect(x, 0, 2, 16);
    g.fillStyle = '#9a9a9a';
    g.fillRect(0, 0, 16, 1);
    g.fillRect(0, 15, 16, 1);
    const t = tex(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  })();
  const ribMat = (w, h, color) => {
    const t = ribs.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 1.4, h / 2.4);
    return new THREE.MeshToonMaterial({ map: t, color, gradientMap });
  };
  function building(o) {
    const { x0, x1, zf = WALK.n, depth = 12, floors } = o;
    const w = x1 - x0;
    const H = floors * FH + 0.5;
    const look = { panel: o.panel, accent: o.accent, broken: o.broken ?? 0.2, holes: o.holes ?? 1, shop: o.shop };
    const front = facadeMat(facadeTextures(w, floors, look, rand));
    const end = mapMat(endTexture(depth, floors, look, rand, false));
    const roof = toon(0xc6c9ce);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, depth), [end, end, roof, roof, front, end]);
    m.position.set((x0 + x1) / 2, H / 2, zf - depth / 2);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    B.block((x0 + x1) / 2, zf - depth / 2, w / 2, depth / 2);
    P.facadeClutter(B, x0, x1, zf, H);
    B.lump((x0 + x1) / 2, H + 0.05, zf - depth / 2, w / 2.4, 0.1, depth / 2.8, 0xd0d3d8);
  }
  // A warehouse shed: ribbed tin walls, a sawtooth roof, a big roller door
  // and a painted name board, set back behind its yard.
  function shed(x0, x1, z0, z1, color, name) {
    const w = x1 - x0;
    const d = z1 - z0;
    const H = 4.2;
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, H, d), ribMat(Math.max(w, d), H, color));
    walls.position.set((x0 + x1) / 2, H / 2, (z0 + z1) / 2);
    walls.castShadow = walls.receiveShadow = true;
    B.add(walls);
    B.solid(walls);
    B.block((x0 + x1) / 2, (z0 + z1) / 2, w / 2, d / 2);
    // sawtooth roof: a row of sloped panels with glazing strips
    for (let x = x0 + 1.5; x < x1 - 0.5; x += 3) {
      const panel = put(B.root, box(3, 0.12, d, 0x6d6a64, { r: 0.02 }), x, H + 0.55, (z0 + z1) / 2);
      panel.rotation.z = 0.35;
      put(B.root, box(0.06, 0.9, d - 0.2, 0x8fa4b0, { r: 0.01 }), x + 1.38, H + 0.5, (z0 + z1) / 2);
    }
    // the door and its name board, on the side facing the road
    const face = z0 > 0 ? z0 : z1;
    const out = z0 > 0 ? -1 : 1;
    put(B.root, box(4, 3.2, 0.08, 0x5f6670, { r: 0.02 }), (x0 + x1) / 2, 1.6, face + out * 0.05);
    for (let y = 0.3; y < 3.1; y += 0.32) put(B.root, box(4, 0.04, 0.1, 0x4d535b), (x0 + x1) / 2, y, face + out * 0.06);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(Math.min(w * 0.6, 9), 0.8), sign(Math.min(w * 0.6, 9), 0.8, { board: '#3d4a58', ink: '#e6e0cc' }));
    board.position.set((x0 + x1) / 2, H - 0.6, face + out * 0.07);
    if (out < 0) board.rotation.y = Math.PI;
    B.add(board);
    void name;
  }
  function container(x, y, z, yaw, color, tilt = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.45), new THREE.MeshToonMaterial({ map: ribs, color, gradientMap }));
    m.position.set(x, y + 1.3, z);
    m.rotation.set(0, yaw, tilt);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    B.lump(x, y + 2.62, z, 2.4, 0.08, 1.0, 0xd0d3d8, yaw);
    return m;
  }
  function jersey(BB, x, z, yaw = 0, h = 0.9, w = 1.6) {
    const j = put(BB.root, box(w, h, 0.7, 0x9a978f, { r: 0.06 }), x, (BB === B ? heightAt(x, z) : 0) + h / 2, z);
    j.rotation.y = yaw;
    BB.solid(j);
    BB.block(x, z, w / 2, 0.35, yaw);
    return j;
  }
  function rubble(x, z, radius, height) {
    const y = heightAt(x, z);
    const n = Math.round(radius * radius * 6) + 8;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius;
      const k = 1 - r / radius;
      const s = 0.25 + rand() * 0.6;
      B.piece(s * (1 + rand()), s * 0.7, s, CONCRETE[(rand() * 5) | 0], x + Math.cos(a) * r, y + k * height * (0.4 + rand() * 0.6), z + Math.sin(a) * r * 0.8, rand() * 3, rand() * 3, rand() * 3);
    }
    B.lump(x, y + height * 0.7, z, radius * 0.3, 0.1, radius * 0.25, 0xc9ccd1, rand() * 3);
  }

  // 1: the city's last blocks, lower and further apart
  {
    // the start: a container wall across the street behind the tank
    const X = START_X - 1.3;
    let i = 0;
    for (let z = -15; z < 20; z += 6.2, i++) {
      container(X, 0, z, Math.PI / 2, CONTAINERS[i % 5]);
      if (i % 3 !== 1) container(X - 0.1, 2.6, z + (i % 2 ? 0.4 : -0.3), Math.PI / 2 + (rand() - 0.5) * 0.1, CONTAINERS[(i + 2) % 5]);
    }
    B.block(X, 2, 1.4, 22);
    building({ x0: -46, x1: -10, floors: 6, panel: PANELS[1], accent: ACCENTS[3] });
    building({ x0: -6, x1: 22, floors: 5, panel: PANELS[3], accent: ACCENTS[1], shop: true });
    building({ x0: 26, x1: 44, floors: 4, panel: PANELS[0], accent: ACCENTS[2] });
    // the near side: garages, a low shop block
    const doors = [0x6b5a48, 0x56606a, 0x5f6b5a, 0x6e6152, 0x4d5560];
    for (let k = 0; k < 9; k++) {
      const x = START_X - 2 + k * 3.1;
      const h = 2.1 + (rand() - 0.5) * 0.2;
      put(B.root, box(3.0, h, 5, 0x7f7d79, { r: 0.04 }), x, SW + h / 2, WALK.s + 6.5);
      put(B.root, box(2.3, 1.7, 0.06, doors[(rand() * 5) | 0], { r: 0.01 }), x, SW + 0.9, WALK.s + 3.99);
      B.lump(x, SW + h + 0.12, WALK.s + 6.5, 1.4, 0.1, 2.4, 0xd0d3d8, 0);
    }
    B.block(START_X + 11, WALK.s + 6.5, 14, 2.5);
    building({ x0: 12, x1: 40, zf: WALK.s + 13, floors: 3, panel: PANELS[2], accent: ACCENTS[0] });
  }
  // the works: warehouses either side behind fenced yards, a chimney, oil
  // tanks, a container stack, a gantry crane over the yard
  shed(50, 72, -26, -12, 0x8a9a8e, 'WAREHOUSE');
  shed(76, 96, -24, -12.5, 0x9a8f7a, 'DEPOT');
  shed(54, 80, 12.5, 26, 0x7d8a92, 'WORKS');
  {
    // fences along the yards
    for (const [x0, x1, z] of [[46, 98, WALK.n - 0.2], [46, 98, WALK.s + 0.4]]) P.fence(B, x0, x1, SW, z);
    B.block(72, WALK.n + 0.55, 26, 0.3);
    B.block(72, WALK.s - 0.25, 26, 0.3);
    B.block(-3, WALK.n + 0.55, 46, 0.3);
    B.block(-3, WALK.s - 0.25, 46, 0.3);
    // the works chimney: banded brick, a gantry ladder, a smoke plume
    const cx = 86;
    const cz = 20;
    for (let i = 0; i < 9; i++) put(B.root, cyl(1.3 - i * 0.07, 2.2, i % 3 === 2 ? 0x5a4a40 : 0x8a6a52, { seg: 12 }), cx, 1.1 + i * 2.2, cz);
    B.block(cx, cz, 1.4, 1.4);
    put(B.root, cyl(0.85, 0.3, 0x2a2b2e, { seg: 12 }), cx, 20, cz);
    const smoke = [];
    for (let i = 0; i < 6; i++) {
      const p = B.lump(cx, 21 + i * 1.6, cz, 1 + i * 0.4, 0.8 + i * 0.3, 1 + i * 0.4, 0x8d8f93, i);
      smoke.push(p);
    }
    // oil tanks behind the far fence
    for (const [x, z, r] of [[104, -24, 3.2], [112, -22, 2.6], [102, 22, 3]]) {
      put(B.root, cyl(r, 5, 0xb8b4a6, { seg: 18 }), x, 2.5, z);
      put(B.root, cyl(r + 0.05, 0.3, 0x8a8678, { seg: 18 }), x, 5.1, z);
      B.lump(x, 5.2, z, r * 0.8, 0.12, r * 0.8, 0xdfe3e6);
      B.block(x, z, r, r);
    }
    // a container stack in the yard by the road (cover in the street)
    container(60, 0, -15.5, 0.05, CONTAINERS[1]);
    container(60.3, 2.6, -15.4, 0.08, CONTAINERS[3]);
    container(84, 0, 14.5, -0.04, CONTAINERS[4]);
  }
  // cover in the street: wrecks, barriers, heaps
  const wreck = (BB, x, z, yaw, o) => BB.crushable(() => P.car(BB, x, z, yaw, o), { kind: 'car', scrap: 2 });
  wreck(B, -4, -1, 0.35, { kind: 'sedan', paint: BURNT_PAINT[0] });
  wreck(B, 14, 3.8, 0.25, { kind: 'hatch', paint: BURNT_PAINT[1], flipped: true });
  wreck(B, 34, -4.5, -0.4, { kind: 'van', paint: 0x6b7458 });
  wreck(B, 52, 3, 0.5, { kind: 'sedan', paint: BURNT_PAINT[2] });
  wreck(B, 70, -3.5, 0.8, { kind: 'hatch', paint: BURNT_PAINT[3] });
  wreck(B, 90, 2.5, -0.3, { kind: 'sedan', paint: BURNT_PAINT[5] });
  P.tram(B, 44, -3.8, 0.08, { tilt: 0.05, burn: 0.75, snow: false });
  rubble(24, -5.5, 1.6, 1.2);
  rubble(78, 4.5, 1.8, 1.3);
  for (const [x, z, yaw] of [[8, -4, 0.3], [62, 1.5, 1.4], [63.8, 2.2, 1.3], [96, -4.5, 0.6]]) jersey(B, x, z, yaw);
  const junk = (fn, scrap = 0) => B.crushable(fn, { kind: 'prop', scrap });
  junk(() => P.crates(B, 30, SW, WALK.n + 1.2), 2);
  junk(() => P.tires(B, 48, SW, CURB.s + 1, 4));
  junk(() => P.crates(B, 74, SW, CURB.s + 1.2), 2);
  junk(() => P.bin(B, 2, SW, WALK.n + 1.3, { tipped: true }), 1);
  // street lamps (off: it's day)
  for (let x = START_X + 4; x < SHACK_A.x0 - 1; x += 16) {
    for (const s of [-1, 1]) {
      const z = s < 0 ? CURB.n - 0.45 : CURB.s + 0.45;
      B.crushable(
        () => {
          const pole = cyl(0.09, 6.4, 0x8b8984, { seg: 8, radiusEnd: 0.14 });
          pole.position.set(x, SW + 3.2, z);
          B.add(pole);
          B.solid(pole);
          B.block(x, z, 0.2, 0.2);
          const arm = put(B.root, box(0.08, 0.08, 1.7, 0x4a4c50, { r: 0.02 }), x, SW + 6.1, z - s * 0.85);
          arm.rotation.x = s * 0.12;
          put(B.root, box(0.34, 0.14, 0.6, 0x3c3e42, { r: 0.05 }), x, SW + 6.05, z - s * 1.7);
        },
        { kind: 'pole', pivot: { x, y: SW, z }, footprint: { x, z, hx: 0.25, hz: 0.25, yaw: 0 } },
      );
    }
  }

  // ------------------------------------------------- the ramp and deck
  // the road climbs from RAMP.x0 to RAMP.x1 onto the deck; concrete walls
  // either side, piers under the deck, and the fields all round below
  const roadMat = toon(0x5e5f64);
  {
    const len = RAMP.x1 - RAMP.x0;
    const ang = Math.atan2(DECK, len);
    const L = Math.hypot(len, DECK);
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(L, 0.6, DECK_Z * 2), [toon(0x7a776f), toon(0x7a776f), roadMat, toon(0x6a675f), toon(0x7a776f), toon(0x7a776f)]);
    ramp.position.set((RAMP.x0 + RAMP.x1) / 2, DECK / 2 - 0.3 * Math.cos(ang), -0.5);
    ramp.rotation.z = ang;
    ramp.receiveShadow = ramp.castShadow = true;
    B.add(ramp);
    B.solid(ramp);
    // its side walls, sloping up with it
    for (const s of [-1, 1]) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9, 0.35), toon(0x9a978f));
      wall.position.set((RAMP.x0 + RAMP.x1) / 2, DECK / 2 + 0.45, -0.5 + s * (DECK_Z - 0.2));
      wall.rotation.z = ang;
      wall.castShadow = true;
      B.add(wall);
      B.solid(wall);
      // the earth bank under it, filling down to the fields
      const bank = new THREE.Mesh(new THREE.BoxGeometry(len, DECK, 0.5), toon(0x8a8478));
      bank.position.set((RAMP.x0 + RAMP.x1) / 2 + len * 0.15, DECK / 2 - 0.2, -0.5 + s * (DECK_Z + 0.1));
      bank.scale.y = 0.6;
      B.add(bank);
      for (let x = RAMP.x0; x < RAMP.x1; x += 2) B.block(x + 1, -0.5 + s * (DECK_Z - 0.2), 1, 0.25);
    }
    // the road markings up it
    for (let x = RAMP.x0 + 1; x < RAMP.x1; x += 3) {
      const m = put(B.root, box(1.4, 0.02, 0.12, 0xd8d4c8, { r: 0 }), x, heightAt(x, 0) + 0.03, -0.5);
      m.rotation.z = ang;
    }
  }
  // the deck (built up on D's raised root): slab, carriageways, a median,
  // guard rails, lane marks
  const DECK_X1 = MAP.x1 - 4;
  {
    const len = DECK_X1 - RAMP.x1;
    const cx = (RAMP.x1 + DECK_X1) / 2;
    const slabM = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, DECK_Z * 2), [toon(0x7a776f), toon(0x7a776f), roadMat, toon(0x6a675f), toon(0x7a776f), toon(0x7a776f)]);
    slabM.position.set(cx, -0.45, -0.5);
    slabM.receiveShadow = slabM.castShadow = true;
    D.add(slabM);
    D.solid(slabM);
    // lane marks, the hard shoulders, slush on the edges
    for (let x = RAMP.x1 + 1; x < DECK_X1; x += 4) for (const z of [-4.3, 3.3]) put(D.root, box(2, 0.02, 0.14, 0xd8d4c8, { r: 0 }), x, 0.02, z);
    for (const z of [-7.6, 6.6]) put(D.root, box(len, 0.02, 0.14, 0xe0c060, { r: 0 }), cx, 0.02, z);
    for (let i = 0; i < len / 3; i++) D.lump(RAMP.x1 + rand() * len, 0, (rand() < 0.5 ? -1 : 1) * (7.4 + rand() * 0.5) - 0.5, 0.6 + rand() * 0.6, 0.1 + rand() * 0.1, 0.3 + rand() * 0.2, 0xc7cacf, rand() * 3);
    // guard rails: posts and a corrugated beam
    for (const s of [-1, 1]) {
      const z = -0.5 + s * (DECK_Z - 0.25);
      for (let x = RAMP.x1; x < DECK_X1; x += 2) D.piece(0.1, 0.8, 0.1, 0x6f7276, x, 0.4, z);
      D.piece(len, 0.3, 0.06, 0xa9adb2, cx, 0.62, z);
      D.block(cx, z, len / 2, 0.3);
    }
    // the median: a low concrete wall with gaps to cross
    for (let x = RAMP.x1 + 4; x < DECK_X1 - 6; x += 22) {
      const m = put(D.root, box(14, 0.8, 0.5, 0x9a978f, { r: 0.04 }), x + 7, 0.4, -0.5);
      D.solid(m);
      D.block(x + 7, -0.5, 7, 0.25);
    }
    // piers down to the fields
    for (let x = RAMP.x1 + 6; x < DECK_X1; x += 16) {
      for (const z of [-5.5, 4.5]) {
        const pier = put(B.root, box(1.3, DECK - 0.9, 1.3, 0x8a8780, { r: 0.04 }), x, (DECK - 0.9) / 2, z);
        pier.castShadow = true;
      }
      put(B.root, box(1.5, 0.8, DECK_Z * 2 - 1, 0x7d7a73, { r: 0.04 }), x, DECK - 1.3, -0.5);
    }
  }
  // gantry signs over the highway, and one by the ramp
  function gantry(BB, x, boards) {
    const y0 = BB === D ? 0 : heightAt(x, 0);
    for (const z of [-DECK_Z + 0.2, DECK_Z - 1.2]) {
      const post = put(BB.root, box(0.3, 6, 0.3, 0x6f7276, { r: 0.03 }), x, y0 + 3, z);
      post.castShadow = true;
      BB.block(x, z, 0.3, 0.3);
    }
    put(BB.root, box(0.4, 0.5, DECK_Z * 2 - 1, 0x5a5d61, { r: 0.03 }), x, y0 + 6.1, -0.5);
    for (const [z, lines, w] of boards) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.8), new THREE.MeshToonMaterial({ map: roadSign(lines, w, 1.8), gradientMap }));
      m.rotation.y = -Math.PI / 2; // faces back down the road, at the tank
      m.position.set(x - 0.25, y0 + 5.2, z);
      BB.add(m);
      const back = put(BB.root, box(0.08, 1.85, w + 0.05, 0x3a3c3f, { r: 0.01 }), x - 0.18, y0 + 5.2, z);
      back.castShadow = true;
    }
  }
  gantry(B, 114, [[-4.2, [['M-2 HIGHWAY'], ['AIRPORT', '6 km']], 5], [3.2, [['CITY CENTRE'], ['RING ROAD', '↩']], 5]]);
  gantry(D, 196, [[-4.2, [['AIRPORT', '4 km'], ['CARGO TERMINAL']], 5], [3.2, [['EXIT 12'], ['WORKS ROAD', '1 km']], 5]]);
  gantry(D, 268, [[-1.5, [['AIRPORT', '2 km →'], ['ALL TRAFFIC']], 7]]);
  // out in the fields: a power line marching along, bare trees, the
  // airport's control tower and hangars off in the haze
  {
    for (let x = RAMP.x0 - 20; x < MAP.x1; x += 24) {
      for (const z of [-26, 30]) {
        put(B.root, box(0.3, 9, 0.3, 0x6f6a62, { r: 0.03 }), x, 4.5, z);
        put(B.root, box(0.2, 0.2, 3.4, 0x5a5650, { r: 0.02 }), x, 8.6, z);
        if (x + 24 < MAP.x1) for (const dz of [-1.5, 0, 1.5]) B.sagging(new THREE.Vector3(x, 8.6, z + dz), new THREE.Vector3(x + 24, 8.6, z + dz), 0.8);
      }
    }
    for (let i = 0; i < 60; i++) {
      const x = RAMP.x0 - 30 + rand() * (MAP.x1 - RAMP.x0 + 20);
      const z = (rand() < 0.5 ? -1 : 1) * (14 + rand() * 30);
      const h = 2.5 + rand() * 3;
      put(B.root, cyl(0.12, h, 0x4a3f34, { seg: 5 }), x, h / 2, z);
      for (let k = 0; k < 4; k++) {
        const br = put(B.root, cyl(0.04, 1 + rand(), 0x4a3f34, { seg: 4 }), x, h * (0.55 + k * 0.12), z);
        br.rotation.set(rand() - 0.5, rand() * 3, 0.6 + rand() * 0.5);
      }
    }
    // the airport, far off to the north east
    const AX = 290;
    const AZ = -54;
    put(B.root, box(2.4, 14, 2.4, 0xb8b4a6, { r: 0.05 }), AX, 7, AZ);
    put(B.root, box(4.4, 2.2, 4.4, 0x5c7488, { r: 0.08 }), AX, 15, AZ);
    put(B.root, box(4.8, 0.3, 4.8, 0x8a8678, { r: 0.02 }), AX, 16.3, AZ);
    for (const [x, w] of [[230, 26], [258, 18], [318, 24]]) {
      put(B.root, box(w, 8, 16, 0x9aa0a6, { r: 0.1 }), x, 4, AZ - 4);
      put(B.root, box(w * 0.8, 6, 0.1, 0x6d7278, { r: 0 }), x, 3, AZ + 4.05);
    }
  }

  // ----------------------------------------------------- on the deck
  // cover: wrecks, a jack-knifed truck, barriers
  wreck(D, 182, 3.5, 0.3, { kind: 'sedan', paint: BURNT_PAINT[2], snow: false });
  wreck(D, 205, -5, -0.5, { kind: 'van', paint: 0x6b7458, snow: false });
  wreck(D, 248, 4, 0.6, { kind: 'hatch', paint: BURNT_PAINT[1], snow: false });
  wreck(D, 262, -4.5, -0.2, { kind: 'sedan', paint: BURNT_PAINT[3], snow: false });
  wreck(D, 284, 2.5, 0.9, { kind: 'van', paint: 0x7b7f78, snow: false });
  {
    // a lorry jack-knifed across the westbound lanes: cab and container
    const cab = put(D.root, box(2.4, 2.2, 2.3, 0x4f6b6a, { r: 0.08 }), 214, 1.3, -4.6);
    cab.rotation.y = 0.9;
    D.solid(cab);
    D.block(214, -4.6, 1.3, 1.2, 0.9);
    const trailer = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 2.45), new THREE.MeshToonMaterial({ map: ribs, color: CONTAINERS[3], gradientMap }));
    trailer.position.set(218.5, 1.6, -3.2);
    trailer.rotation.y = -0.25;
    trailer.castShadow = true;
    D.add(trailer);
    D.solid(trailer);
    D.block(218.5, -3.2, 4, 1.25, -0.25);
  }
  for (const [x, z, yaw] of [[190, -2, 1.5], [242, -6, 1.6], [255, 1.5, 1.5], [276, -2.5, 1.55], [290, 5, 1.45]]) jersey(D, x, z, yaw, 1.2, 2.2);

  // the roadblock: concrete blocks and a barrier line right across both
  // carriageways, sandbagged. It won't break while its defenders hold.
  const roadblock = [];
  for (const [z0, z1] of [[-DECK_Z + 0.4, -4], [-4, 0.5], [0.5, DECK_Z - 1.4]]) {
    const zc = (z0 + z1) / 2;
    const len = z1 - z0;
    D.crushable(
      () => {
        for (let z = z0 + 0.6; z < z1 - 0.3; z += 1.7) {
          const j = put(D.root, box(0.8, 1.2, 1.5, 0x9a978f, { r: 0.05 }), BLOCK_X, 0.6, z);
          j.rotation.y = (rand() - 0.5) * 0.2;
        }
        for (let z = z0 + 0.3; z < z1; z += 0.55) put(D.root, box(0.5, 0.25, 0.34, 0x8a7b5c, { r: 0.08 }), BLOCK_X - 0.75, 0.13 + (rand() < 0.5 ? 0.25 : 0), z);
        put(D.root, box(0.12, 0.3, len - 0.4, 0xe8b030, { r: 0.01 }), BLOCK_X - 0.45, 1.3, zc); // a hazard rail along the top
        D.hitBox(BLOCK_X, 0.8, zc, 1.2, 1.6, len);
        D.block(BLOCK_X, zc, 0.7, len / 2);
      },
      { kind: 'prop', heavy: true, breakable: true, armored: true, scrap: 2 },
    );
    roadblock.push(D.crushables[D.crushables.length - 1]);
  }

  // the checkpoints: one at the street's end, one up on the deck
  const shackA = buildShack(B, { x0: SHACK_A.x0, x1: SHACK_A.x1, z0: CURB.n + 0.1, z1: CURB.s - 0.1, fill: { n: WALK.n - 0.5, s: WALK.s + 1.2 }, heightAt });
  const shackB = buildShack(D, { x0: SHACK_B.x0, x1: SHACK_B.x1, z0: -DECK_Z + 0.5, z1: DECK_Z - 1.5, fill: { n: -DECK_Z + 0.5, s: DECK_Z - 1.5 }, heightAt: () => 0 });

  B.finish();
  B.mergeStatic();
  D.finish();
  D.mergeStatic();

  const room = buildDepotRoom(scene);
  const blocks = [...B.blocks, ...D.blocks, ...room.blocks];
  const colliders = [...B.colliders, ...D.colliders, ...room.colliders];
  const emitters = [...B.emitters, ...D.emitters, ...room.emitters];
  const crushables = [...B.crushables, ...D.crushables];
  // (the depot doors and the depot room drop and add their blocks in the shared list)
  room.bindBlocks(blocks);
  for (const k of [shackA, shackB]) k.bindBlocks?.(blocks);

  // ---------------------------------------------------- the level script
  const SECTORS = ['The outskirts', 'The ramp', 'The highway'];
  const B1 = { minX: START_X + 2, maxX: shackA.x0 - 0.8, minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 };
  const B2 = { minX: shackA.x1 + 1.2, maxX: shackB.x0 - 0.8, minZ: -DECK_Z + 0.2, maxZ: DECK_Z - 1.2 };
  const B3 = { minX: shackB.x1 + 1.2, maxX: END_X + 4, minZ: -DECK_Z + 0.2, maxZ: DECK_Z - 1.2 };
  const S = { sector: 0, step: 0, t: 0 };
  const bounds = { ...B1 };
  const setBounds = (api, b) => api.setBounds(Object.assign(bounds, b));
  const go = (step) => {
    S.step = step;
    S.t = 0;
  };
  const near = (api, shack) => Math.hypot(api.tankPos.x - shack.door.x, api.tankPos.z - shack.door.z);
  const atDoor = (api, shack) => shack.inDoor > 0.6 && near(api, shack) < 5;
  const contact = (api, text, seconds = 3) => !api.cleared && api.prompt('Contact', text, { danger: true, seconds });
  function openShack(api, shack, text = null) {
    shack.openIn();
    api.objective('Enter the checkpoint');
    if (text) api.prompt('Zone clear', text, { go: true });
    api.arrow(shack.door.clone().setY(shack.door.y + (shack === shackB ? DECK : 0)), 'Checkpoint');
  }
  const droneTip = (api) => {
    if (api.lesson('drone')) api.prompt('Attack drones', 'When a drone <b>stops and its pods glow</b>, rockets are coming: <b>keep moving</b>, or shoot it while it hangs there!', { danger: true, seconds: 8 });
    else contact(api, 'Drones!');
  };
  // the parts this level can turn up
  const PARTS3 = ['he', 'dozer', 'autoloader', 'era', 'afterburner', 'twinmg', 'optics'];
  const H = (x) => heightAt(x, 0);
  // machines coming in: up the ramp behind, along the deck ahead, over the
  // sides (drones)
  const deckDog = (api, x, z, delay = 0) => api.spawnDog(x, z, { delay });
  const sideDrone = (api, x, s, delay = 0) => api.spawnDrone(x, s * 22, { delay, via: [[x - 4, s * 4]] });

  function start(api) {
    Object.assign(S, { sector: 0, step: 0, t: 0 });
    setBounds(api, B1);
    api.enableGun();
    api.revealScraps(false);
    api.giveRockets();
    if (api.tank.ability) api.giveAbility();
    api.sectors(SECTORS, 0, 'Level 3');
    api.objective('Get onto the highway');
    api.prompt('Midday', 'Out through the works and onto the highway.', { seconds: 4 });
  }

  // 1: the outskirts
  function sector1(api) {
    const x = api.tankPos.x;
    if (S.step < 5 && x > shackA.x0 - 9) {
      openShack(api, shackA);
      go(5);
    }
    switch (S.step) {
      case 0:
        if (x > START_X + 12 || S.t > 4) {
          for (const [dx, z, d] of [[0, -4, 0], [2, 3, 0.4], [4, -1, 0.8]]) api.spawnDog(Math.max(x + 18, 10) + dx, z, { delay: d });
          contact(api, 'Enemies ahead!');
          go(1);
        }
        break;
      case 1:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          api.spawnWalker(56, -4);
          api.spawnDog(50, 4, { delay: 0.6 });
          api.spawnDog(52, -6, { delay: 1 });
          contact(api, 'Anti-tank walker!');
          go(2);
        }
        break;
      case 2:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          // the first drones, in over the warehouses
          sideDrone(api, Math.max(x + 14, 60), -1);
          sideDrone(api, Math.max(x + 18, 64), 1, 1.2);
          droneTip(api);
          go(3);
        }
        break;
      case 3:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          api.spawnDog(92, -4);
          api.spawnDog(94, 3, { delay: 0.4 });
          api.spawnWalker(97, 0, { delay: 0.8 });
          sideDrone(api, 90, 1, 1.5);
          go(4);
        }
        break;
      case 4:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          openShack(api, shackA, 'Area cleared.');
          go(5);
        }
        break;
      case 5:
        if (atDoor(api, shackA)) {
          go(6);
          if (api.enemiesAlive) api.clearEnemies();
          api.depot(shackA, { offers: PARTS3, count: 3, onLeave: () => startSector2(api) });
        }
        break;
    }
  }

  // 2: up the ramp and along the deck to the second checkpoint
  function startSector2(api) {
    S.sector = 1;
    go(0);
    setBounds(api, B2);
    api.sectors(SECTORS, 1, 'Level 3');
    api.objective('Up onto the highway');
  }
  function sector2(api) {
    const x = api.tankPos.x;
    if (S.step < 4 && x > shackB.x0 - 9) {
      openShack(api, shackB);
      go(4);
    }
    switch (S.step) {
      case 0:
        if (x > RAMP.x0 - 6 || S.t > 3) {
          // down the ramp at you, and drones over the fields
          for (const [dz, d] of [[-3, 0], [2, 0.5], [0, 1]]) deckDog(api, RAMP.x1 + 4, dz, d);
          sideDrone(api, RAMP.x0 + 14, -1, 0.8);
          contact(api, 'Coming down the ramp!');
          go(1);
        }
        break;
      case 1:
        if (api.enemiesAlive <= 1 && S.t > 3) {
          api.spawnWalker(198, -2);
          sideDrone(api, 186, 1);
          sideDrone(api, 190, -1, 0.8);
          deckDog(api, 206, 3, 1.2);
          go(2);
        }
        break;
      case 2:
        if (api.enemiesAlive <= 1 && S.t > 3) {
          deckDog(api, 222, -5);
          deckDog(api, 222, 4, 0.4);
          api.spawnWalker(222, 0, { delay: 0.8 });
          sideDrone(api, 212, -1, 1.2);
          sideDrone(api, 214, 1, 1.6);
          contact(api, 'More of them!');
          go(3);
        }
        break;
      case 3:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          openShack(api, shackB, 'Area cleared.');
          go(4);
        }
        break;
      case 4:
        if (atDoor(api, shackB)) {
          go(5);
          if (api.enemiesAlive) api.clearEnemies();
          api.depot(shackB, { offers: PARTS3, count: 2, onLeave: () => startSector3(api) });
        }
        break;
    }
  }

  // 3: along the highway to the roadblock
  function startSector3(api) {
    S.sector = 2;
    go(0);
    setBounds(api, B3);
    api.sectors(SECTORS, 2, 'Level 3');
    api.objective('Clear the roadblock');
  }
  function sector3(api) {
    const x = api.tankPos.x;
    switch (S.step) {
      case 0:
        if (S.t > 1.5) {
          deckDog(api, 262, -3);
          deckDog(api, 264, 3, 0.4);
          sideDrone(api, 256, 1, 0.8);
          go(1);
        }
        break;
      case 1:
        if (api.enemiesAlive <= 1 && S.t > 3) {
          // the roadblock's defenders: walkers behind it, drones over it
          api.spawnWalker(BLOCK_X + 5, -4);
          api.spawnWalker(BLOCK_X + 5, 3, { delay: 0.6 });
          sideDrone(api, BLOCK_X - 6, -1, 0.4);
          sideDrone(api, BLOCK_X - 4, 1, 1);
          deckDog(api, BLOCK_X - 4, 0, 1.4);
          api.prompt('Roadblock', 'A roadblock across the highway. <b>Take out its defenders</b>, then break through!', { danger: true, seconds: 6 });
          go(2);
        }
        break;
      case 2:
        if (api.enemiesAlive === 0 && S.t > 2) {
          for (const c of roadblock) c.armored = false;
          api.prompt('Roadblock', 'Defenders down. <b>Break through the roadblock!</b>', { go: true, seconds: 5 });
          api.arrow(new THREE.Vector3(BLOCK_X, DECK + 1.6, -0.5), 'Break it!');
          go(3);
        }
        break;
      case 3:
        if (roadblock.every((c) => c.done) || x > BLOCK_X + 1) {
          api.arrow(new THREE.Vector3(END_X + 2, DECK + 0.6, -0.5), 'Exit');
          setBounds(api, { maxX: MAP.x1 - 6 });
          go(4);
        }
        break;
      case 4:
        if (x > END_X) {
          api.arrow(null);
          api.sectors(SECTORS, 3, 'Level 3');
          api.win('Level clear', { path: [[END_X + 6, -2.5], [END_X + 18, -2.5]] });
          go(5);
        }
        break;
    }
    void H;
  }

  // Dev kit: beat the current stage
  function skipStage(api) {
    api.clearSpot();
    api.arrow(null);
    api.clearPrompt();
    api.clearEnemies();
    if (S.sector < 2) {
      const shack = S.sector === 0 ? shackA : shackB;
      api.teleport(shack.door.x - 7, shack.door.z, 0);
      openShack(api, shack);
      go(S.sector === 0 ? 5 : 4);
      return true;
    }
    if (S.step < 3) {
      for (const c of roadblock) c.armored = false;
      go(3);
      return true;
    }
    return false;
  }

  function script(api, dt) {
    S.t += dt;
    if (api.run.mode !== 'field') return;
    if (S.sector === 0) sector1(api);
    else if (S.sector === 1) sector2(api);
    else sector3(api);
  }

  function update(dt, t, ctx = {}) {
    B.update(dt, t, ctx);
    D.update(dt, t, ctx);
    for (const k of [shackA, shackB]) k.update(dt, t);
    room.update(dt, t, ctx);
    if (ctx.api) script(ctx.api, dt);
  }

  return {
    light,
    colliders,
    blocks,
    emitters,
    crushables,
    depotRoom: room,
    heightAt: (x, z) => (z > 150 ? 0 : heightAt(x, z)),
    spawn: { x: START_X + 5, z: -0.5, yaw: 0 },
    bounds,
    script: S, // for tests
    shacks: [shackA, shackB], // for tests
    start,
    update,
    skipStage,
    onRampOrDeck,
  };
}
