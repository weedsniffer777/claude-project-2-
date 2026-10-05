// Level 2: the river crossing, at dawn. Same ruined district as level 1,
// a little further on, under a pale rose sky.
//
// Layout (world +X runs bottom-left to top-right on screen):
//  1 The street: a short run between panel blocks, garages on the near
//    side. The first anti-tank walker. A checkpoint (a repair stop) across
//    its end.
//  2 The square: a wide open embankment square, trams and wrecks to fight
//    round, blocks set well back on the far side. Waves out of the side
//    streets, walkers holding the far end. A checkpoint (two parts) at the
//    bridgehead.
//  3 The bridge: a long road bridge over the half-frozen river, wrecks and
//    barriers across the deck for cover; at its far end the bridge gun, dug
//    in, sweeping the deck. Destroy it and drive across.
import * as THREE from 'three';
import { addDawn } from '../render/setup.js';
import { box, cyl, put, toon, gradientMap, setLowPoly } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import * as P from './props.js';
import { buildShack } from './depot.js';
import { buildDepotRoom } from './depotRoom.js';
import { rails } from './rails.js';
import { FH, glyphSign, sidewalkTexture, facadeTextures, endTexture, cutawayTexture, facadeMat, mapMat } from './cityTextures.js';

const GPX = 10; // ground texels per world unit
const MAP = { x0: -60, x1: 232, z0: -70, z1: 50 };
const START_X = -20;
const CURB = { n: -7.5, s: 6.5 };
const WALK = { n: -10, s: 9 };
const SW = 0.16; // sidewalk height
const SQUARE = { x0: 41.6, x1: 96, n: -22, s: 17 };
const SHACKS = [{ x0: 34, x1: 41.6 }, { x0: 104, x1: 111.6 }];
const RIVER = { x0: 116, x1: 182, y: -3.4 };
const BRIDGE = { n: -9.4, s: 8.4 };
const GUN_X = 172; // the bridge gun, dug in near the far end of the deck
const END_X = 196; // past it: the level's done

const COLD = 0xcfe8ff;
const SODIUM = [0xffa245, 0xff9636, 0xffb15a];
const PANELS = ['#9a978f', '#a5a095', '#91959a', '#aca393', '#8b8e92'];
const ACCENTS = ['#5f8784', '#a3874e', '#5c6f8c', '#8f8550', '#6f7f6a'];
const PAINT = [0x8a8172, 0x6d7a72, 0x5d6b80, 0x9b9277, 0x707a5c, 0xb3ad9c];
const CONCRETE = [0x8d8b86, 0x7d7c78, 0x9a978f, 0x6f6e6b, 0x85898c];
const BURNT_PAINT = [0x5d6b80, 0x8a8172, 0x6f7f6a, 0x9b9277, null, 0x7a6a5a];
const CONTAINERS = [0x7a4a36, 0x4f6b6a, 0x6b6f72, 0x8a6a3a, 0x3f5470];

const inSquare = (x) => x > SQUARE.x0 && x < SQUARE.x1;
const inRiver = (x) => x > RIVER.x0 - 0.5 && x < RIVER.x1 + 0.5;
const overWater = (x, z) => inRiver(x) && (z < BRIDGE.n || z > BRIDGE.s);
// the street's sidewalks; the square is flat out to its edges; the bridge
// deck is all road
function heightAt(x, z) {
  if (inRiver(x)) return 0;
  if (inSquare(x)) return z <= SQUARE.n || z >= SQUARE.s ? SW : 0;
  return z <= CURB.n || z >= CURB.s ? SW : 0;
}

// The ground: snow everywhere, asphalt down the street, over the square and
// the bridge deck; slush, ruts, faded paint, craters.
function roadTexture(rand, craters) {
  const W = (MAP.x1 - MAP.x0) * GPX;
  const H = (MAP.z1 - MAP.z0) * GPX;
  const [c, g] = canvas(W, H);
  const X = (x) => (x - MAP.x0) * GPX;
  const Z = (z) => (z - MAP.z0) * GPX;
  const rect = (x0, z0, x1, z1, color) => {
    g.fillStyle = color;
    g.fillRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
  };
  rect(MAP.x0, MAP.z0, MAP.x1, MAP.z1, '#c6c8ce');
  const asphalt = [
    [MAP.x0, CURB.n, SQUARE.x0, CURB.s],
    [SQUARE.x0, SQUARE.n, SQUARE.x1, SQUARE.s],
    [SQUARE.x1, CURB.n, RIVER.x0, CURB.s],
    [RIVER.x0, BRIDGE.n, RIVER.x1, BRIDGE.s],
    [RIVER.x1, CURB.n, MAP.x1, CURB.s],
  ];
  for (const [x0, z0, x1, z1] of asphalt) {
    rect(x0, z0, x1, z1, '#5e5f64');
    speckle(g, X(x1) - X(x0), Z(z1) - Z(z0), ['#68696e', '#54555a', '#6e6e72'], (X(x1) - X(x0)) * (Z(z1) - Z(z0)) * 0.05, rand, Z(z0), X(x0));
  }
  // slush: pale near the edges, grey-brown in the middle
  for (const [x0, z0, x1, z1] of asphalt) {
    const n = ((x1 - x0) * (z1 - z0)) / 2;
    for (let i = 0; i < n; i++) {
      const x = x0 + rand() * (x1 - x0);
      const z = z0 + 0.3 + rand() * (z1 - z0 - 0.6);
      const nearEdge = Math.min(z - z0, z1 - z) < 1.3;
      g.fillStyle = nearEdge ? (rand() < 0.5 ? '#a9a8a6' : '#9a9996') : rand() < 0.5 ? '#88867f' : '#78766f';
      blob(g, X(x), Z(z), (0.5 + rand() * 1.3) * GPX, (0.35 + rand() * 0.6) * GPX, rand, 9);
    }
  }
  // centre line and lane dashes down the street and over the bridge
  g.fillStyle = '#aaa79e';
  for (const z of [-0.6, -0.3, -4, 3]) {
    const center = z > -1;
    for (let x = MAP.x0; x < MAP.x1; x += center ? 1 : 4) {
      if (rand() < 0.45 || inSquare(x)) continue;
      g.fillRect(X(x), Z(z), (center ? 1 : 2) * GPX, 2);
    }
  }
  // the square: the faded grid of an old market's stall lines
  g.fillStyle = '#9c9a92';
  for (let x = SQUARE.x0 + 4; x < SQUARE.x1 - 2; x += 5) {
    for (let z = SQUARE.n + 3; z < SQUARE.s - 2; z += 0.5) if (rand() > 0.35) g.fillRect(X(x), Z(z), 2, 0.5 * GPX);
  }
  for (const { x, z, r } of craters) {
    g.fillStyle = '#3b3836';
    blob(g, X(x), Z(z), r * 1.8 * GPX, r * 1.5 * GPX, rand, 13);
    g.fillStyle = '#6f6c66';
    blob(g, X(x), Z(z), r * 1.15 * GPX, r * GPX, rand, 11);
    g.fillStyle = '#242427';
    blob(g, X(x), Z(z), r * 0.85 * GPX, r * 0.7 * GPX, rand, 11);
  }
  for (let i = 0; i < 1200; i++) {
    g.fillStyle = ['#bdb7a6', '#8d7c62', '#3d3f44', '#6c7a74'][(rand() * 4) | 0];
    g.fillRect(X(MAP.x0 + rand() * (MAP.x1 - MAP.x0)), Z(SQUARE.n + rand() * (SQUARE.s - SQUARE.n)), 2, 1);
  }
  return tex(c);
}

// ------------------------------------------------------------- the level
export const river = {
  id: 'river',
  name: 'Level 2 · River crossing',
  build(scene) {
    setLowPoly(true);
    try {
      return buildRiver(scene);
    } finally {
      setLowPoly(false);
    }
  },
};

function buildRiver(scene) {
  const B = new LevelBuilder(scene, 7719);
  const rand = B.rand;
  const light = addDawn(scene, { shadowSize: 22, shadowMap: 2048 });
  const sign = (w, h, o = {}) => mapMat(glyphSign(w, h, { rand, ...o }));

  // ------------------------------------------------- ground and sidewalks
  const craters = [];
  while (craters.length < 14) {
    const x = START_X + 4 + rand() * 190;
    const z = inSquare(x) ? SQUARE.n + 3 + rand() * (SQUARE.s - SQUARE.n - 6) : CURB.n + 2 + rand() * (CURB.s - CURB.n - 4);
    if (!inRiver(x)) craters.push({ x, z, r: 0.6 + rand() * 0.7 });
  }
  const groundMat = mapMat(roadTexture(rand, craters));
  function groundPiece(x0, x1, z0, z1, y = 0) {
    const geo = new THREE.PlaneGeometry(x1 - x0, z1 - z0);
    const uv = geo.attributes.uv;
    const p = geo.attributes.position;
    for (let i = 0; i < uv.count; i++) {
      const x = p.getX(i) + (x0 + x1) / 2;
      const z = -p.getY(i) + (z0 + z1) / 2;
      uv.setXY(i, (x - MAP.x0) / (MAP.x1 - MAP.x0), 1 - (z - MAP.z0) / (MAP.z1 - MAP.z0));
    }
    const m = new THREE.Mesh(geo, groundMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2);
    m.receiveShadow = true;
    B.add(m);
    B.solid(m);
  }
  groundPiece(MAP.x0, RIVER.x0, MAP.z0, MAP.z1);
  groundPiece(RIVER.x1, MAP.x1, MAP.z0, MAP.z1);
  groundPiece(RIVER.x0, RIVER.x1, BRIDGE.n, BRIDGE.s); // the bridge deck

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
  // the street's sidewalks, the square's edges, the street on past the river
  slab(MAP.x0, SQUARE.x0, -18, CURB.n);
  slab(MAP.x0, SQUARE.x0, CURB.s, MAP.z1);
  slab(SQUARE.x0, SQUARE.x1, -30, SQUARE.n);
  slab(SQUARE.x0, SQUARE.x1, SQUARE.s, MAP.z1);
  slab(SQUARE.x1, RIVER.x0, -30, CURB.n);
  slab(SQUARE.x1, RIVER.x0, CURB.s, MAP.z1);
  slab(RIVER.x1, MAP.x1, -30, CURB.n);
  slab(RIVER.x1, MAP.x1, CURB.s, MAP.z1);

  // snow banks plowed up along the curbs and the square's edges
  const bank = (x0, x1, z, dir) => {
    for (let x = x0; x < x1; x += 0.55) {
      if (rand() < 0.12) x += 2;
      B.lump(x, SW, z + dir * rand() * 0.25, 0.5 + rand() * 0.4, 0.2 + rand() * 0.18, 0.35 + rand() * 0.2, rand() < 0.3 ? 0xa9aaac : 0xc7cacf, rand() * 3);
    }
  };
  bank(START_X - 10, SQUARE.x0, CURB.n - 0.35, -1);
  bank(START_X - 10, SQUARE.x0, CURB.s + 0.35, 1);
  bank(SQUARE.x0, SQUARE.x1, SQUARE.n - 0.35, -1);
  bank(SQUARE.x0, SQUARE.x1, SQUARE.s + 0.35, 1);
  bank(SQUARE.x1, RIVER.x0 - 1, CURB.n - 0.35, -1);
  bank(SQUARE.x1, RIVER.x0 - 1, CURB.s + 0.35, 1);
  bank(RIVER.x1 + 1, MAP.x1, CURB.n - 0.35, -1);
  bank(RIVER.x1 + 1, MAP.x1, CURB.s + 0.35, 1);
  // broken asphalt round the craters, chunks and bricks scattered about
  for (const { x, z, r } of craters) {
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + rand() * 0.4;
      const d = r * (0.95 + rand() * 0.3);
      B.piece(0.35 + rand() * 0.35, 0.1, 0.3 + rand() * 0.25, rand() < 0.6 ? 0x4c4d52 : 0x5e5c58, x + Math.cos(a) * d, 0.06, z + Math.sin(a) * d * 0.85, Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
    }
  }
  for (let i = 0; i < 520; i++) {
    const x = START_X - 6 + rand() * 210;
    const z = inSquare(x) ? SQUARE.n + rand() * (SQUARE.s - SQUARE.n) : WALK.n + rand() * (WALK.s - WALK.n + 4);
    if (overWater(x, z)) continue;
    const s = 0.08 + rand() * 0.22;
    B.piece(s * (1 + rand()), s * 0.6, s, rand() < 0.25 ? 0x7a5e50 : CONCRETE[(rand() * 5) | 0], x, heightAt(x, z) + s * 0.25, z, rand(), rand() * 3, rand());
  }

  function rubble(x, z, radius, height, { solid = false, slabs = 2, y = heightAt(x, z) } = {}) {
    const n = Math.round(radius * radius * 6) + 8;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius;
      const k = 1 - r / radius;
      const s = 0.25 + rand() * 0.6;
      B.piece(s * (1 + rand()), s * 0.7, s, CONCRETE[(rand() * 5) | 0], x + Math.cos(a) * r, y + k * height * (0.4 + rand() * 0.6), z + Math.sin(a) * r * 0.8, rand() * 3, rand() * 3, rand() * 3);
    }
    for (let i = 0; i < slabs; i++) {
      const m = B.chunk(1.4 + rand() * 1.4, 0.16, 1 + rand() * 0.8, CONCRETE[(rand() * 5) | 0], x + (rand() - 0.5) * radius, y + height * 0.5, z + (rand() - 0.5) * radius * 0.6, (rand() - 0.5) * 1.2, rand() * 3, (rand() - 0.5) * 1.4);
      if (solid) B.solid(m);
    }
    for (let i = 0; i < 3; i++) B.lump(x + (rand() - 0.5) * radius, y + height * 0.7, z + (rand() - 0.5) * radius * 0.5, radius * 0.3, 0.12, radius * 0.25, 0xc9ccd1, rand() * 3);
    if (rand() < 0.6) B.rebar(x, y + height * 0.5, z, 2 + ((rand() * 3) | 0));
    if (solid) {
      B.hitBox(x, y + height * 0.4, z, radius * 1.4, height * 0.8, radius * 1.1);
      B.block(x, z, radius * 0.8, radius * 0.65);
    }
  }

  // ---------------------------------------------------------- buildings
  // A panel block with its facade to the street (zf), going back depth.
  function building(o) {
    const { x0, x1, zf = WALK.n, depth = 13, floors } = o;
    const w = x1 - x0;
    const H = floors * FH + 0.5;
    const cols = Math.max(2, Math.round(w / 1.7));
    const cw = w / cols;
    const look = { panel: o.panel, accent: o.accent, broken: o.broken ?? 0.25, holes: o.holes ?? 2, shop: o.shop };
    const front = facadeMat(facadeTextures(w, floors, look, rand));
    const end = mapMat(endTexture(depth, floors, look, rand, !!o.mural));
    let west = o.cutaway ? mapMat(cutawayTexture(depth, floors, rand)) : end;
    let east = end;
    if (o.sideFacade === 'east') east = facadeMat(facadeTextures(depth, floors, look, rand));
    if (o.sideFacade === 'west') west = facadeMat(facadeTextures(depth, floors, look, rand));
    const roof = toon(0xc6c9ce);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, depth), [east, west, roof, roof, front, end]);
    m.position.set((x0 + x1) / 2, H / 2, zf - depth / 2);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    B.block((x0 + x1) / 2, zf - depth / 2, w / 2, depth / 2);
    // balconies, ledges and the clutter of a lived-in facade
    for (let k = 0; k < cols; k++) {
      if (k % 3 !== 1 || rand() < 0.3) continue;
      const bx = x0 + (k + 0.5) * cw;
      for (let f = 1; f < floors; f++) {
        if (rand() < 0.12) continue;
        const y = f * FH + 0.28;
        B.piece(cw * 0.8, 0.55, 0.45, rand() < 0.4 ? 0xb9b4a6 : PAINT[(rand() * PAINT.length) | 0], bx, y, zf + 0.22, 0, 0, rand() < 0.05 ? 0.4 : 0);
        B.piece(cw * 0.86, 0.07, 0.55, 0x7b7a76, bx, y - 0.3, zf + 0.26);
        if (rand() < 0.5) B.piece(cw * 0.7, 0.05, 0.4, 0xd5d8dc, bx, y + 0.3, zf + 0.22);
      }
    }
    if (o.shop) for (let k = 0; k < cols; k++) if (rand() > 0.3) B.piece(cw * 0.9, 0.05, 0.9, [0x5c6f8c, 0x6f7f6a, 0x8f8550][k % 3], x0 + (k + 0.5) * cw, 1.45 - rand() * 0.3, zf + 0.42, -0.35 - rand() * 0.5, 0, (rand() - 0.5) * 0.3);
    P.facadeClutter(B, x0, x1, zf, H);
    for (let i = 0; i < 3; i++) B.piece(0.6 + rand(), 0.5 + rand() * 0.6, 0.6 + rand(), 0x7b7a76, x0 + 1 + rand() * (w - 2), H + 0.3, zf - 2 - rand() * (depth - 4));
    B.lump((x0 + x1) / 2, H + 0.05, zf - depth / 2, w / 2.4, 0.12, depth / 2.8, 0xd0d3d8);
    if (o.sign) {
      const sw = Math.min(w * 0.6, 8);
      const s = new THREE.Mesh(new THREE.PlaneGeometry(sw, 0.55), sign(sw, 0.55, { ink: o.sign }));
      s.position.set(x0 + w * 0.35, 1.08, zf + 0.06);
      B.add(s);
    }
  }
  // low blocks on the near (south) side, shopfronts facing the street
  function southBlock(x0, x1, floors, side, zf = WALK.s + 0.3) {
    const depth = 13;
    const w = x1 - x0;
    const H = floors * FH + 0.5;
    const look = { panel: PANELS[(rand() * 5) | 0], accent: ACCENTS[(rand() * 5) | 0], broken: 0.35, holes: 1, shop: true };
    const front = facadeMat(facadeTextures(w, floors, look, rand));
    const end = mapMat(endTexture(depth, floors, look, rand, false));
    const sideMat = facadeMat(facadeTextures(depth, floors, { ...look, shop: false }, rand));
    const roof = toon(0xc6c9ce);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, depth), [side === 'east' ? sideMat : end, side === 'west' ? sideMat : end, roof, roof, end, front]);
    m.position.set((x0 + x1) / 2, H / 2, zf + depth / 2);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    B.block((x0 + x1) / 2, zf + depth / 2, w / 2, depth / 2);
    for (let x = x0 + 1.2; x < x1 - 1; x += 2.6) if (rand() < 0.7) B.piece(1.8, 0.06, 0.9, [0x5c6f8c, 0x6f7f6a, 0x8f8550][(rand() * 3) | 0], x, 1.45, zf - 0.42, 0.4, 0, 0);
    B.piece(w, 0.3, 0.2, 0x8d8b86, (x0 + x1) / 2, H + 0.15, zf + 0.1);
    B.lump((x0 + x1) / 2, H + 0.05, zf + depth / 2, w / 2.2, 0.12, depth / 2.6, 0xd0d3d8);
  }
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
    t.repeat.set(5, 1);
    return t;
  })();
  function container(x, y, z, yaw, color, tilt = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.45), new THREE.MeshToonMaterial({ map: ribs, color, gradientMap }));
    m.position.set(x, y + 1.3, z);
    m.rotation.set(0, yaw, tilt);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    B.lump(x, y + 2.62, z, 2.4, 0.1, 1.0, 0xd0d3d8, yaw);
    return m;
  }
  function jersey(x, z, yaw = 0, h = 0.9, w = 1.6) {
    const j = put(B.root, box(w, h, 0.7, 0x9a978f, { r: 0.06 }), x, heightAt(x, z) + h / 2, z);
    j.rotation.y = yaw;
    B.solid(j);
    B.block(x, z, w / 2, 0.35, yaw);
    return j;
  }
  // a tall concrete block, broadside to the far end of the bridge: real
  // cover from the bridge gun's beam (it fires at hull height)
  function blockCover(x, z, yaw = Math.PI / 2) {
    const j = jersey(x, z, yaw, 1.35, 2.3);
    put(B.root, box(2.1, 0.08, 0.5, 0x86837c, { r: 0.02 }), x, 1.39, z).rotation.y = yaw; // its worn top
    B.lump(x, 1.42, z, 0.6, 0.06, 0.25, 0xd0d3d8, yaw);
    return j;
  }

  // 1: the street. North side blocks, a gap walled up with containers.
  building({ x0: -48, x1: -8, floors: 9, panel: PANELS[1], accent: ACCENTS[3], holes: 3 });
  building({ x0: -8, x1: 10, floors: 5, panel: PANELS[3], shop: true, sign: '#c9d4cf', holes: 1 });
  building({ x0: 14, x1: SHACKS[0].x0 + 4, floors: 8, panel: PANELS[0], accent: ACCENTS[2], holes: 3, mural: true });
  for (let k = 0; k < 2; k++) container(12, k * 2.6, WALK.n - 1.3, 0, CONTAINERS[(k + 3) % 5]);
  B.block(12, WALK.n - 1.3, 2.2, 1.3);
  // the start: the street's blocked behind the tank by a collapsed
  // building, a mountain of rubble right across it: broken slabs, a wall
  // section still standing in it, rebar, snow
  {
    const X = START_X - 2.4;
    for (let z = -14; z < 16; z += 2.6) rubble(X - 1 + (rand() - 0.5) * 1.5, z + (rand() - 0.5), 2.6 + rand() * 1.2, 2.6 + rand() * 1.8, { slabs: 3 });
    for (let z = -12; z < 14; z += 4) rubble(X - 3.5, z + rand() * 2, 3 + rand(), 3.6 + rand() * 1.5, { slabs: 4 });
    // a piece of the facade, fallen across the top, and one standing
    const lean = put(B.root, box(7, 0.35, 3.4, 0x9a978f, { r: 0.03 }), X - 2.2, 3.1, -3);
    lean.rotation.set(0.25, 1.3, 0.5);
    const wall = put(B.root, box(0.4, 5.5, 6, 0xa5a095, { r: 0.03 }), X - 4.5, 2.75, 6);
    wall.rotation.z = -0.12;
    for (let y = 1.2; y < 5; y += 1.6) put(B.root, box(0.42, 0.7, 1.2, 0x2a2b2e), X - 4.5, y, 5 + (y % 2));
    B.block(X - 1, 0.5, 2.2, 22);
    for (let k = 0; k < 7; k++) rubble(START_X - 8 - rand() * 30, -8 + rand() * 22, 2 + rand() * 2.5, 1.5 + rand() * 2.5, { slabs: 4 });
  }
  // the near side: garages, then a low block up to the checkpoint
  {
    const doors = [0x6b5a48, 0x56606a, 0x5f6b5a, 0x6e6152, 0x4d5560];
    for (let i = 0; i < 12; i++) {
      const x = START_X - 2 + i * 3.1;
      if (rand() < 0.15) {
        rubble(x, WALK.s + 6, 1.4, 1.0);
        continue;
      }
      const h = 2.1 + (rand() - 0.5) * 0.2;
      put(B.root, box(3.0, h, 5, 0x7f7d79, { r: 0.04 }), x, SW + h / 2, WALK.s + 6.5);
      put(B.root, box(2.3, 1.7, 0.06, doors[(rand() * 5) | 0], { r: 0.01 }), x, SW + 0.9, WALK.s + 3.99);
      put(B.root, box(3.1, 0.12, 5.2, 0x45474a, { r: 0.02 }), x, SW + h + 0.06, WALK.s + 6.5);
      B.lump(x, SW + h + 0.12, WALK.s + 6.5, 1.4, 0.12, 2.4, 0xd0d3d8, 0);
    }
    southBlock(17, SHACKS[0].x0 + 4, 2, 'west', WALK.s + 2);
    P.fence(B, START_X, 15, SW, WALK.s + 1.6);
  }
  // the street's edges: straight invisible rails so the tank slides along
  for (const [x0, x1] of [[START_X, SHACKS[0].x0], [SQUARE.x1, RIVER.x0], [RIVER.x1, MAP.x1]]) {
    B.block((x0 + x1) / 2, WALK.n + 0.55, (x1 - x0) / 2, 0.3);
    B.block((x0 + x1) / 2, WALK.s - 0.25, (x1 - x0) / 2, 0.3);
  }

  // 2: the square. Blocks set well back on the far side, a side street
  // into it from the north, low ruins along the near side.
  building({ x0: SQUARE.x0 - 2, x1: 64, zf: SQUARE.n - 2, floors: 9, panel: PANELS[2], accent: ACCENTS[0], holes: 3, sideFacade: 'east' });
  building({ x0: 71, x1: SQUARE.x1 + 8, zf: SQUARE.n - 2, floors: 10, panel: PANELS[4], accent: ACCENTS[4], holes: 4, sideFacade: 'west' });
  // the north side street: rubble most of the way up, a lane open for them
  rubble(65, -30, 1.6, 1.3, { solid: true });
  rubble(70, -34, 1.8, 1.4, { solid: true });
  for (let k = 0; k < 2; k++) container(67.5, k * 2.6, -40, 0, CONTAINERS[(k + 1) % 5]);
  B.block(67.5, -40, 3.2, 1.3);
  // the near side: a low ruined arcade, kiosks, a billboard frame
  {
    let x = SQUARE.x0 + 1;
    while (x < SQUARE.x1 - 2) {
      const w = 0.6 + rand() * 0.7;
      const h = 1.0 + rand() * 2.2;
      if (rand() < 0.8) put(B.root, box(w, h, 0.4, CONCRETE[(rand() * 5) | 0], { r: 0.02 }), x + w / 2, SW + h / 2, SQUARE.s + 1.4);
      if (rand() < 0.3) B.piece(1.6, 0.3, 0.42, CONCRETE[0], x + w, SW + Math.min(h, 2.2), SQUARE.s + 1.4, 0, 0, (rand() - 0.5) * 0.6);
      x += w + 0.4 + rand() * 0.9;
    }
    B.block((SQUARE.x0 + SQUARE.x1) / 2, SQUARE.s + 1.4, (SQUARE.x1 - SQUARE.x0) / 2, 0.3);
    for (const kx of [52, 83]) {
      put(B.root, box(2.2, 2.0, 1.6, 0x58707a, { r: 0.06 }), kx, SW + 1.0, SQUARE.s + 3.5);
      put(B.root, box(2.4, 0.08, 1.8, 0xd2d5da, { r: 0.02 }), kx, SW + 2.05, SQUARE.s + 3.5);
    }
    P.billboard(B, 68, SQUARE.s + 6, 0.1, (w, h) => sign(w, h, { board: '#5d5546', ink: '#9fb5b3' }));
    for (let i = 0; i < 6; i++) rubble(SQUARE.x0 + 6 + i * 9 + rand() * 3, SQUARE.s + 8 + rand() * 4, 1 + rand() * 1.2, 0.8 + rand(), { slabs: 2 });
  }
  // its edges: where the street opens into it, containers close the corners
  for (const [z0, z1] of [[SQUARE.n, WALK.n - 0.5], [WALK.s + 0.5, SQUARE.s]]) {
    for (let z = z0 + 1.3; z < z1; z += 2.5) container(SQUARE.x0 + 1.4, 0, z, Math.PI / 2, CONTAINERS[((z * 7) | 0) % 5 < 0 ? 0 : ((z * 7) | 0) % 5]);
    B.block(SQUARE.x0 + 1.4, (z0 + z1) / 2, 1.3, (z1 - z0) / 2);
  }
  // cover in the square: trams, wrecks, heaps, barriers, containers
  P.tram(B, 56, -12.5, 0.18, { tilt: 0.05, burn: 0.7 });
  P.tram(B, 80, 10.5, -0.12, { trailer: true, tilt: -0.04, burn: 0.85 });
  rubble(48.5, 11, 1.6, 1.3, { solid: true });
  rubble(73, -15.5, 2.0, 1.6, { solid: true, slabs: 3 });
  rubble(90.5, 2, 1.7, 1.4, { solid: true });
  container(66, 0, 3.5, 0.35, CONTAINERS[2]);
  B.block(66, 3.5, 3.1, 1.3, 0.35);
  container(88, 0, -13.5, -0.25, CONTAINERS[4]);
  container(88.3, 2.6, -13.2, -0.2, CONTAINERS[0]);
  B.block(88, -13.5, 3.1, 1.3, -0.25);
  for (const [x, z, yaw] of [[60, -3, 0.1], [61.7, -2.6, 0.2], [75, 4, -0.3], [76.5, 4.6, -0.4], [84, -4, 1.5], [52, 4, 1.2]]) jersey(x, z, yaw);
  const wreck = (x, z, yaw, o) => B.crushable(() => P.car(B, x, z, yaw, o), { kind: 'car', scrap: 2 });
  wreck(-6, -0.4, 0.35, { kind: 'sedan', paint: BURNT_PAINT[0] });
  wreck(6, 4.4, 0.25, { kind: 'hatch', paint: BURNT_PAINT[1], flipped: true });
  wreck(22, -5, -0.4, { kind: 'van', paint: 0x6b7458 });
  wreck(28, 3.6, 0.5, { kind: 'sedan', paint: BURNT_PAINT[2] });
  wreck(47, -8, 0.8, { kind: 'sedan', paint: BURNT_PAINT[3] });
  wreck(58, 8, -0.3, { kind: 'hatch', paint: BURNT_PAINT[5] });
  wreck(70, -6, 1.2, { kind: 'sedan', paint: BURNT_PAINT[1], flipped: true });
  wreck(84, 13, 0.2, { kind: 'van', paint: 0x7b7f78 });
  wreck(93, -9, -0.6, { kind: 'hatch', paint: BURNT_PAINT[2] });
  wreck(100, 4.6, 0.3, { kind: 'sedan', paint: BURNT_PAINT[0] });
  const junk = (fn, scrap = 0) => B.crushable(fn, { kind: 'prop', scrap });
  junk(() => P.crates(B, 63, 0, 9), 2);
  junk(() => P.tires(B, 51, 0, -16, 5));
  junk(() => P.crates(B, 85, 0, -1), 2);
  junk(() => P.bench(B, -2, SW, WALK.n + 1.2, 0));
  junk(() => P.bin(B, 4, SW, WALK.n + 1.3, { tipped: true }), 1);
  junk(() => P.crates(B, 25, SW, WALK.n + 1.2), 2);
  junk(() => P.tires(B, 18, SW, CURB.s + 1.0, 4));
  // barrel fires: someone's been here in the night
  function barrelFire(x, z) {
    const y = heightAt(x, z);
    put(B.root, cyl(0.3, 0.8, 0x5a4636, { seg: 10 }), x, y + 0.4, z);
    B.block(x, z, 0.32, 0.32);
    const e = B.emit(new THREE.Vector3(x, y + 1.3, z), 0xff9a40, 12, 7);
    const p = B.pool(x, z, 2.2, 0xff9a40, 0.25, { y: y + 0.03, yaw: rand() * 3 });
    const flames = [0xffb347, 0xffd27a].map((c, i) => {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.2 - i * 0.05, 0.6, 6), new THREE.MeshBasicMaterial({ color: c }));
      f.position.set(x + (i - 0.5) * 0.08, y + 0.95, z);
      B.add(f);
      B.keep(f);
      return f;
    });
    const phase = rand() * 10;
    B.animate((dt, t) => {
      const k = 0.8 + Math.sin(t * 13 + phase) * 0.12 + Math.sin(t * 29) * 0.08;
      e.level = k;
      p.material.opacity = 0.25 * k;
      flames.forEach((f, i) => f.scale.set(1, 0.75 + Math.sin(t * (11 + i * 3) + phase) * 0.25, 1));
    });
  }
  barrelFire(50, -18);
  barrelFire(92, 14);
  barrelFire(30, WALK.s - 0.8);

  // lamps: down the street, round the square, along the bridge; dawn, so
  // only a few still burning
  let lampIdx = 0;
  function lamp(x, z, dir, lit) {
    const y = heightAt(x, z);
    const idx = lampIdx++;
    B.crushable(
      () => {
        const pole = cyl(0.09, 6.4, 0x8b8984, { seg: 8, radiusEnd: 0.14 });
        pole.position.set(x, y + 3.2, z);
        B.add(pole);
        B.solid(pole);
        B.block(x, z, 0.2, 0.2);
        const top = new THREE.Vector3(x, y + 6.1, z);
        const arm = put(B.root, box(0.08, 0.08, 1.7, 0x4a4c50, { r: 0.02 }), top.x, top.y, top.z + dir * 0.85);
        arm.rotation.x = -dir * 0.12;
        const head = new THREE.Vector3(top.x, top.y - 0.05, top.z + dir * 1.7);
        put(B.root, box(0.34, 0.14, 0.6, 0x3c3e42, { r: 0.05 }), head.x, head.y, head.z);
        const color = idx % 3 === 1 ? COLD : SODIUM[idx % 3];
        put(B.root, box(0.24, 0.04, 0.44, lit ? color : 0x2a2b2e, { r: 0.01, glow: lit }), head.x, head.y - 0.08, head.z);
        if (lit) {
          B.emit(head.clone().add(new THREE.Vector3(0, -0.7, 0)), color, 14, 10);
          B.pool(head.x, head.z, 2.8, color, 0.14, { y: heightAt(head.x, head.z) + 0.03, yaw: rand() * 3 });
        }
      },
      { kind: 'pole', pivot: { x, y, z }, footprint: { x, z, hx: 0.25, hz: 0.25, yaw: 0 } },
    );
  }
  for (let x = START_X + 4; x < SHACKS[0].x0 - 1; x += 14) for (const s of [-1, 1]) lamp(x, s < 0 ? CURB.n - 0.45 : CURB.s + 0.45, -s, rand() < 0.4);
  for (let x = SQUARE.x0 + 6; x < SQUARE.x1 - 2; x += 13) for (const s of [-1, 1]) lamp(x, s < 0 ? SQUARE.n - 0.5 : SQUARE.s + 0.5, -s, rand() < 0.35);
  for (const x of [SQUARE.x1 + 3, 114, RIVER.x1 + 4, RIVER.x1 + 18]) for (const s of [-1, 1]) lamp(x, s < 0 ? CURB.n - 0.45 : CURB.s + 0.45, -s, rand() < 0.4);

  // the bridgehead: blocks close in again, the second checkpoint across the street
  building({ x0: SQUARE.x1 - 1, x1: SHACKS[1].x0 + 4, floors: 8, panel: PANELS[3], accent: ACCENTS[1], holes: 3, depth: 14, sideFacade: 'west' });
  southBlock(SQUARE.x1 - 1, SHACKS[1].x0 + 4, 3, 'west', WALK.s + 1);
  building({ x0: SHACKS[1].x1 - 3, x1: RIVER.x0 - 3.5, floors: 6, panel: PANELS[1], accent: ACCENTS[3], holes: 2 });
  for (const z of [-8.6, 7.9]) jersey(113.5, z, 1.5);

  // ---------------------------------------------------------- the river
  {
    const W = RIVER.x1 - RIVER.x0;
    const cx = (RIVER.x0 + RIVER.x1) / 2;
    const cz = (MAP.z0 + MAP.z1) / 2;
    const depth = MAP.z1 - MAP.z0;
    // dark water under a skin of ice, floes drifting, mist over it
    const [c, g] = canvas(W * 6, depth * 6);
    g.fillStyle = '#34465a';
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = '#3e5266';
    for (let i = 0; i < 240; i++) g.fillRect((rand() * c.width) | 0, (rand() * c.height) | 0, 3 + rand() * 10, 1);
    g.fillStyle = '#cfd6de';
    for (const edge of [0, c.width]) for (let y = 0; y < c.height; y += 6) blob(g, edge, y, 10 + rand() * 18, 6 + rand() * 6, rand);
    g.fillStyle = '#a9b6c3';
    for (let i = 0; i < 80; i++) blob(g, rand() * c.width, rand() * c.height, 3 + rand() * 10, 2 + rand() * 7, rand);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(W, depth), mapMat(tex(c)));
    water.rotation.x = -Math.PI / 2;
    water.position.set(cx, RIVER.y, cz);
    water.receiveShadow = true;
    B.add(water);
    B.solid(water);
    for (let i = 0; i < 50; i++) {
      const z = MAP.z0 + rand() * depth;
      B.lump(RIVER.x0 + 2 + rand() * (W - 4), RIVER.y, z, 0.6 + rand() * 1.6, 0.08, 0.5 + rand() * 1.1, rand() < 0.5 ? 0xd5dade : 0xb5c0ca, rand() * 3);
    }
    // embankment walls with their railings
    for (const [x, side] of [[RIVER.x0 - 0.25, -1], [RIVER.x1 + 0.25, 1]]) {
      for (const [z0, z1] of [[MAP.z0, BRIDGE.n], [BRIDGE.s, MAP.z1]]) {
        B.chunk(0.5, -RIVER.y + SW - 0.02, z1 - z0, 0x77736c, x, (RIVER.y + SW - 0.02) / 2, (z0 + z1) / 2);
        B.block(x - side * 0.1, (z0 + z1) / 2, 0.4, (z1 - z0) / 2);
        const rx = x + side * 0.3;
        for (let z = z0 + 0.6; z < z1 - 0.3; z += 1.8) B.piece(0.07, 0.9, 0.07, 0x4c4f53, rx, SW + 0.45, z);
        B.piece(0.06, 0.06, z1 - z0 - 0.4, 0x5a5d61, rx, SW + 0.88, (z0 + z1) / 2);
      }
    }
    // the bridge: deck, fascia beams, piers, railings with lamp posts
    B.chunk(W + 0.4, 0.98, BRIDGE.s - BRIDGE.n, 0x6e6b66, cx, -0.51, (BRIDGE.n + BRIDGE.s) / 2);
    for (const z of [BRIDGE.n + 0.1, BRIDGE.s - 0.1]) B.chunk(W + 0.6, 0.55, 0.3, 0x5d5a55, cx, -0.75, z);
    for (let x = RIVER.x0 + 8; x < RIVER.x1 - 4; x += 12) {
      B.chunk(1.4, -1 - RIVER.y, BRIDGE.s - BRIDGE.n - 2, 0x7a766f, x, (RIVER.y - 1) / 2, (BRIDGE.n + BRIDGE.s) / 2);
      B.lump(x, RIVER.y, BRIDGE.s - 1.5, 1.2, 0.12, 0.8, 0xd5dade);
    }
    for (const z of [BRIDGE.n + 0.25, BRIDGE.s - 0.25]) {
      for (let x = RIVER.x0 + 0.3; x < RIVER.x1; x += 1.2) {
        const bent = rand() < 0.1;
        B.piece(0.08, 0.95, 0.08, 0x4c4f53, x, 0.47, z, bent ? 0.4 : 0, 0, bent ? 0.3 : 0);
      }
      B.piece(W, 0.07, 0.07, 0x5a5d61, cx, 0.92, z);
      B.piece(W, 0.05, 0.05, 0x5a5d61, cx, 0.5, z);
      B.block(cx, z, W / 2 + 0.6, 0.3);
    }
    for (let x = RIVER.x0 + 6; x < RIVER.x1 - 2; x += 12) for (const s of [-1, 1]) lamp(x, s < 0 ? BRIDGE.n + 0.4 : BRIDGE.s - 0.4, -s, rand() < 0.3);
  }
  // cover across the deck: a dead tram, wrecks, barriers, sandbags
  P.tram(B, 140, -4.8, 0.05, { tilt: -0.04, burn: 0.9 });
  wreck(127, 3.5, 0.4, { kind: 'sedan', paint: BURNT_PAINT[1] });
  wreck(163, -4.5, 0.6, { kind: 'hatch', paint: BURNT_PAINT[3], flipped: true });
  for (const [x, z, yaw] of [[131, 2, 1.5], [147, -1.5, 1.62], [156, 4.5, 1.45], [166, -5.2, 1.55]]) blockCover(x, z, yaw);
  jersey(180, -5.5, 0.4);
  function sandbags(x, z, len, yaw) {
    for (let i = 0; i < len; i++) {
      for (let k = 0; k < 4; k++) {
        const bag = put(B.root, box(0.5, 0.22, 0.32, 0x8a7b5c, { r: 0.08 }), x + Math.cos(yaw) * (i * 0.5 + k * 0.25), 0.11 + k * 0.22, z - Math.sin(yaw) * (i * 0.5 + k * 0.25));
        bag.rotation.y = yaw;
      }
    }
    const cx = x + Math.cos(yaw) * len * 0.25;
    const cz = z - Math.sin(yaw) * len * 0.25;
    B.block(cx, cz, len * 0.25, 0.25, yaw);
    B.hitBox(cx, 0.45, cz, len * 0.5, 0.9, 0.4, yaw);
  }
  const gunBlock = B.block(GUN_X, 0, 2.3, 2.3); // the bridge gun's emplacement: solid while it stands (it's blown to pieces when destroyed, and then you drive through)
  // Past the bridge, across the street beyond it: road barriers, yellow and black
  // striped bars on trestles with sandbags. They won't break while the gun
  // stands; once it's destroyed, a shell or a ram knocks them flat.
  const gate = [];
  // (well back, past the bridge: out of sight while you fight the gun; it
  // only stands in for the edge of the play area)
  const BAR_X = END_X - 3;
  for (const [z0, z1] of [[WALK.n + 0.3, -3.2], [-3.2, 2.4], [2.4, WALK.s - 0.3]]) {
    const zc = (z0 + z1) / 2;
    const len = z1 - z0;
    B.crushable(
      () => {
        const stripes = (() => {
          const [c, g] = canvas(16, 2);
          for (let i = 0; i < 16; i++) {
            g.fillStyle = (i >> 1) % 2 ? '#1d1b1e' : '#e8b030';
            g.fillRect(i, 0, 1, 2);
          }
          const t = tex(c);
          t.wrapS = THREE.RepeatWrapping;
          t.repeat.set(len / 2.5, 1);
          return t;
        })();
        for (const h of [0.55, 1.05]) {
          const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.26, len - 0.3), new THREE.MeshToonMaterial({ map: stripes, gradientMap }));
          bar.position.set(BAR_X, h, zc);
          bar.castShadow = true;
          B.add(bar);
        }
        for (const zz of [z0 + 0.4, zc, z1 - 0.4]) {
          for (const s of [-1, 1]) {
            const leg = put(B.root, box(0.08, 1.25, 0.08, 0x8a8678, { r: 0.01 }), BAR_X + s * 0.22, 0.6, zz);
            leg.rotation.z = -s * 0.32;
          }
          put(B.root, box(0.5, 0.22, 0.34, 0x8a7b5c, { r: 0.08 }), BAR_X, 0.11, zz); // a sandbag on its feet
        }
        put(B.root, box(0.16, 0.16, 0.16, 0xff9a40, { glow: true }), BAR_X, 1.25, zc); // a warning lamp
        B.hitBox(BAR_X, 0.7, zc, 0.6, 1.4, len);
        B.block(BAR_X, zc, 0.35, len / 2);
      },
      { kind: 'prop', heavy: true, breakable: true, armored: true, scrap: 1 },
    );
    gate.push(B.crushables[B.crushables.length - 1]);
  }
  sandbags(151, 2.5, 5, Math.PI / 2);

  // the far bank: the street runs on between blocks, a heap of rubble or two
  building({ x0: RIVER.x1 + 3.5, x1: 210, floors: 9, panel: PANELS[2], accent: ACCENTS[1], holes: 3, sideFacade: 'west' });
  building({ x0: 214, x1: MAP.x1, floors: 7, panel: PANELS[0], accent: ACCENTS[2], holes: 2 });
  southBlock(RIVER.x1 + 3.5, 206, 2, 'west');
  southBlock(210, MAP.x1, 3, 'west');
  rubble(200, -8.4, 2.0, 1.4, { slabs: 2 });
  rubble(224, 7.8, 2.4, 1.6, { slabs: 2 });

  // tram rails down the street, over the square and across the bridge
  {
    const R = rails(B, rand);
    for (const z of [-2.25, 1.55]) R.track(R.straight(START_X + 1, z, MAP.x1 - 1, z));
  }

  // the checkpoints
  const shacks = SHACKS.map((k) => buildShack(B, { x0: k.x0, x1: k.x1, z0: CURB.n + 0.1, z1: CURB.s - 0.1, fill: { n: WALK.n - 0.5, s: WALK.s + 1.2 }, heightAt }));

  B.finish();
  B.mergeStatic();

  // the depot interior, built far off in the same scene
  const room = buildDepotRoom(scene);
  B.blocks.push(...room.blocks);
  B.colliders.push(...room.colliders);
  B.emitters.push(...room.emitters);
  room.bindBlocks(B.blocks);

  // ---------------------------------------------------- the level script
  const SECTORS = ['The street', 'The square', 'The bridge'];
  const [shackA, shackB] = shacks;
  const B1 = { minX: START_X + 2, maxX: shackA.x0 - 0.8, minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 };
  // the square: out onto its sidewalks too (drops land there), up to the
  // blocks on the far side and the ruined arcade on the near one
  const B2 = { minX: shackA.x1 + 1.2, maxX: shackB.x0 - 0.8, minZ: SQUARE.n - 1.3, maxZ: SQUARE.s + 0.9 };
  // the bridge: room to drive right round the gun, out onto the far bank
  const B3 = { minX: shackB.x1 + 1.2, maxX: END_X + 4, minZ: BRIDGE.n + 0.6, maxZ: BRIDGE.s - 0.6 }; // (the barriers stop you short of the end)
  const S = { sector: 0, step: 0, t: 0, n: 0, boss: null, waveT: 0, walkerT: 0 };
  const bounds = { ...B1 };
  const setBounds = (api, b) => api.setBounds(Object.assign(bounds, b));
  const go = (step) => {
    S.step = step;
    S.t = 0;
  };
  function openShack(api, shack, text) {
    shack.openIn();
    api.objective('Enter the checkpoint');
    if (text) api.prompt('Zone clear', text, { go: true });
    api.arrow(shack.door, 'Checkpoint');
  }
  const atDoor = (api, shack) => shack.inDoor > 0.6 && Math.hypot(api.tankPos.x - shack.door.x, api.tankPos.z - shack.door.z) < 5;
  const contact = (api, text, seconds = 4) => !api.cleared && api.prompt('Contact', text, { danger: true, seconds });
  const walkerTip = (api) => {
    if (api.lesson('walker')) api.prompt('Anti-tank walker', 'When its red line <b>narrows and starts blinking</b>, it\'s about to fire a beam: <b>get off the line</b> or behind something solid!', { danger: true, seconds: 9 });
    else contact(api, 'Anti-tank walker!');
  };

  function start(api) {
    Object.assign(S, { sector: 0, step: 0, t: 0, n: 0, boss: null, waveT: 0, walkerT: 0 });
    S.api = api;
    setBounds(api, B1);
    // everything's online from the start here
    api.enableGun();
    api.revealScraps(false);
    api.giveRockets();
    if (api.tank.ability) api.giveAbility();
    api.sectors(SECTORS, 0, 'Level 2');
    api.objective('Cross the river');
    api.prompt('Dawn', 'Cross the river.', { seconds: 4 });
  }

  // 1: the street
  function sector1(api) {
    const x = api.tankPos.x;
    // drive on up to the checkpoint and it opens, whatever's still about
    // (left behind at the door)
    if (S.step < 3 && x > shackA.x0 - 9) {
      openShack(api, shackA, null);
      go(3);
    }
    switch (S.step) {
      case 0:
        if (x > START_X + 10 || S.t > 4) {
          for (const [dx, z, d] of [[0, -4, 0.2], [1.5, 3, 0.6], [3, -0.5, 1.0]]) api.spawnDog(Math.max(x + 16, 8) + dx, z, { delay: d });
          contact(api, 'Enemies ahead!');
          go(1);
        }
        break;
      case 1:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          api.spawnWalker(31, -4.5);
          api.spawnDog(26, 4, { delay: 0.8 });
          api.spawnDog(27.5, -6, { delay: 1.2 });
          walkerTip(api);
          go(2);
        }
        break;
      case 2:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          openShack(api, shackA, null);
          go(3);
        }
        break;
      case 3:
        if (atDoor(api, shackA)) {
          go(4);
          if (api.enemiesAlive) api.clearEnemies(); // left behind
          api.depot(shackA, { offers: [], onLeave: () => startSector2(api) }); // a repair stop: no parts here
        }
        break;
    }
  }

  // 2: the square
  const fromNorth = (api, dx, delay = 0) => api.spawnDog(67.5 + dx, -36, { delay, via: [[67.5 + dx * 0.5, -22]], noclip: true });
  const fromSouth = (api, x, delay = 0) => api.spawnDog(x, SQUARE.s + 3, { delay, via: [[x, SQUARE.s - 2]], noclip: true });
  function startSector2(api) {
    S.sector = 1;
    go(0);
    setBounds(api, B2);
    api.sectors(SECTORS, 1, 'Level 2');
    api.objective('');
    shackB.setLocked(true);
  }
  function sector2(api) {
    // the checkpoint at the far end stays locked until the square's clear;
    // driving up to it says so
    if (shackB.locked && S.step < 4 && Math.hypot(api.tankPos.x - shackB.door.x, api.tankPos.z - shackB.door.z) < 9 && !(S.toldLock > 0)) {
      S.toldLock = 8;
      api.prompt('Locked', 'Clear the square to unlock the checkpoint.', { danger: true, seconds: 3 });
    }
    S.toldLock = (S.toldLock || 0) - 1 / 60;
    switch (S.step) {
      case 0:
        if (S.t > 1.5) {
          contact(api, 'The square is full of enemies!');
          fromNorth(api, -1.5);
          fromNorth(api, 1.5, 0.5);
          fromNorth(api, 0, 1.0);
          api.spawnWalker(91, -16);
          go(1);
        }
        break;
      case 1:
        if (api.enemiesAlive <= 1 && S.t > 4) {
          // over the ruins at the checkpoint end, so the fight's near the door
          fromSouth(api, 84);
          fromSouth(api, 88, 0.4);
          fromSouth(api, 92, 0.8);
          api.spawnWalker(92, 11);
          api.spawnDog(93, 0, { delay: 1.4 });
          go(2);
        }
        break;
      case 2:
        if (api.enemiesAlive <= 1 && S.t > 4) {
          fromNorth(api, -1.5);
          fromNorth(api, 1.5, 0.4);
          fromSouth(api, 86, 0.8);
          fromSouth(api, 91, 1.2);
          api.spawnWalker(93, -3, { delay: 0.6 });
          api.spawnWalker(86, -18, { delay: 1.6 });
          contact(api, 'More of them!', 3);
          go(3);
        }
        break;
      case 3:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          shackB.setLocked(false);
          openShack(api, shackB, 'Area cleared.');
          go(4);
        }
        break;
      case 4:
        if (atDoor(api, shackB)) {
          go(5);
          if (api.enemiesAlive) api.clearEnemies(); // left behind in the square
          api.depot(shackB, { offers: ['afterburner', 'twinmg', 'optics'], onLeave: () => startSector3(api) });
        }
        break;
    }
  }

  // 3: the bridge and its gun
  function startSector3(api) {
    S.sector = 2;
    go(0);
    setBounds(api, B3);
    api.sectors(SECTORS, 2, 'Level 2');
    api.objective('Destroy the bridge gun');
    S.boss = api.spawnBridgeGun(GUN_X, 0, { yaw: Math.PI });
    api.boss(S.boss, 'Bridge gun');
    api.prompt('Warning', 'A heavy gun holds the far end of the bridge. Use the wrecks for cover and <b>destroy it</b>!', { danger: true, seconds: 7 });
    // the camera swings right out over the bridge to the gun, then back
    api.spotlight({ targets: [() => (S.boss.alive ? new THREE.Vector3(S.boss.pos.x, 2, S.boss.pos.z) : null)], r: 150 }, () => S.t > 2.4, { maxTime: 3, frame: () => (S.boss.alive ? S.boss.pos.clone() : null), frameK: 1 });
    S.waveT = 6;
    S.walkerT = 14;
  }
  // machines come over from behind the gun
  const fromFar = (api, dz, delay = 0) => api.spawnDog(END_X + 8, dz, { delay, via: [[GUN_X + 4, dz * 1.4]], noclip: true });
  function sector3(api, dt) {
    switch (S.step) {
      case 0:
        if (!S.boss.alive) {
          const bi = B.blocks.indexOf(gunBlock);
          if (bi >= 0) B.blocks.splice(bi, 1);
          for (const c of gate) c.armored = false; // the barriers can be broken now
          api.prompt('Bridge gun destroyed', 'The way is open. <b>Drive across!</b>', { go: true, seconds: 5 });
          setBounds(api, { maxX: MAP.x1 - 4 });
          api.arrow(new THREE.Vector3(END_X + 2, 0.6, 0), 'Exit');
          api.cameraTo(new THREE.Vector3(END_X, 0, 0), 2); // (a look at the way out)
          go(1);
          break;
        }
        S.waveT -= dt;
        S.walkerT -= dt;
        if (S.waveT <= 0 && api.enemiesAlive < 6) {
          S.waveT = 11;
          fromFar(api, -3);
          fromFar(api, 3, 0.5);
        }
        if (S.walkerT <= 0 && api.enemiesAlive < 6) {
          S.walkerT = 24;
          api.spawnWalker(END_X + 8, (Math.random() < 0.5 ? -1 : 1) * 4, { via: [[GUN_X + 6, (Math.random() - 0.5) * 8]], noclip: true });
        }
        break;
      case 1:
        if (api.tankPos.x > END_X) {
          api.arrow(null);
          api.sectors(SECTORS, 3, 'Level 2');
          api.win('Level clear', { path: [[END_X + 8, 0], [END_X + 30, 0]] });
          go(2);
        }
        break;
    }
  }

  // Dev kit: beat the current stage
  function skipStage(api) {
    api.clearSpot();
    api.arrow(null);
    api.clearPrompt();
    if (S.sector < 2) {
      const shack = S.sector === 0 ? shackA : shackB;
      api.clearEnemies();
      api.teleport(shack.door.x - 7, shack.door.z, 0);
      openShack(api, shack, 'Skipped ahead. Drive into the <b>checkpoint</b>.');
      go(S.sector === 0 ? 3 : 4);
      return true;
    }
    if (S.step === 0 && S.boss?.alive) {
      api.blast(S.boss.pos.clone().setY(1), 0.5, 99999);
      return true;
    }
    return false;
  }

  function script(api, dt) {
    S.t += dt;
    if (api.run.mode !== 'field') return;
    if (S.sector === 0) sector1(api, dt);
    else if (S.sector === 1) sector2(api, dt);
    else sector3(api, dt);
  }

  function update(dt, t, ctx = {}) {
    B.update(dt, t, ctx);
    for (const k of shacks) k.update(dt, t);
    room.update(dt, t, ctx);
    if (ctx.api) script(ctx.api, dt);
  }

  return {
    light,
    colliders: B.colliders,
    blocks: B.blocks,
    emitters: B.emitters,
    crushables: B.crushables,
    depotRoom: room,
    heightAt: (x, z) => (z > 150 ? 0 : heightAt(x, z)),
    spawn: { x: START_X + 5, z: -0.5, yaw: 0 },
    bounds,
    script: S, // for tests
    shacks, // for tests
    start,
    update,
    skipStage,
  };
}
