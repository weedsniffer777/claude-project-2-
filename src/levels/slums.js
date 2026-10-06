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
const MAP = { x0: -60, x1: 330, z0: -50, z1: 46 };
const START_X = -30;
const ROAD = { n: -6, s: 5.5 }; // the dirt road's edges
const FRONT = { n: -7.6, s: 7.2 }; // where the shacks' fronts stand
const SHACK_A = { x0: 92, x1: 99.6 };
const MARKET = { x0: 112, x1: 168, n: -18, s: 15 }; // the square
const RAIL_X = 150; // the old railway across it
const SHACK_B = { x0: 196, x1: 203.6 };
const DUMP_X = 214; // where the shacks end and the dump starts
const END_X = 300;

// rust and old paint: the sheets the shacks are patched together from
const SHEET = [0x8a5a3a, 0x4f6b7a, 0x7a8a5a, 0x9a3a2e, 0x3f5f6f, 0xa8823a, 0x6a6e72, 0x7a4a36, 0x5a7a5e, 0x8f8a7a, 0x3a5a8a];
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
  // patches of old snow, dirty, in the lee of things
  for (let i = 0; i < 260; i++) {
    g.fillStyle = rand() < 0.5 ? '#b7b5ad' : '#9c978b';
    blob(g, rand() * W, rand() * H, (0.6 + rand() * 2.2) * GPX, (0.4 + rand() * 1.2) * GPX, rand, 9);
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
  // the market: packed earth, lighter, worn paths across it
  rect(MARKET.x0, MARKET.n, MARKET.x1, MARKET.s, '#7a6a52');
  speckle(g, X(MARKET.x1) - X(MARKET.x0), Z(MARKET.s) - Z(MARKET.n), ['#6f604a', '#85745a', '#6a5b46'], (X(MARKET.x1) - X(MARKET.x0)) * (Z(MARKET.s) - Z(MARKET.n)) * 0.08, rand, Z(MARKET.n), X(MARKET.x0));
  // the dump: grey-brown, trash ground in
  rect(DUMP_X, MAP.z0, MAP.x1, MAP.z1, '#5f584c');
  for (let i = 0; i < 2600; i++) {
    g.fillStyle = ['#8a8f96', '#3a5a8a', '#b03a3a', '#d0d3c8', '#2a2b2d', '#7a8a5a', '#c9b03a'][(rand() * 7) | 0];
    g.fillRect(X(DUMP_X + rand() * (MAP.x1 - DUMP_X)), Z(MAP.z0 + rand() * (MAP.z1 - MAP.z0)), 1 + ((rand() * 2) | 0), 1);
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
  // One shack: walls patched together from sheets of corrugated metal in
  // different colours (each wall two or three panels), a door gap with a
  // cloth or a plank door, a window hole with a frame, a corrugated roof
  // overhanging a little, sloping, held down with tyres and rocks, a tarp
  // patched over it; maybe a second storey, smaller, set back; a ladder.
  // face: -1 its front looks -z (north side faces... no: +z), so:
  // face = +1: the front is on its +z side; -1: on its -z side.
  function shack(x0, x1, zf, face, { h = 2.4 + rand() * 0.6, depth = 4 + rand() * 2.5, upper = false } = {}) {
    const w = x1 - x0;
    const zc = zf - (face * depth) / 2;
    const cx = (x0 + x1) / 2;
    // the walls, in panels
    const panels = Math.max(1, Math.round(w / 1.8));
    for (let k = 0; k < panels; k++) {
      const pw = w / panels;
      const px = x0 + pw * (k + 0.5);
      const ph = h - rand() * 0.2;
      const m = new THREE.Mesh(new THREE.BoxGeometry(pw + 0.02, ph, depth), K.ribMat(pw, ph, pick(SHEET)));
      m.position.set(px, ph / 2, zc);
      m.castShadow = m.receiveShadow = true;
      B.add(m);
      if (k === 0) B.solid(m);
    }
    B.block(cx, zc, w / 2, depth / 2);
    B.hitBox(cx, h / 2, zc, w, h, depth);
    // the front: a door gap (dark), its cloth or plank door; a window
    const dx = x0 + 0.6 + rand() * (w - 1.8);
    put(B.root, box(0.9, 1.8, 0.04, 0x141312), dx + 0.45, 0.9, zf + face * 0.01);
    if (rand() < 0.6) {
      const cloth = put(B.root, box(0.8, 1.5, 0.03, pick(TARP)), dx + 0.5, 1.05, zf + face * 0.04);
      cloth.rotation.z = (rand() - 0.5) * 0.15;
    } else for (let k = 0; k < 4; k++) put(B.root, box(0.2, 1.7, 0.04, pick([0x6b5640, 0x7a5f3e])), dx + 0.15 + k * 0.21, 0.85, zf + face * 0.05);
    if (w > 2.6) {
      const wx = dx + 1.6 > x1 - 0.5 ? x0 + 0.7 : dx + 1.7;
      put(B.root, box(0.8, 0.6, 0.04, rand() < 0.3 ? 0xffd28a : 0x1a1918, rand() < 0.3 ? { glow: true } : {}), wx, 1.6, zf + face * 0.02);
      put(B.root, box(0.9, 0.06, 0.08, 0x5a4636), wx, 1.27, zf + face * 0.05);
    }
    // the roof: corrugated sheets sloping back, overhanging the front
    const roof = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, 0.06, depth + 0.8), K.ribMat(w, depth, pick([0x7a5a42, 0x6a6e72, 0x8a5a3a, 0x5a5e62])));
    roof.position.set(cx, h + 0.15, zc + face * 0.2);
    roof.rotation.x = face * 0.12;
    roof.castShadow = true;
    B.add(roof);
    if (rand() < 0.5) put(B.root, box(1 + rand() * 1.5, 0.04, 1 + rand(), pick(TARP)), cx + (rand() - 0.5) * w * 0.4, h + 0.22, zc).rotation.x = face * 0.12;
    for (let k = 0; k < 2 + rand() * 3; k++) {
      const tx = x0 + 0.3 + rand() * (w - 0.6);
      const tz = zc + (rand() - 0.5) * depth * 0.7;
      if (rand() < 0.5) put(B.root, cyl(0.28, 0.14, 0x1d1e20, { seg: 8 }), tx, h + 0.3, tz);
      else B.piece(0.3, 0.2, 0.3, 0x6a6458, tx, h + 0.28, tz, rand(), rand() * 3, 0);
    }
    if (rand() < 0.3) B.lump(cx + (rand() - 0.5) * w * 0.3, h + 0.22, zc, w / 6, 0.04, depth / 7, 0xb7b5ad); // old snow on it
    // a second storey, smaller, set back; a ladder up
    if (upper) {
      const uw = w * (0.5 + rand() * 0.35);
      const ux = x0 + rand() * (w - uw) + uw / 2;
      const ud = depth * 0.7;
      const uz = zc - face * depth * 0.1;
      const uh = 2.1;
      const m = new THREE.Mesh(new THREE.BoxGeometry(uw, uh, ud), K.ribMat(uw, uh, pick(SHEET)));
      m.position.set(ux, h + 0.2 + uh / 2, uz);
      m.castShadow = m.receiveShadow = true;
      B.add(m);
      put(B.root, box(0.7, 0.5, 0.04, 0x1a1918), ux, h + 1.4, uz + face * (ud / 2 + 0.01));
      const r2 = new THREE.Mesh(new THREE.BoxGeometry(uw + 0.4, 0.06, ud + 0.6), K.ribMat(uw, ud, pick([0x7a5a42, 0x6a6e72, 0x8a5a3a])));
      r2.position.set(ux, h + 0.2 + uh + 0.12, uz);
      r2.rotation.x = -face * 0.1;
      r2.castShadow = true;
      B.add(r2);
      // the ladder against the front
      const lx = ux + (rand() < 0.5 ? -1 : 1) * (uw / 2 + 0.3);
      for (const dz of [-0.2, 0.2]) {
        const rail = put(B.root, box(0.06, h + 0.6, 0.06, 0x6b5640), lx + dz, (h + 0.6) / 2, zf + face * 0.25);
        rail.rotation.x = -face * 0.12;
      }
      for (let y = 0.4; y < h + 0.4; y += 0.4) put(B.root, box(0.46, 0.04, 0.05, 0x6b5640), lx, y, zf + face * (0.25 - y * 0.06));
      if (rand() < 0.5) {
        // a satellite dish on top
        const d = put(B.root, cyl(0.35, 0.08, 0xd8d6d0, { seg: 10, radiusEnd: 0.15 }), ux, h + uh + 0.7, uz);
        d.rotation.z = 1.0;
      }
    }
    // things against the front: a crate, a bucket, a jerry can, a chair
    if (rand() < 0.6) B.piece(0.5, 0.4, 0.4, pick([0x7a5f3e, 0x2f6fb0, 0xb03a3a, 0xc9b03a]), x0 + rand() * w, 0.2, zf + face * 0.4, 0, rand(), 0);
    if (rand() < 0.4) put(B.root, cyl(0.16, 0.3, pick([0x2f6fb0, 0xd0702a, 0x8a8f96]), { seg: 8 }), x0 + rand() * w, 0.15, zf + face * 0.5);
  }
  // a row of shacks along a line, each its own width, squeezed in, alleys
  // here and there; returns the alleys' x's
  function shackRow(xa, xb, zf, face, { upper = 0, skip = () => false } = {}) {
    const gaps = [];
    let x = xa;
    while (x < xb - 1.5) {
      const w = 2.6 + rand() * 3.4;
      const x1 = Math.min(xb, x + w);
      if (!skip(x, x1)) shack(x, x1, zf + face * (rand() - 0.5) * 0.5, face, { upper: rand() < upper });
      x = x1;
      if (rand() < 0.22) {
        gaps.push(x + 0.8);
        x += 1.6; // an alley
      }
    }
    return gaps;
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
  shackRow(MARKET.x0, MARKET.x1, MARKET.n, 1, { upper: 0.5 });
  shackRow(MARKET.x0, MARKET.x1, MARKET.s, -1, { upper: 0.05 });
  for (const s of [-1, 1]) {
    // the square's corners: shacks closing it in either side of the road
    for (const x of [MARKET.x0, MARKET.x1]) {
      const za = s < 0 ? MARKET.n : FRONT.s;
      const zb = s < 0 ? FRONT.n : MARKET.s;
      B.block(x, (za + zb) / 2, 0.6, Math.abs(zb - za) / 2);
      put(B.root, box(1.2, 2.4, Math.abs(zb - za), pick(SHEET), { r: 0.02 }), x, 1.2, (za + zb) / 2).castShadow = true;
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
    put(B.root, box(w, h, d, pick(SHEET), { r: 0.02 }), x, h / 2, z);
    const rf = put(B.root, box(w + 0.3, 0.06, d + 0.4, pick([0x7a5a42, 0x6a6e72, 0x8a5a3a, 0x5a5e62, 0x9a3a2e])), x, h + 0.1, z);
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
      if (Math.abs(x - RAIL_X) < 4) continue;
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
    const R = rails(B, rand, { gauge: 0.72 });
    for (const [z0, z1] of [[MARKET.n - 30, -6], [-2, 3], [7, MARKET.s + 30]]) R.track(R.straight(RAIL_X, z0, RAIL_X, z1));
    for (let z = MARKET.n - 30; z < MARKET.s + 30; z += 0.9) if (rand() > 0.2 && !(z > -6 && z < -2) && !(z > 3 && z < 7)) B.piece(2.4, 0.1, 0.22, 0x4a3a2e, RAIL_X, 0.04, z, 0, 0, 0); // sleepers
    for (const z of [-4, 5]) {
      ST.rubble(RAIL_X + (rand() - 0.5), z, 1.6, 0.5);
      for (let k = 0; k < 2; k++) {
        const bent = put(B.root, box(0.07, 0.07, 2.4, 0x8d9196), RAIL_X + (k ? 0.72 : -0.72), 0.5, z);
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
  {
    // hills of rubbish going away, wrecks stacked three high, a crane with
    // its jib down, a bulldozer abandoned, flocks of plastic
    for (let i = 0; i < 26; i++) {
      const x = DUMP_X + 10 + rand() * (END_X - DUMP_X);
      const z = (rand() < 0.5 ? -1 : 1) * (10 + rand() * 24);
      const r = 2.5 + rand() * 4;
      for (let k = 0; k < r * 6; k++) {
        const a = rand() * Math.PI * 2;
        const d = Math.sqrt(rand()) * r;
        B.lump(x + Math.cos(a) * d, (1 - d / r) * r * 0.5, z + Math.sin(a) * d * 0.8, 0.6 + rand() * 0.8, 0.4 + rand() * 0.5, 0.6 + rand() * 0.7, pick([0x5a5e62, 0x3a3c3f, 0x6a6458, 0x2f4f7a, 0x7a5a42, 0xd8d6d0]), rand() * 3);
      }
      B.block(x, z, r * 0.7, r * 0.55);
    }
    for (const [x, z] of [[232, -9], [252, 10], [276, -10]]) {
      for (let k = 0; k < 3; k++) {
        const c = P.car(B, x + (rand() - 0.5) * 0.4, z + (rand() - 0.5) * 0.3, rand() * 0.3, { kind: pick(['sedan', 'hatch']), paint: pick(BURNT_PAINT), snow: false, solidBlock: k === 0 });
        c.position.y = k * 1.25;
      }
    }
    // the crane: a lattice boom down on the heaps, its cab rusted
    const cx = 262;
    const cz = -16;
    put(B.root, box(3, 1.4, 2.4, 0x8a6a3a, { r: 0.04 }), cx, 1.2, cz).castShadow = true;
    for (const s of [-1, 1]) put(B.root, box(3.4, 0.6, 0.5, 0x2a2b2d), cx, 0.3, cz + s * 1.1);
    const jib = new THREE.Group();
    jib.position.set(cx + 1, 2, cz);
    jib.rotation.z = 0.35;
    for (const [dy, dz] of [[0, -0.3], [0, 0.3], [0.5, 0]]) put(jib, box(12, 0.1, 0.1, 0xb08a3a), 6, dy, dz);
    for (let k = 0; k < 12; k++) put(jib, box(0.06, 0.6, 0.06, 0xb08a3a), 0.5 + k, 0.25, 0).rotation.x = k % 2 ? 0.5 : -0.5;
    B.add(jib);
    B.block(cx, cz, 1.8, 1.4);
    // the road on out over the dump: tyre ruts, then the open
    for (let x = DUMP_X; x < MAP.x1 - 4; x += 1.2) for (const z of [-1.4, 1.4]) if (rand() < 0.7) B.lump(x, 0.02, z + (rand() - 0.5) * 0.3, 0.5, 0.05, 0.14, 0x4a4036);
    ST.barrelFire(240, 4.6);
    ST.barrelFire(268, -5);
    trash(226, -3.5, 1.4);
    trash(258, 5, 1.6);
    trash(284, -2, 1.2);
    // the edges: fences of sheet metal and a burning heap off to the side
    for (const s of [-1, 1]) for (let x = DUMP_X; x < MAP.x1 - 6; x += 2.4) {
      const z = s * (8 + Math.sin(x / 13) * 1.5);
      const fh = 2.2 + rand() * 0.4;
      const f = new THREE.Mesh(new THREE.BoxGeometry(2.3, fh, 0.06), K.ribMat(2.3, fh, pick(SHEET)));
      f.position.set(x + 1.2, fh / 2, z);
      f.castShadow = true;
      B.add(f);
      f.rotation.z = (rand() - 0.5) * 0.12;
      if (rand() < 0.1) f.rotation.x = s * 0.6;
    }
    for (const s of [-1, 1]) B.block((DUMP_X + MAP.x1) / 2, s * 8.5, (MAP.x1 - DUMP_X) / 2, 0.6);
    const fx = 248;
    const fz = -18;
    const fire = B.emit(new THREE.Vector3(fx, 2, fz), 0xff8a35, 20, 12);
    const flames = [0, 1, 2, 3].map((i) => {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.6 - i * 0.1, 2, 6), glowMat([0xffb347, 0xffd27a, 0xff8a35, 0xff6a2a][i]));
      f.position.set(fx + (i - 1.5) * 0.6, 1.5, fz + (i % 2) * 0.5);
      B.add(f);
      B.keep(f);
      return f;
    });
    let carry = 0;
    B.animate((dt, t, ctx) => {
      flames.forEach((f, i) => f.scale.set(1, 0.7 + Math.sin(t * (9 + i * 2) + i) * 0.3, 1));
      fire.level = 0.8 + Math.sin(t * 11) * 0.15;
      carry += dt * 10;
      while (carry > 1 && ctx?.combat) {
        carry -= 1;
        ctx.combat.puffs.spawn(new THREE.Vector3(fx + (rand() - 0.5) * 2, 2.6, fz), new THREE.Vector3(0.5, 1.6 + rand(), 0.2), { color: rand() < 0.5 ? 0x2a2a2e : 0x3a3a3e, s0: 0.4, s1: 1.4, life: 3, drag: 0.2, lift: 0.3, fadeAt: 0.4 });
      }
    });
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
  const B1 = { minX: START_X + 2, maxX: shackA.x0 - 0.8, ...ROADB };
  const B2 = { minX: shackA.x1 + 1.2, maxX: shackB.x0 - 0.8, ...ROADB };
  const B3 = { minX: shackB.x1 + 1.2, maxX: END_X + 6, minZ: -7.4, maxZ: 7.4 };
  const S = { sector: 0, step: 0, t: 0 };
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
    spawn(ax, s * 12, { delay, via: [[ax, s * 3]], noclip: true });
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

  // 3: the dump, and the road out
  function startSector3(api) {
    S.sector = 2;
    go(0);
    setBounds(api, { ...B3, maxX: 226, ...ROADB });
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
          setBounds(api, { maxX: B3.maxX });
          go(1);
        }
        break;
      case 1:
        if (x > 232) {
          api.spawnArty(258, -3, { yaw: Math.PI, hpScale: 0.35 });
          api.spawnWalker(ahead(api, 252, 262), 4, { delay: 0.5 });
          drone(api, 250, 262, 1);
          go(2);
        }
        break;
      case 2:
        if (x > 252) {
          for (const d of [0, 0.3, 0.6, 0.9]) api.spawnDog(ahead(api, 274, 286), (rand() - 0.5) * 10, { delay: d });
          api.spawnWalker(ahead(api, 280, 290), -4, { delay: 0.6 });
          api.spawnWalker(ahead(api, 282, 292), 4, { delay: 1.1 });
          go(3);
        }
        break;
      case 3:
        if (api.enemiesAlive === 0 && S.t > 2) {
          api.objective('Out of the slums');
          api.arrow(new THREE.Vector3(END_X, 1, 0), 'Exit');
          api.cameraTo(new THREE.Vector3(END_X, 0, 0), 2);
          go(4);
        }
        break;
      case 4:
        if (x > END_X - 4) {
          api.arrow(null);
          api.sectors(SECTORS, 3, 'Level 7');
          setBounds(api, { maxX: MAP.x1 + 200 });
          api.win('Level clear', { path: [[END_X + 10, 0], [END_X + 120, 0]] });
          go(5);
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
    if (S.step < 3) {
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
    heightAt: () => 0,
    spawn: { x: START_X + 5, z: -0.5, yaw: 0 },
    bounds,
    script: S,
    shacks: [shackA, shackB],
    start,
    update,
    skipStage,
  };
}
