// Level 3: onto the highway, at midday. The same district, further out:
// the street runs on between panel blocks and old warehouses, then climbs
// a long ramp onto an elevated highway that cuts straight through the
// city, the blocks standing either side of it.
//
// Layout (world +X runs bottom-left to top-right on screen):
//  1 The street: panel blocks, works buildings. Dogs and walkers; the first
//    attack drones. A checkpoint across its end. (Behind the start: the
//    checkpoint the tank's just come out of, shut again.)
//  2 The ramp: the road rises on a long ramp onto the highway deck. Drones
//    come in over the roofs, machines down the ramp. A checkpoint on the
//    deck itself.
//  3 The highway: tram rails, wrecks and debris on the carriageways. At the
//    end a barricade across the deck, and everything they have left in
//    front of it: clear them all, then break through and on.
import * as THREE from 'three';
import { addNoon } from '../render/setup.js';
import { box, cyl, put, toon, gradientMap, setLowPoly } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import * as P from './props.js';
import { buildShack } from './depot.js';
import { buildDepotRoom } from './depotRoom.js';
import { rails } from './rails.js';
import { FH, glyphSign, sidewalkTexture, facadeTextures, endTexture, facadeMat, mapMat } from './cityTextures.js';

const GPX = 6; // ground texels per world unit
const MAP = { x0: -60, x1: 344, z0: -50, z1: 46 };
const START_X = -20;
const CURB = { n: -7.5, s: 6.5 };
const WALK = { n: -10, s: 9 };
const SW = 0.16;
const SHACK_A = { x0: 100, x1: 107.6 };
const RAMP = { x0: 126, x1: 168 }; // the ramp, rising onto the deck
const DECK = 4.5; // the highway deck's height
const DECK_Z = 8.6; // its half-width (round z = DZ)
const DZ = -0.5; // the deck's centre line
const DECK_X1 = MAP.x1 - 4;
const SHACK_B = { x0: 226, x1: 233.6 }; // the checkpoint on the deck
const BAR_X = 302; // the last barricade
const END_X = 316;
// beside the ramp and under the deck: a street at ground level, the blocks
// set back either side of it
const SIDE = { n: -12.5, s: 11.5 };
const TRACKS = [-4.4, 3.4]; // tram tracks along the deck

const PANELS = ['#9a978f', '#a5a095', '#91959a', '#aca393', '#8b8e92'];
const ACCENTS = ['#5f8784', '#a3874e', '#5c6f8c', '#8f8550', '#6f7f6a'];
const PAINT = [0x8a8172, 0x6d7a72, 0x5d6b80, 0x9b9277, 0x707a5c, 0xb3ad9c];
const CONCRETE = [0x8d8b86, 0x7d7c78, 0x9a978f, 0x6f6e6b, 0x85898c];
const BURNT_PAINT = [0x5d6b80, 0x8a8172, 0x6f7f6a, 0x9b9277, null, 0x7a6a5a];
const CONTAINERS = [0x7a4a36, 0x4f6b6a, 0x6b6f72, 0x8a6a3a, 0x3f5470];

const onDeckZ = (z) => Math.abs(z - DZ) < DECK_Z;
// the ground's height: the street's sidewalks, the ramp climbing, the deck
function heightAt(x, z) {
  if (x >= RAMP.x1 && x <= DECK_X1 && onDeckZ(z)) return DECK;
  if (x >= RAMP.x0 && x < RAMP.x1 && onDeckZ(z)) return (DECK * (x - RAMP.x0)) / (RAMP.x1 - RAMP.x0);
  if (x < RAMP.x0) return z <= CURB.n || z >= CURB.s ? SW : 0;
  return z <= SIDE.n + 2 || z >= SIDE.s - 2 ? SW : 0;
}

// The ground: snow on the yards and corners, asphalt down the street and on
// under the highway; slush, faded paint.
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
  rect(MAP.x0, MAP.z0, MAP.x1, MAP.z1, '#b4b8be');
  speckle(g, W, H, ['#a7abb1', '#c2c6cb', '#9c9fa5'], W * H * 0.02, rand);
  const asphalt = [
    [MAP.x0, CURB.n, RAMP.x0, CURB.s],
    [RAMP.x0, SIDE.n + 2, MAP.x1, SIDE.s - 2],
  ];
  for (const [x0, z0, x1, z1] of asphalt) {
    rect(x0, z0, x1, z1, '#5e5f64');
    speckle(g, X(x1) - X(x0), Z(z1) - Z(z0), ['#68696e', '#54555a', '#6e6e72'], (X(x1) - X(x0)) * (Z(z1) - Z(z0)) * 0.05, rand, Z(z0), X(x0));
    const n = ((x1 - x0) * (z1 - z0)) / 2.5;
    for (let i = 0; i < n; i++) {
      const x = x0 + rand() * (x1 - x0);
      const z = z0 + 0.3 + rand() * (z1 - z0 - 0.6);
      const nearEdge = Math.min(z - z0, z1 - z) < 1.3;
      g.fillStyle = nearEdge ? (rand() < 0.5 ? '#a9a8a6' : '#9a9996') : rand() < 0.5 ? '#88867f' : '#78766f';
      blob(g, X(x), Z(z), (0.5 + rand() * 1.3) * GPX, (0.35 + rand() * 0.6) * GPX, rand, 9);
    }
  }
  g.fillStyle = '#aaa79e';
  for (const z of [-0.6, -0.3, -4, 3]) {
    const center = z > -1;
    for (let x = MAP.x0; x < RAMP.x0; x += center ? 1 : 4) if (rand() > 0.45) g.fillRect(X(x), Z(z), (center ? 1 : 2) * GPX, 2);
  }
  return tex(c);
}

// The highway's surface, for one stretch of deck (or the ramp): worn dark
// asphalt, patched squares, cracks, oil and soot, tyre marks, white lane
// dashes, a double yellow centre, yellow edge lines, slush along the sides.
export function deckTexture(rand, len) {
  const K = 10; // texels per unit
  const Wd = DECK_Z * 2;
  const [c, g] = canvas(Math.round(len * K), Math.round(Wd * K));
  const X = (x) => x * K;
  const Z = (z) => (z + DECK_Z) * K; // z across the deck, from its centre
  g.fillStyle = '#56575c';
  g.fillRect(0, 0, c.width, c.height);
  speckle(g, c.width, c.height, ['#606166', '#4c4d52', '#66666b', '#515056'], c.width * c.height * 0.08, rand);
  // patched repairs: lighter and darker rectangles with dark seams
  for (let i = 0; i < len / 6; i++) {
    const x = rand() * len;
    const z = -DECK_Z + 1 + rand() * (Wd - 2);
    const w = 1.5 + rand() * 4;
    const h = 1 + rand() * 2.5;
    g.fillStyle = rand() < 0.5 ? '#626368' : '#4a4b50';
    g.fillRect(X(x), Z(z), w * K, h * K);
    g.fillStyle = '#3e3f44';
    g.fillRect(X(x), Z(z), w * K, 1);
    g.fillRect(X(x), Z(z), 1, h * K);
  }
  // wheel-worn bands down each lane
  g.fillStyle = 'rgba(40,40,44,0.25)';
  for (const z of [-6.2, -2.6, 1.6, 5.2]) {
    g.fillRect(0, Z(z - 0.5), c.width, 0.35 * K);
    g.fillRect(0, Z(z + 0.4), c.width, 0.35 * K);
  }
  // cracks: wandering dark lines
  g.fillStyle = '#2f3034';
  for (let i = 0; i < len / 3; i++) {
    let x = rand() * len * K;
    let z = rand() * c.height;
    let a = rand() * Math.PI * 2;
    const n = 8 + rand() * 30;
    for (let k = 0; k < n; k++) {
      g.fillRect(x, z, 1, 1);
      a += (rand() - 0.5) * 0.9;
      x += Math.cos(a);
      z += Math.sin(a) * 0.7;
    }
  }
  // oil stains and soot, skid marks
  for (let i = 0; i < len / 5; i++) {
    g.fillStyle = rand() < 0.5 ? 'rgba(20,20,22,0.35)' : 'rgba(60,45,30,0.25)';
    blob(g, X(rand() * len), Z(-DECK_Z + 1 + rand() * (Wd - 2)), (0.6 + rand() * 1.4) * K, (0.4 + rand() * 0.9) * K, rand, 9);
  }
  g.fillStyle = 'rgba(25,25,28,0.5)';
  for (let i = 0; i < len / 20; i++) {
    const x0 = rand() * len;
    const z0 = -DECK_Z + 2 + rand() * (Wd - 4);
    for (let k = 0; k < 40; k++) g.fillRect(X(x0 + k * 0.25), Z(z0 + Math.sin(k * 0.15) * 0.8), 2, 2);
  }
  // lane dashes, white, worn (bits missing)
  g.fillStyle = '#d6d2c6';
  for (const z of [-3.8, 3.8]) {
    for (let x = 0.5; x < len; x += 4) {
      if (rand() < 0.15) continue;
      for (let k = 0; k < 2 * K; k++) if (rand() > 0.12) g.fillRect(X(x) + k, Z(z), 1, 0.14 * K);
    }
  }
  // the centre: double yellow; the edge lines
  g.fillStyle = '#d9b84a';
  for (const z of [-0.12, 0.12, -DECK_Z + 1.1, DECK_Z - 1.2]) for (let x = 0; x < len * K; x++) if (rand() > 0.08) g.fillRect(x, Z(z), 1, 0.1 * K);
  // slush packed along the sides
  for (let i = 0; i < len * 1.5; i++) {
    const s = rand() < 0.5 ? -1 : 1;
    g.fillStyle = rand() < 0.5 ? '#c7cbd0' : '#aeb2b7';
    blob(g, X(rand() * len), Z(s * (DECK_Z - 0.3 - rand() * 0.6)), (0.4 + rand() * 1.2) * K, (0.2 + rand() * 0.4) * K, rand, 8);
  }
  return tex(c);
}

// A highway sign with no words: a green board, a white edge, white arrows
// (straight on; or on, and an exit off to the side) and bars.
export function roadSign(w, h, rand, kind = 'ahead') {
  const k = 24;
  const [c, g] = canvas(w * k, h * k);
  g.fillStyle = '#1f6b43';
  g.fillRect(0, 0, w * k, h * k);
  g.fillStyle = '#f1f1ea';
  g.fillRect(4, 4, w * k - 8, 3);
  g.fillRect(4, h * k - 7, w * k - 8, 3);
  g.fillRect(4, 4, 3, h * k - 8);
  g.fillRect(w * k - 7, 4, 3, h * k - 8);
  const arrow = (cx, cy, s, ang) => {
    g.save();
    g.translate(cx, cy);
    g.rotate(ang);
    g.beginPath();
    g.moveTo(0, -s);
    g.lineTo(s * 0.7, -s * 0.2);
    g.lineTo(s * 0.25, -s * 0.2);
    g.lineTo(s * 0.25, s);
    g.lineTo(-s * 0.25, s);
    g.lineTo(-s * 0.25, -s * 0.2);
    g.lineTo(-s * 0.7, -s * 0.2);
    g.closePath();
    g.fill();
    g.restore();
  };
  const s = h * k * 0.3;
  arrow(w * k * 0.22, h * k * 0.5, s, 0);
  arrow(w * k * 0.78, h * k * 0.5, s, kind === 'exit' ? Math.PI / 4 : 0);
  for (let i = 0; i < 2; i++) {
    const bw = (0.15 + rand() * 0.12) * w * k;
    g.fillRect(w * k * 0.5 - bw / 2, h * k * (0.32 + i * 0.3), bw, 4);
  }
  // weather: rust streaks, a bullet hole or two
  g.fillStyle = 'rgba(110,70,40,0.45)';
  for (let i = 0; i < 6; i++) g.fillRect((rand() * c.width) | 0, (rand() * c.height * 0.5) | 0, 1, 4 + rand() * 12);
  g.fillStyle = '#0e1a14';
  for (let i = 0; i < 3; i++) g.fillRect((rand() * c.width) | 0, (rand() * c.height) | 0, 2, 2);
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
  {
    const geo = new THREE.PlaneGeometry(MAP.x1 - MAP.x0, MAP.z1 - MAP.z0);
    const m = new THREE.Mesh(geo, mapMat(groundTexture(rand)));
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
  slab(MAP.x0, RAMP.x0, MAP.z0, CURB.n);
  slab(MAP.x0, RAMP.x0, CURB.s, MAP.z1);
  slab(RAMP.x0, MAP.x1, MAP.z0, SIDE.n + 2);
  slab(RAMP.x0, MAP.x1, SIDE.s - 2, MAP.z1);
  // snow plowed up along the curbs
  const bank = (x0, x1, z, dir) => {
    for (let x = x0; x < x1; x += 0.6) {
      if (rand() < 0.15) x += 2;
      B.lump(x, SW, z + dir * rand() * 0.25, 0.5 + rand() * 0.4, 0.18 + rand() * 0.15, 0.35 + rand() * 0.2, rand() < 0.3 ? 0xa9aaac : 0xc7cacf, rand() * 3);
    }
  };
  bank(START_X - 2, RAMP.x0 - 2, CURB.n - 0.35, -1);
  bank(START_X - 2, RAMP.x0 - 2, CURB.s + 0.35, 1);
  // stones and bits of brick over the street
  for (let i = 0; i < 360; i++) {
    const x = START_X - 1 + rand() * (RAMP.x0 - START_X);
    const z = WALK.n + rand() * (WALK.s - WALK.n);
    const s = 0.08 + rand() * 0.22;
    B.piece(s * (1 + rand()), s * 0.6, s, rand() < 0.25 ? 0x7a5e50 : CONCRETE[(rand() * 5) | 0], x, heightAt(x, z) + s * 0.25, z, rand(), rand() * 3, rand());
  }
  // tram rails down the street to the ramp's foot
  {
    const R = rails(B, rand);
    for (const z of [-2.25, 1.55]) R.track(R.straight(START_X - 1, z, RAMP.x0 - 3, z));
  }

  // ---------------------------------------------------------- buildings
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
  const ribMat = (w, h, color) => {
    const t = ribs.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 1.2, h / 2.6);
    return new THREE.MeshToonMaterial({ map: t, color, gradientMap });
  };
  // A panel block with its facade to the street (zf), going back depth.
  function building(o) {
    const { x0, x1, zf = WALK.n, depth = 13, floors } = o;
    const w = x1 - x0;
    const H = floors * FH + 0.5;
    const cols = Math.max(2, Math.round(w / 1.7));
    const cw = w / cols;
    const look = { panel: o.panel ?? PANELS[(rand() * 5) | 0], accent: o.accent ?? ACCENTS[(rand() * 5) | 0], broken: o.broken ?? 0.25, holes: o.holes ?? 1, shop: o.shop };
    const front = facadeMat(facadeTextures(w, floors, look, rand));
    const end = mapMat(endTexture(depth, floors, look, rand, !!o.mural));
    const roof = toon(0xc6c9ce);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, depth), [end, end, roof, roof, front, end]);
    m.position.set((x0 + x1) / 2, H / 2, zf - depth / 2);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    B.block((x0 + x1) / 2, zf - depth / 2, w / 2, depth / 2);
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
  function southBlock(x0, x1, floors, zf = WALK.s + 0.3) {
    const depth = 13;
    const w = x1 - x0;
    const H = floors * FH + 0.5;
    const look = { panel: PANELS[(rand() * 5) | 0], accent: ACCENTS[(rand() * 5) | 0], broken: 0.35, holes: 1, shop: true };
    const front = facadeMat(facadeTextures(w, floors, look, rand));
    const end = mapMat(endTexture(depth, floors, look, rand, false));
    const roof = toon(0xc6c9ce);
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, H, depth), [end, end, roof, roof, end, front]);
    m.position.set((x0 + x1) / 2, H / 2, zf + depth / 2);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    B.solid(m);
    B.block((x0 + x1) / 2, zf + depth / 2, w / 2, depth / 2);
    for (let x = x0 + 1.2; x < x1 - 1; x += 2.6) if (rand() < 0.7) B.piece(1.8, 0.06, 0.9, [0x5c6f8c, 0x6f7f6a, 0x8f8550][(rand() * 3) | 0], x, 1.45, zf - 0.42, 0.4, 0, 0);
    B.piece(w, 0.3, 0.2, 0x8d8b86, (x0 + x1) / 2, H + 0.15, zf + 0.1);
    B.lump((x0 + x1) / 2, H + 0.05, zf + depth / 2, w / 2.2, 0.12, depth / 2.6, 0xd0d3d8);
  }
  // A works building in among the blocks, its front on the street (zf;
  // side 'n': it runs back north, 's' south). Ribbed tin or brick walls,
  // and one of three roofs: a sawtooth of north lights, a long gable, or
  // flat behind a parapet with vents and a water tank. Roller doors (some
  // part open), a loading dock, high windows, a name board, drainpipes.
  const BRICK = 0x8a5a44;
  function works(o) {
    const { x0, x1, zf, side = 'n', depth = 14, roof = 'saw', wall = 0x8a9a8e, tin = true, doors = 2, dock = false, H = 4.4 } = o;
    const w = x1 - x0;
    const s = side === 'n' ? -1 : 1; // the way back from the street
    const zc = zf + (s * depth) / 2;
    const out = -s; // the facade faces out this way
    const walls = new THREE.Mesh(new THREE.BoxGeometry(w, H, depth), tin ? ribMat(Math.max(w, depth), H, wall) : toon(wall));
    walls.position.set((x0 + x1) / 2, H / 2, zc);
    walls.castShadow = walls.receiveShadow = true;
    B.add(walls);
    B.solid(walls);
    B.block((x0 + x1) / 2, zc, w / 2, depth / 2);
    if (!tin) {
      // brick: courses and a darker plinth
      for (let y = 0.4; y < H; y += 0.5) B.piece(w + 0.02, 0.04, 0.03, 0x6f4636, (x0 + x1) / 2, y, zf + out * 0.01);
      B.piece(w + 0.04, 0.6, 0.06, 0x5a4a40, (x0 + x1) / 2, 0.3, zf + out * 0.02);
    }
    if (roof === 'saw') {
      for (let x = x0 + 1.5; x < x1 - 0.5; x += 3) {
        put(B.root, box(3.1, 0.12, depth, 0x6d6a64, { r: 0.02 }), x, H + 0.55, zc).rotation.z = 0.35;
        put(B.root, box(0.06, 0.9, depth - 0.2, 0x8fa4b0, { r: 0.01 }), x + 1.42, H + 0.5, zc);
        B.lump(x - 0.3, H + 0.7, zc, 1.2, 0.08, depth / 2.6, 0xd6d9dd);
      }
    } else if (roof === 'gable') {
      for (const k of [-1, 1]) {
        const p = put(B.root, box(w + 0.4, 0.14, depth / 2 + 0.6, 0x7a6f62, { r: 0.02 }), (x0 + x1) / 2, H + 0.9, zc + k * depth * 0.24);
        p.rotation.x = k * 0.32;
      }
      B.lump((x0 + x1) / 2, H + 1.4, zc, w / 2.4, 0.1, depth / 3, 0xd6d9dd);
    } else {
      B.piece(w, 0.5, 0.25, 0x6d6a64, (x0 + x1) / 2, H + 0.25, zf + out * 0.1);
      for (let i = 0; i < 3; i++) put(B.root, cyl(0.35, 0.9, 0x7d8085, { seg: 8 }), x0 + 2 + rand() * (w - 4), H + 0.45, zc + (rand() - 0.5) * depth * 0.6);
      put(B.root, cyl(1.1, 1.8, 0x6b5843, { seg: 10 }), x1 - 2.5, H + 1.6, zc);
      for (const dx of [-0.7, 0.7]) put(B.root, box(0.12, 1.2, 0.12, 0x3a3c3f), x1 - 2.5 + dx, H + 0.6, zc);
      B.lump((x0 + x1) / 2, H + 0.05, zc, w / 2.4, 0.1, depth / 2.8, 0xd6d9dd);
    }
    for (let x = x0 + 1.4; x < x1 - 1; x += 2.2) put(B.root, box(1.6, 0.6, 0.06, rand() < 0.25 ? 0x1d2024 : 0x8fa4b0, { r: 0.01 }), x, H - 0.8, zf + out * 0.04);
    const span = w / (doors + 1);
    for (let k = 1; k <= doors; k++) {
      const x = x0 + span * k;
      const up = rand() < 0.3 ? 0.6 + rand() * 0.8 : 0;
      put(B.root, box(3.2, 3.2, 0.05, 0x1d1f22, { r: 0 }), x, 1.6, zf + out * 0.03);
      const door = put(B.root, box(3.0, 3.0 - up, 0.08, [0x5f6670, 0x6b5a48, 0x4f6b6a][(rand() * 3) | 0], { r: 0.02 }), x, 1.5 + up / 2 + 0.05, zf + out * 0.06);
      door.rotation.z = (rand() - 0.5) * 0.04;
      for (let y = up + 0.3; y < 3.0; y += 0.32) put(B.root, box(3.0, 0.04, 0.1, 0x3d434b), x, y, zf + out * 0.07);
      put(B.root, box(3.3, 0.18, 0.2, 0x3a3c3f), x, 3.25, zf + out * 0.1);
    }
    if (dock) {
      const dz = zf + out * 1.0;
      const d = put(B.root, box(w * 0.8, 1.1, 2, 0x8a8780, { r: 0.03 }), (x0 + x1) / 2, 0.55, dz);
      B.solid(d);
      B.block((x0 + x1) / 2, dz, w * 0.4, 1);
      for (let x = x0 + w * 0.15; x < x1 - w * 0.15; x += 2) B.piece(0.4, 0.3, 0.12, 0x1d1f22, x, 0.9, dz + out * 1.0);
      B.lump((x0 + x1) / 2, 1.12, dz, w * 0.3, 0.08, 0.7, 0xd6d9dd);
    }
    const bw = Math.min(w * 0.5, 8);
    const board = new THREE.Mesh(new THREE.PlaneGeometry(bw, 0.8), sign(bw, 0.8, { board: ['#3d4a58', '#58402e', '#3a4a3a'][(rand() * 3) | 0], ink: '#e6e0cc' }));
    board.position.set((x0 + x1) / 2, H - 0.05, zf + out * 0.09);
    if (out < 0) board.rotation.y = Math.PI;
    B.add(board);
    for (const x of [x0 + 0.3, x1 - 0.3]) put(B.root, cyl(0.07, H, 0x5a5e62, { seg: 6 }), x, H / 2, zf + out * 0.12);
  }
  function container(BB, x, y, z, yaw, color) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(6, 2.6, 2.45), new THREE.MeshToonMaterial({ map: ribs, color, gradientMap }));
    m.position.set(x, y + 1.3, z);
    m.rotation.set(0, yaw, 0);
    m.castShadow = m.receiveShadow = true;
    BB.add(m);
    BB.solid(m);
    BB.block(x, z, 3, 1.25, yaw);
    BB.lump(x, y + 2.62, z, 2.4, 0.1, 1.0, 0xd0d3d8, yaw);
    return m;
  }
  function jersey(BB, x, z, yaw = 0, h = 0.9, w = 1.6) {
    const j = put(BB.root, box(w, h, 0.7, 0x9a978f, { r: 0.06 }), x, (BB === B ? heightAt(x, z) : 0) + h / 2, z);
    j.rotation.y = yaw;
    BB.solid(j);
    BB.block(x, z, w / 2, 0.35, yaw);
    return j;
  }
  function rubble(BB, x, z, radius, height, { solid = false, slabs = 2 } = {}) {
    const y = BB === B ? heightAt(x, z) : 0;
    const n = Math.round(radius * radius * 6) + 8;
    for (let i = 0; i < n; i++) {
      const a = rand() * Math.PI * 2;
      const r = Math.sqrt(rand()) * radius;
      const k = 1 - r / radius;
      const s = 0.25 + rand() * 0.6;
      BB.piece(s * (1 + rand()), s * 0.7, s, CONCRETE[(rand() * 5) | 0], x + Math.cos(a) * r, y + k * height * (0.4 + rand() * 0.6), z + Math.sin(a) * r * 0.8, rand() * 3, rand() * 3, rand() * 3);
    }
    for (let i = 0; i < slabs; i++) {
      const m = BB.chunk(1.4 + rand() * 1.4, 0.16, 1 + rand() * 0.8, CONCRETE[(rand() * 5) | 0], x + (rand() - 0.5) * radius, y + height * 0.5, z + (rand() - 0.5) * radius * 0.6, (rand() - 0.5) * 1.2, rand() * 3, (rand() - 0.5) * 1.4);
      if (solid) BB.solid(m);
    }
    for (let i = 0; i < 2; i++) BB.lump(x + (rand() - 0.5) * radius, y + height * 0.7, z + (rand() - 0.5) * radius * 0.5, radius * 0.3, 0.1, radius * 0.25, 0xc9ccd1, rand() * 3);
    if (rand() < 0.6) BB.rebar(x, y + height * 0.5, z, 2 + ((rand() * 3) | 0));
    if (solid) {
      BB.hitBox(x, y + height * 0.4, z, radius * 1.4, height * 0.8, radius * 1.1);
      BB.block(x, z, radius * 0.8, radius * 0.65);
    }
  }

  // 1: the street. Behind the start: the checkpoint the tank's just come
  // out of, its doors down again behind it.
  const shackStart = buildShack(B, { x0: START_X - 9.6, x1: START_X - 2, z0: CURB.n + 0.1, z1: CURB.s - 0.1, fill: { n: WALK.n - 0.5, s: WALK.s + 1.2 }, heightAt });
  B.block(START_X - 2, -0.5, 0.4, 12);
  // the far (north) side: blocks and works, right up to the checkpoint
  building({ x0: -52, x1: START_X - 10, floors: 7, shop: true });
  building({ x0: START_X - 8, x1: -6, floors: 6, shop: true, sign: '#ffcf8a' });
  works({ x0: -4, x1: 16, zf: WALK.n, roof: 'saw', wall: 0x8a9a8e, doors: 3 });
  building({ x0: 18, x1: 40, floors: 6, holes: 2 });
  works({ x0: 42, x1: 60, zf: WALK.n, roof: 'flat', wall: BRICK, tin: false, doors: 2, dock: true });
  building({ x0: 62, x1: 82, floors: 5, shop: true });
  works({ x0: 84, x1: 100, zf: WALK.n, roof: 'gable', wall: 0x9a8f7a, doors: 2 });
  building({ x0: 107.6, x1: 124, floors: 6, mural: true });
  // the near (south) side: low blocks and sheds
  southBlock(-52, START_X - 10, 2);
  southBlock(START_X - 8, -6, 2);
  works({ x0: -4, x1: 14, zf: WALK.s + 0.3, side: 's', roof: 'gable', wall: 0x7d8a92, doors: 2 });
  southBlock(16, 34, 3);
  works({ x0: 36, x1: 56, zf: WALK.s + 0.3, side: 's', roof: 'saw', wall: 0xa38d6a, doors: 3 });
  southBlock(58, 76, 2);
  works({ x0: 78, x1: 100, zf: WALK.s + 0.3, side: 's', roof: 'flat', wall: 0x6f7f74, doors: 2, dock: true });
  southBlock(107.6, 124, 2);
  // cover in the street: wrecks, barriers, heaps, a stranded tram
  const wreck = (BB, x, z, yaw, o) => BB.crushable(() => P.car(BB, x, z, yaw, o), { kind: 'car', scrap: 2 });
  wreck(B, -4, -1, 0.35, { kind: 'sedan', paint: BURNT_PAINT[0] });
  wreck(B, 14, 3.8, 0.25, { kind: 'hatch', paint: BURNT_PAINT[1], flipped: true });
  wreck(B, 34, -4.5, -0.4, { kind: 'van', paint: 0x6b7458 });
  wreck(B, 58, 3, 0.5, { kind: 'sedan', paint: BURNT_PAINT[2] });
  wreck(B, 74, -3.5, 0.8, { kind: 'hatch', paint: BURNT_PAINT[3] });
  wreck(B, 92, 2.5, -0.3, { kind: 'sedan', paint: BURNT_PAINT[5] });
  P.tram(B, 46, -2.25, 0.03, { tilt: 0.04, burn: 0.7 });
  rubble(B, 24, -5.8, 1.6, 1.2, { slabs: 2 });
  rubble(B, 82, 5, 1.8, 1.3, { slabs: 2 });
  for (const [x, z, yaw] of [[8, -4, 0.3], [66, 1.5, 1.4], [67.8, 2.2, 1.3], [96, -4.5, 0.6]]) jersey(B, x, z, yaw);
  container(B, 62, SW, WALK.n + 1.7, 0.05, CONTAINERS[1]);
  const junk = (fn, scrap = 0) => B.crushable(fn, { kind: 'prop', scrap });
  junk(() => P.crates(B, 30, SW, WALK.n + 1.2), 2);
  junk(() => P.tires(B, 48, SW, CURB.s + 1, 4));
  junk(() => P.crates(B, 74, SW, CURB.s + 1.2), 2);
  junk(() => P.bin(B, 2, SW, WALK.n + 1.3, { tipped: true }), 1);
  junk(() => P.dumpster(B, 88, SW, WALK.s - 1.2, 0.1));
  junk(() => P.bench(B, 20, SW, WALK.s - 1, Math.PI, { tipped: true }));
  junk(() => P.cabinet(B, 114, SW, WALK.n + 0.8, 0));
  // street lamps
  for (let x = START_X + 4; x < RAMP.x0 - 2; x += 16) {
    if (x > SHACK_A.x0 - 3 && x < SHACK_A.x1 + 3) continue;
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

  // --------------------------------------------- beside and under the deck
  // the blocks go on either side of the ramp and the highway, set back
  // behind the street that runs underneath it
  {
    let x = RAMP.x0;
    let k = 0;
    while (x < MAP.x1 - 4) {
      const x1 = Math.min(MAP.x1, x + 16 + rand() * 14);
      if (k % 4 === 2) works({ x0: x, x1, zf: SIDE.n, roof: ['saw', 'flat', 'gable'][((k / 4) | 0) % 3], wall: [0x8a9a8e, BRICK, 0x9a8f7a][k % 3], tin: k % 3 !== 1, doors: 2 });
      else building({ x0: x, x1, zf: SIDE.n, floors: 6 + ((rand() * 4) | 0), shop: rand() < 0.4, holes: 1 + ((rand() * 2) | 0) });
      x = x1 + 2 + rand() * 2;
      k++;
    }
    x = RAMP.x0;
    k = 0;
    while (x < MAP.x1 - 4) {
      const x1 = Math.min(MAP.x1, x + 14 + rand() * 12);
      if (k % 3 === 1) works({ x0: x, x1, zf: SIDE.s, side: 's', roof: ['gable', 'saw', 'flat'][((k / 3) | 0) % 3], wall: [0x7d8a92, 0xa38d6a, 0x6f7f74][k % 3], doors: 2 });
      else southBlock(x, x1, 2 + ((rand() * 2) | 0), SIDE.s);
      x = x1 + 2 + rand() * 2;
      k++;
    }
    // down in the street under it: wrecks (seen past the deck's edge)
    for (let x2 = RAMP.x0 + 10; x2 < MAP.x1 - 10; x2 += 22 + rand() * 12) {
      const z = rand() < 0.5 ? SIDE.n + 3.2 : SIDE.s - 3.2;
      P.car(B, x2, z, rand() * 0.6 - 0.3, { kind: ['sedan', 'hatch', 'van'][(rand() * 3) | 0], paint: BURNT_PAINT[(rand() * 6) | 0], solidBlock: false });
    }
  }

  // ------------------------------------------------- the ramp and deck
  const sideMat = toon(0x8a8780);
  {
    const len = RAMP.x1 - RAMP.x0;
    const ang = Math.atan2(DECK, len);
    const L = Math.hypot(len, DECK);
    const top = new THREE.MeshToonMaterial({ map: deckTexture(rand, L), gradientMap });
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(L, 0.6, DECK_Z * 2), [sideMat, sideMat, top, sideMat, sideMat, sideMat]);
    ramp.position.set((RAMP.x0 + RAMP.x1) / 2, DECK / 2 - 0.3 * Math.cos(ang), DZ);
    ramp.rotation.z = ang;
    ramp.receiveShadow = ramp.castShadow = true;
    B.add(ramp);
    B.solid(ramp);
    // the embankment under it: a solid wedge of retaining wall down to the
    // street (nothing to see under)
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(len, 0);
    shape.lineTo(len, DECK - 0.55);
    shape.lineTo(0, -0.05);
    const wedge = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: DECK_Z * 2 - 0.1, bevelEnabled: false }), toon(0x8d8a83));
    wedge.position.set(RAMP.x0, 0, DZ - DECK_Z + 0.05);
    wedge.receiveShadow = true;
    B.add(wedge);
    // its parapet walls, sloping up with it, panel joints down them
    for (const s of [-1, 1]) {
      const z = DZ + s * (DECK_Z - 0.2);
      const wall = new THREE.Mesh(new THREE.BoxGeometry(L, 0.9, 0.35), toon(0x9a978f));
      wall.position.set((RAMP.x0 + RAMP.x1) / 2, DECK / 2 + 0.45, z);
      wall.rotation.z = ang;
      wall.castShadow = true;
      B.add(wall);
      B.solid(wall);
      for (let x = RAMP.x0 + 3; x < RAMP.x1; x += 3) B.piece(0.06, 0.92, 0.37, 0x86837c, x, heightAt(x, DZ) + 0.45, z, 0, 0, ang);
      for (let x = RAMP.x0; x < RAMP.x1; x += 2) B.block(x + 1, z, 1, 0.25);
      for (let x = RAMP.x0 + 1; x < RAMP.x1; x += 1.4) B.lump(x, heightAt(x, DZ) + 0.05, z - s * 0.4, 0.5 + rand() * 0.4, 0.12, 0.25, 0xc7cacf, rand() * 3);
    }
  }
  // the deck (built on D's raised root): the slab with its worn top, guard
  // rails, piers down to the street
  {
    const len = DECK_X1 - RAMP.x1;
    const cx = (RAMP.x1 + DECK_X1) / 2;
    const top = new THREE.MeshToonMaterial({ map: deckTexture(rand, len), gradientMap });
    const slabM = new THREE.Mesh(new THREE.BoxGeometry(len, 0.9, DECK_Z * 2), [sideMat, sideMat, top, toon(0x6a675f), sideMat, sideMat]);
    slabM.position.set(cx, -0.45, DZ);
    slabM.receiveShadow = slabM.castShadow = true;
    D.add(slabM);
    D.solid(slabM);
    for (const s of [-1, 1]) D.piece(len, 0.5, 0.2, 0x7a776f, cx, -0.7, DZ + s * (DECK_Z + 0.05)); // edge beams
    // guard rails: posts and a steel beam, a few bays bent or gone
    for (const s of [-1, 1]) {
      const z = DZ + s * (DECK_Z - 0.25);
      for (let x = RAMP.x1; x < DECK_X1; x += 2) {
        const bent = rand() < 0.06;
        D.piece(0.1, 0.8, 0.1, 0x6f7276, x, 0.4, z, bent ? s * 0.4 : 0, 0, 0);
        if (rand() > 0.05) D.piece(2.02, 0.28, 0.06, 0xa9adb2, x + 1, bent ? 0.45 : 0.62, z + (bent ? s * 0.15 : 0), 0, 0, bent ? 0.08 : 0);
      }
      D.block(cx, z, len / 2, 0.3);
    }
    // piers down to the street, crossheads under the slab
    for (let x = RAMP.x1 + 6; x < DECK_X1; x += 16) {
      for (const z of [DZ - 5, DZ + 5]) {
        const pier = put(B.root, box(1.3, DECK - 0.9, 1.3, 0x8a8780, { r: 0.04 }), x, (DECK - 0.9) / 2, z);
        pier.castShadow = true;
      }
      put(B.root, box(1.5, 0.8, DECK_Z * 2 - 1, 0x7d7a73, { r: 0.04 }), x, DECK - 1.3, DZ);
    }
    // the median: a low concrete wall in stretches, open round the
    // checkpoint and the last barricade
    for (const [x0, x1] of [[RAMP.x1 + 4, SHACK_B.x0 - 12], [SHACK_B.x1 + 12, BAR_X - 26]]) {
      for (let x = x0; x + 3 < x1; x += 12) {
        const l = Math.min(9, x1 - x);
        const m = put(D.root, box(l, 0.8, 0.5, 0x9a978f, { r: 0.04 }), x + l / 2, 0.4, DZ);
        D.solid(m);
        D.block(x + l / 2, DZ, l / 2, 0.25);
        D.lump(x + l / 2, 0.82, DZ, l / 2.4, 0.06, 0.2, 0xd0d3d8);
      }
    }
    // tram tracks along both carriageways
    const R = rails(D, rand);
    for (const z of TRACKS) R.track(R.straight(RAMP.x1 + 0.5, z, DECK_X1 - 1, z));
    // highway lamps on the guard rails, leaning out over the lanes
    for (let x = RAMP.x1 + 8; x < DECK_X1; x += 24) {
      if (x > SHACK_B.x0 - 3 && x < SHACK_B.x1 + 3) continue;
      for (const s of [-1, 1]) {
        const z = DZ + s * (DECK_Z - 0.1);
        put(D.root, cyl(0.1, 7, 0x8b8984, { seg: 8, radiusEnd: 0.14 }), x, 3.5, z);
        put(D.root, box(0.1, 0.1, 2.2, 0x4a4c50, { r: 0.02 }), x, 6.9, z - s * 1.05);
        put(D.root, box(0.5, 0.16, 0.7, 0x3c3e42, { r: 0.05 }), x, 6.85, z - s * 2.1);
        D.block(x, z, 0.2, 0.2);
      }
    }
  }
  // gantry signs over the highway, and one at the ramp's foot (no words)
  function gantry(BB, x, boards) {
    const y0 = BB === D ? 0 : heightAt(x, DZ);
    for (const z of [DZ - DECK_Z + 0.6, DZ + DECK_Z - 0.6]) {
      const post = put(BB.root, box(0.3, 6.2, 0.3, 0x6f7276, { r: 0.03 }), x, y0 + 3.1, z);
      post.castShadow = true;
      BB.block(x, z, 0.3, 0.3);
      put(BB.root, box(0.7, 0.3, 0.7, 0x8a8780, { r: 0.03 }), x, y0 + 0.15, z);
    }
    put(BB.root, box(0.4, 0.5, DECK_Z * 2 - 1, 0x5a5d61, { r: 0.03 }), x, y0 + 6.2, DZ);
    for (const [z, w, kind] of boards) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.8), new THREE.MeshToonMaterial({ map: roadSign(w, 1.8, rand, kind), gradientMap }));
      m.rotation.y = -Math.PI / 2; // faces back down the road, at the tank
      m.position.set(x - 0.25, y0 + 5.2, z);
      BB.add(m);
      const back = put(BB.root, box(0.08, 1.85, w + 0.05, 0x3a3c3f, { r: 0.01 }), x - 0.18, y0 + 5.2, z);
      back.castShadow = true;
    }
  }
  gantry(B, 116, [[DZ - 3.8, 5, 'ahead'], [DZ + 3.6, 5, 'exit']]);
  gantry(D, 196, [[DZ - 3.8, 5, 'ahead'], [DZ + 3.6, 5, 'exit']]);
  gantry(D, 272, [[DZ, 7, 'ahead']]);

  // ----------------------------------------------------- on the deck
  // wrecks, a stranded tram on the rails, a burnt-out bus, debris
  wreck(D, 180, 3.8, 0.3, { kind: 'sedan', paint: BURNT_PAINT[2], snow: false });
  wreck(D, 188, -6.4, -0.2, { kind: 'hatch', paint: BURNT_PAINT[0], snow: false, flipped: true });
  wreck(D, 207, -6, -0.4, { kind: 'van', paint: 0x6b7458, snow: false });
  wreck(D, 216, 5.4, 0.15, { kind: 'sedan', paint: BURNT_PAINT[5], snow: false });
  wreck(D, 248, 4.6, 0.6, { kind: 'hatch', paint: BURNT_PAINT[1], snow: false });
  wreck(D, 264, -1.6, -0.2, { kind: 'sedan', paint: BURNT_PAINT[3], snow: false });
  wreck(D, 284, 5.6, 0.9, { kind: 'van', paint: 0x7b7f78, snow: false });
  wreck(D, 292, -6, -0.7, { kind: 'sedan', paint: BURNT_PAINT[0], snow: false });
  P.tram(D, 254, TRACKS[0], 0.02, { tilt: 0.03, burn: 0.8, snow: false });
  D.crushable(() => P.bus(D, 199, 2.4, 0.12), { kind: 'prop', heavy: true, armored: true });
  rubble(D, 186, -2.4, 1.4, 1.0, { slabs: 2, solid: true });
  rubble(D, 240, -6.4, 1.6, 1.1, { slabs: 2, solid: true });
  rubble(D, 272, 5.4, 1.5, 1.0, { slabs: 2, solid: true });
  rubble(D, 288, -2.2, 1.2, 0.9, { slabs: 1, solid: true });
  for (const [x, z, yaw] of [[192, -1.5, 1.5], [244, 1, 1.6], [259, 6.2, 1.4], [279, -4.5, 1.55], [296, 2.6, 1.45]]) jersey(D, x, z, yaw, 1.0, 1.8);
  {
    // debris all over: concrete chunks, tyres, a fallen lamp, potholes, soot
    for (let i = 0; i < 320; i++) {
      const x = RAMP.x1 + 2 + rand() * (DECK_X1 - RAMP.x1 - 4);
      const z = DZ + (rand() - 0.5) * (DECK_Z * 2 - 1.6);
      if (x > SHACK_B.x0 - 2 && x < SHACK_B.x1 + 2) continue;
      const s = 0.08 + rand() * 0.25;
      D.piece(s * (1 + rand()), s * 0.6, s, rand() < 0.2 ? 0x2a2b2e : CONCRETE[(rand() * 5) | 0], x, s * 0.25, z, rand(), rand() * 3, rand());
    }
    for (const [x, z, r] of [[184, 0.8, 0.9], [212, -2.4, 1.1], [238, 3.2, 0.8], [268, -5, 1.0], [280, 1.4, 1.2]]) {
      D.pool(x, z, r, 0x2a2b2f, 0.85, { sx: 1, sz: 0.8, y: 0.02 });
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + rand() * 0.4;
        D.piece(0.35 + rand() * 0.3, 0.1, 0.3, 0x4c4d52, x + Math.cos(a) * r, 0.06, z + Math.sin(a) * r * 0.8, Math.sin(a) * 0.5, -a, Math.cos(a) * 0.5);
      }
    }
    for (const [x, z] of [[197, 6.6], [246, -7], [276, 6.6]]) D.crushable(() => P.tires(D, x, 0, z, 3), { kind: 'prop' });
    D.crushable(() => P.crates(D, 222, 0, -7.2), { kind: 'prop', scrap: 2 });
    P.fallenPole(D, 252, 6.8, 2.6);
    for (const [x, z, r] of [[194, -4, 2], [216, 1, 1.6], [268, 3, 2.2]]) P.scorch(D, x, z, r);
  }

  // the last barricade: wrecks, jersey blocks and planks nailed across the
  // deck in three sections. It holds while anything's left in front of it;
  // then a shell or a ram bursts each section.
  const barricade = [];
  for (const [z0, z1] of [[DZ - DECK_Z + 0.5, DZ - 2.8], [DZ - 2.8, DZ + 2.8], [DZ + 2.8, DZ + DECK_Z - 0.5]]) {
    const zc = (z0 + z1) / 2;
    const len = z1 - z0;
    const x = BAR_X;
    D.crushable(
      () => {
        P.car(D, x, zc, Math.PI / 2 + (rand() - 0.5) * 0.3, { kind: rand() < 0.5 ? 'sedan' : 'hatch', paint: BURNT_PAINT[(rand() * 6) | 0], solidBlock: false, snow: false });
        const top = P.car(D, x + 0.2, zc + 0.3, Math.PI / 2 + 0.4, { kind: 'hatch', paint: BURNT_PAINT[(rand() * 6) | 0], solidBlock: false, flipped: true, snow: false });
        top.position.y = 1.0;
        top.rotation.z = 0.2;
        for (const s of [-1, 1]) {
          const j = put(D.root, box(0.7, 0.9, 1.6, 0x9a978f), x + s * 1.1, 0.45, zc + s * 1.2);
          j.rotation.y = s * 0.4;
        }
        for (const [h, tilt] of [[0.6, 0.18], [1.2, -0.14], [1.75, 0.1]]) {
          const p = put(D.root, box(0.08, 0.22, len - 0.5, [0x7a5f3e, 0x6b5640, 0x84694a][(rand() * 3) | 0]), x - 1.0, h, zc);
          p.rotation.x = tilt;
        }
        for (const zz of [z0 + 0.5, z1 - 0.5]) put(D.root, box(0.12, 2.2, 0.16, 0x5c472e), x - 0.95, 1.1, zz);
        for (let i = 0; i < 6; i++) D.piece(0.3 + rand() * 0.5, 0.2, 0.3, CONCRETE[i % 5], x + (rand() - 0.5) * 2.4, 0.1, zc + (rand() - 0.5) * len, rand(), rand() * 3, rand());
        put(D.root, box(0.12, 0.3, len - 0.4, 0xc99a2e), x - 1.06, 0.95, zc); // hazard board
        D.hitBox(x, 1.1, zc, 2.2, 2.2, len);
        D.block(x, zc, 1.0, len / 2);
      },
      { kind: 'prop', heavy: true, breakable: true, armored: true, scrap: 3 },
    );
    barricade.push(D.crushables[D.crushables.length - 1]);
  }

  // the checkpoints: one across the street, one up on the deck
  const shackA = buildShack(B, { x0: SHACK_A.x0, x1: SHACK_A.x1, z0: CURB.n + 0.1, z1: CURB.s - 0.1, fill: { n: WALK.n - 0.5, s: WALK.s + 1.2 }, heightAt });
  const shackB = buildShack(D, { x0: SHACK_B.x0, x1: SHACK_B.x1, z0: DZ - DECK_Z + 0.6, z1: DZ + DECK_Z - 0.6, fill: { n: DZ - DECK_Z + 0.6, s: DZ + DECK_Z - 0.6 }, heightAt: () => 0 });

  B.finish();
  B.mergeStatic();
  D.finish();
  D.mergeStatic();

  const room = buildDepotRoom(scene);
  const blocks = [...B.blocks, ...D.blocks, ...room.blocks];
  const colliders = [...B.colliders, ...D.colliders, ...room.colliders];
  const emitters = [...B.emitters, ...D.emitters, ...room.emitters];
  const crushables = [...B.crushables, ...D.crushables];
  // (the doors drop and add their blocks in the shared list)
  room.bindBlocks(blocks);
  for (const k of [shackStart, shackA, shackB]) k.bindBlocks(blocks);

  // ---------------------------------------------------- the level script
  const SECTORS = ['The street', 'The ramp', 'The highway'];
  const B1 = { minX: START_X + 2, maxX: shackA.x0 - 0.8, minZ: WALK.n + 0.4, maxZ: WALK.s - 0.4 };
  const B2 = { minX: shackA.x1 + 1.2, maxX: shackB.x0 - 0.8, minZ: DZ - DECK_Z + 0.5, maxZ: DZ + DECK_Z - 0.5 };
  const B3 = { minX: shackB.x1 + 1.2, maxX: END_X + 4, minZ: DZ - DECK_Z + 0.5, maxZ: DZ + DECK_Z - 0.5 };
  const S = { sector: 0, step: 0, t: 0, wave: 0 };
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
  };
  // the parts this level can turn up
  const PARTS3 = ['he', 'era', 'afterburner']; // (its own parts only: campaign.js rewards)
  // machines coming in: on the deck ahead; drones over the roofs either side
  // (always ahead of the tank, however far it's got: never behind it)
  const ahead = (api, x) => Math.min(Math.max(x, api.tankPos.x + 14), Math.max(x, Math.min(bounds.maxX, BAR_X) - 2)); // (but not past the end of the area)
  const deckDog = (api, x, z, delay = 0) => api.spawnDog(ahead(api, x), z, { delay });
  const sideDrone = (api, x, s, delay = 0) => {
    const ax = ahead(api, x);
    api.spawnDrone(ax, DZ + s * 20, { delay, via: [[ax - 2, DZ + s * 4]] });
  };

  function start(api) {
    Object.assign(S, { sector: 0, step: 0, t: 0, wave: 0 });
    setBounds(api, B1);
    api.enableGun();
    api.revealScraps(false);
    api.giveRockets();
    if (api.tank.ability) api.giveAbility();
    api.sectors(SECTORS, 0, 'Level 3');
    api.objective('Get onto the highway');
  }

  // 1: the street
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
          api.spawnWalker(58, -4);
          api.spawnDog(52, 4, { delay: 0.6 });
          api.spawnDog(54, -6, { delay: 1 });
          go(2);
        }
        break;
      case 2:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          // the first drones, in over the roofs
          sideDrone(api, Math.max(x + 14, 60), -1);
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
          for (const [dz, d] of [[-3, 0], [2, 0.5], [0, 1]]) deckDog(api, RAMP.x1 + 4, DZ + dz, d);
          contact(api, 'Coming down the ramp!');
          go(1);
        }
        break;
      case 1:
        if (api.enemiesAlive <= 1 && S.t > 3) {
          api.spawnWalker(ahead(api, 198), -3.6);
          sideDrone(api, 186, 1);
          deckDog(api, 206, 4, 1.2);
          go(2);
        }
        break;
      case 2:
        if (api.enemiesAlive <= 1 && S.t > 3) {
          deckDog(api, 220, -5);
          deckDog(api, 220, 4, 0.4);
          api.spawnWalker(ahead(api, 221), 0, { delay: 0.8 });
          sideDrone(api, 212, -1, 1.2);
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

  // 3: along the highway to the last barricade, and everything in front of it
  function startSector3(api) {
    S.sector = 2;
    go(0);
    setBounds(api, B3);
    api.sectors(SECTORS, 2, 'Level 3');
    api.objective('Reach the barricade');
  }
  function sector3(api) {
    const x = api.tankPos.x;
    switch (S.step) {
      case 0:
        if (S.t > 1.5) {
          deckDog(api, 260, -3);
          deckDog(api, 262, 3, 0.4);
          sideDrone(api, 254, 1, 0.8);
          go(1);
        }
        break;
      case 1:
        if (x > 250) {
          // the last stand: everything they've got, between the tank and
          // the barricade, in three waves
          api.prompt('Barricade', 'Clear the enemies ahead of the barricade!', { danger: true, seconds: 5 });
          api.objective('Clear the highway');
          for (const [dx, z, d] of [[0, -5, 0], [1, 4, 0.3], [2, -1, 0.6], [3, 6, 0.9]]) deckDog(api, 290 + dx, DZ + z, d);
          api.spawnWalker(296, DZ - 4, { delay: 0.5 });
          api.spawnWalker(296, DZ + 4, { delay: 1.1 });
          sideDrone(api, 282, -1, 0.8);
          S.wave = 1;
          go(2);
        }
        break;
      case 2:
        if (S.wave === 1 && x > 268) {
          for (const [dx, z, d] of [[0, -3, 0], [2, 3, 0.4], [4, 0, 0.8]]) deckDog(api, 292 + dx, DZ + z, d);
          api.spawnWalker(298, DZ, { delay: 0.6 });
          sideDrone(api, 286, -1, 0.4);
          S.wave = 2;
          S.t = 0;
        } else if (S.wave === 2 && x > 282) {
          for (const [dx, z, d] of [[0, -5, 0], [1, 5, 0.3], [2, -2, 0.6], [3, 2, 0.9], [4, 0, 1.2]]) deckDog(api, 290 + dx, DZ + z, d);
          api.spawnWalker(297, DZ - 5, { delay: 0.4 });
          api.spawnWalker(297, DZ + 5, { delay: 0.9 });
          sideDrone(api, 284, 1, 0.5);
          S.wave = 3;
          S.t = 0;
        } else if (S.wave === 3 && api.enemiesAlive === 0 && S.t > 2) {
          for (const c of barricade) c.armored = false;
          api.prompt('Barricade', '<b>Break through the barricade!</b>', { go: true, seconds: 5 });
          api.objective('Break through');
          api.arrow(new THREE.Vector3(BAR_X, DECK + 2.2, DZ), 'Break it!');
          go(3);
        }
        break;
      case 3:
        if (barricade.some((c) => c.done) || x > BAR_X + 1) {
          api.arrow(new THREE.Vector3(END_X + 2, DECK + 0.6, DZ), 'Exit');
          setBounds(api, { maxX: DECK_X1 - 6 });
          go(4);
        }
        break;
      case 4:
        if (x > END_X) {
          api.arrow(null);
          api.sectors(SECTORS, 3, 'Level 3');
          api.win('Level clear', { path: [[END_X + 6, DZ - 2], [END_X + 18, DZ - 2]] });
          go(5);
        }
        break;
    }
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
      for (const c of barricade) c.armored = false;
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
    for (const k of [shackStart, shackA, shackB]) k.update(dt, t);
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
  };
}
