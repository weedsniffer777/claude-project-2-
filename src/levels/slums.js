// Level 7: the slums, outside the wall, on a hazy smoky late morning. No
// boss: three stretches of shanty town, machines all through it, and a few
// artillery drones squatting among the shacks.
//
// Layout (world +X runs bottom-left to top-right on screen):
//  1 The shanty road: a rutted dirt road, mud and puddles, between shacks
//    of patched corrugated sheet in every colour of rust and old paint,
//    two storeys on the far side, low on the near side; wooden poles with
//    a tangle of wires everywhere, drop lines to the shacks, transformers;
//    trash heaped in every gap, fires in barrels, generators, water tanks
//    on stilts, washing on lines, tarps. A checkpoint across the road.
//  2 The market: the road opens into a market square of stalls under
//    tarps, strung bulbs; across it an old railway, bombed out: rails in
//    the dirt, a broken crossing barrier, a shell-holed signal box.
//    Artillery drones among the shacks beyond. A checkpoint.
//  3 The dump: out past the last shacks into the edge of a rubbish dump:
//    hills of trash, stacked wrecks, a rusty crane; the road out on the far
//    side. Clear it and drive on.
import * as THREE from 'three';
import { addHaze } from '../render/setup.js';
import { box, cyl, put, gradientMap, setLowPoly, glowMat } from '../models/kit.js';
import { LevelBuilder, canvas, tex, blob, speckle } from './builder.js';
import * as P from './props.js';
import { buildShack } from './depot.js';
import { buildDepotRoom } from './depotRoom.js';
import { rails } from './rails.js';
import { glyphSign, mapMat } from './cityTextures.js';
import { cityKit, BURNT_PAINT } from './cityKit.js';
import { streetKit } from './streetKit.js';

const GPX = 6;
const MAP = { x0: -60, x1: 440, z0: -50, z1: 46 };
const START_X = -30;
const ROAD = { n: -6, s: 5.5 }; // the dirt road's edges
const FRONT = { n: -7.6, s: 7.2 }; // where the shacks' fronts stand
const SHACK_A = { x0: 92, x1: 99.6 };
const MARKET = { x0: 112, x1: 168, n: -18, s: 15 }; // the square
const RAIL_X = 150; // the old railway across it
const BED = { h: 0.3, top: 1.3, base: 2.1 }; // its gravel embankment
// the ground's height: flat, but for the railway's bed
const railH = (x) => {
  const d = Math.abs(x - RAIL_X);
  return d < BED.top ? BED.h : d < BED.base ? (BED.h * (BED.base - d)) / (BED.base - BED.top) : 0;
};
const SHACK_B = { x0: 196, x1: 203.6 };
const DUMP_X = 214; // where the shacks end and the dump starts
const END_X = 300;

// rust and old paint: the sheets the shacks are patched together from
// mostly old galvanised grey and rust; now and then a sheet with paint left on it
const DULL = [0x6a6e72, 0x7a7d80, 0x5a5e62, 0x84888c, 0x6f6a64, 0x7a4a36, 0x8a5a3a, 0x6b4a38, 0x7e6250, 0x5e534a];
const PAINTED = [0x4f6b7a, 0x9a3a2e, 0x5a7a5e, 0x3a5a8a, 0xa8823a];
const ROOFS = [0x6a6e72, 0x5a5e62, 0x7a5a42, 0x6b4a38, 0x74777a];
const TARP = [0x2f6fb0, 0xd0702a, 0x3f8a5a, 0xb03a3a, 0xc9b03a];
const inMarket = (x) => x > MARKET.x0 && x < MARKET.x1;
const heightAt = () => 0;

// The ground: dirt and mud everywhere; the road rutted and puddled down
// its middle; trodden paths; litter ground in; the market square packed
// earth; the dump grey-brown with trash trodden into it.
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
  rect(MAP.x0, MAP.z0, MAP.x1, MAP.z1, '#6e5f4c');
  speckle(g, W, H, ['#655744', '#77684f', '#5e5040', '#827257', '#4f4436'], W * H * 0.08, rand);
  // old snow, dirty, drifted in the lee of things: along the shack fronts
  // and fences mostly, a few out in the open; never in the road's ruts.
  // Each drift a wobbly run of overlapping blobs, fat in the middle,
  // tapering off, patchy, grimed, with a few bright crusts; flecks round it
  const drift = (x, z, len, depth) => {
    const n = 5 + ((len * 2) | 0);
    const wob = rand() * 6;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      const fat = Math.sin(Math.PI * u) * (0.6 + rand() * 0.5);
      const px = x + (u - 0.5) * len;
      const pz = z + Math.sin(u * 3 + wob) * depth * 0.35;
      g.globalAlpha = 0.55 + rand() * 0.4;
      g.fillStyle = rand() < 0.6 ? '#b9b7af' : '#a29d91';
      blob(g, X(px), Z(pz), (0.4 + fat * 0.9) * GPX, (0.2 + fat * depth * 0.5) * GPX, rand, 7);
    }
    g.globalAlpha = 1;
    for (let i = 0; i < len * 6; i++) {
      const px = x + (rand() - 0.5) * len;
      const pz = z + (rand() - 0.5) * depth * 0.7;
      g.fillStyle = rand() < 0.7 ? '#6e665a' : '#e2e0d8'; // grime; bright crust
      g.fillRect(X(px), Z(pz), 1 + ((rand() * 2) | 0), 1);
    }
    for (let i = 0; i < len * 4; i++) {
      g.fillStyle = rand() < 0.5 ? '#c4c2ba' : '#a8a397';
      g.fillRect(X(x + (rand() - 0.5) * len * 1.6), Z(z + (rand() - 0.5) * depth * 2.2), 1 + ((rand() * 2) | 0), 1 + ((rand() * 2) | 0));
    }
  };
  for (let i = 0; i < 110; i++) {
    const x = MAP.x0 + rand() * (MAP.x1 - MAP.x0);
    const r = rand();
    // in the lee of the fronts (either side), else somewhere off the road
    let z = r < 0.4 ? FRONT.n - 0.2 - rand() * 0.8 : r < 0.75 ? FRONT.s + 0.2 + rand() * 0.8 : 0;
    if (r >= 0.75) {
      z = MAP.z0 + rand() * (MAP.z1 - MAP.z0);
      if (z > ROAD.n - 0.5 && z < ROAD.s + 0.5) continue;
    }
    drift(x, z, 1.2 + rand() * rand() * 7, 0.5 + rand() * 1.2);
  }
  // and a little crusted along the road's edges, broken up by the wheels
  for (let x = MAP.x0; x < MAP.x1; x += 2 + rand() * 6) if (rand() < 0.4) drift(x, rand() < 0.5 ? ROAD.n - 0.1 : ROAD.s + 0.1, 0.8 + rand() * 2.5, 0.35);
  // the market: packed earth, lighter, worn paths across it
  rect(MARKET.x0, MARKET.n, MARKET.x1, MARKET.s, '#7a6a52');
  speckle(g, X(MARKET.x1) - X(MARKET.x0), Z(MARKET.s) - Z(MARKET.n), ['#6f604a', '#85745a', '#6a5b46'], (X(MARKET.x1) - X(MARKET.x0)) * (Z(MARKET.s) - Z(MARKET.n)) * 0.08, rand, Z(MARKET.n), X(MARKET.x0));
  // the old railway's bed: grey gravel, a band across everything
  rect(RAIL_X - 1.9, MAP.z0, RAIL_X + 1.9, MAP.z1, '#7f7d78');
  for (let i = 0; i < 4200; i++) {
    g.fillStyle = ['#8f8d88', '#6c6a66', '#9a978f', '#5e5c58'][(rand() * 4) | 0];
    const z = MAP.z0 + rand() * (MAP.z1 - MAP.z0);
    const hw = 1.9 - Math.abs(Math.sin(z * 1.7)) * 0.3;
    g.fillRect(X(RAIL_X - hw + rand() * hw * 2), Z(z), 1 + ((rand() * 2) | 0), 1 + ((rand() * 2) | 0));
  }
  // the road: darker wet mud, ruts down it (tyre and track), puddles
  rect(MAP.x0, ROAD.n, DUMP_X, ROAD.s, '#5a4c3c');
  speckle(g, X(DUMP_X) - X(MAP.x0), Z(ROAD.s) - Z(ROAD.n), ['#4e4234', '#62533f', '#544636'], (X(DUMP_X) - X(MAP.x0)) * (Z(ROAD.s) - Z(ROAD.n)) * 0.1, rand, Z(ROAD.n), X(MAP.x0));
  for (const z0 of [-3.4, -1.6, 0.8, 2.6]) {
    g.fillStyle = 'rgba(40,32,24,0.55)';
    for (let x = MAP.x0; x < MAP.x1; x += 0.5) g.fillRect(X(x), Z(z0 + Math.sin(x / 11 + z0) * 0.5), 0.5 * GPX, 0.35 * GPX);
    g.fillStyle = 'rgba(120,104,84,0.35)';
    for (let x = MAP.x0; x < MAP.x1; x += 0.5) g.fillRect(X(x), Z(z0 + 0.35 + Math.sin(x / 11 + z0) * 0.5), 0.5 * GPX, 1);
  }
  for (let i = 0; i < 120; i++) {
    const x = MAP.x0 + rand() * (MAP.x1 - MAP.x0);
    const z = ROAD.n + 1 + rand() * (ROAD.s - ROAD.n - 2);
    g.fillStyle = '#4a4036';
    blob(g, X(x), Z(z), (0.8 + rand() * 1.6) * GPX, (0.5 + rand() * 0.9) * GPX, rand, 10);
    g.fillStyle = rand() < 0.5 ? '#7e8a96' : '#6b7682'; // standing water: the sky in it
    blob(g, X(x) + 1, Z(z) + 1, (0.6 + rand() * 1.2) * GPX, (0.35 + rand() * 0.6) * GPX, rand, 10);
  }
  // the dump: grey-brown, trash ground in
  rect(DUMP_X, MAP.z0, MAP.x1, MAP.z1, '#5f584c');
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = ['#8a8f96', '#3a5a8a', '#b03a3a', '#d0d3c8', '#2a2b2d', '#7a8a5a', '#c9b03a'][(rand() * 7) | 0];
    g.fillRect(X(DUMP_X + rand() * (MAP.x1 - DUMP_X)), Z(MAP.z0 + rand() * (MAP.z1 - MAP.z0)), 1 + ((rand() * 2) | 0), 1);
  }
  // the track on out across the dump
  rect(DUMP_X, -3.2, MAP.x1, 3.2, '#56503f');
  for (let i = 0; i < 1600; i++) {
    g.fillStyle = ['#4a4436', '#625a48', '#6c6a66'][(rand() * 3) | 0];
    g.fillRect(X(DUMP_X + rand() * (MAP.x1 - DUMP_X)), Z(-3.2 + rand() * 6.4), 2, 1);
  }
  // litter everywhere: scraps of paper, plastic, cans
  for (let i = 0; i < 5000; i++) {
    g.fillStyle = ['#d0d3c8', '#8a8f96', '#3a5a8a', '#b03a3a', '#e0d8b0'][(rand() * 5) | 0];
    g.fillRect((rand() * W) | 0, (rand() * H) | 0, 1, 1);
  }
  return tex(c);
}

export const slums = {
  id: 'slums',
  name: 'Level 7 · Slums',
  build(scene) {
    setLowPoly(true);
    try {
      return buildSlums(scene);
    } finally {
      setLowPoly(false);
    }
  },
};

function buildSlums(scene) {
  const B = new LevelBuilder(scene, 7071);
  const rand = B.rand;
  const light = addHaze(scene, { shadowSize: 22, shadowMap: 2048 });
  const K = cityKit(B, { WALK: { n: FRONT.n, s: FRONT.s }, SW: 0, heightAt });
  const sign = (w, h, o = {}) => mapMat(glyphSign(w, h, { rand, ...o }));
  const ST = streetKit(B, { CURB: { n: ROAD.n, s: ROAD.s }, WALK: { n: FRONT.n, s: FRONT.s }, SW: 0, heightAt, sign });
  const junk = (fn, scrap = 0) => B.crushable(fn, { kind: 'prop', scrap });
  const pick = (a) => a[(rand() * a.length) | 0];

  // ------------------------------------------------------------ ground
  {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(MAP.x1 - MAP.x0, MAP.z1 - MAP.z0), new THREE.MeshToonMaterial({ map: groundTexture(rand), gradientMap }));
    m.rotation.x = -Math.PI / 2;
    m.position.set((MAP.x0 + MAP.x1) / 2, 0, (MAP.z0 + MAP.z1) / 2);
    m.receiveShadow = true;
    B.add(m);
    B.solid(m);
  }
  // the road's relief: ridges of mud along the ruts, clods, stones, the
  // odd plank laid over the worst of it
  for (let x = START_X - 4; x < DUMP_X; x += 0.7) {
    for (const z0 of [-3.4, -1.6, 0.8, 2.6]) {
      if (rand() < 0.35) continue;
      const z = z0 + Math.sin(x / 11 + z0) * 0.5 + (rand() < 0.5 ? -0.25 : 0.55);
      B.lump(x, 0.02, z, 0.4 + rand() * 0.3, 0.05 + rand() * 0.05, 0.12 + rand() * 0.08, pick([0x4e4234, 0x5a4c3c, 0x655744]), rand() * 0.4);
    }
  }
  for (let i = 0; i < 700; i++) {
    const x = START_X - 4 + rand() * (END_X - START_X);
    const z = (rand() - 0.5) * 30;
    const s = 0.06 + rand() * 0.16;
    B.piece(s * (1 + rand()), s * 0.6, s, pick([0x6a6458, 0x7a7266, 0x4a4036, 0x8a8f96, 0x3a5a8a, 0xb03a3a]), x, s * 0.25, z, rand(), rand() * 3, rand());
  }
  for (const x of [8, 46, 132, 178]) for (let k = 0; k < 4; k++) B.piece(0.3, 0.06, 3.2, pick([0x7a5f3e, 0x6b5640, 0x84694a]), x + k * 0.34, 0.03, -0.5 + (rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.1, 0);

  // ------------------------------------------------------------ shacks
  const sheet = () => (rand() < 0.12 ? pick(PAINTED) : pick(DULL));
  const roofCol = () => (rand() < 0.08 ? pick(PAINTED) : pick(ROOFS));
  const tin = (w, h, d, x, y, z, col = sheet()) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), K.ribMat(Math.max(w, d), h, col));
    m.position.set(x, y, z);
    m.castShadow = m.receiveShadow = true;
    B.add(m);
    return m;
  };
  // a sloping tin roof over w x d, its low edge to the back (or front)
  const tinRoof = (cx, cz, w, d, y, tilt) => {
    const r = tin(w, 0.06, d, cx, y, cz, roofCol());
    r.rotation.x = tilt;
    return r;
  };
  // rocks and tyres holding a roof down; a tarp patch
  const roofJunk = (x0, w, zc, depth, y, tilt) => {
    if (rand() < 0.45) put(B.root, box(1 + rand() * 1.5, 0.04, 1 + rand(), pick(TARP)), x0 + w / 2 + (rand() - 0.5) * w * 0.4, y + 0.06, zc).rotation.x = tilt;
    for (let k = 0; k < 1 + rand() * 3; k++) {
      const tx = x0 + 0.3 + rand() * (w - 0.6);
      const tz = zc + (rand() - 0.5) * depth * 0.6;
      if (rand() < 0.5) put(B.root, cyl(0.28, 0.14, 0x1d1e20, { seg: 8 }), tx, y + 0.12, tz);
      else B.piece(0.3, 0.2, 0.3, 0x6a6458, tx, y + 0.1, tz, rand(), rand() * 3, 0);
    }
  };
  // a door gap and a window on a front at zf
  const front = (x0, w, zf, face, h) => {
    const dx = x0 + 0.5 + rand() * Math.max(0.1, w - 1.6);
    put(B.root, box(0.9, Math.min(1.8, h - 0.3), 0.04, 0x141312), dx + 0.45, Math.min(1.8, h - 0.3) / 2, zf + face * 0.01);
    if (rand() < 0.55) put(B.root, box(0.8, 1.5, 0.03, rand() < 0.5 ? pick(TARP) : 0x8a8172), dx + 0.5, 1.05, zf + face * 0.04).rotation.z = (rand() - 0.5) * 0.15;
    if (w > 2.8 && rand() < 0.75) {
      const wx = dx + 1.6 > x0 + w - 0.5 ? x0 + 0.7 : dx + 1.7;
      put(B.root, box(0.7, 0.55, 0.04, rand() < 0.2 ? 0xffd28a : 0x1a1918, rand() < 0.2 ? { glow: true } : {}), wx, 1.55, zf + face * 0.02);
      if (rand() < 0.5) put(B.root, box(0.8, 0.06, 0.08, 0x5a4636), wx, 1.25, zf + face * 0.05);
      else for (const d of [-0.2, 0.2]) put(B.root, box(0.04, 0.6, 0.05, 0x3a3634), wx + d, 1.55, zf + face * 0.05); // bars
    }
  };
  const stuff = (x0, w, zf, face) => {
    if (rand() < 0.6) B.piece(0.5, 0.4, 0.4, rand() < 0.3 ? pick(TARP) : 0x7a5f3e, x0 + rand() * w, 0.2, zf + face * 0.4, 0, rand(), 0);
    if (rand() < 0.4) put(B.root, cyl(0.16, 0.3, pick([0x2f6fb0, 0xd0702a, 0x8a8f96, 0x5a5e62]), { seg: 8 }), x0 + rand() * w, 0.15, zf + face * 0.5);
    if (rand() < 0.25) for (let k = 0; k < 3; k++) B.lump(x0 + rand() * w, 0.15, zf + face * (0.4 + rand() * 0.4), 0.25, 0.2, 0.22, pick([0x1d1e20, 0x2a2b2d, 0x2f4f7a]), rand() * 3);
  };

  // One shack. kinds: 'tin' patched corrugated sheet; 'block' grey breeze
  // block, tin roof; 'ply' plank and plywood; 'container' a shipping box
  // with a door cut in; 'leanto' open-fronted under a sloping roof on
  // posts, stuff stored in it; 'nook' a tarp strung over a little yard
  // with a fire, chairs, crates.
  // face = +1: the front is on its +z side; -1: on its -z side.
  function shack(x0, x1, zf, face, { kind = 'tin', h = 2.3 + rand() * 0.7, depth = 4 + rand() * 2.5, upper = false } = {}) {
    const w = x1 - x0;
    const zc = zf - (face * depth) / 2;
    const cx = (x0 + x1) / 2;
    if (kind === 'nook') {
      const tz = zf - face * 1.4;
      const tw = w - 0.4;
      for (const dx of [-tw / 2, tw / 2]) put(B.root, box(0.08, 2.3, 0.08, 0x6b5640), cx + dx, 1.15, zf - face * 0.1);
      const t = put(B.root, box(tw, 0.03, 2.8, pick(TARP)), cx, 2.15, tz);
      t.rotation.x = -face * 0.18;
      t.rotation.z = (rand() - 0.5) * 0.1;
      tin(w, 2.2, 0.08, cx, 1.1, zf - face * 2.9); // the back wall
      if (rand() < 0.5) ST.barrelFire(cx + (rand() - 0.5) * (w - 1.5), zf - face * 1.6);
      else trashBit(cx, zf - face * 1.8);
      for (let k = 0; k < 2; k++) put(B.root, box(0.4, 0.45, 0.4, pick([0xb03a3a, 0x2f6fb0, 0xd8d6d0, 0x3f8a5a])), cx + (k ? 1 : -1) * (0.6 + rand() * 0.4), 0.22, zf - face * (0.8 + rand()));
      B.block(cx, zf - face * 2.9, w / 2, 0.15);
      return;
    }
    const H = kind === 'leanto' ? 2.4 : h;
    if (kind === 'tin') {
      const panels = Math.max(1, Math.round(w / 1.8));
      for (let k = 0; k < panels; k++) {
        const pw = w / panels;
        const ph = H - rand() * 0.2;
        tin(pw + 0.02, ph, depth, x0 + pw * (k + 0.5), ph / 2, zc);
      }
      // a patch or two nailed over the joins
      for (let k = 0; k < rand() * 3; k++) tin(0.8 + rand() * 0.8, 0.6 + rand() * 0.8, 0.03, x0 + 0.5 + rand() * (w - 1), 0.6 + rand() * (H - 1.2), zf + face * 0.03, sheet());
    } else if (kind === 'block') {
      const m = put(B.root, box(w, H, depth, pick([0x8d8b86, 0x7d7c78, 0x9a978f, 0x85898c]), { r: 0.02 }), cx, H / 2, zc);
      m.castShadow = true;
      // rows of blocks: lines scored across, a few patched darker
      for (let y = 0.4; y < H; y += 0.4) put(B.root, box(w + 0.01, 0.02, 0.02, 0x5f5e5a), cx, y, zf + face * 0.005);
      for (let k = 0; k < 3; k++) put(B.root, box(0.8, 0.4, 0.02, 0x6f6e6b), x0 + 0.4 + rand() * (w - 0.8), 0.2 + ((rand() * H * 2.5) | 0) * 0.4, zf + face * 0.01);
    } else if (kind === 'ply') {
      put(B.root, box(w, H, depth, 0x8a6e4e, { r: 0.02 }), cx, H / 2, zc).castShadow = true;
      for (let x = x0 + 0.15; x < x1; x += 0.3) put(B.root, box(0.26, H - rand() * 0.3, 0.03, pick([0x7a5f3e, 0x6b5640, 0x84694a, 0x8a7a5a, 0x5e4a36])), x + 0.13, (H - 0.15) / 2, zf + face * 0.02);
      if (rand() < 0.5) put(B.root, box(1.2, 1.2, 0.03, 0xa89a7a), x0 + 0.8 + rand() * (w - 1.6), 1.2, zf + face * 0.04); // a plywood sheet
    } else if (kind === 'container') {
      const c = pick([0x7a4a36, 0x4f6b6a, 0x6b6f72, 0x8a6a3a, 0x3f5470]);
      tin(w, 2.5, depth, cx, 1.25, zc, c);
      put(B.root, box(w + 0.05, 0.1, depth + 0.05, 0x3a3634), cx, 2.5, zc);
    } else if (kind === 'leanto') {
      // the back wall only, the roof sloping out over the front on posts
      tin(w, H, 0.08, cx, H / 2, zf - face * depth);
      for (const dx of [0.1, w - 0.1]) put(B.root, box(0.1, H * 0.85, 0.1, 0x5e4a36), x0 + dx, (H * 0.85) / 2, zf - face * 0.2);
      for (let k = 0; k < 3 + rand() * 3; k++) B.piece(0.5 + rand() * 0.4, 0.4 + rand() * 0.5, 0.5, pick([0x7a5f3e, 0x6a6458, 0x5a5e62, 0x2f4f7a, 0x8a6a3a]), x0 + 0.4 + rand() * (w - 0.8), 0.3, zf - face * (0.8 + rand() * (depth - 1.5)), 0, rand(), 0);
      if (rand() < 0.4) put(B.root, cyl(0.3, 0.9, 0x3a5a8a, { seg: 10 }), x0 + 0.5, 0.45, zf - face * (depth - 0.6));
    }
    if (kind !== 'leanto') {
      B.block(cx, zc, w / 2, depth / 2);
      B.hitBox(cx, H / 2, zc, w, H, depth);
      front(x0, w, zf, face, H);
    } else {
      B.block(cx, zf - face * depth, w / 2, 0.2);
    }
    // the roof
    const ry = kind === 'leanto' ? H * 0.85 + 0.1 : H + 0.12;
    const tilt = kind === 'leanto' ? -face * 0.18 : face * (0.08 + rand() * 0.08) * (rand() < 0.75 ? 1 : -1);
    const rd = kind === 'leanto' ? depth + 0.4 : depth + 0.8;
    const rz = kind === 'leanto' ? zf - (face * depth) / 2 : zc + face * 0.2;
    if (kind !== 'container' || rand() < 0.4) {
      tinRoof(cx, rz, w + 0.5, rd, ry, tilt);
      roofJunk(x0, w, rz, rd, ry, tilt);
    }
    // a second storey, smaller, set back; a ladder up
    if (upper && kind !== 'leanto') {
      const uw = w * (0.5 + rand() * 0.35);
      const ux = x0 + rand() * (w - uw) + uw / 2;
      const ud = depth * 0.7;
      const uz = zc - face * depth * 0.1;
      const uh = 2.1;
      tin(uw, uh, ud, ux, H + 0.2 + uh / 2, uz);
      put(B.root, box(0.7, 0.5, 0.04, 0x1a1918), ux, H + 1.4, uz + face * (ud / 2 + 0.01));
      tinRoof(ux, uz, uw + 0.4, ud + 0.6, H + 0.2 + uh + 0.12, -face * 0.1);
      const lx = ux + (rand() < 0.5 ? -1 : 1) * (uw / 2 + 0.3);
      for (const dz of [-0.2, 0.2]) put(B.root, box(0.06, H + 0.6, 0.06, 0x6b5640), lx + dz, (H + 0.6) / 2, zf + face * 0.25).rotation.x = -face * 0.12;
      for (let y = 0.4; y < H + 0.4; y += 0.4) put(B.root, box(0.46, 0.04, 0.05, 0x6b5640), lx, y, zf + face * (0.25 - y * 0.06));
      if (rand() < 0.4) put(B.root, cyl(0.35, 0.08, 0xd8d6d0, { seg: 10, radiusEnd: 0.15 }), ux, H + uh + 0.7, uz).rotation.z = 1.0;
    }
    if (rand() < 0.3) tin(w * 0.4, 0.04, 1.2, x0 + w * (0.3 + rand() * 0.4), Math.min(H, 2.2) - 0.1, zf + face * 0.6, roofCol()).rotation.x = face * 0.3; // an awning
    stuff(x0, w, zf, face);
  }
  const KINDS = [['tin', 0.42], ['block', 0.14], ['ply', 0.14], ['leanto', 0.1], ['nook', 0.1], ['container', 0.1]];
  const pickKind = () => {
    let r = rand();
    for (const [k, p] of KINDS) if ((r -= p) < 0) return k;
    return 'tin';
  };
  // a row of shacks along a line, each its own width and setback, squeezed
  // in, alleys here and there; returns the alleys' x's
  function shackRow(xa, xb, zf, face, { upper = 0, kinds = true } = {}) {
    const gaps = [];
    let x = xa;
    while (x < xb - 1.5) {
      const kind = kinds ? pickKind() : 'tin';
      const w = kind === 'container' ? 6 : 2.4 + rand() * 3.6;
      const x1 = Math.min(xb, x + w);
      if (x1 - x > 1.6) shack(x, x1, zf - face * rand() * 0.9, face, { kind, upper: rand() < upper });
      x = x1;
      if (rand() < 0.22) {
        gaps.push(x + 0.8);
        x += 1.6; // an alley
      }
    }
    return gaps;
  }
  // (a small trash heap, before trash() proper below)
  function trashBit(x, z) {
    for (let i = 0; i < 6; i++) B.lump(x + (rand() - 0.5) * 1.2, 0.15, z + (rand() - 0.5) * 0.8, 0.3, 0.22, 0.28, pick([0x1d1e20, 0x2a2b2d, 0x2f4f7a, 0xd8d6d0]), rand() * 3);
  }

  // the shanty road, both sides; the market's edges; the dump's last shacks
  const segN = [[START_X - 30, SHACK_A.x0], [SHACK_A.x1, MARKET.x0], [MARKET.x1, SHACK_B.x0], [SHACK_B.x1, DUMP_X]];
  const alleys = [];
  for (const [a, b] of segN) {
    alleys.push(...shackRow(a, b, FRONT.n, 1, { upper: 0.6 }));
    shackRow(a, b, FRONT.s, -1, { upper: 0.08 });
    // the next row back on the far side: taller, seen over the front row
    shackRow(a, b, FRONT.n - 7, 1, { upper: 0.8 });
  }
  // the market's own edges: shacks round three sides of the square
  // (a gap left where the old railway runs through)
  for (const [a, b] of [[MARKET.x0, RAIL_X - 2.6], [RAIL_X + 2.6, MARKET.x1]]) {
    shackRow(a, b, MARKET.n, 1, { upper: 0.5 });
    shackRow(a, b, MARKET.s, -1, { upper: 0.05 });
  }
  for (const s of [-1, 1]) {
    // the square's corners: shacks closing it in either side of the road
    for (const x of [MARKET.x0, MARKET.x1]) {
      const za = s < 0 ? MARKET.n : FRONT.s;
      const zb = s < 0 ? FRONT.n : MARKET.s;
      B.block(x, (za + zb) / 2, 0.6, Math.abs(zb - za) / 2);
      tin(1.2, 2.4, Math.abs(zb - za), x, 1.2, (za + zb) / 2);
    }
  }
  // behind the back rows: a sea of roofs going on (low boxes, roof colours)
  for (let i = 0; i < 160; i++) {
    const x = START_X - 30 + rand() * (DUMP_X - START_X + 30);
    const s = rand() < 0.7 ? -1 : 1;
    const z = s < 0 ? FRONT.n - 14 - rand() * 18 : FRONT.s + 8 + rand() * 12;
    if (inMarket(x)) continue;
    const w = 2.5 + rand() * 3;
    const d = 3 + rand() * 2;
    const h = s < 0 ? 2.2 + rand() * 2.5 : 1.6 + rand() * 0.8;
    put(B.root, box(w, h, d, rand() < 0.2 ? 0x8d8b86 : sheet(), { r: 0.02 }), x, h / 2, z);
    const rf = put(B.root, box(w + 0.3, 0.06, d + 0.4, roofCol()), x, h + 0.1, z);
    rf.rotation.x = (rand() - 0.5) * 0.25;
    if (rand() < 0.3) put(B.root, box(1.2, 0.04, 1, pick(TARP)), x, h + 0.16, z);
  }

  // -------------------------------------------- poles and the wire tangle
  // wooden poles both sides of the road, crossarms, insulators; three or
  // four wires pole to pole sagging at different depths; drop lines to the
  // shacks; transformers on some poles; on others a mess of extra cables
  const poles = { n: [], s: [] };
  const wireMat = new THREE.LineBasicMaterial({ color: 0x141312 });
  for (let x = START_X - 10; x < DUMP_X + 6; x += 9 + rand() * 4) {
    if (x > SHACK_A.x0 - 2 && x < SHACK_A.x1 + 2) continue;
    if (x > SHACK_B.x0 - 2 && x < SHACK_B.x1 + 2) continue;
    if (Math.abs(x - RAIL_X) < 2.6) continue; // (not on the old railway)
    for (const side of ['n', 's']) {
      const z = side === 'n' ? ROAD.n - 0.6 : ROAD.s + 0.6;
      const lean = (rand() - 0.5) * 0.12;
      const hgt = 6.4 + rand() * 1.2;
      B.crushable(
        () => {
          const p = cyl(0.11, hgt, 0x5a4636, { seg: 6, radiusEnd: 0.14 });
          p.position.set(x, hgt / 2, z);
          p.rotation.z = lean;
          p.castShadow = true;
          B.add(p);
          B.solid(p);
          B.block(x, z, 0.2, 0.2);
          put(B.root, box(0.12, 0.12, 1.6, 0x4a3a2e), x - lean * hgt, hgt - 0.4, z);
          for (const dz of [-0.6, 0, 0.6]) put(B.root, cyl(0.04, 0.12, 0x5a7a6a, { seg: 5 }), x - lean * hgt, hgt - 0.28, z + dz);
          if (rand() < 0.3) {
            // a transformer can
            put(B.root, cyl(0.28, 0.7, 0x5f6670, { seg: 8 }), x - lean * hgt + 0.3, hgt - 1.4, z);
            put(B.root, box(0.3, 0.04, 0.3, 0x3a3c3f), x - lean * hgt + 0.3, hgt - 1.0, z);
          }
          if (rand() < 0.4) put(B.root, box(0.4, 0.5, 0.2, pick([0x8a8f96, 0x5f6670])), x, 1.6, z + (side === 'n' ? -0.2 : 0.2)); // a meter box
        },
        { kind: 'pole', pivot: { x, y: 0, z }, footprint: { x, z, hx: 0.25, hz: 0.25, yaw: 0 } },
      );
      poles[side].push({ x: x - lean * hgt, y: hgt - 0.3, z });
    }
  }
  for (const side of ['n', 's']) {
    const ps = poles[side];
    for (let i = 0; i < ps.length - 1; i++) {
      const a = ps[i];
      const b = ps[i + 1];
      if (b.x - a.x > 20) continue;
      for (const dz of [-0.6, 0.6]) B.sagging(new THREE.Vector3(a.x, a.y, a.z + dz), new THREE.Vector3(b.x, b.y, b.z + dz), 0.3 + rand() * 0.5, wireMat);
      // the tangle: extra cables slung anyhow, hanging low
      for (let k = 0; k < (rand() < 0.5 ? 1 : 0); k++) B.sagging(new THREE.Vector3(a.x, a.y - 0.5 - rand(), a.z + (rand() - 0.5)), new THREE.Vector3(b.x, b.y - 0.5 - rand(), b.z + (rand() - 0.5)), 0.8 + rand() * 1.4, wireMat);
      // drop lines into the shacks behind
      for (let k = 0; k < 2; k++) {
        const tx = a.x + rand() * (b.x - a.x);
        const tz = side === 'n' ? FRONT.n - 1 - rand() * 3 : FRONT.s + 1 + rand() * 2;
        B.sagging(new THREE.Vector3(a.x, a.y - 0.2, a.z), new THREE.Vector3(tx, 2.4 + rand() * 0.6, tz), 0.4 + rand() * 0.6, wireMat);
      }
    }
  }
  // a few lines right across the road
  for (let i = 0; i < Math.min(poles.n.length, poles.s.length); i += 5) B.sagging(new THREE.Vector3(poles.n[i].x, poles.n[i].y - 0.4, poles.n[i].z), new THREE.Vector3(poles.s[i].x, poles.s[i].y - 0.4, poles.s[i].z), 0.6, wireMat);

  // ------------------------------------------------- life: fires, trash
  // trash heaps: bags (black, blue, white), boxes, a fridge, a mattress,
  // tyres, plastic everywhere
  function trash(x, z, r = 1.5) {
    for (let i = 0; i < r * r * 7; i++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r;
      B.lump(x + Math.cos(a) * d, (1 - d / r) * r * 0.35, z + Math.sin(a) * d * 0.8, 0.25 + rand() * 0.25, 0.2 + rand() * 0.15, 0.25 + rand() * 0.2, pick([0x1d1e20, 0x2a2b2d, 0x2f4f7a, 0xd8d6d0, 0x6a6458, 0x3f6f4a]), rand() * 3);
    }
    for (let i = 0; i < r * 3; i++) B.piece(0.3 + rand() * 0.4, 0.2 + rand() * 0.3, 0.3 + rand() * 0.3, pick([0x9a8a6a, 0x7a5f3e, 0xd8d6d0, 0xb03a3a]), x + (rand() - 0.5) * r * 1.6, 0.2, z + (rand() - 0.5) * r, rand(), rand() * 3, rand());
    if (rand() < 0.3) B.piece(0.7, 1.4, 0.6, 0xd8d6d0, x + (rand() - 0.5) * r, 0.5, z, 0.3, rand() * 3, 1.2); // a fridge on its side
    if (rand() < 0.3) B.piece(1.8, 0.2, 0.9, 0xb9a88a, x + (rand() - 0.5) * r, 0.3, z + 0.5, 0.2, rand() * 3, 0.1); // a mattress
    if (r > 1.2) B.block(x, z, r * 0.6, r * 0.45);
  }
  // a generator: a box on skids, a little exhaust, a cable off it, chugging
  function generator(x, z) {
    put(B.root, box(1.2, 0.7, 0.8, pick([0xc9a23a, 0x3f6f4a, 0xb03a3a]), { r: 0.05 }), x, 0.45, z);
    put(B.root, box(1.3, 0.1, 0.9, 0x2a2b2d), x, 0.05, z);
    put(B.root, cyl(0.05, 0.4, 0x2a2b2d, { seg: 5 }), x - 0.4, 1.0, z);
    B.groundCable(x + 0.6, z, rand() * 6, 10, 0.4);
    B.block(x, z, 0.6, 0.4);
    let carry = 0;
    B.animate((dt, t, ctx) => {
      carry += dt * 4;
      while (carry > 1 && ctx?.combat) {
        carry -= 1;
        ctx.combat.puffs.spawn(new THREE.Vector3(x - 0.4, 1.25, z), new THREE.Vector3(0.2, 0.8, 0), { color: 0x4a4a4e, s0: 0.08, s1: 0.3, life: 1.2, drag: 1, lift: 0.4, fadeAt: 0.3 });
      }
    });
  }
  // a water tank on stilts
  function waterTank(x, z) {
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) put(B.root, box(0.12, 3, 0.12, 0x5a4636), x + dx, 1.5, z + dz);
    put(B.root, cyl(0.85, 1.4, pick([0x2f2f30, 0x3a5a8a, 0x8a8f96]), { seg: 12 }), x, 3.7, z).castShadow = true;
    B.block(x, z, 0.8, 0.8);
  }
  // washing on a line between two posts (or a shack and a pole)
  function washing(x0, x1, z, y = 2.2) {
    B.sagging(new THREE.Vector3(x0, y, z), new THREE.Vector3(x1, y, z), 0.3, wireMat);
    for (let x = x0 + 0.4; x < x1 - 0.3; x += 0.5 + rand() * 0.4) {
      const t = (x - x0) / (x1 - x0);
      const yy = y - 0.3 * 4 * t * (1 - t);
      put(B.root, box(0.36 + rand() * 0.3, 0.5 + rand() * 0.4, 0.02, pick([0xd8d6d0, 0x2f6fb0, 0xb03a3a, 0xc9b03a, 0x3f8a5a, 0x8a5a9a])), x, yy - 0.3, z);
    }
  }
  // along the road: trash heaps, fires, generators, tanks, washing, tyres,
  // wrecks, all in the gaps and alleys
  for (let x = START_X; x < DUMP_X; x += 6 + rand() * 7) {
    if (inMarket(x) || (x > SHACK_A.x0 - 4 && x < SHACK_A.x1 + 4) || (x > SHACK_B.x0 - 4 && x < SHACK_B.x1 + 4)) continue;
    const side = rand() < 0.5 ? -1 : 1;
    const z = side < 0 ? FRONT.n + 1 : FRONT.s - 1;
    const r = rand();
    if (r < 0.3) trash(x, z, 1 + rand() * 0.8);
    else if (r < 0.45) ST.barrelFire(x, z);
    else if (r < 0.55) generator(x, z);
    else if (r < 0.65) junk(() => P.tires(B, x, 0, z, 3 + ((rand() * 4) | 0)));
    else if (r < 0.75) junk(() => P.crates(B, x, 0, z), 2);
    else if (r < 0.85) washing(x - 1.5, x + 1.5, z + side * 0.3);
    else junk(() => P.dumpster(B, x, 0, z, (rand() - 0.5) * 0.4, pick([0x4e6355, 0x4f5d73, 0x7a4a36])));
  }
  for (const x of alleys) {
    if (rand() < 0.5) trash(x, FRONT.n - 2, 0.8);
    if (rand() < 0.4) washing(x - 0.6, x + 0.6, FRONT.n - 1.5, 2.6);
  }
  for (const [x, z] of [[-12, FRONT.n - 3], [62, FRONT.n - 9], [186, FRONT.n - 4]]) waterTank(x, z);
  // wrecks in and by the road: burnt cars, a minibus, a cart
  const wreck = (x, z, yaw, o) => B.crushable(() => P.car(B, x, z, yaw, o), { kind: 'car', scrap: 2 });
  wreck(-8, -3.2, 0.4, { kind: 'sedan', paint: BURNT_PAINT[0], snow: false });
  wreck(30, 3.4, -0.3, { kind: 'van', paint: 0x8a6a3a, snow: false });
  wreck(70, -3.6, 0.6, { kind: 'hatch', paint: BURNT_PAINT[2], snow: false, flipped: true });
  wreck(184, 2.8, 0.2, { kind: 'sedan', paint: BURNT_PAINT[3], snow: false });
  // hand-painted signs on the shacks
  for (let x = START_X; x < DUMP_X; x += 14 + rand() * 10) {
    const w = 1.6 + rand() * 1.2;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.5), sign(w, 0.5, { board: pick(['#c9b03a', '#2f6fb0', '#d8d6d0', '#b03a3a']), ink: '#1d1e20' }));
    m.position.set(x, 2.3, FRONT.n + 0.06);
    B.add(m);
  }

  // ----------------------------------------------- 2: the market square
  {
    // stalls: timber frames, tarp roofs, goods on the counters, strung bulbs
    const stall = (x, z, yaw) => {
      const g = new THREE.Group();
      g.position.set(x, 0, z);
      g.rotation.y = yaw;
      for (const [dx, dz] of [[-1.2, -0.8], [1.2, -0.8], [-1.2, 0.8], [1.2, 0.8]]) put(g, box(0.1, 2.2, 0.1, 0x6b5640), dx, 1.1, dz);
      const t = put(g, box(2.8, 0.04, 2.0, pick(TARP)), 0, 2.25, 0);
      t.rotation.x = 0.1;
      put(g, box(2.5, 0.08, 0.7, 0x7a5f3e), 0, 0.9, 0.5);
      for (let i = 0; i < 6; i++) put(g, box(0.25, 0.2, 0.25, pick([0xc9b03a, 0xb03a3a, 0x3f8a5a, 0xd0702a, 0xd8d6d0])), -1 + i * 0.4, 1.05, 0.5);
      B.add(g);
      B.solid(t);
      B.block(x, z, 1.4, 1.0, yaw);
    };
    for (let i = 0; i < 9; i++) {
      const x = MARKET.x0 + 6 + (i % 3) * 13 + rand() * 3;
      const z = (i < 3 ? -12 : i < 6 ? 9 : -14 + rand() * 4) + (rand() - 0.5) * 2;
      if (Math.abs(x - RAIL_X) < 5.5) continue;
      junk(() => stall(x, z, (rand() - 0.5) * 0.5), 2);
    }
    // strings of bulbs between poles over the square
    for (let k = 0; k < 4; k++) {
      const a = new THREE.Vector3(MARKET.x0 + 4 + k * 12, 4.2, MARKET.n + 2);
      const b = new THREE.Vector3(MARKET.x0 + 10 + k * 12, 4.2, MARKET.s - 2);
      for (const p of [a, b]) put(B.root, cyl(0.07, 4.2, 0x5a4636, { seg: 5 }), p.x, 2.1, p.z);
      B.sagging(a, b, 0.6, wireMat);
      for (let i = 1; i < 10; i++) {
        const t = i / 10;
        const p = new THREE.Vector3().lerpVectors(a, b, t);
        p.y -= 0.6 * 4 * t * (1 - t) + 0.08;
        put(B.root, box(0.1, 0.12, 0.1, pick([0xffd28a, 0xff9a5a, 0xffe8b0]), { glow: true }), p.x, p.y, p.z);
      }
      const mid = new THREE.Vector3().lerpVectors(a, b, 0.5);
      B.emit(mid.clone().setY(3), 0xffc890, 10, 9);
    }
    // the old railway across the square, bombed: rails in the dirt with
    // gaps blown out of them, craters, a buckled length twisted up, the
    // crossing's barrier snapped, its crossbuck bent, the signal box holed
    // the bed: a gravel embankment, sloped sides, the rails up on it (above
    // the road where it crosses); the blown-out lengths over by the square's
    // edges
    {
      const [c, g] = canvas(64, 64);
      g.fillStyle = '#827f7a';
      g.fillRect(0, 0, 64, 64);
      speckle(g, 64, 64, ['#8a8782', '#76736e', '#908d87', '#7a7772', '#6e6b66'], 64 * 40, rand);
      const map = tex(c);
      map.wrapS = map.wrapT = THREE.RepeatWrapping;
      map.repeat.set(1, 30);
      const shape = new THREE.Shape([new THREE.Vector2(-BED.base, 0), new THREE.Vector2(BED.base, 0), new THREE.Vector2(BED.top, BED.h), new THREE.Vector2(-BED.top, BED.h)]);
      const len = MARKET.s - MARKET.n + 60;
      const geo = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false });
      const uv = geo.attributes.uv;
      const pos = geo.attributes.position;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) + BED.base) / (BED.base * 2), pos.getZ(i) / len); // (gravel along it, not stretched)
      const bed = new THREE.Mesh(geo, new THREE.MeshToonMaterial({ map, gradientMap }));
      bed.position.set(RAIL_X, 0, MARKET.n - 30);
      bed.receiveShadow = true;
      B.add(bed);
    }
    const GAP = [[MARKET.n + 1, MARKET.n + 4], [MARKET.s - 4, MARKET.s - 1]];
    const inGap = (z) => GAP.some(([a, b]) => z > a && z < b);
    const R = rails(B, rand, { gauge: 0.72, y: () => BED.h + 0.09 }); // (on the sleepers)
    for (const [z0, z1] of [[MARKET.n - 30, GAP[0][0]], [GAP[0][1], GAP[1][0]], [GAP[1][1], MARKET.s + 30]]) R.track(R.straight(RAIL_X, z0, RAIL_X, z1));
    for (let z = MARKET.n - 30; z < MARKET.s + 30; z += 0.9) if (rand() > 0.15 && !inGap(z)) B.piece(2.2, 0.1, 0.22, 0x4a3a2e, RAIL_X, BED.h + 0.04, z, 0, 0, 0); // sleepers
    for (const [a, b] of GAP) {
      const z = (a + b) / 2;
      ST.rubble(RAIL_X + (rand() - 0.5), z, 1.6, 0.5);
      for (let k = 0; k < 2; k++) {
        const bent = put(B.root, box(0.07, 0.07, 2.4, 0x8d9196), RAIL_X + (k ? 0.72 : -0.72), BED.h + 0.5, z);
        bent.rotation.x = (k ? 1 : -1) * 0.5;
        bent.rotation.y = (rand() - 0.5) * 0.6;
      }
    }
    for (const s of [-1, 1]) {
      const z = s * 9.5;
      // crossbuck on a post
      const cb = put(B.root, cyl(0.07, 3, 0xd8d6d0, { seg: 5 }), RAIL_X - s * 2.2, 1.5, z);
      cb.rotation.x = s * 0.15;
      for (const a of [0.6, -0.6]) put(B.root, box(0.06, 0.18, 1.4, 0xd8d6d0), RAIL_X - s * 2.2, 2.8, z).rotation.x = a;
      // the broken barrier: its pedestal, the boom snapped and lying
      put(B.root, box(0.4, 1, 0.4, 0xb03a3a), RAIL_X - s * 2.6, 0.5, z + s * 1.4);
      const boom = put(B.root, box(0.1, 0.1, 3, 0xd8d6d0), RAIL_X - s * 2.4, 0.12, z - s * 0.4);
      boom.rotation.set(0.05, 0.3, 0);
      for (let k = 0; k < 3; k++) put(B.root, box(0.12, 0.12, 0.4, 0xb03a3a), RAIL_X - s * 2.4, 0.13, z - s * (0.6 + k * 0.9));
    }
    // the signal box: brick, a shell hole, its windows out
    const sb = put(B.root, box(3, 3.2, 3, 0x8a5a44, { r: 0.03 }), RAIL_X + 5, 1.6, MARKET.n + 3.5);
    sb.castShadow = true;
    B.solid(sb);
    put(B.root, box(3.4, 0.2, 3.4, 0x45484c), RAIL_X + 5, 3.3, MARKET.n + 3.5);
    for (const dx of [-0.8, 0.8]) put(B.root, box(0.8, 0.8, 0.04, 0x141312), RAIL_X + 5 + dx, 2.3, MARKET.n + 5.01);
    put(B.root, box(1.1, 1.2, 0.05, 0x0e0e0f), RAIL_X + 6.2, 1.6, MARKET.n + 5.02); // the shell hole
    ST.rubble(RAIL_X + 6.4, MARKET.n + 5.8, 0.9, 0.4);
    B.block(RAIL_X + 5, MARKET.n + 3.5, 1.5, 1.5);
    // a couple of rusted goods wagons' bogies left on the rails? no: just
    // a heap of sleepers, and the fires the market cooks on
    trash(MARKET.x0 + 22, 2, 1.2);
    ST.barrelFire(MARKET.x0 + 30, -4);
    ST.barrelFire(MARKET.x0 + 46, 6);
    generator(MARKET.x0 + 20, -16);
  }

  // ------------------------------------------------------ 3: the dump
  // hills of rubbish going away on both sides, wrecks stacked three high,
  // scrap pickers' shacks and a container office, a sorting shed, tyre
  // mountains, a crane with its jib down, a heap burning; the track out
  // across it, fenced with sheet metal, barricaded at the far end
  const heap = (x, z, r, cols = [0x5a5e62, 0x3a3c3f, 0x6a6458, 0x2f4f7a, 0x7a5a42, 0xd8d6d0, 0x1d1e20]) => {
    for (let k = 0; k < r * 7; k++) {
      const a = rand() * Math.PI * 2;
      const d = Math.sqrt(rand()) * r;
      B.lump(x + Math.cos(a) * d, (1 - d / r) * r * 0.5, z + Math.sin(a) * d * 0.8, 0.5 + rand() * 0.8, 0.35 + rand() * 0.5, 0.5 + rand() * 0.7, pick(cols), rand() * 3);
    }
    for (let k = 0; k < r * 2; k++) B.piece(0.5 + rand() * 1.2, 0.08, 0.4 + rand() * 0.8, sheet(), x + (rand() - 0.5) * r * 1.4, (0.3 + rand() * 0.5) * r * 0.5, z + (rand() - 0.5) * r, rand() - 0.5, rand() * 3, rand() - 0.5);
    B.block(x, z, r * 0.7, r * 0.55);
  };
  const DUMP_FAR = MAP.x1 - 6;
  for (let x = DUMP_X + 6; x < DUMP_FAR; x += 5 + rand() * 6) {
    for (const s of [-1, 1]) {
      heap(x, s * (12 + rand() * 6), 2.5 + rand() * 3);
      if (rand() < 0.7) heap(x + rand() * 4, s * (22 + rand() * 14), 3.5 + rand() * 4);
    }
  }
  // inside the fences: small heaps, scattered junk
  for (let x = DUMP_X + 8; x < DUMP_FAR; x += 4 + rand() * 5) {
    const s = rand() < 0.5 ? -1 : 1;
    if (Math.abs(x - END_X) < 6) continue;
    if (rand() < 0.5) trash(x, s * (5.2 + rand()), 1 + rand() * 0.6);
    else junk(() => P.tires(B, x, 0, s * 6, 3 + ((rand() * 5) | 0)));
  }
  // stacks of wrecks
  for (const [x, z] of [[232, -11], [252, 12], [276, -12], [318, 11], [344, -11], [372, 12], [398, -12]]) {
    for (let k = 0; k < 2 + ((rand() * 2) | 0); k++) {
      const c = P.car(B, x + (rand() - 0.5) * 0.5, z + (rand() - 0.5) * 0.4, rand() * 0.3, { kind: pick(['sedan', 'hatch', 'van']), paint: pick(BURNT_PAINT), snow: false, solidBlock: k === 0 });
      c.position.y = k * 1.25;
    }
  }
  // the pickers' shacks along the track, and a container office
  const DUMP_SHACKS = [[222, 230, -1], [246, 254, 1], [288, 296, -1], [330, 340, 1], [356, 364, -1], [384, 392, 1]];
  for (const [xa, xb, s] of DUMP_SHACKS) shackRow(xa, xb, s * 8.6, -s, { upper: 0 });
  {
    const x = 264;
    const z = 12;
    tin(6, 2.5, 2.4, x, 1.25, z, 0x4f6b6a);
    put(B.root, box(0.9, 1.8, 0.04, 0x141312), x - 1.5, 0.9, z - 1.21);
    put(B.root, box(1.4, 0.7, 0.04, 0x1a1918), x + 1, 1.5, z - 1.21);
    put(B.root, box(1.2, 0.35, 0.05, 0xc9b03a), x + 1, 2.2, z - 1.22);
    for (const dx of [-2.6, 2.6]) put(B.root, box(0.3, 0.3, 0.3, 0x5a5e62), x + dx, 0.15, z);
    B.block(x, z, 3, 1.2);
  }
  // the sorting shed: a roof on poles, sorted heaps under it
  {
    const x = 306;
    const z = -14;
    for (const [dx, dz] of [[-4, -2.5], [4, -2.5], [-4, 2.5], [4, 2.5], [0, -2.5], [0, 2.5]]) put(B.root, box(0.16, 3.4, 0.16, 0x5a5e62), x + dx, 1.7, z + dz);
    tinRoof(x, z, 9, 6, 3.5, 0.1);
    heap(x - 2, z, 1.6, [0x8d9196, 0x6a6e72, 0xa8a49a]);
    heap(x + 2, z, 1.6, [0x7a4a36, 0x8a5a3a, 0x6b4a38]);
  }
  // the crane: a lattice boom down on the heaps, its cab rusted
  {
    const cx = 284;
    const cz = -17;
    put(B.root, box(3, 1.4, 2.4, 0x8a6a3a, { r: 0.04 }), cx, 1.2, cz).castShadow = true;
    for (const s of [-1, 1]) put(B.root, box(3.4, 0.6, 0.5, 0x2a2b2d), cx, 0.3, cz + s * 1.1);
    const jib = new THREE.Group();
    jib.position.set(cx + 1, 2, cz);
    jib.rotation.z = 0.35;
    for (const [dy, dz] of [[0, -0.3], [0, 0.3], [0.5, 0]]) put(jib, box(12, 0.1, 0.1, 0xb08a3a), 6, dy, dz);
    for (let k = 0; k < 12; k++) put(jib, box(0.06, 0.6, 0.06, 0xb08a3a), 0.5 + k, 0.25, 0).rotation.x = k % 2 ? 0.5 : -0.5;
    B.add(jib);
    B.block(cx, cz, 1.8, 1.4);
  }
  // an old bus dumped by the track
  B.crushable(() => P.bus(B, 340, -15, 0.3), { kind: 'prop', heavy: true, armored: true });
  ST.barrelFire(240, 5.2);
  ST.barrelFire(268, -5.4);
  ST.barrelFire(318, 5.2);
  // the edges: fences of sheet metal along the track
  for (const s of [-1, 1]) {
    for (let x = DUMP_X; x < DUMP_FAR; x += 2.4) {
      if (DUMP_SHACKS.some(([xa, xb, ss]) => ss === s && x + 2.4 > xa && x < xb)) continue;
      const z = s * (8 + Math.sin(x / 13) * 1.5);
      const fh = 2.2 + rand() * 0.4;
      const f = tin(2.3, fh, 0.06, x + 1.2, fh / 2, z);
      f.rotation.z = (rand() - 0.5) * 0.12;
      if (rand() < 0.1) f.rotation.x = s * 0.6;
    }
    B.block((DUMP_X + DUMP_FAR) / 2, s * 8.5, (DUMP_FAR - DUMP_X) / 2, 0.6);
  }
  // a heap burning off to the side: flames licking up all over its slope,
  // a column of black smoke
  {
    const fx = 248;
    const fz = -16;
    heap(fx, fz, 3.4, [0x2a2b2d, 0x1d1e20, 0x3a3634, 0x4a4036]);
    const fire = B.emit(new THREE.Vector3(fx, 2.4, fz), 0xff8a35, 20, 12);
    const flames = [];
    for (let i = 0; i < 9; i++) {
      const a = rand() * Math.PI * 2;
      const d = rand() * 2.4;
      const fy = (1 - d / 3.4) * 1.7;
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.22 + rand() * 0.2, 0.9 + rand() * 0.7, 6), glowMat(pick([0xffb347, 0xffd27a, 0xff8a35, 0xff6a2a])));
      f.position.set(fx + Math.cos(a) * d, fy + 0.4, fz + Math.sin(a) * d * 0.8);
      B.add(f);
      B.keep(f);
      flames.push({ f, y: fy + 0.4, ph: rand() * 10 });
    }
    let carry = 0;
    B.animate((dt, t, ctx) => {
      for (const { f, y, ph } of flames) {
        const k = 0.7 + Math.sin(t * 11 + ph) * 0.25 + Math.sin(t * 23 + ph) * 0.1;
        f.scale.set(1, k, 1);
        f.position.y = y + k * 0.25;
      }
      fire.level = 0.8 + Math.sin(t * 11) * 0.15;
      carry += dt * 8;
      while (carry > 1 && ctx?.combat) {
        carry -= 1;
        ctx.combat.puffs.spawn(new THREE.Vector3(fx + (rand() - 0.5) * 2.5, 2.4, fz + (rand() - 0.5) * 1.5), new THREE.Vector3(0.5, 1.6 + rand(), 0.2), { color: rand() < 0.5 ? 0x2a2a2e : 0x3a3a3e, s0: 0.4, s1: 1.6, life: 3, drag: 0.2, lift: 0.3, fadeAt: 0.4 });
      }
    });
  }
  // the barricade across the track at the far end: wrecks, sheet metal,
  // tyres, beams; it holds till the artillery covering it is gone
  const barricade = [];
  for (const [z0, z1] of [[-7.4, -2.4], [-2.4, 2.4], [2.4, 7.4]]) {
    const zc = (z0 + z1) / 2;
    const len = z1 - z0;
    const x = END_X;
    B.crushable(
      () => {
        P.car(B, x, zc, Math.PI / 2 + (rand() - 0.5) * 0.3, { kind: pick(['sedan', 'hatch', 'van']), paint: pick(BURNT_PAINT), solidBlock: false, snow: false });
        for (let k = 0; k < 3; k++) {
          const f = tin(0.06, 2 + rand() * 0.5, len / 3 + 0.2, x - 1.1, 1.1, z0 + (k + 0.5) * (len / 3));
          f.rotation.z = (rand() - 0.5) * 0.25;
        }
        for (const [hh, tilt] of [[0.7, 0.2], [1.6, -0.15]]) put(B.root, box(0.16, 0.2, len, 0x5e4a36), x - 1.2, hh, zc).rotation.x = tilt;
        for (let k = 0; k < 3; k++) put(B.root, cyl(0.4, 0.25, 0x1d1e20, { seg: 10 }), x + 1, 0.15 + k * 0.26, zc + (rand() - 0.5) * len * 0.6);
        put(B.root, box(0.06, 0.4, len - 0.6, 0xb03a3a), x - 1.16, 1.4, zc); // a red board
        B.hitBox(x, 1.1, zc, 2.4, 2.2, len);
        B.block(x, zc, 1.1, len / 2);
      },
      { kind: 'prop', heavy: true, breakable: true, armored: true, scrap: 3 },
    );
    barricade.push(B.crushables[B.crushables.length - 1]);
  }
  // behind the start: the way back blocked by a burnt-out bus and junk
  B.crushable(() => P.bus(B, START_X - 5, -0.5, 1.45), { kind: 'prop', heavy: true, armored: true });
  trash(START_X - 4, 4.5, 1.6);
  trash(START_X - 4, -5.5, 1.6);
  B.block(START_X - 5, 0, 1.5, 9);

  // the checkpoints
  const shackA = buildShack(B, { x0: SHACK_A.x0, x1: SHACK_A.x1, z0: ROAD.n + 0.1, z1: ROAD.s - 0.1, fill: { n: FRONT.n - 0.5, s: FRONT.s + 0.8 }, heightAt });
  const shackB = buildShack(B, { x0: SHACK_B.x0, x1: SHACK_B.x1, z0: ROAD.n + 0.1, z1: ROAD.s - 0.1, fill: { n: FRONT.n - 0.5, s: FRONT.s + 0.8 }, heightAt });

  B.finish();
  B.mergeStatic();

  const room = buildDepotRoom(scene);
  B.blocks.push(...room.blocks);
  B.colliders.push(...room.colliders);
  B.emitters.push(...room.emitters);
  room.bindBlocks(B.blocks);
  const blocks = B.blocks;
  for (const k of [shackA, shackB]) k.bindBlocks(blocks);

  // ---------------------------------------------------- the level script
  const SECTORS = ['The shanty road', 'The market', 'The dump'];
  const ROADB = { minZ: ROAD.n + 0.4, maxZ: ROAD.s - 0.4 };
  const B1 = { minX: START_X - 1.5, maxX: shackA.x0 - 0.8, ...ROADB };
  const B2 = { minX: shackA.x1 + 1.2, maxX: shackB.x0 - 0.8, ...ROADB };
  const B3 = { minX: shackB.x1 + 1.2, minZ: -7.4, maxZ: 7.4 };
  const S = { sector: 0, step: 0, t: 0, final: [] };
  const bounds = { ...B1 };
  const setBounds = (api, b) => api.setBounds(Object.assign(bounds, b));
  const go = (step) => {
    S.step = step;
    S.t = 0;
  };
  const near = (api, shack) => Math.hypot(api.tankPos.x - shack.door.x, api.tankPos.z - shack.door.z);
  const atDoor = (api, shack) => shack.inDoor > 0.6 && near(api, shack) < 5;
  function openShack(api, shack) {
    shack.openIn();
    api.objective('Enter the checkpoint');
    api.arrow(shack.door, 'Checkpoint');
  }
  const PARTS7 = ['gmg', 'twinmg', 'he']; // (its own parts only: campaign.js rewards)
  const ahead = (api, x, lim) => Math.min(Math.max(x, api.tankPos.x + 16), lim);
  // machines out of the alleys (or over the roofs, for drones)
  const fromAlley = (api, kind, x, lim, delay = 0) => {
    const ax = ahead(api, x, lim);
    const s = rand() < 0.6 ? -1 : 1;
    const spawn = kind === 'walker' ? api.spawnWalker : api.spawnDog;
    spawn(ax, s < 0 ? ROAD.n + 0.8 : ROAD.s - 0.8, { delay }); // (out of the shack fronts, on the road: never stuck behind them)
  };
  const drone = (api, x, lim, delay = 0) => {
    const ax = ahead(api, x, lim);
    api.spawnDrone(ax, -24, { delay, via: [[ax - 2, -3]] });
  };

  function start(api) {
    Object.assign(S, { sector: 0, step: 0, t: 0 });
    setBounds(api, B1);
    api.enableGun();
    api.revealScraps(false);
    api.giveRockets();
    if (api.tank.ability) api.giveAbility();
    api.sectors(SECTORS, 0, 'Level 7');
    api.objective('Through the slums');
  }

  // 1: the shanty road (each wave as the tank gets there)
  function sector1(api) {
    const x = api.tankPos.x;
    if (S.step < 5 && x > shackA.x0 - 9) {
      openShack(api, shackA);
      go(5);
    }
    switch (S.step) {
      case 0:
        if (x > START_X + 8 || S.t > 4) {
          for (const d of [0, 0.4, 0.8, 1.2]) fromAlley(api, 'dog', 6 + d * 3, 40, d);
          go(1);
        }
        break;
      case 1:
        if (x > 18) {
          fromAlley(api, 'walker', 44, 60);
          fromAlley(api, 'dog', 40, 58, 0.4);
          fromAlley(api, 'dog', 42, 60, 0.8);
          drone(api, 46, 62, 1.2);
          go(2);
        }
        break;
      case 2:
        if (x > 46) {
          // an artillery drone squatting on the road ahead
          api.spawnArty(ahead(api, 80, 86), -1, { yaw: Math.PI, hpScale: 0.35 });
          for (const d of [0.3, 0.7]) fromAlley(api, 'dog', 72, 84, d);
          go(3);
        }
        break;
      case 3:
        if (x > 66) {
          fromAlley(api, 'walker', 84, 88);
          fromAlley(api, 'walker', 86, 88, 0.6);
          drone(api, 84, 88, 1);
          go(4);
        }
        break;
      case 4:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          openShack(api, shackA);
          go(5);
        }
        break;
      case 5:
        if (atDoor(api, shackA)) {
          go(6);
          if (api.enemiesAlive) api.clearEnemies();
          api.depot(shackA, { offers: PARTS7, count: 3, onLeave: () => startSector2(api) });
        }
        break;
    }
  }

  // 2: the market
  function startSector2(api) {
    S.sector = 1;
    go(0);
    setBounds(api, B2);
    api.sectors(SECTORS, 1, 'Level 7');
    api.objective('Through the market');
  }
  function sector2(api) {
    const x = api.tankPos.x;
    // the square: its full width
    if (inMarket(x) && inMarket(x - 1)) setBounds(api, { minZ: MARKET.n + 2, maxZ: MARKET.s - 2 });
    else if (Math.abs(api.tankPos.z) < ROAD.s - 0.6) setBounds(api, ROADB);
    if (S.step < 5 && x > shackB.x0 - 9) {
      openShack(api, shackB);
      go(5);
    }
    switch (S.step) {
      case 0:
        if (x > SHACK_A.x1 + 4 || S.t > 3) {
          for (const d of [0, 0.4, 0.8]) fromAlley(api, 'dog', 108, 112, d);
          go(1);
        }
        break;
      case 1:
        if (x > MARKET.x0 - 2) {
          // the market: machines all over it, two artillery drones beyond the railway
          api.spawnArty(RAIL_X + 10, -10, { yaw: Math.PI, hpScale: 0.35 });
          api.spawnArty(RAIL_X + 12, 9, { yaw: Math.PI, hpScale: 0.35, delay: 1 });
          if (api.run.hard) api.spawnArty(RAIL_X + 14, 0, { yaw: Math.PI, hpScale: 0.35, delay: 2 }); // (two at most; three on Hard)
          for (const [z, d] of [[-8, 0], [6, 0.4], [-2, 0.8]]) api.spawnDog(MARKET.x0 + 20, z, { delay: d });
          api.spawnWalker(MARKET.x0 + 28, 8, { delay: 0.6 });
          go(2);
        }
        break;
      case 2:
        if (x > MARKET.x0 + 26) {
          api.spawnWalker(RAIL_X + 6, -12);
          drone(api, RAIL_X + 4, MARKET.x1, 0.5);
          drone(api, RAIL_X + 8, MARKET.x1, 1.4);
          go(3);
        }
        break;
      case 3:
        if (x > MARKET.x1 - 4) {
          for (const d of [0, 0.4, 0.8, 1.2]) fromAlley(api, 'dog', 178, 192, d);
          fromAlley(api, 'walker', 186, 192, 0.6);
          go(4);
        }
        break;
      case 4:
        if (api.enemiesAlive === 0 && S.t > 1.5) {
          openShack(api, shackB);
          go(5);
        }
        break;
      case 5:
        if (atDoor(api, shackB)) {
          go(6);
          if (api.enemiesAlive) api.clearEnemies();
          api.depot(shackB, { offers: PARTS7, count: 2, onLeave: () => startSector3(api) });
        }
        break;
    }
  }

  // 3: the dump, and the road out: the barricade at the far end holds till
  // the two artillery drones dug in before it are gone
  function startSector3(api) {
    S.sector = 2;
    go(0);
    setBounds(api, { ...B3, ...ROADB, maxX: MAP.x1 + 200 });
    api.sectors(SECTORS, 2, 'Level 7');
    api.objective('Clear the dump');
  }
  function sector3(api) {
    const x = api.tankPos.x;
    if (x > DUMP_X + 1) setBounds(api, { minZ: B3.minZ, maxZ: B3.maxZ });
    switch (S.step) {
      case 0:
        if (S.t > 1.2) {
          for (const d of [0, 0.4, 0.8]) api.spawnDog(ahead(api, 228, 236), (rand() - 0.5) * 8, { delay: d });
          go(1);
        }
        break;
      case 1:
        if (x > 232) {
          api.spawnWalker(ahead(api, 256, 262), -3); // (the dump's artillery: only the pair at the end)
          api.spawnWalker(ahead(api, 252, 262), 4, { delay: 0.5 });
          drone(api, 250, 262, 1);
          go(2);
        }
        break;
      case 2:
        if (x > 252) {
          for (const d of [0, 0.3, 0.6, 0.9]) api.spawnDog(ahead(api, 270, 280), (rand() - 0.5) * 10, { delay: d });
          api.spawnWalker(ahead(api, 274, 282), -4, { delay: 0.6 });
          go(3);
        }
        break;
      case 3:
        if (x > 266) {
          // the pair covering the barricade
          S.final = [api.spawnArty(END_X - 10, -4, { yaw: Math.PI, hpScale: 0.5 }), api.spawnArty(END_X - 8, 4, { yaw: Math.PI, hpScale: 0.5, delay: 0.6 })];
          if (api.run.hard) S.final.push(api.spawnArty(END_X - 6, 0, { yaw: Math.PI, hpScale: 0.5, delay: 1.2 })); // (a third on Hard)
          api.spawnWalker(END_X - 14, 3, { delay: 1 });
          drone(api, END_X - 12, END_X - 6, 1.4);
          api.objective('Destroy the artillery drones');
          go(4);
        }
        break;
      case 4:
        if (S.final.every((e) => !e?.alive) && S.t > 1) {
          for (const c of barricade) c.armored = false;
          api.objective('Break through');
          api.arrow(new THREE.Vector3(END_X, 2.4, 0), 'Break it!');
          api.cameraTo(new THREE.Vector3(END_X, 0, 0), 2);
          go(5);
        }
        break;
      case 5:
        if (barricade.some((c) => c.done) || x > END_X + 1) {
          api.arrow(null);
          go(6);
        }
        break;
      case 6:
        if (x > END_X + 4) {
          api.sectors(SECTORS, 3, 'Level 7');
          api.win('Level clear', { path: [[END_X + 14, 0], [END_X + 110, 0]] });
          go(7);
        }
        break;
    }
  }

  function skipStage(api) {
    api.clearSpot();
    api.arrow(null);
    api.clearPrompt();
    api.clearEnemies();
    if (S.sector < 2) {
      const shack = S.sector === 0 ? shackA : shackB;
      setBounds(api, ROADB);
      api.teleport(shack.door.x - 7, shack.door.z, 0);
      openShack(api, shack);
      go(5);
      return true;
    }
    if (S.step < 4) {
      api.teleport(270, 0, 0);
      go(3);
      return true;
    }
    if (S.step === 4) {
      for (const e of S.final) if (e?.alive) api.blast(e.pos.clone(), 0.5, 99999);
      return true;
    }
    return false;
  }

  function script(api, dt) {
    S.t += dt;
    if (api.run.mode !== 'field') return;
    if (S.sector === 0) sector1(api);
    else if (S.sector === 1) sector2(api);
    else sector3(api, dt);
  }

  function update(dt, t, ctx = {}) {
    B.update(dt, t, ctx);
    for (const k of [shackA, shackB]) k.update(dt, t);
    room.update(dt, t, ctx);
    if (ctx.api) script(ctx.api, dt);
  }

  return {
    light,
    skirt: 0x6e5f4c,
    colliders: B.colliders,
    blocks,
    emitters: B.emitters,
    crushables: B.crushables,
    depotRoom: room,
    heightAt: (x) => railH(x), // (the tank rides up over the rail bed)
    spawn: { x: START_X + 5, z: -0.5, yaw: 0 },
    bounds,
    script: S,
    shacks: [shackA, shackB],
    start,
    update,
    skipStage,
  };
}
